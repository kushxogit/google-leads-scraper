import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parse as parseNaturalDate } from "chrono-node";
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import {
  CheckCircle2,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  MessageSquare,
  Flag,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import TaskModal from "../components/TaskModal";
import TaskDetailPanel from "../components/TaskDetailPanel";
import { useWorkspaceLeads } from "../hooks/useCrm";
import {
  TASK_CATEGORIES,
  useCalendarEvents,
  useTaskComments,
  useWorkspaceTasks,
} from "../hooks/useTasks";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useFeedback } from "../context/feedback";

const DAY_START = 7;
const DAY_END = 21;
const HOUR_HEIGHT = 76;

export default function Rewind() {
  const { user } = useAuthWorkspace();
  const { leads } = useWorkspaceLeads();
  const taskApi = useWorkspaceTasks();
  const { confirm } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("map");
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [owner, setOwner] = useState("all");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const taskId = searchParams.get("task");
    const target = taskApi.tasks.find((task) => task.id === taskId);
    if (target) setSelectedTask(target);
  }, [searchParams, taskApi.tasks]);

  const openTask = (task) => {
    setSelectedTask(task);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("task", task.id);
      return next;
    });
  };

  const closeTask = () => {
    setSelectedTask(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("task");
      return next;
    });
  };

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
  
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(range.start, index))
      : [cursor];

  const save = async (values) =>
    editing
      ? taskApi.updateTask(editing.id, values)
      : taskApi.createTask(values);

  if (taskApi.isLoading)
    return <div className="panel p-8 text-zinc-500 rounded-[24px]">Opening your day…</div>;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
      {/* Glass Header */}
      <header className="rounded-[26px] bg-[#171719] p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200">
              <CalendarClock size={14} /> Today's Focus & Schedule
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl text-white">
              {format(cursor, "EEEE, MMMM d, yyyy")}
            </h1>
            <p className="mt-1 text-xs text-zinc-300 font-medium">
              Calls, tasks, meetings, and lead follow-ups in one clear rhythm.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="button-primary liquid-button py-2 px-4 text-xs font-extrabold gap-2 rounded-full text-white shadow-md hover:scale-[1.01]"
            >
              <Plus size={15} /> New Task
            </button>
          </div>
        </div>

        {/* Today Summary Metrics Row */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <div className="rounded-2xl bg-white/10 p-3 border border-white/10 backdrop-blur-md">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-200">Planned Tasks</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{planned.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 border border-white/10 backdrop-blur-md">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-200">Calendar Events</p>
            <p className="text-xl font-extrabold text-violet-300 mt-0.5">{(calendar.data ?? []).length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 border border-white/10 backdrop-blur-md">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-200">Active View</p>
            <p className="text-xl font-extrabold text-white capitalize mt-0.5">{view}</p>
          </div>
        </div>
      </header>

      {/* Navigation Toolbar Dock */}
      <section className="panel flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-[22px] bg-white/70 border border-zinc-200/80 backdrop-blur-md shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex rounded-full bg-zinc-100/80 p-0.5 border border-zinc-200/60">
            {[
              ["map", "Day map"],
              ["today", "Timeline"],
              ["week", "Week"],
              ["team", "Team"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition ${
                  view === key ? "bg-zinc-950 text-white shadow-2xs" : "text-zinc-500 hover:text-zinc-950"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              aria-label="Previous"
              onClick={() => setCursor(addDays(cursor, view === "week" ? -7 : -1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 shadow-2xs"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCursor(startOfDay(new Date()))}
              className="rounded-full border border-zinc-200/80 bg-white px-3 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-50 shadow-2xs"
            >
              Today ({format(new Date(), "MMM d")})
            </button>
            <button
              aria-label="Next"
              onClick={() => setCursor(addDays(cursor, view === "week" ? 7 : 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 shadow-2xs"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="control rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-800 outline-none"
          >
            <option value="all">Everyone</option>
            {taskApi.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === user.id ? "My work" : member.full_name || member.email}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="control rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-800 outline-none"
          >
            <option value="all">All categories</option>
            {Object.entries(TASK_CATEGORIES).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {view === "map" ? (
        <PlanDay
          day={cursor}
          tasks={planned}
          events={calendar.data ?? []}
          onOpen={openTask}
        />
      ) : (
        <div className="flex-1">
          {view === "team" ? (
            <TeamView tasks={filtered} members={taskApi.members} onOpen={openTask} />
          ) : (
            <Timeline days={days} tasks={planned} events={calendar.data ?? []} onOpen={openTask} />
          )}
        </div>
      )}

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
        <TaskDetailPanel
          task={
            taskApi.tasks.find((item) => item.id === selectedTask.id) ||
            selectedTask
          }
          onClose={closeTask}
          onUpdate={(id, changes) => taskApi.updateTask(id, changes)}
          onDelete={(id) => taskApi.deleteTask(id)}
          onAddComment={(id, body) => taskApi.addComment(id, body)}
          members={taskApi.members}
          leads={leads}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
}

function PlanDay({ day, tasks, events, onOpen }) {
  const allEntries = [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      type: "event",
      title: event.display_title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      category: "meeting",
    })),
    ...tasks.map((task) => ({
      id: task.id,
      type: "task",
      title: task.title,
      startsAt: task.scheduled_start,
      endsAt: task.scheduled_end,
      category: task.category,
      task,
    })),
  ]
    .filter((entry) => isSameDay(new Date(entry.startsAt), day))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const reference = isSameDay(day, new Date()) ? new Date() : startOfDay(day);
  const nextIndex = allEntries.findIndex(
    (entry) => new Date(entry.endsAt || entry.startsAt) >= reference,
  );

  const current = nextIndex > 0 ? allEntries.slice(0, nextIndex) : [];
  const upcoming = nextIndex >= 0 ? allEntries.slice(nextIndex, nextIndex + 4) : allEntries.slice(0, 4);
  const later = nextIndex >= 0 ? allEntries.slice(nextIndex + 4) : allEntries.slice(4);

  return (
    <section className="panel overflow-hidden border border-zinc-200/80 rounded-[24px] bg-white/70 backdrop-blur-md shadow-xs">
      <div className="grid min-w-0">
        <main className="min-w-0 p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 border-b border-zinc-200/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Daily Schedule & Action Plan</p>
              <h2 className="mt-1 text-2xl font-extrabold text-zinc-950 sm:text-3xl">Plan & Focus Your Day</h2>
              <p className="mt-1 max-w-md text-xs font-semibold text-zinc-500">
                All commitments scheduled for today in clear rhythm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-violet-100/90 px-3.5 py-1 text-xs font-extrabold text-violet-800 border border-violet-200/70 shadow-2xs">
                <CheckCircle2 size={15} /> {allEntries.length} Tasks Today
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-7">
            <AgendaSection
              label="Active & Priority Now"
              detail={isSameDay(day, new Date()) ? format(new Date(), "h:mm a") : format(day, "EEEE")}
              entries={current.length > 0 ? current : upcoming.slice(0, 1)}
              onOpen={onOpen}
              empty="No active task right now."
            />

            <AgendaSection
              label="Up Next for Today"
              detail="Tasks and lead follow-ups requiring immediate attention"
              entries={current.length > 0 ? upcoming : upcoming.slice(1)}
              onOpen={onOpen}
              empty="All upcoming tasks completed!"
            />

            {later.length > 0 && (
              <AgendaSection
                label="Later Today"
                detail="Planned for later in the day"
                entries={later}
                onOpen={onOpen}
                empty="No more timed work for today."
              />
            )}
          </div>
        </main>
      </div>
    </section>
  );
}

function AgendaSection({ label, detail, entries, onOpen, empty }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-base font-extrabold text-zinc-950">{label}</p>
          <p className="mt-0.5 text-xs text-zinc-400 font-semibold">{detail}</p>
        </div>
        <span className="mono text-xs font-bold text-zinc-400">{entries.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <AgendaRow key={entry.id} entry={entry} onOpen={onOpen} />
        ))}
        {!entries.length && (
          <div className="rounded-2xl border border-dashed border-zinc-200/80 px-4 py-3 text-xs text-zinc-400 font-medium">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function AgendaRow({ entry, onOpen }) {
  const category = TASK_CATEGORIES[entry.category] ?? TASK_CATEGORIES.meeting;
  const start = new Date(entry.startsAt);
  const end = entry.endsAt ? new Date(entry.endsAt) : null;
  const leadName = entry.task?.leads?.business_name || entry.task?.leads?.name;
  const leadPhone = entry.task?.leads?.phone;
  const leadDisplay = leadName ? (leadPhone ? `${leadName} (${leadPhone})` : leadName) : null;
  
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${entry.type === "event" ? "bg-rose-500" : category.dot}`} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
            {entry.type === "event" ? "Calendar" : category.label}
          </span>
        </div>
        <p className="mt-1 truncate text-xs sm:text-sm font-extrabold text-zinc-950">{entry.title}</p>
        {leadDisplay && (
          <p className="mt-1 truncate text-xs font-extrabold text-violet-700">
            Opportunity: {leadDisplay}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-extrabold text-zinc-950">{format(start, "h:mm a")}</p>
        <p className="mt-0.5 text-[11px] text-zinc-400 font-semibold">
          {end ? formatDuration((end - start) / 60000) : "60 min"}
        </p>
      </div>
    </>
  );

  if (entry.type === "event") {
    return (
      <article className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 px-3.5 py-3 shadow-2xs">
        {content}
      </article>
    );
  }

  return (
    <button
      onClick={() => onOpen(entry.task)}
      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 px-3.5 py-3 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {content}
    </button>
  );
}

function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${hours ? `${hours}h ` : ""}${remainder ? `${remainder}m` : ""}`.trim() || "0m";
}

function Timeline({ days, tasks, events, onOpen }) {
  return (
    <section className="panel min-w-0 overflow-hidden rounded-[24px]">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[680px]"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(150px, 1fr))`,
          }}
        >
          <div className="border-b border-r border-zinc-200/60" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`border-b border-zinc-200/60 p-3 text-center ${isSameDay(day, new Date()) ? "bg-violet-50/60" : ""}`}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                {format(day, "EEE")}
              </p>
              <p className="mt-1 text-base font-extrabold text-zinc-950">{format(day, "d")}</p>
            </div>
          ))}
          <div
            className="relative border-r border-zinc-200/60"
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
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DayColumn({ day, tasks, events, onOpen }) {
  return (
    <div
      className="relative border-r border-zinc-200/60 last:border-r-0"
      style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}
    >
      {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-zinc-100"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {events.map((event) => (
        <div
          key={event.id}
          className="absolute left-1 right-1 z-[1] rounded-xl border border-zinc-200 bg-zinc-100/90 px-2 py-1 text-[10px] font-bold text-zinc-600"
          style={blockStyle(event.starts_at, event.ends_at)}
        >
          {event.display_title}
        </div>
      ))}
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onOpen(task)}
          className="absolute left-2 right-2 z-[2] overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-2 text-left shadow-2xs backdrop-blur-xs transition hover:z-10 hover:shadow-md"
          style={blockStyle(task.scheduled_start, task.scheduled_end)}
        >
          <span className="block text-[9px] font-extrabold uppercase tracking-wider text-violet-700">
            {TASK_CATEGORIES[task.category]?.label || "Task"}
          </span>
          <span className="mt-0.5 block truncate text-xs font-extrabold text-zinc-950">
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
          <div key={member.id} className="panel p-5 rounded-[24px]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-xs font-extrabold text-violet-700 shadow-2xs">
                {(member.full_name || member.email)[0].toUpperCase()}
              </span>
              <div>
                <p className="font-extrabold text-xs text-zinc-950">
                  {member.full_name || member.email}
                </p>
                <p className="text-[11px] text-zinc-400 font-semibold">
                  {mine.length} active ·{" "}
                  {mine.filter((task) => task.scheduled_start).length} planned
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {mine.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onOpen(task)}
                  className="w-full text-left rounded-2xl border border-zinc-200/70 bg-white/90 p-3 shadow-2xs hover:shadow-md transition"
                >
                  <p className="text-xs font-extrabold text-zinc-950">{task.title}</p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function blockStyle(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 30 * 60000);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  const top = (startHour - DAY_START) * HOUR_HEIGHT;
  const height = Math.max(32, (endHour - startHour) * HOUR_HEIGHT);

  return {
    top: `${Math.max(0, top)}px`,
    height: `${height}px`,
  };
}
