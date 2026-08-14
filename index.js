const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

// Panggil handler game yang sudah kita buat
require('./handlers/game')(bot);

// Endpoint webhook untuk Vercel
app.post(`/api/telegram`, (req, res) => {
    bot.handleUpdate(req.body, res);
});

app.get('/', (req, res) => {
    res.send('Bot ABC 5 Dasar is running!');
});

// Penting untuk Vercel: Export module express
module.exports = app;

// Jika dijalankan secara lokal (bukan di Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => {
        console.log('Bot berjalan secara lokal di port 3000');
    });
}