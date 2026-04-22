
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Simple .env.local parser
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
  console.log("--- BOOKINGS ---");
  const { data: bookings } = await supabase.from('bookings').select('phone, name');
  console.log(JSON.stringify(bookings, null, 2));

  console.log("\n--- AGENT MODES ---");
  const { data: modes } = await supabase.from('agent_mode').select('phone_number, profile_name');
  console.log(JSON.stringify(modes, null, 2));

  console.log("\n--- CONVERSATIONS (Distinct Phones) ---");
  const { data: convos } = await supabase.from('conversations').select('phone').limit(50);
  const phones = [...new Set(convos?.map(c => c.phone) || [])];
  console.log(phones);
}

debugData();
