import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://qldfdobkkvfsxliwhyxs.supabase.co';
const SUPABASE_ANON = 'sb_publishable_aW1GXHSYwUnaCQB1ufVDaw_lY4kq466';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
