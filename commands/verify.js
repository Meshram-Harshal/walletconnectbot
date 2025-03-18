const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { findPendingWalletByUserId, findVerifiedWalletByUserId } = require('../services/database');
const { VERIFICATION_AMOUNT, VERIFICATION_WALLET, VERIFICATION_CURRENCY } = require('../config');

module.exports = {
  name: '!verify',
  async execute(message, args, client) {
    const userId = message.author.id;
    
    // Check if the user already has a pending verification
    const pendingWallet = await findPendingWalletByUserId(userId);
    if (pendingWallet) {
      return message.reply({
        content: `You already have a pending verification for wallet address ${pendingWallet.walletAddress}. Please complete that verification first or wait for it to expire.`,
        ephemeral: true
      });
    }
    
    // Check if the user already has a verified wallet - MODIFIED TO SHOW OPTIONS
    const verifiedWallet = await findVerifiedWalletByUserId(userId);
    
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
      );
    
    // Send the verification message with buttons
    let content = 'Please choose an option:';
    
    // If user already has a verified wallet, modify the message
    if (verifiedWallet) {
      content = `You already have a verified wallet address: ${verifiedWallet.walletAddress}\n\nClick "Verify Wallet" to change your wallet or "View My Wallet" to view details.`;
    }
    
    await message.reply({
      content,
      components: [row]
    });
  }
};