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
    <div className="relative px-1 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.05] px-3 py-3 text-left transition hover:bg-white/[.08]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-400/15 text-violet-200">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-zinc-100">
            {activeWorkspace?.name || "Loading…"}
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">
            {activeWorkspace?.type || "workspace"}
          </span>
        </span>
        <ChevronDown size={15} className="text-zinc-500" />
      </button>
      {open && (
        <div className="absolute left-1 right-1 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/[.1] bg-[#232326] p-2 shadow-2xl">
          {creating ? (
            <form onSubmit={submit} className="space-y-3 p-2">
              <p className="text-sm font-bold">New team workspace</p>
              <input
                autoFocus
                required
                maxLength="120"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Sales"
                className="w-full rounded-xl border border-white/[.1] bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              {error && <p className="text-xs text-rose-300">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-3 py-2 text-sm text-zinc-400"
                >
                  Cancel
                </button>
                <button className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-zinc-900">
                  Create
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="max-h-44 overflow-y-auto">
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
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${workspace.id === activeWorkspace?.id ? "bg-white/[.1] text-white" : "text-zinc-400 hover:bg-white/[.05]"}`}
                    >
                      <ItemIcon size={15} />
                      <span className="truncate font-semibold">
                        {workspace.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeWorkspace?.type === "team" && (
                <button
                  onClick={() => setInviteOpen(!inviteOpen)}
                  className="mt-1 flex w-full items-center gap-2 border-t border-white/[.08] px-3 pt-3 text-sm font-semibold text-violet-200"
                >
                  <Link2 size={15} /> Copy invite link
                </button>
              )}
              {inviteOpen && (
                <form
                  onSubmit={invite}
                  className="mt-2 space-y-2 rounded-xl bg-black/20 p-2"
                >
                  <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">
                    Partner email
                    <input
                      autoFocus
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="partner@agency.com"
                      className="mt-1 w-full rounded-xl border border-white/[.1] bg-black/30 px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteOpen(false)}
                      className="px-2 py-1.5 text-xs text-zinc-400"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={inviting}
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-zinc-900"
                    >
                      {inviting ? "Creating…" : "Copy link"}
                    </button>
                  </div>
                </form>
              )}
              <button
                onClick={() => setCreating(true)}
                className="mt-3 flex w-full items-center gap-2 px-3 text-sm font-semibold text-violet-200"
              >
                <Plus size={16} /> Create team workspace
              </button>
              {error && (
                <p className="px-3 pt-2 text-xs text-rose-300">{error}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
