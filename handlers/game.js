const supabase = require('../config/database');
const { countries } = require('countries-list');
const { City } = require('country-state-city');

// Load modul kamus lokal untuk tema khusus
const hewanList = require('../temagame/hewan');
const tumbuhanList = require('../temagame/tumbuhan');
const brandList = require('../temagame/brand');
const bendaList = require('../temagame/bendarumah');

const LIST_TEMEMA = [
    'Negara', 'Kota / Kabupaten', 'Hewan / Binatang', 
    'Tumbuhan', 'Brand / Merek', 'Benda di Rumah'
];

const activeLobbyTimers = new Map();

// --- FUNGSI VALIDASI CERDAS BERDASARKAN TEMA ---
function validasiJawabanTema(tema, jawabanUser) {
    const cleanAnswer = jawabanUser.toLowerCase().trim();
    const temaLower = tema.toLowerCase();

    if (temaLower.includes('negara')) {
        const allCountries = Object.values(countries).map(c => c.name.toLowerCase());
        // Tambahkan alternatif nama umum dalam bahasa Indonesia
        const extraCountries = ['amerika serikat', 'inggris', 'belanda', 'jepang', 'korea selatan', 'china', 'tiongkok'];
        return allCountries.includes(cleanAnswer) || extraCountries.includes(cleanAnswer);
    } 
    else if (temaLower.includes('kota') || temaLower.includes('kabupaten')) {
        const allCities = City.getAllCities().map(c => c.name.toLowerCase());
        const kotaLokal = ['jakarta', 'bandung', 'surabaya', 'indramayu', 'cirebon', 'bogor', 'medan', 'yogyakarta', 'semarang', 'bekasi', 'depok', 'tangerang'];
        return allCities.includes(cleanAnswer) || kotaLokal.includes(cleanAnswer);
    } 
    else if (temaLower.includes('hewan') || temaLower.includes('binatang')) {
        return hewanList.map(h => h.toLowerCase()).includes(cleanAnswer);
    } 
    else if (temaLower.includes('tumbuhan')) {
        return tumbuhanList.map(t => t.toLowerCase()).includes(cleanAnswer);
    } 
    else if (temaLower.includes('brand') || temaLower.includes('merek')) {
        return brandList.map(b => b.toLowerCase()).includes(cleanAnswer);
    } 
    else if (temaLower.includes('benda di rumah')) {
        return bendaList.map(b => b.toLowerCase()).includes(cleanAnswer);
    }

    // Jika tema kustom bebas yang dibuat pemain lain, loloskan asal lolos huruf awal & panjang
    return true;
}

