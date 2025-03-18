const { startMonitoring, blockchainEvents } = require('../services/blockchain');
const { 
  cleanupExpiredPendingWallets,
  verifyWallet, 
  removePendingWallet,
  findPendingWallet
} = require('../services/database');
const { VERIFICATION_TIMEOUT } = require('../config');
const setupVerificationChannel = require('./setupVerificationChannel');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Set up verification channel in all guilds the bot is in
    client.guilds.cache.forEach(async (guild) => {
      try {
        await setupVerificationChannel.execute(guild, client);
      } catch (error) {
        console.error(`Error setting up verification channel in ${guild.name}:`, error);
      }
    });
    
    // Set up event listener for verification transactions
    blockchainEvents.on('verificationTx', async (txData) => {
      const pendingWallet = await findPendingWallet(txData.from);
      
      if (pendingWallet) {
        console.log(`Wallet verified for user ${pendingWallet.username}`);
        
        // Store in verified wallets collection and remove from pending
        await verifyWallet(pendingWallet.userId);
        
        // We don't send any notifications - users will check status with the button
      }
    });
    
    // Set up interval to clean up expired pending verifications
    setInterval(async () => {
      const deletedCount = await cleanupExpiredPendingWallets(VERIFICATION_TIMEOUT);
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired pending wallet verifications`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
};