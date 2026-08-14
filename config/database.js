require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ PERINGATAN: Supabase URL atau Key belum terbaca di file .env!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;