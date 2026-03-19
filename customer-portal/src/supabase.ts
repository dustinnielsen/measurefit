import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vqtuuncnolvkxyelapdo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdHV1bmNub2x2a3h5ZWxhcGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODU0ODQsImV4cCI6MjA4ODc2MTQ4NH0.q0HuKI3QWfih2jDdsJWwLTCfRnAJpDXG2li8vqIUsOA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);