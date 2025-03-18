const { 
  ModalBuilder, 
  TextInputBuilder, 
  ActionRowBuilder, 
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { 
  findPendingWallet, 
  findVerifiedWallet, 
  addPendingWallet,
  findPendingWalletByUserId,
  findVerifiedWalletByUserId,
  removePendingWallet,
  removeVerifiedWallet
} = require('../services/database');
const { startMonitoringWallet } = require('../services/blockchain');
const { VERIFICATION_AMOUNT, VERIFICATION_WALLET, VERIFICATION_CURRENCY, VERIFICATION_TIMEOUT } = require('../config');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Handle button interactions
    if (interaction.isButton()) {
      if (interaction.customId === 'verify_wallet') {
        // Create wallet input modal
        const modal = new ModalBuilder()
          .setCustomId('wallet_input_modal')
          .setTitle('Verify Your Wallet Address');
          
        const walletAddressInput = new TextInputBuilder()
          .setCustomId('wallet_address')
          .setLabel('Enter your wallet address')
          .setPlaceholder('0x...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
          
        const firstActionRow = new ActionRowBuilder().addComponents(walletAddressInput);
        modal.addComponents(firstActionRow);
        
        await interaction.showModal(modal);
      } 
      else if (interaction.customId === 'view_wallet') {
        // Check if user has a verified wallet
        const verifiedWallet = await findVerifiedWalletByUserId(interaction.user.id);
        
        if (verifiedWallet) {
          await interaction.reply({
            content: `Your verified wallet address is: ${verifiedWallet.walletAddress}`,
            ephemeral: true
          });
        } else {
          // Check if user has a pending wallet
          const pendingWallet = await findPendingWalletByUserId(interaction.user.id);
          
          if (pendingWallet) {
            await interaction.reply({
              content: `You have a pending verification for wallet: ${pendingWallet.walletAddress}\n` +
                      `Please send exactly ${VERIFICATION_AMOUNT} ${VERIFICATION_CURRENCY} to ${VERIFICATION_WALLET} within 10 minutes to complete verification.`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: "You don't have any verified or pending wallet addresses. Please click 'Verify Wallet' to start the verification process.",
              ephemeral: true
            });
          }
        }
      }
      else if (interaction.customId === 'check_verification_status') {
        // First check if user has a verified wallet
        const verifiedWallet = await findVerifiedWalletByUserId(interaction.user.id);
        
        if (verifiedWallet) {
          const verificationTime = verifiedWallet.verifiedAt ? new Date(verifiedWallet.verifiedAt).toLocaleString() : "Unknown";
          
          await interaction.reply({
            content: `✅ **Verification Status: VERIFIED**\n\n` +
                    `Your wallet address **${verifiedWallet.walletAddress}** was successfully verified on ${verificationTime}.`,
            ephemeral: true
          });
        } else {
          // Check if user has a pending wallet
          const pendingWallet = await findPendingWalletByUserId(interaction.user.id);
          
          if (pendingWallet) {
            // Calculate how much time is left
            const startTime = new Date(pendingWallet.timestamp);
            const timeElapsed = Date.now() - startTime.getTime();
            const timeLeft = Math.max(0, VERIFICATION_TIMEOUT - timeElapsed);
            const minutesLeft = Math.floor(timeLeft / 60000);
            const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
            
            await interaction.reply({
              content: `⏳ **Verification Status: PENDING**\n\n` +
                      `Your wallet address **${pendingWallet.walletAddress}** is awaiting verification.\n\n` +
                      `Please send exactly ${VERIFICATION_AMOUNT} ${VERIFICATION_CURRENCY} to:\n` +
                      `\`${VERIFICATION_WALLET}\`\n\n` +
                      `Time remaining: ${minutesLeft} minutes, ${secondsLeft} seconds`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: `❌ **Verification Status: NOT STARTED**\n\n` +
                      `You don't have any verified or pending wallet addresses.\n` +
                      `Please click 'Verify Wallet' to start the verification process.`,
              ephemeral: true
            });
          }
        }
      }
    }
    
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'wallet_input_modal') {
        await interaction.deferReply({ ephemeral: true });
        
        const walletAddress = interaction.fields.getTextInputValue('wallet_address').trim().toLowerCase();
        
        // Validate wallet address format
        if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          return interaction.editReply({
            content: "Invalid wallet address format. Please enter a valid Ethereum-compatible wallet address starting with 0x.",
            ephemeral: true
          });
        }
        
        // Check if user has a verified wallet - we need to remove it before proceeding
        const userVerifiedWallet = await findVerifiedWalletByUserId(interaction.user.id);
        if (userVerifiedWallet) {
          await removeVerifiedWallet(interaction.user.id);
        }
        
        try {
          // Check if user already has this exact wallet address in pending verification
          const userPendingWallet = await findPendingWalletByUserId(interaction.user.id);
          if (userPendingWallet && userPendingWallet.walletAddress === walletAddress) {
            // Remove the existing pending wallet for this user to avoid duplicate key error
            await removePendingWallet(interaction.user.id);
            console.log(`Removed existing pending wallet for user ${interaction.user.id} to avoid duplicate entry`);
          }
          
          // Check if this exact wallet is already pending verification by someone else
          const existingPending = await findPendingWallet(walletAddress);
          if (existingPending && existingPending.userId !== interaction.user.id) {
            return interaction.editReply({
              content: "Someone else is currently trying to verify this wallet address. If this is your wallet, please try again after 10 minutes.",
              ephemeral: true
            });
          }
          
          // Check if this wallet is already verified by someone else
          const existingVerified = await findVerifiedWallet(walletAddress);
          if (existingVerified && existingVerified.userId !== interaction.user.id) {
            return interaction.editReply({
              content: "This wallet address is already verified by someone else. If you feel this wallet address is yours, please create an issue in the bug report channel.",
              ephemeral: true
            });
          }
          
          // Store in pending wallets collection
          await addPendingWallet(
            interaction.user.id, 
            interaction.user.tag, 
            walletAddress,
            interaction.channelId // Store the channel ID where verification was initiated
          );
          
          // Start monitoring this wallet
          await startMonitoringWallet(walletAddress, VERIFICATION_TIMEOUT);
          
          // Respond with verification instructions
          await interaction.editReply({
            content: `Your wallet address \`${walletAddress}\` has been registered for verification.\n\n` +
                     `To complete verification, please send exactly ${VERIFICATION_AMOUNT} ${VERIFICATION_CURRENCY} to:\n` +
                     `\`${VERIFICATION_WALLET}\`\n\n` +
                     `You have 10 minutes to complete this transaction. Once confirmed, your wallet will be verified automatically.\n\n` +
                     `Click the "Check Verification Status" button anytime to see if your verification has been completed.`,
            ephemeral: true
          });
          
          // Set up timeout to check if verification was completed
          setTimeout(function() {
            (async () => {
              const stillPending = await findPendingWalletByUserId(interaction.user.id);
              if (stillPending && stillPending.walletAddress === walletAddress) {
                // Verification timed out, remove from pending
                await removePendingWallet(interaction.user.id);
              }
            })();
          }, VERIFICATION_TIMEOUT);
          
        } catch (error) {
          console.error("Database error:", error);
          await interaction.editReply({
            content: "There was an error processing your verification. Please try again later.",
            ephemeral: true
          });
        }
      }
    }
    
    // Handle message commands
    else if (interaction.isCommand) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: 'There was an error executing this command!',
          ephemeral: true
        });
      }
    }
  }
};