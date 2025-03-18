module.exports = {
  // Discord Bot Token
  TOKEN: process.env.DISCORD_TOKEN,

  // MongoDB Connection String
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Blockchain Configuration
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
  VERIFICATION_AMOUNT: 0.01,
  VERIFICATION_CURRENCY: 'MON',
  VERIFICATION_WALLET: '0x5571d64E92b6307db6ed15192F61dbE461B0a6Ae',
  
  // Verification Timeout (in milliseconds)
  VERIFICATION_TIMEOUT: 10 * 60 * 1000, // 10 minutes
};