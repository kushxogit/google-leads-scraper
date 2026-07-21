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
          className="fixed inset-0 z-[90] flex justify-center bg-zinc-950/35 p-3 pt-[10vh] backdrop-blur-sm"
          onMouseDown={onClose}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Search and create"
            onMouseDown={(event) => event.stopPropagation()}
            className="h-fit w-full max-w-2xl overflow-hidden rounded-[28px] border border-white bg-white/95 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5">
              <Search size={19} className="text-violet-500" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leads and tasks, or choose an action"
                className="h-16 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400"
              />
              <button
                onClick={onClose}
                aria-label="Close command palette"
                className="text-zinc-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              <p className="px-2 py-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-zinc-400">
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
                  label="Open today"
                  detail="View the Rewind timeline"
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
                  label="Launch scraper"
                  detail="Find pipeline opportunities"
                  onClick={() => go("/jobs")}
                />
              </div>
              {query && (
                <>
                  <p className="mt-3 px-2 py-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-zinc-400">
                    Results
                  </p>
                  <div className="space-y-1">
                    {results.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => go(item.path)}
                        className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-violet-50"
                      >
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-2xl ${item.type === "lead" ? "bg-cyan-100 text-cyan-700" : "bg-violet-100 text-violet-700"}`}
                        >
                          {item.type === "lead" ? (
                            <Users size={16} />
                          ) : (
                            <CheckSquare2 size={16} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-extrabold">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-400">
                            {item.detail || item.type}
                          </span>
                        </span>
                      </button>
                    ))}
                    {!results.length && (
                      <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
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
      className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-zinc-950 text-white">
        <Icon size={16} />
      </span>
      <span>
        <span className="block text-sm font-extrabold">{label}</span>
        <span className="mt-0.5 block text-xs text-zinc-400">{detail}</span>
      </span>
    </button>
  );
}
