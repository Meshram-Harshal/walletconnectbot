require('dotenv').config(); // Add this at the very top
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { connectToDatabase } = require('./services/database');
const { TOKEN } = require('./config');
const express = require('express');

// Create a new client instance with minimum required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Disable presence updates to reduce resource usage
  presence: {
    status: 'dnd' // "Do Not Disturb" uses less resources than "online"
  },
  // Reduce max reconnection attempts
  ws: {
    large_threshold: 50, // Default is 50, reducing if your server is small
  }
});

client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.name, command);
}

// Load event files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Connect to MongoDB
connectToDatabase()
  .then(() => {
    console.log('Connected to MongoDB');
    // Login to Discord
    client.login(TOKEN);
  })
  .catch(error => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });

  const app = express();
const PORT = 4000;

// Basic route
app.get('/', (req, res) => {
  res.send('Discord Bot is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});