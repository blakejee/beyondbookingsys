import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zejdzalcblisnrnaupag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplamR6YWxjYmxpc25ybmF1cGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTgwOTcsImV4cCI6MjA3NjM5NDA5N30.BgKbb5cE6imRQ482gFY_ESbHsxx0LEIkP3oQUXIwIjo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);