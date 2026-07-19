import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasPlaceholder = (value) => !value || value.includes('your-project') || value.includes('your-publishable-key');

export const supabaseConfigError = hasPlaceholder(url) || hasPlaceholder(key)
  ? 'Add your Supabase URL and publishable key to frontend/.env.local, then restart npm start.'
  : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(url, key, {
      auth: {
        // Keep the Supabase access and refresh tokens in this browser's local storage.
        // Do not persist them in the backend or manually copy JWTs between sessions.
        storage: window.localStorage,
        storageKey: 'leadpilot.auth.session',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });