import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import {
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  ExternalLink,
  Flag,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Send,
  Square,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  TASK_CATEGORIES,
  PROJECT_COLORS,
  useTaskComments,
  useTaskChecklistItems,
} from "../hooks/useTasks";
import { useFeedback } from "../context/feedback";

const PRIORITY_CONFIG = {
  low:    { label: "Low",    color: "text-zinc-500",   bg: "bg-zinc-100",   icon: "▽" },
  medium: { label: "Medium", color: "text-amber-600",  bg: "bg-amber-50",   icon: "◈" },
  high:   { label: "High",   color: "text-orange-600", bg: "bg-orange-50",  icon: "▲" },
  urgent: { label: "Urgent", color: "text-rose-600",   bg: "bg-rose-50",    icon: "⚡" },
};

const STATUS_CONFIG = {
  unplanned:   { label: "Unplanned",   dot: "bg-zinc-400",   ring: "ring-zinc-200",   next: "planned"    },
  planned:     { label: "Planned",     dot: "bg-blue-500",   ring: "ring-blue-200",   next: "in_progress"},
  in_progress: { label: "In Progress", dot: "bg-violet-500", ring: "ring-violet-200", next: "waiting"    },
  waiting:     { label: "Waiting",     dot: "bg-amber-500",  ring: "ring-amber-200",  next: "done"       },
  done:        { label: "Done",        dot: "bg-emerald-500",ring: "ring-emerald-200",next: "unplanned"  },
  cancelled:   { label: "Cancelled",   dot: "bg-red-400",    ring: "ring-red-200",    next: "unplanned"  },
};

