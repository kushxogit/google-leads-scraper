# Rewind deployment

Rewind uses the Supabase migration at `supabase/migrations/202607200001_rewind_tasks.sql`. Apply migrations before opening the updated frontend.

## Google Calendar

1. Create a Google Cloud OAuth web client and enable the Google Calendar API.
2. Add `https://YOUR_APP_HOST/calendar/callback` as an authorized redirect URI.
3. Configure the Edge Function secrets:

   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `APP_URL` (the deployed frontend origin, without a trailing slash)
   - `CALENDAR_TOKEN_KEY` (a base64-encoded random 32-byte key)

4. Deploy `google-calendar-auth` from `supabase/functions/google-calendar-auth`.
5. Each workspace member connects their own primary calendar from Settings.

Scheduled tasks only publish to Google when **Publish scheduled time to Google Calendar** is enabled. Rewind masks a partner's private Google events as **Busy** at the database RPC boundary.
