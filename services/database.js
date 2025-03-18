const { MongoClient } = require('mongodb');
const { MONGODB_URI } = require('../config');

let client;
let db;

async function connectToDatabase() {
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('wallet_verification');
  
  // Create collections if they don't exist
  await db.createCollection('pending_wallets');
  await db.createCollection('verified_wallets');
  
  // Create indexes for faster lookups
  await db.collection('pending_wallets').createIndex({ walletAddress: 1 }, { unique: true });
  await db.collection('pending_wallets').createIndex({ userId: 1 }, { unique: true });
  await db.collection('pending_wallets').createIndex({ timestamp: 1 });
  
  await db.collection('verified_wallets').createIndex({ walletAddress: 1 }, { unique: true });
  await db.collection('verified_wallets').createIndex({ userId: 1 }, { unique: true });
  
  return db;
}

async function getDatabase() {
  if (!db) {
    await connectToDatabase();
  }
  return db;
}

async function addPendingWallet(userId, username, walletAddress, channelId) {
  const db = await getDatabase();
  const timestamp = new Date();
  
  await db.collection('pending_wallets').insertOne({
    userId,
    username,
    walletAddress: walletAddress.toLowerCase(),
    channelId, // Store the channel ID where verification was initiated
    timestamp
  });
}

async function findPendingWallet(walletAddress) {
  const db = await getDatabase();
  return await db.collection('pending_wallets').findOne({ 
    walletAddress: walletAddress.toLowerCase() 
  });
}

async function findVerifiedWallet(walletAddress) {
  const db = await getDatabase();
  return await db.collection('verified_wallets').findOne({ 
    walletAddress: walletAddress.toLowerCase() 
  });
}

async function findPendingWalletByUserId(userId) {
  const db = await getDatabase();
  return await db.collection('pending_wallets').findOne({ userId });
}

async function findVerifiedWalletByUserId(userId) {
  const db = await getDatabase();
  return await db.collection('verified_wallets').findOne({ userId });
}

async function verifyWallet(userId) {
  const db = await getDatabase();
  
  // Find the pending wallet
  const pendingWallet = await db.collection('pending_wallets').findOne({ userId });
  
  if (!pendingWallet) {
    return null;
  }
  
  // Move to verified wallets
  await db.collection('verified_wallets').insertOne({
    userId: pendingWallet.userId,
    username: pendingWallet.username,
    walletAddress: pendingWallet.walletAddress,
    channelId: pendingWallet.channelId, // Preserve the channel ID
    verifiedAt: new Date()
  });
  
  // Remove from pending wallets
  await db.collection('pending_wallets').deleteOne({ userId });
  
  return pendingWallet;
}

async function removeVerifiedWallet(userId) {
  const db = await getDatabase();
  await db.collection('verified_wallets').deleteOne({ userId });
}

async function removePendingWallet(userId) {
  const db = await getDatabase();
  await db.collection('pending_wallets').deleteOne({ userId });
}

async function cleanupExpiredPendingWallets(timeoutMs) {
  const db = await getDatabase();
  const cutoffTime = new Date(Date.now() - timeoutMs);
  
  const result = await db.collection('pending_wallets').deleteMany({
    timestamp: { $lt: cutoffTime }
  });
  
  return result.deletedCount;
}

module.exports = {
  connectToDatabase,
  getDatabase,
  addPendingWallet,
  findPendingWallet,
  findVerifiedWallet,
  findPendingWalletByUserId,
  findVerifiedWalletByUserId,
  verifyWallet,
  removePendingWallet,
  removeVerifiedWallet,
  cleanupExpiredPendingWallets
};