export default function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
  members = [],
  projects = [],
  leads = [],
  currentUserId,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [addingCheck, setAddingCheck] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const checkRef = useRef(null);
  const { confirm } = useFeedback();

  const comments = useTaskComments(task?.id);
  const checklist = useTaskChecklistItems(task?.id);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (addingCheck && checkRef.current) checkRef.current.focus();
  }, [addingCheck]);

  if (!task) return null;

  const cat = TASK_CATEGORIES[task.category] ?? TASK_CATEGORIES.development;
  const prio = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.unplanned;
  const project = projects.find((p) => p.id === task.project_id);
  const projectColor = project ? (PROJECT_COLORS[project.color] ?? PROJECT_COLORS.violet) : null;

  const save = (changes) => onUpdate(task.id, changes);

  const commitTitle = async () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== task.title)
      await save({ title: titleDraft.trim() });
  };

  const commitDesc = async () => {
    setEditingDesc(false);
    if (descDraft !== task.description)
      await save({ description: descDraft });
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      await onUpdate.__addComment(task.id, comment);
      setComment("");
    } finally {
      setSending(false);
    }
  };

  const addCheckItem = async (e) => {
    e.preventDefault();
    if (!newCheckItem.trim()) return;
    await checklist.addItem(newCheckItem);
    setNewCheckItem("");
    setAddingCheck(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this task?",
      description: "This will permanently remove the task and all its comments and checklist items.",
      confirmLabel: "Delete task",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try { await onDelete(task.id); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-zinc-950/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[560px] flex-col bg-white shadow-[−24px_0_80px_rgba(0,0,0,.12)] animate-in slide-in-from-right duration-300"
        style={{ borderLeft: "1px solid rgba(0,0,0,.07)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-zinc-100 px-5 py-4">
          {/* Status dot with cycle */}
          <button
            onClick={() => save({ status: status.next })}
            title={`Status: ${status.label} — click to advance`}
            className={`mt-1 h-4 w-4 shrink-0 rounded-full ring-2 ${status.dot} ${status.ring} transition hover:scale-110`}
          />
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <input
                ref={titleRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTitle(); } }}
                className="w-full text-lg font-extrabold tracking-tight text-zinc-950 outline-none border-b-2 border-violet-400 pb-0.5 bg-transparent"
              />
            ) : (
              <h2
                onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                className="cursor-text text-lg font-extrabold tracking-tight text-zinc-950 hover:text-violet-700 transition line-clamp-2"
              >
                {task.title}
              </h2>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {/* Status dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setStatusOpen((o) => !o); setPriorityOpen(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
                >
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  {status.label}
                  <ChevronDown size={11} />
                </button>
                {statusOpen && (
                  <div className="absolute left-0 top-7 z-10 min-w-[150px] rounded-2xl border border-zinc-100 bg-white p-1 shadow-xl">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => { save({ status: key }); setStatusOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 ${task.status === key ? "text-violet-700" : "text-zinc-700"}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Priority */}
              <div className="relative">
                <button
                  onClick={() => { setPriorityOpen((o) => !o); setStatusOpen(false); }}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold transition hover:opacity-80 ${prio.bg} ${prio.color} border-current/20`}
                >
                  <span>{prio.icon}</span> {prio.label}
                  <ChevronDown size={11} />
                </button>
                {priorityOpen && (
                  <div className="absolute left-0 top-7 z-10 min-w-[130px] rounded-2xl border border-zinc-100 bg-white p-1 shadow-xl">
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => { save({ priority: key }); setPriorityOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 ${cfg.color}`}
                      >
                        <span>{cfg.icon}</span> {cfg.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Project badge */}
              {project && (
                <span className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${projectColor.light} ${projectColor.text} ${projectColor.border}`}>
                  {project.emoji && <span>{project.emoji}</span>}
                  {project.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete task"
              className="grid h-8 w-8 place-items-center rounded-xl text-zinc-400 hover:bg-rose-50 hover:text-rose-500 transition"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 px-5 py-4 text-xs">
            {/* Assignees */}
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1"><Users size={10} /> Assignees</p>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const assigned = task.assignee_ids?.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      title={m.full_name || m.email}
                      onClick={() => {
                        const cur = task.assignee_ids ?? [];
                        const next = assigned
                          ? cur.filter((id) => id !== m.id)
                          : cur.length < 2 ? [...cur, m.id] : cur;
                        save({ assignee_ids: next });
                      }}
                      className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] font-extrabold transition ${assigned ? "border-violet-400 bg-violet-100 text-violet-700" : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-violet-300"}`}
                    >
                      {assigned ? <Check size={12} /> : (m.full_name || m.email)[0].toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1"><Tag size={10} /> Category</p>
              <select
                value={task.category}
                onChange={(e) => save({ category: e.target.value })}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 outline-none focus:border-violet-400"
              >
                {Object.entries(TASK_CATEGORIES).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1"><Clock size={10} /> Due date</p>
              <input
                type="datetime-local"
                value={task.due_at ? localDt(task.due_at) : ""}
                onChange={(e) => save({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 outline-none focus:border-violet-400"
              />
            </div>

            {/* Project */}
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1"><Zap size={10} /> Project</p>
              <select
                value={task.project_id ?? ""}
                onChange={(e) => save({ project_id: e.target.value || null })}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 outline-none focus:border-violet-400"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji ? `${p.emoji} ` : ""}{p.name}</option>
                ))}
              </select>
            </div>

            {/* Linked lead */}
            {leads.length > 0 && (
              <div className="col-span-2">
                <p className="eyebrow mb-2 flex items-center gap-1"><Link2 size={10} /> Linked lead</p>
                <div className="flex items-center gap-2">
                  <select
                    value={task.lead_id ?? ""}
                    onChange={(e) => save({ lead_id: e.target.value || null })}
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 outline-none focus:border-violet-400"
                  >
                    <option value="">No linked lead</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  {task.lead_id && (
                    <Link to={`/leads/${task.lead_id}`} onClick={onClose} className="grid h-7 w-7 place-items-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-violet-100 hover:text-violet-600 transition">
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="eyebrow mb-2">Notes</p>
            {editingDesc ? (
              <textarea
                ref={descRef}
                autoFocus
                rows={4}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={commitDesc}
                className="w-full resize-none rounded-xl border border-violet-300 bg-violet-50/50 px-3 py-2 text-sm text-zinc-800 outline-none ring-4 ring-violet-100"
                placeholder="Add context, links, or outcomes…"
              />
            ) : (
              <p
                onClick={() => { setDescDraft(task.description || ""); setEditingDesc(true); }}
                className={`cursor-text rounded-xl px-3 py-2 text-sm leading-6 transition hover:bg-zinc-50 ${task.description ? "text-zinc-700" : "text-zinc-400"}`}
              >
                {task.description || "Click to add notes…"}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="border-b border-zinc-100 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare size={14} className="text-violet-500" />
                <p className="text-sm font-extrabold">Checklist</p>
                {checklist.total > 0 && (
                  <span className="text-xs font-bold text-zinc-400">
                    {checklist.done}/{checklist.total}
                  </span>
                )}
              </div>
              <button
                onClick={() => setAddingCheck(true)}
                className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition"
              >
                <Plus size={12} /> Add item
              </button>
            </div>

            {/* Progress bar */}
            {checklist.total > 0 && (
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${checklist.progress}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {checklist.items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  onToggle={(completed) => checklist.toggleItem(item.id, completed)}
                  onDelete={() => checklist.deleteItem(item.id)}
                  onEdit={(body) => checklist.updateItem(item.id, body)}
                />
              ))}
            </div>

            {addingCheck && (
              <form onSubmit={addCheckItem} className="mt-2 flex gap-2">
                <input
                  ref={checkRef}
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onBlur={() => { if (!newCheckItem.trim()) setAddingCheck(false); }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setAddingCheck(false); setNewCheckItem(""); } }}
                  placeholder="Add checklist item…"
                  className="flex-1 rounded-xl border border-violet-300 bg-violet-50/50 px-3 py-1.5 text-sm outline-none focus:ring-4 focus:ring-violet-100"
                />
                <button type="submit" disabled={!newCheckItem.trim()} className="button-primary py-1.5 px-3 text-xs">
                  Add
                </button>
              </form>
            )}

            {checklist.total === 0 && !addingCheck && (
              <p className="text-xs text-zinc-400">No checklist items yet.</p>
            )}
          </div>

          {/* Comments */}
          <div className="px-5 py-4">
            <p className="eyebrow mb-3 flex items-center gap-1.5">
              <MessageSquare size={10} /> Comments ({(comments.data ?? []).length})
            </p>
            <div className="space-y-3 mb-4">
              {(comments.data ?? []).map((c) => {
                const author = members.find((m) => m.id === c.author_id);
                const isMe = c.author_id === currentUserId;
                return (
                  <div key={c.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${isMe ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {(author?.full_name || author?.email || "?")?.[0].toUpperCase()}
                    </span>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-5 ${isMe ? "bg-violet-600 text-white rounded-tr-sm" : "bg-zinc-100 text-zinc-800 rounded-tl-sm"}`}>
                      <p>{c.body}</p>
                      <p className={`mt-1 text-[10px] ${isMe ? "text-violet-200" : "text-zinc-400"}`}>
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!(comments.data ?? []).length && (
                <p className="text-xs text-zinc-400">No comments yet. Start the conversation!</p>
              )}
            </div>

            {/* Comment form */}
            <form onSubmit={sendComment} className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment… (@mention to notify)"
                className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={!comment.trim() || sending}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-white disabled:opacity-40 hover:-translate-y-0.5 transition"
              >
                <Send size={15} />
              </button>
            </form>
          </div>

          {/* Footer metadata */}
          <div className="border-t border-zinc-100 px-5 py-3">
            <p className="text-[10px] text-zinc-400">
              Created {format(new Date(task.created_at), "MMM d, yyyy 'at' h:mm a")}
              {task.completed_at && (
                <> · Completed {format(new Date(task.completed_at), "MMM d, yyyy")}</>
              )}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Checklist Item ───────────────────────────────────────────────────────────

function ChecklistItem({ item, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);

  const commit = async () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== item.body) await onEdit(draft.trim());
    else setDraft(item.body);
  };

  return (
    <div className="group flex items-center gap-2.5 rounded-xl px-1 py-0.5 hover:bg-zinc-50">
      <button
        onClick={() => onToggle(!item.completed)}
        className={`shrink-0 transition ${item.completed ? "text-emerald-500" : "text-zinc-300 hover:text-zinc-500"}`}
      >
        {item.completed ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setEditing(false); setDraft(item.body); } }}
          className="flex-1 rounded-lg border border-violet-300 bg-violet-50/50 px-2 py-0.5 text-sm outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => { setDraft(item.body); setEditing(true); }}
          className={`flex-1 text-sm cursor-default select-none ${item.completed ? "line-through text-zinc-400" : "text-zinc-800"}`}
        >
          {item.body}
        </span>
      )}

      <button
        onClick={onDelete}
        className="shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function localDt(value) {
  if (!value) return "";
  const d = new Date(value);
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
