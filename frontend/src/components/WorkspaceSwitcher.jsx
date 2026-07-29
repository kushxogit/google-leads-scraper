import { useState } from "react";
import { Building2, ChevronDown, Link2, Plus, UserRound } from "lucide-react";
import { useAuthWorkspace } from "../context/authWorkspace";
import { supabase } from "../lib/supabase";
import { useFeedback } from "../context/feedback";

export default function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, selectWorkspace, createTeamWorkspace } =
    useAuthWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const { notify } = useFeedback();

  const Icon = activeWorkspace?.type === "team" ? Building2 : UserRound;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createTeamWorkspace(name);
      setName("");
      setCreating(false);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    const { data, error: inviteError } = await supabase.rpc(
      "create_workspace_invite",
      { p_workspace_id: activeWorkspace.id, p_email: inviteEmail.trim() },
    );
    if (inviteError) {
      setInviting(false);
      return setError(inviteError.message);
    }
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite?token=${data}`,
    );
    setInviting(false);
    setInviteEmail("");
    setInviteOpen(false);
    notify("Invitation link copied. Send it to your partner.");
  };

  return (
    <div className="relative px-0.5 pb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-2 text-left transition hover:bg-white/10"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/20">
          <Icon size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-extrabold text-white">
            {activeWorkspace?.name || "Loading…"}
          </span>
          <span className="block text-[9px] font-extrabold uppercase tracking-wider text-zinc-400">
            {activeWorkspace?.type || "workspace"}
          </span>
        </span>
        <ChevronDown size={14} className="text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[22px] border border-white/10 bg-[#1c1c1f] p-2 shadow-2xl backdrop-blur-xl">
          {creating ? (
            <form onSubmit={submit} className="space-y-2.5 p-1.5">
              <p className="text-xs font-extrabold text-white">New team workspace</p>
              <input
                autoFocus
                required
                maxLength="120"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Sales"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none"
              />
              {error && <p className="text-[11px] font-bold text-rose-300">{error}</p>}
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-zinc-950">
                  Create
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {workspaces.map((workspace) => {
                  const ItemIcon =
                    workspace.type === "team" ? Building2 : UserRound;
                  return (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        selectWorkspace(workspace.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs ${workspace.id === activeWorkspace?.id ? "bg-white/10 text-white font-extrabold" : "text-zinc-400 hover:bg-white/5 hover:text-white font-medium"}`}
                    >
                      <ItemIcon size={14} className="shrink-0" />
                      <span className="truncate">
                        {workspace.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeWorkspace?.type === "team" && (
                <button
                  onClick={() => setInviteOpen(!inviteOpen)}
                  className="mt-1 flex w-full items-center gap-2 border-t border-white/10 px-2.5 pt-2.5 text-xs font-extrabold text-violet-300 hover:text-violet-200"
                >
                  <Link2 size={14} /> Copy invite link
                </button>
              )}

              {inviteOpen && (
                <form
                  onSubmit={invite}
                  className="mt-2 space-y-2 rounded-xl bg-black/30 p-2"
                >
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Partner email
                    <input
                      autoFocus
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="partner@agency.com"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                  </label>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInviteOpen(false)}
                      className="px-2 py-1 text-xs text-zinc-400"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={inviting}
                      className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-zinc-950"
                    >
                      {inviting ? "Creating…" : "Copy link"}
                    </button>
                  </div>
                </form>
              )}

              <button
                onClick={() => setCreating(true)}
                className="mt-2 flex w-full items-center gap-2 px-2.5 text-xs font-extrabold text-violet-300 hover:text-violet-200"
              >
                <Plus size={15} /> Create team workspace
              </button>
              {error && (
                <p className="px-2.5 pt-2 text-xs text-rose-300">{error}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
