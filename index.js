require('dotenv').config();
const { Telegraf } = require('telegraf');

// Panggil kredensial token
const botToken = process.env.BOT_TOKEN;
const bot = new Telegraf(botToken);

// Panggil module handlers
const setupSecurity = require('./handlers/security');
const setupGame = require('./handlers/game');

// Inisialisasi fitur ke dalam bot
setupSecurity(bot);
setupGame(bot);

// Nyalakan bot
bot.launch().then(() => {
    console.log('✅ Bot ABC 5 Dasar menyala dengan struktur modular yang rapi!');
});

// Fitur keamanan untuk mematikan bot
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));