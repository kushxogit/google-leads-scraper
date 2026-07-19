import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";

export default function InviteAccept() {
  const [params] = useSearchParams();
  const { refreshWorkspaces, selectWorkspace } = useAuthWorkspace();
  const [message, setMessage] = useState("Joining your workspace…");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setMessage("This invitation link is invalid.");
      return;
    }
    supabase
      .rpc("accept_workspace_invite", { p_token: token })
      .then(async ({ data, error }) => {
        if (error) return setMessage(error.message);
        await refreshWorkspaces();
        selectWorkspace(data);
        setDone(true);
        setMessage("You are in. Your shared workspace is ready.");
      });
  }, [params, refreshWorkspaces, selectWorkspace]);
  return (
    <div className="mx-auto grid min-h-[65vh] max-w-xl place-items-center">
      <section className="panel w-full overflow-hidden p-8 text-center">
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-3xl ${done ? "bg-emerald-100 text-emerald-600" : "liquid-button text-white"}`}
        >
          {done ? <Check size={26} /> : <Sparkles size={24} />}
        </span>
        <p className="eyebrow mt-6">Workspace invitation</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">
          {done ? "Welcome aboard." : "Preparing your space."}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
          {message}
        </p>
        <Link to="/" className="button-primary mt-7">
          Go to workspace
        </Link>
      </section>
    </div>
  );
}
