import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://taoehdhumdiyhaekrcyh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_omqI23Odc3Y7OVCZZ2BwJw_EWh6frZX'; // Paste the key you just copied

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        detectSessionInUrl: false,
        persistSession: true,
        flowType: 'pkce', // Force PKCE to ensure we get ?code= in the URL, not #hash
    },
});