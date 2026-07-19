import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function CalendarCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Connecting Google Calendar…");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const code = params.get("code");
    const workspaceId = params.get("state");
    if (!code || !workspaceId) {
      setMessage(
        params.get("error") ||
          "Google did not return a valid authorization code.",
      );
      return;
    }
    supabase.functions
      .invoke("google-calendar-auth", {
        body: { action: "exchange", code, workspace_id: workspaceId },
      })
      .then(({ error }) => {
        if (error) return setMessage(error.message);
        setDone(true);
        setMessage("Google Calendar is connected.");
        window.setTimeout(() => navigate("/settings?calendar=connected"), 900);
      });
  }, [navigate, params]);
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center">
      <section className="panel w-full p-8 text-center">
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-3xl ${done ? "bg-emerald-100 text-emerald-600" : "bg-violet-100 text-violet-600"}`}
        >
          {done ? (
            <CheckCircle2 size={25} />
          ) : (
            <LoaderCircle className="animate-spin" size={25} />
          )}
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">Calendar connection</h1>
        <p className="mt-2 text-sm text-zinc-500">{message}</p>
      </section>
    </div>
  );
}
