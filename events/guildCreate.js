const setupVerificationChannel = require('./setupVerificationChannel');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    console.log(`Bot joined a new guild: ${guild.name}`);
    
    // Set up verification channel in the new guild
    try {
      await setupVerificationChannel.execute(guild, client);
    } catch (error) {
      console.error(`Error setting up verification channel in new guild ${guild.name}:`, error);
    }
  }
};