# lead-webhook

Deploy this function after setting `INTEGRATION_WEBHOOK_URL`; it is deliberately inactive without that secret. Invoke it on a schedule or from an authenticated server to deliver pending `lead.created` events from `integration_events`.
