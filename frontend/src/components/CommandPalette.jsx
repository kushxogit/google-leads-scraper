import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare2,
  NotebookPen,
  Plus,
  Search,
  Target,
  Users,
  X,
} from "lucide-react";
import AddLeadModal from "./AddLeadModal";
import TaskModal from "./TaskModal";
import { useWorkspaceLeads } from "../hooks/useCrm";
import { useWorkspaceTasks } from "../hooks/useTasks";

export default function CommandPalette({
  open,
  onClose,
  initialCreate = false,
}) {
  const navigate = useNavigate();
  const { leads } = useWorkspaceLeads();
  const taskApi = useWorkspaceTasks();
  const [query, setQuery] = useState("");
  const [leadOpen, setLeadOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      if (initialCreate) setTaskOpen(true);
    }
  }, [initialCreate, open]);

  useEffect(() => {
    const listener = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return [
      ...leads.map((lead) => ({
        id: lead.id,
        type: "lead",
        title: lead.business_name,
        detail: [lead.niche, lead.area].filter(Boolean).join(" · "),
        path: `/leads/${lead.id}`,
      })),
      ...taskApi.tasks.map((task) => ({
        id: task.id,
        type: "task",
        title: task.title,
        detail: task.leads?.name || "Workspace task",
        path: `/rewind?task=${task.id}`,
      })),
    ]
      .filter((item) =>
        `${item.title} ${item.detail}`.toLowerCase().includes(needle),
      )
      .slice(0, 10);
  }, [leads, query, taskApi.tasks]);

  const go = (path) => {
    navigate(path);
    onClose();
  };

  if (!open && !leadOpen && !taskOpen) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex justify-center bg-zinc-950/20 p-3 pt-[10vh] backdrop-blur-xs"
          onMouseDown={onClose}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Search and create"
            onMouseDown={(event) => event.stopPropagation()}
            className="h-fit w-full max-w-2xl overflow-hidden rounded-[26px] border border-white bg-white/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5">
              <Search size={18} className="text-violet-600 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leads and tasks, or choose an action"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400"
              />
              <button
                onClick={onClose}
                aria-label="Close command palette"
                className="grid h-7 w-7 place-items-center rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition"
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
              <p className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Quick actions
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <Action
                  icon={Plus}
                  label="New opportunity"
                  detail="Add a lead to Pipeline"
                  onClick={() => {
                    onClose();
                    setLeadOpen(true);
                  }}
                />
                <Action
                  icon={CheckSquare2}
                  label="New task"
                  detail="Plan shared work"
                  onClick={() => {
                    onClose();
                    setTaskOpen(true);
                  }}
                />
                <Action
                  icon={CalendarDays}
                  label="Open Today"
                  detail="See your task timeline"
                  onClick={() => go("/rewind")}
                />
                <Action
                  icon={NotebookPen}
                  label="Open notes"
                  detail="Capture private or shared context"
                  onClick={() => go("/notes")}
                />
                <Action
                  icon={Target}
                  label="Find leads"
                  detail="Launch a Google Maps scan"
                  onClick={() => go("/jobs")}
                />
              </div>

              {query && (
                <>
                  <p className="mt-3 px-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Results
                  </p>
                  <div className="space-y-1.5">
                    {results.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => go(item.path)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-white/80 p-2.5 text-left hover:bg-violet-50/80 transition"
                      >
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-xl ${item.type === "lead" ? "bg-cyan-100 text-cyan-800" : "bg-violet-100 text-violet-800"}`}
                        >
                          {item.type === "lead" ? (
                            <Users size={15} />
                          ) : (
                            <CheckSquare2 size={15} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-extrabold text-zinc-950">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] font-semibold text-zinc-400">
                            {item.detail || item.type}
                          </span>
                        </span>
                      </button>
                    ))}
                    {!results.length && (
                      <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400 font-medium">
                        No matching leads or tasks.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      <AddLeadModal isOpen={leadOpen} onClose={() => setLeadOpen(false)} />
      <TaskModal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        onSave={taskApi.createTask}
        members={taskApi.members}
        defaultOwnerId={taskApi.currentUserId}
        leads={leads}
      />
    </>
  );
}

function Action({ icon: Icon, label, detail, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white/90 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/50 shadow-2xs"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-950 text-white shadow-2xs">
        <Icon size={15} />
      </span>
      <span>
        <span className="block text-xs font-extrabold text-zinc-950">{label}</span>
        <span className="mt-0.5 block text-[11px] font-semibold text-zinc-400">{detail}</span>
      </span>
    </button>
  );
}
