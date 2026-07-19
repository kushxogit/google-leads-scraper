# Google Calendar setup

Deploy `google-calendar-auth` and configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, and `CALENDAR_TOKEN_KEY` as Supabase function secrets. `CALENDAR_TOKEN_KEY` must be a base64-encoded 32-byte AES key. Add `${APP_URL}/calendar/callback` as an authorized redirect URI in Google Cloud.
