import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://clwaeadzuxrezxsjszxs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd2FlYWR6dXhyZXp4c2pzenhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mzk5MDksImV4cCI6MjA5NTQxNTkwOX0.cFxGS3craoBp3T1erub_EpFSebmxPus7fBdvWWBjmI8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
