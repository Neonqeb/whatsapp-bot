const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { OpenAI } = require('openai');
const fs = require('fs');

// Load environment variables from .env file if available
require('dotenv').config();

// Set your OpenAI API key here or in a .env file as OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const sender = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

      // Simple command: Respond to "ai:" messages only
      if (text && text.toLowerCase().startsWith('ai:')) {
        const prompt = text.slice(3).trim();
        try {
          const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-3.5-turbo',
          });

          const reply = completion.choices[0].message.content;
          await sock.sendMessage(sender, { text: reply });
        } catch (e) {
          await sock.sendMessage(sender, { text: 'Error: Could not get AI response.' });
        }
      }
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    }
  });
}

startBot();