import { useMemo, useState } from "react";
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquare,
  Plus,
  RotateCcw,
} from "lucide-react";
import TaskModal from "../components/TaskModal";
import { useWorkspaceLeads } from "../hooks/useCrm";
import {
  TASK_CATEGORIES,
  useCalendarEvents,
  useTaskComments,
  useWorkspaceTasks,
} from "../hooks/useTasks";
import { useAuthWorkspace } from "../context/AuthWorkspaceContext";

const DAY_START = 7;
const DAY_END = 21;
const HOUR_HEIGHT = 76;

export default function Rewind() {
  const { user } = useAuthWorkspace();
  const { leads } = useWorkspaceLeads();
  const taskApi = useWorkspaceTasks();
  const [view, setView] = useState("today");
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [owner, setOwner] = useState("all");
  const [category, setCategory] = useState("all");
  const range = useMemo(() => {
    const start =
      view === "week"
        ? startOfWeek(cursor, { weekStartsOn: 1 })
        : startOfDay(cursor);
    return {
      start,
      end:
        view === "week"
          ? endOfWeek(cursor, { weekStartsOn: 1 })
          : endOfDay(cursor),
    };
  }, [cursor, view]);
  const calendar = useCalendarEvents(
    range.start.toISOString(),
    range.end.toISOString(),
  );
  const filtered = taskApi.tasks.filter(
    (task) =>
      (owner === "all" || task.assignee_ids.includes(owner)) &&
      (category === "all" || task.category === category) &&
      !["cancelled"].includes(task.status),
  );
  const planned = filtered.filter(
    (task) =>
      task.scheduled_start &&
      new Date(task.scheduled_start) >= range.start &&
      new Date(task.scheduled_start) <= range.end,
  );
  const unplanned = filtered.filter(
    (task) => !task.scheduled_start && task.status !== "done",
  );
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(range.start, index))
      : [cursor];
  const schedule = async (taskId, day, hour = 9) => {
    const start = new Date(day);
    const wholeHour = Math.floor(hour);
    start.setHours(wholeHour, Math.round((hour - wholeHour) * 60), 0, 0);
    const existing = taskApi.tasks.find((task) => task.id === taskId);
    const duration =
      existing?.scheduled_start && existing?.scheduled_end
        ? Math.max(
            30 * 60000,
            new Date(existing.scheduled_end) -
              new Date(existing.scheduled_start),
          )
        : 60 * 60000;
    const end = new Date(start.getTime() + duration);
    const conflict = (calendar.data ?? []).some(
      (event) =>
        new Date(event.starts_at) < end && new Date(event.ends_at) > start,
    );
    if (
      conflict &&
      !window.confirm(
        "This time overlaps a Google Calendar event. Schedule it anyway?",
      )
    )
      return;
    await taskApi.updateTask(taskId, {
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      status: "planned",
    });
  };
  const save = async (values) =>
    editing
      ? taskApi.updateTask(editing.id, values)
      : taskApi.createTask(values);
  if (taskApi.isLoading)
    return <div className="panel p-8 text-zinc-500">Opening your day…</div>;
  return (
    <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
      <header className="relative overflow-hidden rounded-[30px] bg-[#171719] p-6 text-white shadow-[0_20px_50px_rgba(50,35,105,.22)] sm:p-7">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-violet-500/70 blur-[72px]" />
        <div className="absolute right-[28%] top-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-[55px]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200">
              <RotateCcw size={13} /> Rewind
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.06em] sm:text-5xl">
              Own the day.
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Calls, delivery, and every next move in one shared rhythm.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-zinc-950"
          >
            <Plus size={17} /> Add task
          </button>
        </div>
      </header>
      <section className="panel flex flex-wrap items-center gap-2 p-3">
        <div className="flex rounded-2xl bg-zinc-100 p-1">
          {[
            ["today", "Today"],
            ["week", "Week"],
            ["team", "Team"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-xl px-3 py-2 text-xs font-extrabold ${view === key ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-1 flex items-center gap-1">
          <button
            aria-label="Previous"
            onClick={() =>
              setCursor(addDays(cursor, view === "week" ? -7 : -1))
            }
            className="grid h-9 w-9 place-items-center rounded-xl hover:bg-zinc-100"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() => setCursor(startOfDay(new Date()))}
            className="rounded-xl px-3 py-2 text-xs font-bold hover:bg-zinc-100"
          >
            Today
          </button>
          <button
            aria-label="Next"
            onClick={() => setCursor(addDays(cursor, view === "week" ? 7 : 1))}
            className="grid h-9 w-9 place-items-center rounded-xl hover:bg-zinc-100"
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <p className="min-w-[170px] text-sm font-extrabold">
          {view === "week"
            ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
            : format(cursor, "EEEE, MMMM d")}
        </p>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="control ml-auto py-2 text-xs"
        >
          <option value="all">Everyone</option>
          {taskApi.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === user.id
                ? "My work"
                : member.full_name || member.email}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="control py-2 text-xs"
        >
          <option value="all">All categories</option>
          {Object.entries(TASK_CATEGORIES).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
      </section>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Unplanned tasks={unplanned} api={taskApi} onOpen={setSelectedTask} />
        {view === "team" ? (
          <TeamView
            tasks={filtered}
            members={taskApi.members}
            onOpen={setSelectedTask}
          />
        ) : (
          <Timeline
            days={days}
            tasks={planned}
            events={calendar.data ?? []}
            onDrop={schedule}
            onOpen={setSelectedTask}
          />
        )}
      </div>
      <TaskModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={save}
        members={taskApi.members}
        defaultOwnerId={taskApi.currentUserId}
        leads={leads}
        task={editing}
      />
      {selectedTask && (
        <TaskDrawer
          task={
            taskApi.tasks.find((item) => item.id === selectedTask.id) ||
            selectedTask
          }
          members={taskApi.members}
          api={taskApi}
          onClose={() => setSelectedTask(null)}
          onEdit={(task) => {
            setSelectedTask(null);
            setEditing(task);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

function Unplanned({ tasks, api, onOpen }) {
  return (
    <aside className="panel h-fit p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <Clock3 size={17} />
        </span>
        <div>
          <p className="text-sm font-extrabold">Unplanned</p>
          <p className="text-xs text-zinc-400">Drag into your day</p>
        </div>
        <span className="mono ml-auto text-xs text-zinc-400">
          {tasks.length}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={api.members}
            onOpen={onOpen}
          />
        ))}
        {!tasks.length && (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
            Everything has a place.
          </div>
        )}
      </div>
    </aside>
  );
}

function Timeline({ days, tasks, events, onDrop, onOpen }) {
  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[680px]"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(150px, 1fr))`,
          }}
        >
          <div className="border-b border-r border-zinc-100" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`border-b border-zinc-100 p-3 text-center ${isSameDay(day, new Date()) ? "bg-violet-50/60" : ""}`}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400">
                {format(day, "EEE")}
              </p>
              <p className="mt-1 text-lg font-extrabold">{format(day, "d")}</p>
            </div>
          ))}
          <div
            className="relative border-r border-zinc-100"
            style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}
          >
            {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
              <span
                key={i}
                className="absolute right-3 text-[10px] font-bold text-zinc-400"
                style={{ top: i * HOUR_HEIGHT - 6 }}
              >
                {format(new Date(2020, 0, 1, DAY_START + i), "ha")}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              tasks={tasks.filter((task) =>
                isSameDay(new Date(task.scheduled_start), day),
              )}
              events={events.filter((event) =>
                isSameDay(new Date(event.starts_at), day),
              )}
              onDrop={onDrop}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DayColumn({ day, tasks, events, onDrop, onOpen }) {
  return (
    <div
      className="relative border-r border-zinc-100 last:border-r-0"
      style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const taskId = e.dataTransfer.getData("task-id");
        const rect = e.currentTarget.getBoundingClientRect();
        const hour = Math.min(
          DAY_END - 1,
          Math.max(
            DAY_START,
            DAY_START +
              Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 2) / 2,
          ),
        );
        if (taskId) onDrop(taskId, day, hour);
      }}
    >
      {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-zinc-100/80"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {events.map((event) => (
        <div
          key={event.id}
          className="absolute left-1 right-1 z-[1] rounded-xl border border-zinc-200 bg-zinc-100/90 px-2 py-1 text-[10px] font-bold text-zinc-500"
          style={blockStyle(event.starts_at, event.ends_at)}
        >
          {event.display_title}
        </div>
      ))}
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onOpen(task)}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("task-id", task.id)}
          className={`absolute left-2 right-2 z-[2] overflow-hidden rounded-2xl border p-2 text-left shadow-sm transition hover:z-10 hover:shadow-lg ${TASK_CATEGORIES[task.category].card}`}
          style={blockStyle(task.scheduled_start, task.scheduled_end)}
        >
          <span className="block text-[9px] font-extrabold uppercase tracking-wide opacity-65">
            {TASK_CATEGORIES[task.category].label}
          </span>
          <span className="mt-0.5 block truncate text-xs font-extrabold">
            {task.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function TeamView({ tasks, members, onOpen }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {members.map((member) => {
        const mine = tasks.filter(
          (task) =>
            task.assignee_ids.includes(member.id) && task.status !== "done",
        );
        return (
          <div key={member.id} className="panel p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 text-sm font-extrabold text-violet-700">
                {(member.full_name || member.email)[0].toUpperCase()}
              </span>
              <div>
                <p className="font-extrabold">
                  {member.full_name || member.email}
                </p>
                <p className="text-xs text-zinc-400">
                  {mine.length} active ·{" "}
                  {mine.filter((task) => task.scheduled_start).length} planned
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {mine.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  members={members}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function TaskCard({ task, members, onOpen }) {
  const category = TASK_CATEGORIES[task.category];
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("task-id", task.id)}
      onClick={() => onOpen(task)}
      className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${category.card}`}
    >
      <span className="text-[9px] font-extrabold uppercase tracking-[.12em] opacity-60">
        {category.label}
      </span>
      <p className="mt-1 text-sm font-extrabold leading-5">{task.title}</p>
      <div className="mt-2 flex items-center gap-1">
        {task.assignee_ids.map((id) => (
          <span
            key={id}
            title={members.find((m) => m.id === id)?.full_name}
            className="grid h-6 w-6 place-items-center rounded-full border border-white bg-white/80 text-[9px] font-extrabold"
          >
            {(members.find((m) => m.id === id)?.full_name ||
              members.find((m) => m.id === id)?.email ||
              "?")[0].toUpperCase()}
          </span>
        ))}
        {task.leads?.name && (
          <span className="ml-auto max-w-[120px] truncate text-[10px] font-bold opacity-60">
            {task.leads.name}
          </span>
        )}
      </div>
    </button>
  );
}

function TaskDrawer({ task, members, api, onClose, onEdit }) {
  const comments = useTaskComments(task.id);
  const [body, setBody] = useState("");
  const category = TASK_CATEGORIES[task.category];
  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await api.addComment(task.id, body);
    setBody("");
    await comments.refetch();
  };
  return (
    <div
      className="fixed inset-0 z-[75] bg-zinc-950/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 right-0 top-0 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
      >
        <button onClick={onClose} className="text-sm font-bold text-zinc-400">
          Close
        </button>
        <div
          className={`mt-5 inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${category.card}`}
        >
          {category.label}
        </div>
        <h2 className="mt-3 text-3xl font-extrabold tracking-[-.05em]">
          {task.title}
        </h2>
        {task.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
            {task.description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {task.assignee_ids.map((id) => (
            <span
              key={id}
              className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold"
            >
              {members.find((m) => m.id === id)?.full_name ||
                members.find((m) => m.id === id)?.email}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() =>
              api.updateTask(task.id, {
                status: task.status === "done" ? "planned" : "done",
              })
            }
            className="button-primary"
          >
            <CheckCircle2 size={16} />
            {task.status === "done" ? "Reopen" : "Complete"}
          </button>
          <button onClick={() => onEdit(task)} className="button-secondary">
            Edit
          </button>
        </div>
        <section className="mt-8 border-t border-zinc-100 pt-6">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            <h3 className="font-extrabold">Discussion</h3>
          </div>
          <form onSubmit={submit} className="mt-4 flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Comment or @mention…"
              className="control min-w-0 flex-1"
            />
            <button className="button-primary px-3">Send</button>
          </form>
          <div className="mt-5 space-y-4">
            {(comments.data ?? []).map((comment) => (
              <article
                key={comment.id}
                className="border-l-2 border-violet-200 pl-3"
              >
                <p className="text-sm text-zinc-700">{comment.body}</p>
                <p className="mt-1 text-[10px] text-zinc-400">
                  {format(new Date(comment.created_at), "MMM d · h:mm a")}
                </p>
              </article>
            ))}
            {!comments.data?.length && (
              <p className="text-sm text-zinc-400">No discussion yet.</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function blockStyle(startValue, endValue) {
  const start = new Date(startValue);
  const end = endValue
    ? new Date(endValue)
    : new Date(start.getTime() + 3600000);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const duration = Math.max(0.5, (end - start) / 3600000);
  return {
    top: Math.max(0, (startHour - DAY_START) * HOUR_HEIGHT),
    height: Math.max(38, duration * HOUR_HEIGHT - 4),
  };
}
