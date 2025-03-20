const axios = require('axios');
const { EventEmitter } = require('events');
const { ALCHEMY_API_KEY, VERIFICATION_AMOUNT, VERIFICATION_WALLET } = require('../config');

const blockchainEvents = new EventEmitter();
const url = `https://monad-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

let lastCheckedBlock = null;
let isMonitoring = false;
let monitoringPromise = null;

// Map to store wallets we're monitoring
const monitoredWallets = new Map();

// Convert MON to smallest unit
function toWei(amount) {
  return BigInt(Math.floor(amount * 10**18)).toString();
}

// Convert from smallest unit to MON
function fromWei(amount) {
  // Handle string inputs by converting to BigInt first
  if (typeof amount === 'string') {
    if (amount.startsWith('0x')) {
      amount = BigInt(amount);
    } else {
      amount = BigInt(amount);
    }
  }
  
  // Ensure we're working with BigInt for the division
  const divisor = BigInt(10**18);
  const result = Number(amount) / Number(divisor);
  return result;
}

async function makeRpcRequest(method, params) {
  try {
    const response = await axios.post(url, {
      jsonrpc: "2.0",
      id: 1,
      method: method,
      params: params
    });

    return response.data.result;
  } catch (error) {
    console.error("RPC Error:", error.response ? error.response.data : error.message);
    return null;
  }
}

async function checkLatestBlock() {
  const latestBlockHex = await makeRpcRequest("eth_blockNumber", []);
  if (!latestBlockHex) return null;
  return parseInt(latestBlockHex, 16);
}

// Start monitoring a specific wallet
async function startMonitoringWallet(walletAddress, timeout = 10 * 60 * 1000) {
  walletAddress = walletAddress.toLowerCase();
  
  // Don't monitor if already being monitored
  if (monitoredWallets.has(walletAddress)) {
    return;
  }
  
  console.log(`Starting to monitor wallet ${walletAddress} for verification`);
  
  // Add to monitored wallets
  monitoredWallets.set(walletAddress, {
    startTime: Date.now(),
    timeout: timeout
  });
  
  // Start monitoring if not already running
  if (!isMonitoring) {
    await startMonitoring();
  }
  
  // Set timeout to stop monitoring this wallet
  setTimeout(() => {
    if (monitoredWallets.has(walletAddress)) {
      console.log(`Verification timed out for wallet ${walletAddress}`);
      monitoredWallets.delete(walletAddress);
      
      // If no more wallets to monitor, stop the blockchain monitoring
      if (monitoredWallets.size === 0 && isMonitoring) {
        stopMonitoring();
      }
    }
  }, timeout);
}

async function processBlock(blockNumber) {
  const blockHex = "0x" + blockNumber.toString(16);
  const blockData = await makeRpcRequest("eth_getBlockByNumber", [blockHex, true]);
  
  if (!blockData || !blockData.transactions) return;
  
  // Process all transactions in parallel
  const processingPromises = blockData.transactions.map(async tx => {
    // Check if transaction is from a monitored wallet
    if (tx.from && monitoredWallets.has(tx.from.toLowerCase()) && 
        tx.to && tx.to.toLowerCase() === VERIFICATION_WALLET.toLowerCase()) {
      try {
        // Safe conversion of the value
        const amount = fromWei(tx.value);
        const expectedAmount = parseFloat(VERIFICATION_AMOUNT);
        
        // Check if amount matches with reasonable tolerance
        if (Math.abs(amount - expectedAmount) < 0.0001) {
          console.log(`✅ Wallet verification successful for ${tx.from.toLowerCase()}`);
          
          // Emit event with transaction details
          blockchainEvents.emit('verificationTx', {
            from: tx.from.toLowerCase(),
            amount: amount,
            txHash: tx.hash,
            timestamp: new Date()
          });
          
          // Stop monitoring this wallet
          monitoredWallets.delete(tx.from.toLowerCase());
        }
      } catch (error) {
        console.error(`Error processing transaction value`);
      }
    }
  });
  
  // Wait for all transaction processing to complete
  await Promise.all(processingPromises);
}

async function continuousBlockMonitoring() {
  // If monitoring is stopped or no wallets to monitor, exit the loop
  if (!isMonitoring) {
    console.log("Monitoring stopped");
    return;
  }

  if (monitoredWallets.size === 0) {
    console.log("No wallets to monitor, stopping blockchain monitoring");
    isMonitoring = false;
    return;
  }

  try {
    const latestBlockNumber = await checkLatestBlock();
    if (!latestBlockNumber) {
      // Try again immediately if we couldn't get the latest block
      continuousBlockMonitoring();
      return;
    }
    
    if (!lastCheckedBlock) {
      lastCheckedBlock = latestBlockNumber;
      console.log(`Started blockchain monitoring`);
    }
    
    if (latestBlockNumber > lastCheckedBlock) {
      // Process multiple blocks in parallel
      const blockPromises = [];
      for (let block = lastCheckedBlock + 1; block <= latestBlockNumber; block++) {
        blockPromises.push(processBlock(block));
      }
      await Promise.all(blockPromises);
      
      lastCheckedBlock = latestBlockNumber;
    }
    
    // Continue immediately without delay
    setImmediate(continuousBlockMonitoring);
  } catch (error) {
    console.error("Error monitoring blockchain:", error);
    // Continue monitoring immediately even after error
    setImmediate(continuousBlockMonitoring);
  }
}

async function startMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  lastCheckedBlock = null; // Reset to get current block when starting
  
  // Start the continuous monitoring process
  continuousBlockMonitoring();
  console.log("Blockchain monitoring started");
}

function stopMonitoring() {
  isMonitoring = false;
  console.log("Blockchain monitoring stopped");
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  startMonitoringWallet,
  blockchainEvents,
  makeRpcRequest
};