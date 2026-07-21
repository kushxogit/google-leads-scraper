# lead-webhook

Deploy this function after setting `INTEGRATION_WEBHOOK_URL` and a high-entropy `WEBHOOK_INVOKE_SECRET`; it is deliberately inactive without the webhook URL. Invoke it only from a server or scheduler that supplies the latter as the `x-webhook-invoke-secret` header. This delivers pending `lead.created` events from `integration_events`.
