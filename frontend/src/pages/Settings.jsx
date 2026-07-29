import { useCallback, useEffect, useState } from "react";
import {
  CalendarSync,
  CheckCircle2,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";

export default function Settings() {
  const { user, activeWorkspaceId } = useAuthWorkspace();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [calendar, setCalendar] = useState(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");

  const loadCalendar = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const { data } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("workspace_id", activeWorkspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    setCalendar(data);
  }, [activeWorkspaceId, user?.id]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const calendarAction = async (action) => {
    setCalendarBusy(true);
    setCalendarMessage("");
    const { data, error } = await supabase.functions.invoke(
      "google-calendar-auth",
      { body: { action, workspace_id: activeWorkspaceId } },
    );
    setCalendarBusy(false);
    if (error || data?.error) {
      const errMsg = data?.error || error?.message || "";
      if (
        errMsg.includes("Failed to send a request") ||
        errMsg.includes("FunctionsFetchError")
      ) {
        return setCalendarMessage(
          "The 'google-calendar-auth' Edge Function is not deployed to your Supabase Cloud project yet (or environment secrets are missing). Deploy it via `supabase functions deploy google-calendar-auth`.",
        );
      }
      return setCalendarMessage(errMsg);
    }
    if (action === "start") return window.location.assign(data.url);
    setCalendarMessage(
      action === "sync"
        ? `Calendar synced${Number.isFinite(data.synced) ? ` · ${data.synced} Google events found` : ""}.`
        : "Calendar disconnected.",
    );
    await loadCalendar();
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    if (password.length < 6)
      return setMessage("Use a password with at least 6 characters.");
    if (password !== confirmPassword)
      return setMessage("Your passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMessage(error.message);
    setPassword("");
    setConfirmPassword("");
    setMessage("Password updated successfully.");
  };

  const sendReset = async () => {
    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSaving(false);
    setMessage(
      error ? error.message : "A password-reset link was sent to your email.",
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      {/* Account Settings Header */}
      <section className="panel p-6 rounded-[26px]">
        <p className="eyebrow">Account</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
          Settings
        </h1>
        <p className="mt-1 text-xs text-zinc-400 font-semibold">
          Manage how you sign in to LeadPilot.
        </p>

        <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-zinc-200/70 bg-white/80 p-3.5 shadow-2xs backdrop-blur-xs">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-700 shadow-2xs">
            <Mail size={18} />
          </span>
          <div>
            <p className="text-xs font-extrabold text-zinc-950">
              {user?.email}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 font-medium">
              Your sign-in email address
            </p>
          </div>
        </div>
      </section>

      {/* Google Calendar Section */}
      <section className="panel p-6 rounded-[26px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 shadow-2xs">
            <CalendarSync size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Calendar</p>
            <h2 className="mt-0.5 text-lg font-extrabold text-zinc-950">
              Google Calendar
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 font-medium">
              Bring meetings into Rewind and publish scheduled shared work back to your primary calendar.
            </p>

            {calendar ? (
              <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-emerald-950">
                      {calendar.provider_account_email ||
                        "Google Calendar connected"}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                      {calendar.last_synced_at
                        ? `Last synced ${new Date(calendar.last_synced_at).toLocaleString()}`
                        : "Ready for first sync"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-3.5 text-xs text-zinc-400 font-medium">
                Each workspace member connects their own calendar. Your partner only sees “Busy” for private events.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {calendar ? (
                <>
                  <button
                    disabled={calendarBusy}
                    onClick={() => calendarAction("sync")}
                    className="button-primary text-xs py-2 px-4 rounded-full font-bold"
                  >
                    <RefreshCw
                      size={14}
                      className={calendarBusy ? "animate-spin" : ""}
                    />{" "}
                    Sync now
                  </button>
                  <button
                    disabled={calendarBusy}
                    onClick={() => calendarAction("disconnect")}
                    className="button-secondary text-xs py-2 px-4 rounded-full font-bold"
                  >
                    <Unplug size={14} /> Disconnect
                  </button>
                </>
              ) : (
                <button
                  disabled={calendarBusy}
                  onClick={() => calendarAction("start")}
                  className="button-primary text-xs py-2 px-4 rounded-full font-bold"
                >
                  <CalendarSync size={15} /> Connect Google Calendar
                </button>
              )}
            </div>

            {calendarMessage && (
              <p
                role="status"
                className="mt-3.5 rounded-2xl bg-violet-50 p-3 text-xs font-bold text-violet-700 border border-violet-200/70"
              >
                {calendarMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="panel p-6 rounded-[26px]">
        <div className="flex items-start gap-3.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-2xs">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="eyebrow">Security</p>
            <h2 className="mt-0.5 text-lg font-extrabold text-zinc-950">
              Set or change your password
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 font-medium">
              If you usually use a magic link or Google, set a password here to enable email-and-password sign-in.
            </p>
          </div>
        </div>

        <form
          onSubmit={changePassword}
          className="mt-5 grid gap-3.5 sm:grid-cols-2 text-xs"
        >
          <label className="block font-bold text-zinc-700">
            New password
            <input
              required
              minLength="6"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="control mt-1.5 w-full text-xs rounded-xl"
            />
          </label>

          <label className="block font-bold text-zinc-700">
            Confirm password
            <input
              required
              minLength="6"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="control mt-1.5 w-full text-xs rounded-xl"
            />
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-2.5 pt-1">
            <button disabled={saving} className="button-primary text-xs py-2 px-4 rounded-full font-bold">
              <KeyRound size={14} /> Save password
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={sendReset}
              className="button-secondary text-xs py-2 px-4 rounded-full font-bold"
            >
              Email a reset link
            </button>
          </div>
        </form>

        {message && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-violet-50 p-3 text-xs font-bold text-violet-700 border border-violet-200/70"
          >
            <CheckCircle2 size={15} />
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
