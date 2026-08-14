const supabase = require('../config/database');
const ownerId = process.env.OWNER_ID;

const pendingDeletions = new Map();

module.exports = (bot) => {
    // --- SISTEM ANTI-PENYUSUP ---
    bot.on('my_chat_member', async (ctx) => {
        const chat = ctx.chat;
        const newStatus = ctx.myChatMember.new_chat_member.status;

        if (newStatus === 'member' || newStatus === 'administrator') {
            if (chat.type === 'group' || chat.type === 'supergroup') {
                try {
                    const { data } = await supabase
                        .from('registered_groups')
                        .select('chat_id')
                        .eq('chat_id', chat.id)
                        .maybeSingle();

                    if (!data) {
                        await ctx.reply('eits izin dulu ke yang punya @arikamukunaon');
                        await ctx.leaveChat();
                    } else {
                        await ctx.reply('Halo grup! Saya siap bermain ABC 5 Dasar di sini. 🎮');
                    }
                } catch (error) {
                    console.error('Error saat mengecek validasi grup:', error);
                }
            }
        }
    });

    // --- MENU UTAMA OWNER (/setting) ---
    const showSettingMenu = async (ctx, isCallback = false) => {
        const text = '⚙️ **Panel Kontrol Owner**\n\nSelamat datang, Bos! Silakan pilih menu untuk mengatur akses bot:';
        const replyMarkup = {
            inline_keyboard: [
                [{ text: '➕ A. Daftarkan Grup Baru', callback_data: 'setting_menu_a' }],
                [{ text: '🏢 B. List Grup & Atur Manajer', callback_data: 'setting_menu_b' }],
                [{ text: '🔐 C. Cek Custom Akses', callback_data: 'setting_menu_c' }],
                [{ text: '🗑️ D. Hapus List Grup', callback_data: 'setting_menu_d' }]
            ]
        };

        if (isCallback) {
            try {
                await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
            } catch (e) {
                await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
            }
        } else {
            await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
        }
    };

    bot.command('setting', async (ctx) => {
        const userId = ctx.from.id.toString();
        if (userId !== ownerId) {
            return ctx.reply('⛔ Maaf, menu ini khusus untuk Owner Bot.');
        }
        showSettingMenu(ctx, false);
    });

    // Tombol Kembali ke Menu Utama
    bot.action('setting_main_menu', async (ctx) => {
        await ctx.answerCbQuery();
        showSettingMenu(ctx, true);
    });

    // --- AKSI TOMBOL MENU A (DAFTAR GRUP) ---
    bot.action('setting_menu_a', async (ctx) => {
        await ctx.answerCbQuery();
        try {
            await ctx.editMessageText(
                '➕ **Cara Mendaftarkan Grup Baru**\n\n' +
                'Silakan ketik perintah dengan format:\n' +
                '`/daftargrup <ID_GRUP>`\n\n' +
                '*(Pastikan bot sudah dimasukkan ke grup tersebut agar bisa mendeteksi nama grup)*.', 
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'setting_main_menu' }]]
                    }
                }
            );
        } catch (e) {
            await ctx.reply('➕ **Cara Mendaftarkan Grup Baru**\nGunakan: `/daftargrup <ID_GRUP>`', { parse_mode: 'Markdown' });
        }
    });

    // --- AKSI TOMBOL MENU B (LIST GRUP -> MANAJER) ---
    bot.action('setting_menu_b', async (ctx) => {
        await ctx.answerCbQuery();

        try {
            const { data: groups, error } = await supabase
                .from('registered_groups')
                .select('*');

            if (error) throw error;

            const keyboard = [];
            if (groups && groups.length > 0) {
                groups.forEach(group => {
                    keyboard.push([{ text: `🏢 ${group.group_name}`, callback_data: `manage_group_${group.chat_id}` }]);
                });
            }
            
            keyboard.push([{ text: '⬅️ Kembali', callback_data: 'setting_main_menu' }]);

            const text = '🏢 **Pilih Grup**\n\nPilih salah satu grup di bawah ini untuk mengatur admin yang berhak menjadi Manajer Bot:';
            
            try {
                await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
            } catch (e) {
                await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
            }

        } catch (error) {
            console.error('Error fetch list grup manajer:', error);
            ctx.reply('❌ Gagal mengambil daftar grup.');
        }
    });

    // --- AKSI TOMBOL MENU C (CEK CUSTOM AKSES / MANAJER AKTIF) ---
    bot.action('setting_menu_c', async (ctx) => {
        await ctx.answerCbQuery();

        try {
            const { data: managers, error } = await supabase
                .from('group_permissions')
                .select('*')
                .eq('is_manager', true);

            if (error) throw error;

            const keyboard = [];
            if (managers && managers.length > 0) {
                const uniqueManagers = Array.from(new Set(managers.map(m => m.user_id)))
                    .map(id => managers.find(m => m.user_id === id));

                uniqueManagers.forEach(mgr => {
                    keyboard.push([{ text: `👤 ${mgr.user_name || 'Manajer'}`, callback_data: `detail_mgr_${mgr.user_id}` }]);
                });
            }

            keyboard.push([{ text: '⬅️ Kembali', callback_data: 'setting_main_menu' }]);

            const text = '🔐 **Daftar Manajer Bot Aktif**\n\nKlik pada nama manajer di bawah untuk melihat grup apa saja yang mereka pegang:';

            try {
                await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
            } catch (e) {
                await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
            }

        } catch (error) {
            console.error('Error fetch menu c:', error);
            ctx.reply('❌ Gagal mengambil data custom akses.');
        }
    });

    bot.action(/^detail_mgr_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery('Memuat data grup manajer...');
        const targetUserId = ctx.match[1];

        try {
            const { data: perms, error } = await supabase
                .from('group_permissions')
                .select('*, registered_groups(group_name)')
                .eq('user_id', targetUserId)
                .eq('is_manager', true);

            if (error) throw error;

            const keyboard = [];
            if (perms && perms.length > 0) {
                perms.forEach(p => {
                    const groupTitle = p.registered_groups?.group_name || 'Grup Terdaftar';
                    const customStatus = p.is_custom_player ? '✅ Custom On' : '❌ Custom Off';
                    keyboard.push([{ 
                        text: `${groupTitle} (${customStatus})`, 
                        callback_data: `toggle_custom_${p.chat_id}_${targetUserId}` 
                    }]);
                });
            }

            keyboard.push([{ text: '⬅️ Kembali ke List Manajer', callback_data: 'setting_menu_c' }]);

            const text = `🔐 **Grup Akses Manajer**\n\nBerikut adalah daftar grup yang dipegang oleh user ini:`;

            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });

        } catch (error) {
            console.error('Error detail manager:', error);
            ctx.reply('❌ Gagal memuat detail akses manajer.');
        }
    });

    // --- PANEL KHUSUS MANAJER BOT (/settinggrup) ---
    bot.command('settinggrup', async (ctx) => {
        const userId = ctx.from.id.toString();

        try {
            // Cek apakah user ini terdaftar sebagai manajer di salah satu grup
            const { data: permissions, error } = await supabase
                .from('group_permissions')
                .select('*, registered_groups(group_name)')
                .eq('user_id', userId)
                .eq('is_manager', true);

            if (error) throw error;

            if (!permissions || permissions.length === 0) {
                return ctx.reply('⛔ Maaf, Anda tidak memiliki hak akses sebagai Manajer Bot di grup manapun.');
            }

            // Tampilkan list grup yang dipegang oleh Manajer tersebut (mirip Menu C)
            const keyboard = permissions.map(p => {
                const groupTitle = p.registered_groups?.group_name || 'Grup Terdaftar';
                const statusCustom = p.is_custom_player ? '✅ Custom On' : '❌ Custom Off';
                return [{ 
                    text: `🏢 ${groupTitle} (${statusCustom})`, 
                    callback_data: `mgr_panel_group_${p.chat_id}` 
                }];
            });

            ctx.reply('🔧 **Panel Kontrol Manajer Grup**\n\nPilih grup di bawah ini untuk mengatur izin pemain custom (`/mainABCcustom`):', {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (error) {
            console.error('Error command settinggrup:', error);
            ctx.reply('❌ Terjadi kesalahan saat memuat panel manajer.');
        }
    });

    // Ketika Manajer klik grupnya di panel /settinggrup
    bot.action(/^mgr_panel_group_(.+)$/, async (ctx) => {
        await ctx.answerCbQuery('Memuat daftar admin grup...');
        const chatId = ctx.match[1];
        const userId = ctx.from.id.toString();

        try {
            // Validasi ulang: pastikan user ini benar manajer di grup tersebut
            const { data: check } = await supabase
                .from('group_permissions')
                .select('is_manager')
                .eq('chat_id', chatId)
                .eq('user_id', userId)
                .eq('is_manager', true)
                .maybeSingle();

            if (!check && userId !== ownerId) {
                return ctx.reply('⛔ Anda tidak berwenang mengatur grup ini.');
            }

            // Ambil daftar admin asli dari grup Telegram tersebut
            const admins = await ctx.telegram.getChatAdministrators(chatId);
            const humanAdmins = admins.filter(member => !member.user.is_bot);

            // Ambil data izin kustom yang sudah ada di database
            const { data: dbPerms } = await supabase
                .from('group_permissions')
                .select('*')
                .eq('chat_id', chatId);

            const keyboard = humanAdmins.map(admin => {
                const adminId = admin.user.id;
                const adminName = admin.user.first_name;

                const perm = dbPerms?.find(p => p.user_id.toString() === adminId.toString());
                const isCustom = perm ? perm.is_custom_player : false;
                const icon = isCustom ? '✅' : '❌';

                return [{ 
                    text: `${icon} ${adminName} (Custom Play)`, 
                    callback_data: `mgr_toggle_custom_${chatId}_${adminId}` 
                }];
            });

            keyboard.push([{ text: '⬅️ Kembali ke List Grup Saya', callback_data: 'back_to_mgr_panel' }]);

            await ctx.editMessageText('👥 **Atur Akses Custom Player**\n\nKlik pada nama admin untuk memberi/mencabut izin akses fitur khusus (`/mainABCcustom`):', {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (error) {
            console.error('Error mgr panel group:', error);
            ctx.reply('❌ Gagal memuat daftar admin grup. Pastikan bot masih menjadi admin di grup tersebut.');
        }
    });

    // Tombol kembali untuk panel manajer
    bot.action('back_to_mgr_panel', async (ctx) => {
        await ctx.answerCbQuery();
        // Jalankan ulang fungsi settinggrup versi edit text
        const userId = ctx.from.id.toString();
        const { data: permissions } = await supabase
            .from('group_permissions')
            .select('*, registered_groups(group_name)')
            .eq('user_id', userId)
            .eq('is_manager', true);

        const keyboard = permissions.map(p => {
            const groupTitle = p.registered_groups?.group_name || 'Grup Terdaftar';
            const statusCustom = p.is_custom_player ? '✅ Custom On' : '❌ Custom Off';
            return [{ text: `🏢 ${groupTitle} (${statusCustom})`, callback_data: `mgr_panel_group_${p.chat_id}` }];
        });

        await ctx.editMessageText('🔧 **Panel Kontrol Manajer Grup**\n\nPilih grup di bawah ini:', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    });

    // Toggle Izin Custom Player oleh Manajer
    bot.action(/^mgr_toggle_custom_(.+)_(\d+)$/, async (ctx) => {
        const chatId = ctx.match[1];
        const targetUserId = ctx.match[2];

        try {
            const { data: current } = await supabase
                .from('group_permissions')
                .select('is_custom_player, user_name')
                .eq('chat_id', chatId)
                .eq('user_id', targetUserId)
                .maybeSingle();

            const newStatus = current ? !current.is_custom_player : true;

            let userName = current?.user_name || "Admin";
            try {
                const memberInfo = await ctx.telegram.getChatMember(chatId, targetUserId);
                userName = memberInfo.user.first_name;
            } catch (e) {}

            await supabase
                .from('group_permissions')
                .upsert({
                    chat_id: chatId,
                    user_id: targetUserId,
                    user_name: userName,
                    is_manager: current ? current.is_manager : false,
                    is_custom_player: newStatus
                }, { onConflict: ['chat_id', 'user_id'] });

            await ctx.answerCbQuery(`Status Custom Player diubah menjadi ${newStatus ? 'AKTIF (✅)' : 'NONAKTIF (❌)'}`);
            ctx.reply(`✅ Hak akses custom player untuk **${userName}** diubah menjadi: **${newStatus ? 'Diberikan (✅)' : 'Dicabut (❌)'}**`, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('Error mgr toggle custom:', error);
            await ctx.answerCbQuery('Gagal mengubah status.');
        }
    });

    // --- AKSI TOMBOL MENU D (HAPUS GRUP) ---
    bot.action('setting_menu_d', async (ctx) => {
        await ctx.answerCbQuery();
        
        try {
            const { data: groups, error } = await supabase
                .from('registered_groups')
                .select('*');

            if (error) throw error;

            const keyboard = [];
            if (groups && groups.length > 0) {
                groups.forEach(group => {
                    keyboard.push([{ text: `🗑️ ${group.group_name}`, callback_data: `delgrp_${group.chat_id}` }]);
                });
            }
            
            keyboard.push([{ text: '⬅️ Kembali', callback_data: 'setting_main_menu' }]);

            const text = 'Pilih grup yang ingin Anda hapus dari database:';
            try {
                await ctx.editMessageText(text, { reply_markup: { inline_keyboard: keyboard } });
            } catch (e) {
                await ctx.reply(text, { reply_markup: { inline_keyboard: keyboard } });
            }

        } catch (error) {
            console.error('Error fetch list hapus:', error);
            ctx.reply('❌ Gagal mengambil daftar grup.');
        }
    });

    // --- EKSEKUSI PENDAFTARAN GRUP ---
    bot.command('daftargrup', async (ctx) => {
        const userId = ctx.from.id.toString();
        if (userId !== ownerId) return; 

        const text = ctx.message.text;
        const args = text.split(' '); 

        if (args.length < 2) {
            return ctx.reply('⚠️ Format salah!\nGunakan: `/daftargrup <ID_GRUP>`');
        }

        const groupId = args[1];
        let groupName = "";

        try {
            const chatInfo = await ctx.telegram.getChat(groupId);
            groupName = chatInfo.title || "Grup Tanpa Nama";
        } catch (error) {
            return ctx.reply('masukan bot dulu ke grup anjir');
        }

        try {
            const { error } = await supabase
                .from('registered_groups')
                .insert([{ chat_id: groupId, group_name: groupName }]);

            if (error) {
                if (error.code === '23505') { 
                    return ctx.reply('⚠️ Grup dengan ID tersebut sudah terdaftar di database!');
                }
                throw error;
            }

            ctx.reply(`✅ Berhasil!\n\nGrup **${groupName}** (ID: \`${groupId}\`) telah resmi diizinkan.`, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('Error saat daftar grup:', error);
            ctx.reply('❌ Gagal mendaftarkan grup. Terjadi kesalahan pada database.');
        }
    });

    // --- LOGIKA HAPUS GRUP (Y / G) ---
    bot.action(/^delgrp_(.+)$/, async (ctx) => {
        await ctx.answerCbQuery();
        const groupId = ctx.match[1];
        const userId = ctx.from.id.toString();

        if (userId !== ownerId) return;

        pendingDeletions.set(userId, groupId);
        ctx.reply(`Apakah anda yakin ingin menghapus grup ini?\nketik y / g`);
    });

    bot.hears(/^[yY]$/, async (ctx) => {
        const userId = ctx.from.id.toString();
        if (userId !== ownerId) return;

        const groupId = pendingDeletions.get(userId);
        if (!groupId) return; 

        try {
            const { error } = await supabase
                .from('registered_groups')
                .delete()
                .eq('chat_id', groupId);

            if (error) throw error;

            pendingDeletions.delete(userId);
            ctx.reply(`🗑️ Berhasil!\n\nGrup telah dihapus dari daftar database.`);

        } catch (error) {
            console.error('Error saat menghapus grup:', error);
            ctx.reply('❌ Gagal menghapus grup.');
            pendingDeletions.delete(userId);
        }
    });

    bot.hears(/^[gG]$/, async (ctx) => {
        const userId = ctx.from.id.toString();
        if (userId !== ownerId) return;

        if (pendingDeletions.has(userId)) {
            pendingDeletions.delete(userId);
            ctx.reply('✅ Penghapusan grup dibatalkan.');
        }
    });
};