module.exports = (bot) => {
    // --- 1. MODE: /mainabcacak ---
    bot.command('mainabcacak', async (ctx) => {
        if (ctx.chat.type === 'private') return ctx.reply('⚠️ Perintah ini hanya bisa digunakan di dalam grup!');
        const chatId = ctx.chat.id;

        try {
            const { data: existingGame } = await supabase
                .from('active_games')
                .select('*')
                .eq('chat_id', chatId)
                .maybeSingle();

            if (existingGame) {
                return ctx.reply('⚠️ Ada yang main jir! Tunggu sesi selesai dulu atau ketik /stopaksakumas (khusus admin).');
            }

            const { error } = await supabase
                .from('active_games')
                .insert([{
                    chat_id: chatId,
                    status: 'menunggu_pemain',
                    players: [],
                    custom_theme: null,
                    current_turn_index: 0
                }]);

            if (error) throw error;

            const lobiText = 
                '🎲 **LOBI ABC 5 DASAR (MODE ACAK)** 🎲\n\n' +
                'Ayo siapa saja yang mau ikut main? (Minimal 2 orang)\n' +
                'Klik tombol di bawah untuk bergabung!\n\n' +
                '👥 **Daftar Pemain (0):**\n_Belum ada pemain._\n\n' +
                '⏳ *Waktu pendaftaran: 60 detik.*\n' +
                '💡 *Admin bisa ketik /mulaisekaranganjir*';

            const lobiMessage = await ctx.reply(lobiText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '✋ Ikut Main', callback_data: `join_abc_${chatId}` }]]
                }
            });

            mulaiTimerLobi(ctx, chatId, lobiMessage.message_id, 60);

        } catch (error) {
            console.error('Error lobi acak:', error);
            ctx.reply('❌ Gagal memulai lobi.');
        }
    });

    // --- 2. MODE: /mainabccustom ---
    bot.command('mainabccustom', async (ctx) => {
        if (ctx.chat.type === 'private') return ctx.reply('⚠️ Perintah ini hanya bisa digunakan di dalam grup!');
        const chatId = ctx.chat.id.toString();
        const userId = ctx.from.id.toString();

        try {
            const { data: perm } = await supabase
                .from('group_permissions')
                .select('is_custom_player, is_manager')
                .eq('chat_id', chatId)
                .eq('user_id', userId)
                .maybeSingle();

            if (!perm || !perm.is_custom_player) {
                return ctx.reply('⛔ Anda tidak memiliki hak akses untuk memulai mode custom di grup ini.');
            }

            const textArgs = ctx.message.text.split(' ');
            if (textArgs.length < 2) {
                return ctx.reply('⚠️ Format salah!\nGunakan: `/mainabccustom <Tema>`', { parse_mode: 'Markdown' });
            }

            const customTheme = textArgs.slice(1).join(' ');

            const { data: existingGame } = await supabase
                .from('active_games')
                .select('*')
                .eq('chat_id', chatId)
                .maybeSingle();

            if (existingGame) {
                return ctx.reply('⚠️ Sesi lain sedang berjalan!');
            }

            const { error } = await supabase
                .from('active_games')
                .insert([{
                    chat_id: chatId,
                    status: 'menunggu_pemain',
                    players: [],
                    custom_theme: customTheme,
                    current_turn_index: 0
                }]);

            if (error) throw error;

            const lobiText = 
                `🎮 **LOBI ABC 5 DASAR (KUSTOM)** 🎮\n\n` +
                `🎯 **Tema:** ${customTheme}\n\n` +
                `Siapa yang mau ikut? (Minimal 2 orang)\n\n` +
                `👥 **Daftar Pemain (0):**\n_Belum ada pemain._\n\n` +
                `⏳ *Waktu pendaftaran: 60 detik.*`;

            const lobiMessage = await ctx.reply(lobiText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '✋ Ikut Main', callback_data: `join_abc_${chatId}` }]]
                }
            });

            mulaiTimerLobi(ctx, chatId, lobiMessage.message_id, 60, customTheme);

        } catch (error) {
            console.error('Error custom:', error);
            ctx.reply('❌ Terjadi kesalahan.');
        }
    });

    // --- 3. PEMANTAU JAWABAN PEMAIN (CORE GAMEPLAY DENGAN VALIDASI KAMUS) ---
    bot.on('text', async (ctx) => {
        if (ctx.chat.type === 'private') return;
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const messageText = ctx.message.text.trim();

        const { data: game } = await supabase
            .from('active_games')
            .select('*')
            .eq('chat_id', chatId)
            .eq('status', 'bermain')
            .maybeSingle();

        if (!game) return;

        const players = game.players || [];
        const currentIndex = game.current_turn_index || 0;
        const currentActivePlayer = players[currentIndex];

        // Pastikan yang ngetik adalah player yang sedang mendapat giliran
        if (!currentActivePlayer || currentActivePlayer.id !== userId) {
            return; 
        }

        // Wajib reply pesan bot
        if (!ctx.message.reply_to_message) {
            return ctx.reply(`⚠️ ${currentActivePlayer.name}, kamu harus me-reply pesan bot untuk menjawab!`, { parse_reply: true });
        }

        const targetLetter = game.huruf_aktif.toUpperCase();
        const firstLetter = messageText.charAt(0).toUpperCase();

        // 1. Cek validitas huruf awal & panjang kata minimal
        const hurufAwalBenar = (firstLetter === targetLetter);
        const panjangCukup = (messageText.length >= 2);

        // 2. Cek apakah jawaban sesuai dengan tema di kamus/package
        const sesuaikanTema = validasiJawabanTema(game.custom_theme, messageText);

        if (!panjangCukup || !hurufAwalBenar || !sesuaikanTema) {
            // JAWABAN SALAH / TIDAK SESUAI TEMA / SALAH HURUF
            const nextIndex = (currentIndex + 1) % players.length;
            const nextPlayer = players[nextIndex];
            const nextLetter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];

            await supabase
                .from('active_games')
                .update({
                    current_turn_index: nextIndex,
                    huruf_aktif: nextLetter
                })
                .eq('chat_id', chatId);

            return ctx.reply(
                `❌ **SALAH!** Kata *"${messageText}"* tidak valid, salah huruf awal, atau tidak sesuai tema **${game.custom_theme}**.\n\n` +
                `👉 **Giliran Bergeser ke:** [${nextPlayer.name}](tg://user?id=${nextPlayer.id})\n` +
                `🔤 **Huruf Target Baru:** **${nextLetter}**\n` +
                `📂 **Tema:** ${game.custom_theme}\n\n` +
                `_Balas pesan ini untuk menjawab!_`,
                { parse_mode: 'Markdown' }
            );
        } else {
            // JAWABAN BENAR & SESUAI TEMA
            currentActivePlayer.score = (currentActivePlayer.score || 0) + 10;
            players[currentIndex] = currentActivePlayer;

            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const nextLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
            const nextIndex = (currentIndex + 1) % players.length;
            const nextPlayer = players[nextIndex];

            await supabase
                .from('active_games')
                .update({
                    players: players,
                    current_turn_index: nextIndex,
                    huruf_aktif: nextLetter
                })
                .eq('chat_id', chatId);

            await ctx.reply(
                `✅ **BENAR! (+10 Poin)**\n` +
                `🎉 Hebat ${currentActivePlayer.name}! Kata *"${messageText}"* diterima sesuai tema.\n\n` +
                `--- STATUS SKOR SEMENTARA ---\n` +
                players.map(p => `• ${p.name}: ${p.score} pts`).join('\n') + `\n\n` +
                `👉 **Giliran Berikutnya:** [${nextPlayer.name}](tg://user?id=${nextPlayer.id})\n` +
                `🔤 **Huruf Target Baru:** **${nextLetter}**\n` +
                `📂 **Tema:** ${game.custom_theme}\n\n` +
                `_Balas pesan ini untuk menjawab!_`,
                { parse_mode: 'Markdown' }
            );
        }
    });

    // --- 4. COMMAND ADMIN & KONTROL ---
    bot.command('mulaisekaranganjir', async (ctx) => {
        if (ctx.chat.type === 'private') return;
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;

        try {
            const memberInfo = await ctx.telegram.getChatMember(chatId, userId);
            if (memberInfo.status !== 'creator' && memberInfo.status !== 'administrator') {
                return ctx.reply('⛔ Khusus Admin Grup!');
            }

            const { data: game } = await supabase
                .from('active_games')
                .select('*')
                .eq('chat_id', chatId)
                .eq('status', 'menunggu_pemain')
                .maybeSingle();

            if (!game) return ctx.reply('ℹ️ Tidak ada lobi aktif.');

            if (activeLobbyTimers.has(chatId)) {
                clearTimeout(activeLobbyTimers.get(chatId).timer);
                activeLobbyTimers.delete(chatId);
            }

            if (game.custom_theme) {
                await mulaiPermainanCustomLangsung(ctx, chatId, game.custom_theme);
            } else {
                await mulaiPermainanAcakLangsung(ctx, chatId);
            }
        } catch (e) {
            ctx.reply('❌ Gagal memaksa mulai.');
        }
    });

    bot.command('stopaksakumas', async (ctx) => {
        if (ctx.chat.type === 'private') return;
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;

        try {
            const memberInfo = await ctx.telegram.getChatMember(chatId, userId);
            if (memberInfo.status !== 'creator' && memberInfo.status !== 'administrator') return;

            if (activeLobbyTimers.has(chatId)) {
                clearTimeout(activeLobbyTimers.get(chatId).timer);
                activeLobbyTimers.delete(chatId);
            }

            await supabase.from('active_games').delete().eq('chat_id', chatId);
            ctx.reply('🛑 Sesi permainan dihentikan paksa oleh Admin.');
        } catch (e) {}
    });

    // --- 5. TOMBOL JOIN ---
    bot.action(/^join_abc_(.+)$/, async (ctx) => {
        const chatId = ctx.match[1];
        const user = ctx.from;

        try {
            const { data: game } = await supabase
                .from('active_games')
                .select('*')
                .eq('chat_id', chatId)
                .eq('status', 'menunggu_pemain')
                .maybeSingle();

            if (!game) return ctx.answerCbQuery({ text: '⚠️ Lobi sudah ditutup!', show_alert: true });

            let players = game.players || [];
            if (players.some(p => p.id === user.id)) {
                return ctx.answerCbQuery({ text: 'Kamu sudah terdaftar!', show_alert: false });
            }

            players.push({ id: user.id, name: user.first_name, score: 0 });

            await supabase.from('active_games').update({ players: players }).eq('chat_id', chatId);

            const listStr = players.map((p, idx) => `${idx + 1}. ${p.name}`).join('\n');
            const updatedText = `🎮 **LOBI ABC 5 DASAR** 🎮\n\nSiapa yang mau ikut? (Minimal 2 orang)\n\n👥 **Daftar Pemain (${players.length}):**\n${listStr}`;

            try {
                await ctx.editMessageText(updatedText, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: `✋ Ikut Main (${players.length})`, callback_data: `join_abc_${chatId}` }]] }
                });
            } catch (e) {}

            await ctx.answerCbQuery({ text: `Berhasil bergabung, ${user.first_name}!` });
        } catch (e) {}
    });
};

