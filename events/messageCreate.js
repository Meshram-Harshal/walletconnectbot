module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    
    const args = message.content.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Check if the message is the !verify command
    if (commandName === '!verify') {
      const command = client.commands.get('!verify');
      if (command) {
        try {
          // Pass the message object which contains the channel ID
          await command.execute(message, args, client);
        } catch (error) {
          console.error(error);
          await message.reply('There was an error trying to execute that command!');
        }
      }
    }
  }
};