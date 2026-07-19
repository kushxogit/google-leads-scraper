import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, serviceKey);
    const body = await request.json();
    const workspaceId = body.workspace_id;
    const { data: membership } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Workspace access denied" }, 403);
    if (body.action === "start") {
      const params = new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        redirect_uri: `${env("APP_URL")}/calendar/callback`,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: "openid email https://www.googleapis.com/auth/calendar.events",
        state: workspaceId,
      });
      return json({
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      });
    }
    if (body.action === "exchange") {
      const token = await googleToken({
        code: body.code,
        redirect_uri: `${env("APP_URL")}/calendar/callback`,
        grant_type: "authorization_code",
      });
      const identity = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${token.access_token}` } },
      ).then((r) => r.json());
      const encrypted = token.refresh_token
        ? await encrypt(token.refresh_token)
        : undefined;
      const connection = {
        workspace_id: workspaceId,
        user_id: user.id,
        provider: "google",
        provider_account_email: identity.email,
        status: "connected",
        last_error: null,
        ...(encrypted ? { encrypted_refresh_token: encrypted } : {}),
      };
      const { error } = await admin
        .from("calendar_connections")
        .upsert(connection, { onConflict: "workspace_id,user_id,provider" });
      if (error) throw error;
      await syncCalendar(admin, workspaceId, user.id, token.access_token);
      return json({ connected: true, email: identity.email });
    }
    if (body.action === "disconnect") {
      await admin
        .from("calendar_event_links")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id);
      await admin
        .from("calendar_connections")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id);
      return json({ connected: false });
    }
    if (body.action === "sync") {
      const { data: connection } = await admin
        .from("calendar_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();
      if (!connection?.encrypted_refresh_token)
        return json({ error: "Connect Google Calendar first" }, 409);
      const refreshToken = await decrypt(connection.encrypted_refresh_token);
      const token = await googleToken({
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });
      const count = await syncCalendar(
        admin,
        workspaceId,
        user.id,
        token.access_token,
      );
      return json({ synced: count });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

async function syncCalendar(
  admin: ReturnType<typeof createClient>,
  workspaceId: string,
  userId: string,
  accessToken: string,
) {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 30 * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + 90 * 86400000).toISOString();
  const query = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    maxResults: "2500",
  });
  const calendar = await google(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`,
    accessToken,
  );
  for (const event of calendar.items ?? []) {
    const taskId = event.extendedProperties?.private?.leadpilotTaskId;
    if (!taskId) continue;
    if (event.status === "cancelled") {
      await admin
        .from("tasks")
        .update({
          scheduled_start: null,
          scheduled_end: null,
          status: "unplanned",
          calendar_sync_enabled: false,
        })
        .eq("id", taskId)
        .eq("workspace_id", workspaceId);
      await admin
        .from("calendar_event_links")
        .delete()
        .eq("provider_event_id", event.id)
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId);
      continue;
    }
    if (event.start?.dateTime || event.start?.date) {
      await admin
        .from("tasks")
        .update({
          title: event.summary || "Scheduled work",
          scheduled_start:
            event.start.dateTime || `${event.start.date}T00:00:00Z`,
          scheduled_end: event.end.dateTime || `${event.end.date}T00:00:00Z`,
          status: "planned",
        })
        .eq("id", taskId)
        .eq("workspace_id", workspaceId);
    }
  }
  const imported = (calendar.items ?? [])
    .filter(
      (event: Record<string, any>) =>
        event.status !== "cancelled" &&
        (event.start?.dateTime || event.start?.date),
    )
    .map((event: Record<string, any>) => ({
      workspace_id: workspaceId,
      user_id: userId,
      provider: "google",
      provider_event_id: event.id,
      title: event.summary || "Busy",
      starts_at: event.start.dateTime || `${event.start.date}T00:00:00Z`,
      ends_at: event.end.dateTime || `${event.end.date}T00:00:00Z`,
      is_private: event.visibility === "private",
      source: event.extendedProperties?.private?.leadpilotTaskId
        ? "leadpilot"
        : "google",
      provider_updated_at: event.updated,
      last_synced_at: new Date().toISOString(),
    }));
  if (imported.length)
    await admin.from("calendar_event_links").upsert(imported, {
      onConflict: "workspace_id,user_id,provider,provider_event_id",
    });
  const { data: assignments } = await admin
    .from("task_assignees")
    .select("task_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  const ids = (assignments ?? []).map((row) => row.task_id);
  if (ids.length) {
    const { data: tasks } = await admin
      .from("tasks")
      .select("*")
      .in("id", ids)
      .eq("calendar_sync_enabled", true)
      .not("scheduled_start", "is", null);
    for (const task of tasks ?? []) {
      const { data: existing } = await admin
        .from("calendar_event_links")
        .select("*")
        .eq("task_id", task.id)
        .eq("user_id", userId)
        .maybeSingle();
      const payload = {
        summary: task.title,
        description: task.description,
        start: { dateTime: task.scheduled_start },
        end: {
          dateTime:
            task.scheduled_end ??
            new Date(
              new Date(task.scheduled_start).getTime() + 3600000,
            ).toISOString(),
        },
        extendedProperties: { private: { leadpilotTaskId: task.id } },
      };
      const event = existing
        ? await google(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existing.provider_event_id}`,
            accessToken,
            "PATCH",
            payload,
          )
        : await google(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            accessToken,
            "POST",
            payload,
          );
      await admin.from("calendar_event_links").upsert(
        {
          workspace_id: workspaceId,
          user_id: userId,
          task_id: task.id,
          provider: "google",
          provider_event_id: event.id,
          title: task.title,
          starts_at: task.scheduled_start,
          ends_at: task.scheduled_end ?? payload.end.dateTime,
          is_private: false,
          source: "leadpilot",
          provider_updated_at: event.updated,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,user_id,provider,provider_event_id" },
      );
    }
  }
  await admin
    .from("calendar_connections")
    .update({
      status: "connected",
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  return imported.length;
}

async function googleToken(values: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...values,
    }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error_description || data.error || "Google authentication failed",
    );
  return data;
}
async function google(
  url: string,
  token: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Google Calendar request failed");
  return data;
}
function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
async function key() {
  const bytes = Uint8Array.from(atob(env("CALENDAR_TOKEN_KEY")), (char) =>
    char.charCodeAt(0),
  );
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await key(),
      new TextEncoder().encode(value),
    ),
  );
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...encrypted))}`;
}
async function decrypt(value: string) {
  const [iv, payload] = value
    .split(".")
    .map((part) => Uint8Array.from(atob(part), (char) => char.charCodeAt(0)));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), payload),
  );
}