function mulaiTimerLobi(ctx, chatId, messageId, durasi, theme = null) {
    const timerObj = {
        timer: setTimeout(async () => {
            activeLobbyTimers.delete(chatId);
            if (theme) await mulaiPermainanCustomLangsung(ctx, chatId, theme);
            else await mulaiPermainanAcakLangsung(ctx, chatId);
        }, durasi * 1000)
    };
    activeLobbyTimers.set(chatId, timerObj);
}

async function mulaiPermainanAcakLangsung(ctx, chatId) {
    const { data: game } = await supabase.from('active_games').select('*').eq('chat_id', chatId).maybeSingle();
    if (!game || game.status !== 'menunggu_pemain') return;

    const players = game.players || [];
    if (players.length < 2) {
        await supabase.from('active_games').delete().eq('chat_id', chatId);
        return ctx.telegram.sendMessage(chatId, '❌ Permainan dibatalkan, kurang dari 2 pemain.');
    }

    const randomTheme = LIST_TEMEMA[Math.floor(Math.random() * LIST_TEMEMA.length)];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

    await supabase.from('active_games').update({
        status: 'bermain',
        huruf_aktif: randomLetter,
        custom_theme: randomTheme,
        current_turn_index: 0
    }).eq('chat_id', chatId);

    await ctx.telegram.sendMessage(
        chatId,
        `🚀 **PERMAINAN DIMULAI!**\n\n` +
        `📂 **Tema:** ${randomTheme}\n` +
        `🔤 **Huruf Target:** ${randomLetter}\n` +
        `👤 **Giliran Pertama:** [${players[0].name}](tg://user?id=${players[0].id})\n\n` +
        `_Silakan balas (reply) pesan ini dengan jawaban yang berawalan huruf **${randomLetter}**!_`,
        { parse_mode: 'Markdown' }
    );
}

async function mulaiPermainanCustomLangsung(ctx, chatId, theme) {
    const { data: game } = await supabase.from('active_games').select('*').eq('chat_id', chatId).maybeSingle();
    if (!game || game.status !== 'menunggu_pemain') return;

    const players = game.players || [];
    if (players.length < 2) {
        await supabase.from('active_games').delete().eq('chat_id', chatId);
        return ctx.telegram.sendMessage(chatId, '❌ Permainan kustom dibatalkan, kurang dari 2 pemain.');
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

    await supabase.from('active_games').update({
        status: 'bermain',
        huruf_aktif: randomLetter,
        custom_theme: theme,
        current_turn_index: 0
    }).eq('chat_id', chatId);

    await ctx.telegram.sendMessage(
        chatId,
        `🚀 **PERMAINAN KUSTOM DIMULAI!**\n\n` +
        `🎯 **Tema:** ${theme}\n` +
        `🔤 **Huruf Target:** ${randomLetter}\n` +
        `👤 **Giliran Pertama:** [${players[0].name}](tg://user?id=${players[0].id})\n\n` +
        `_Silakan balas (reply) pesan ini dengan jawaban yang berawalan huruf **${randomLetter}**!_`,
        { parse_mode: 'Markdown' }
    );
}