import { useEffect, useState } from "react";
import { CalendarClock, Check, Link2, Users, X } from "lucide-react";
import { TASK_CATEGORIES } from "../hooks/useTasks";

const empty = {
  title: "",
  description: "",
  category: "development",
  priority: "medium",
  lead_id: "",
  due_at: "",
  scheduled_start: "",
  scheduled_end: "",
  assignee_ids: [],
  calendar_sync_enabled: false,
};

export default function TaskModal({
  open,
  onClose,
  onSave,
  members = [],
  defaultOwnerId = "",
  leads = [],
  initialLeadId = "",
  initialValues,
  task,
}) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setForm(
      task
        ? {
            ...empty,
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            assignee_ids: task.assignee_ids ?? [],
            calendar_sync_enabled: task.calendar_sync_enabled,
            lead_id: task.lead_id || "",
            due_at: localValue(task.due_at),
            scheduled_start: localValue(task.scheduled_start),
            scheduled_end: localValue(task.scheduled_end),
          }
        : {
            ...empty,
            title: initialValues?.title ?? "",
            category: initialValues?.category ?? "development",
            lead_id: initialLeadId,
            assignee_ids: defaultOwnerId ? [defaultOwnerId] : [],
          },
    );
    setError("");
  }, [
    defaultOwnerId,
    initialLeadId,
    initialValues?.category,
    initialValues?.title,
    open,
    task,
  ]);
  if (!open) return null;
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleOwner = (id) =>
    set(
      "assignee_ids",
      form.assignee_ids.includes(id)
        ? form.assignee_ids.filter((item) => item !== id)
        : form.assignee_ids.length < 2
          ? [...form.assignee_ids, id]
          : form.assignee_ids,
    );
  const submit = async (event) => {
    event.preventDefault();
    if (
      form.scheduled_start &&
      form.scheduled_end &&
      new Date(form.scheduled_end) <= new Date(form.scheduled_start)
    )
      return setError("End time must be after start time.");
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        due_at: iso(form.due_at),
        scheduled_start: iso(form.scheduled_start),
        scheduled_end: iso(form.scheduled_end),
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/35 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-5 sm:p-7"
      >
        <header className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Shared work</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">
              {task ? "Edit task" : "Plan the next move"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-500"
          >
            <X size={17} />
          </button>
        </header>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-bold">
            Task title
            <input
              autoFocus
              required
              maxLength="240"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="control mt-2 w-full"
              placeholder="Prepare proposal for Acme"
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Notes
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="control mt-2 w-full resize-none"
              placeholder="Context, outcome, or links…"
            />
          </label>
          <label className="text-sm font-bold">
            Category
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="control mt-2 w-full"
            >
              {Object.entries(TASK_CATEGORIES).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Priority
            <select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              className="control mt-2 w-full"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            <span className="flex items-center gap-2">
              <Link2 size={14} /> Linked opportunity
            </span>
            <select
              value={form.lead_id}
              onChange={(e) => set("lead_id", e.target.value)}
              className="control mt-2 w-full"
            >
              <option value="">No linked opportunity</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.business_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Due date
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => set("due_at", e.target.value)}
              className="control mt-2 w-full"
            />
          </label>
          <label className="text-sm font-bold">
            Starts
            <input
              type="datetime-local"
              value={form.scheduled_start}
              onChange={(e) => set("scheduled_start", e.target.value)}
              className="control mt-2 w-full"
            />
          </label>
          <label className="text-sm font-bold">
            Ends
            <input
              type="datetime-local"
              value={form.scheduled_end}
              onChange={(e) => set("scheduled_end", e.target.value)}
              className="control mt-2 w-full"
            />
          </label>
        </div>
        <section className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-violet-600" />
            <p className="text-sm font-extrabold">Owners</p>
            <span className="ml-auto text-xs text-zinc-400">
              Choose up to two
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {members.map((member) => {
              const active = form.assignee_ids.includes(member.id);
              return (
                <button
                  type="button"
                  key={member.id}
                  onClick={() => toggleOwner(member.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold ${active ? "border-violet-200 bg-violet-100 text-violet-800" : "border-zinc-200 bg-white text-zinc-500"}`}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[10px]">
                    {active ? (
                      <Check size={13} />
                    ) : (
                      (member.full_name || member.email)[0].toUpperCase()
                    )}
                  </span>
                  {member.full_name || member.email}
                </button>
              );
            })}
          </div>
        </section>
        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-100 p-4 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.calendar_sync_enabled}
            onChange={(e) => set("calendar_sync_enabled", e.target.checked)}
            className="accent-violet-600"
          />
          <CalendarClock size={17} className="text-violet-600" /> Publish
          scheduled time to Google Calendar
        </label>
        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">
            {error}
          </p>
        )}
        <footer className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="button-secondary">
            Cancel
          </button>
          <button disabled={saving} className="button-primary">
            {saving ? "Saving…" : task ? "Save changes" : "Create task"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}
function localValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
