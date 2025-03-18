const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { VERIFICATION_AMOUNT, VERIFICATION_WALLET, VERIFICATION_CURRENCY } = require('../config');

module.exports = {
  name: 'setupVerificationChannel',
  async execute(guild, client) {
    // Check if verification channel already exists
    let verifyChannel = guild.channels.cache.find(channel => 
      channel.name === '💳┃wallet-verification' && channel.type === ChannelType.GuildText
    );
    
    // Create the channel if it doesn't exist
    if (!verifyChannel) {
      console.log(`Creating 💳┃wallet-verification channel in guild: ${guild.name}`);
      
      // Create channel with specific permissions
      verifyChannel = await guild.channels.create({
        name: '💳┃wallet-verification',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages]
          },
          {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ]
      });
    }
    
    // Clear the channel
    const messages = await verifyChannel.messages.fetch({ limit: 10 });
    if (messages.size > 0) {
      await verifyChannel.bulkDelete(messages);
    }
    
    // Create buttons for verification
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verify_wallet')
          .setLabel('Verify Wallet')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('view_wallet')
          .setLabel('View My Wallet')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('check_verification_status')
          .setLabel('Check Verification Status')
          .setStyle(ButtonStyle.Success)
      );
    
    // Send welcome message with buttons
    await verifyChannel.send({
      content: `# Wallet Verification\n\nUse the buttons below to manage your wallet verification:\n\n- **Verify Wallet**: Connect a new wallet or change your existing wallet\n- **View My Wallet**: Check your currently verified wallet address\n- **Check Verification Status**: See if your pending verification has completed\n\nVerification requires sending ${VERIFICATION_AMOUNT} ${VERIFICATION_CURRENCY} to complete.`,
      components: [row]
    });
    
    console.log(`Verification channel setup complete for guild: ${guild.name}`);
  }
};