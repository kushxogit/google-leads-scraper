function getCorsHeaders(request: Request) {
  const reqOrigin = request.headers.get("origin");
  const appUrl = Deno.env.get("APP_URL");
  const origin = reqOrigin || appUrl || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

const json = (body: unknown, status = 200, corsHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  const cors = getCorsHeaders(request);
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
    if (userError || !user) return json({ error: "Unauthorized" }, 401, cors);
    const admin = createClient(url, serviceKey);
    const body = await request.json();
    const workspaceId = body.workspace_id;
    const { data: membership } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Workspace access denied" }, 403, cors);
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
      }, 200, cors);
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

      const { data: existingConnection } = await admin
        .from("calendar_connections")
        .select("encrypted_refresh_token")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle();

      const refreshTokenToSave =
        encrypted || existingConnection?.encrypted_refresh_token;

      const connection = {
        workspace_id: workspaceId,
        user_id: user.id,
        provider: "google",
        provider_account_email: identity.email,
        status: "connected",
        last_error: null,
        ...(refreshTokenToSave
          ? { encrypted_refresh_token: refreshTokenToSave }
          : {}),
      };
      const { error } = await admin
        .from("calendar_connections")
        .upsert(connection, { onConflict: "workspace_id,user_id,provider" });
      if (error) throw error;
      await syncCalendar(admin, workspaceId, user.id, token.access_token);
      return json({ connected: true, email: identity.email }, 200, cors);
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
      return json({ connected: false }, 200, cors);
    }
    if (body.action === "sync") {
      const { data: connection } = await admin
        .from("calendar_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();
      if (!connection?.encrypted_refresh_token)
        return json({ error: "Connect Google Calendar first" }, 409, cors);
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
      return json({ synced: count }, 200, cors);
    }
    return json({ error: "Unknown action" }, 400, cors);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
      cors,
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

  // 1. Process Google Calendar event updates & cancellations back to LeadPilot tasks
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

  // 2. Import external & synced Google events into calendar_event_links (preserving task_id!)
  const imported = (calendar.items ?? [])
    .filter(
      (event: Record<string, any>) =>
        event.status !== "cancelled" &&
        (event.start?.dateTime || event.start?.date),
    )
    .map((event: Record<string, any>) => {
      const taskId = event.extendedProperties?.private?.leadpilotTaskId || null;
      return {
        workspace_id: workspaceId,
        user_id: userId,
        task_id: taskId,
        provider: "google",
        provider_event_id: event.id,
        title: event.summary || "Busy",
        starts_at: event.start.dateTime || `${event.start.date}T00:00:00Z`,
        ends_at: event.end.dateTime || `${event.end.date}T00:00:00Z`,
        is_private: event.visibility === "private",
        source: taskId ? "leadpilot" : "google",
        provider_updated_at: event.updated,
        last_synced_at: new Date().toISOString(),
      };
    });

  if (imported.length) {
    await admin.from("calendar_event_links").upsert(imported, {
      onConflict: "workspace_id,user_id,provider,provider_event_id",
    });
  }

  // 3. Push LeadPilot tasks to Google Calendar
  const { data: assignments } = await admin
    .from("task_assignees")
    .select("task_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  const ids = (assignments ?? []).map((row) => row.task_id);

  const syncedTaskIds = new Set<string>();

  if (ids.length) {
    const { data: tasks } = await admin
      .from("tasks")
      .select("*")
      .in("id", ids)
      .eq("calendar_sync_enabled", true)
      .not("scheduled_start", "is", null);

    for (const task of tasks ?? []) {
      syncedTaskIds.add(task.id);

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

      let event;
      if (existing) {
        try {
          event = await google(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existing.provider_event_id}`,
            accessToken,
            "PATCH",
            payload,
          );
        } catch {
          // Fall back to creating a new event if the remote event was deleted on Google
          event = await google(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            accessToken,
            "POST",
            payload,
          );
        }
      } else {
        event = await google(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          accessToken,
          "POST",
          payload,
        );
      }

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

  // 4. Cleanup orphaned / stale LeadPilot events from Google Calendar & database
  const { data: leadpilotLinks } = await admin
    .from("calendar_event_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "leadpilot");

  for (const link of leadpilotLinks ?? []) {
    if (link.task_id && !syncedTaskIds.has(link.task_id)) {
      try {
        await google(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${link.provider_event_id}`,
          accessToken,
          "DELETE",
        );
      } catch {
        // Ignore 404/410 if already deleted on Google Calendar
      }
      await admin
        .from("calendar_event_links")
        .delete()
        .eq("id", link.id);
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

  if (method === "DELETE" && (response.status === 204 || response.status === 200)) {
    return { success: true };
  }

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
  return `${bytesToBase64(iv)}.${bytesToBase64(encrypted)}`;
}

async function decrypt(value: string) {
  const [ivBase64, payloadBase64] = value.split(".");
  const iv = base64ToBytes(ivBase64);
  const payload = base64ToBytes(payloadBase64);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), payload),
  );
}
