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
  const unplanned = filtered.filter(
    (task) => !task.scheduled_start && task.status !== "done",
  );
  const timeSuggestions = useMemo(
    () =>
      unplanned
        .map((task) => ({ task, suggestion: inferTaskTime(task, cursor) }))
        .filter((item) => item.suggestion),
    [cursor, unplanned],
  );
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(range.start, index))
      : [cursor];

  const populateAllUnscheduledTasks = async () => {
    let currentHour = 9;
    const dayStart = startOfDay(cursor);
    for (const task of unplanned) {
      const start = new Date(dayStart);
      const wholeHour = Math.floor(currentHour);
      const minutes = Math.round((currentHour - wholeHour) * 60);
      start.setHours(wholeHour, minutes, 0, 0);

      const isCallTask =
        task.category === "call" ||
        task.category === "follow_up" ||
        /call|phone|contact|dial|follow/i.test(task.title || "");

      const durationMins = isCallTask ? 10 : 30;
      const end = new Date(start.getTime() + durationMins * 60000);

      await taskApi.updateTask(task.id, {
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        status: "planned",
      });

      currentHour += durationMins / 60;
      if (currentHour >= 18) currentHour = 9;
    }
  };

  const schedule = async (taskId, day, hour = 9) => {
    const start = new Date(day);
    const wholeHour = Math.floor(hour);
    start.setHours(wholeHour, Math.round((hour - wholeHour) * 60), 0, 0);
    const existing = taskApi.tasks.find((task) => task.id === taskId);
    const isCallTask =
      existing?.category === "call" ||
      existing?.category === "follow_up" ||
      /call|phone|contact|dial|follow/i.test(existing?.title || "");

    const duration = isCallTask ? 10 * 60000 : 30 * 60000;
    const end = new Date(start.getTime() + duration);
    const conflict = (calendar.data ?? []).some(
      (event) =>
        event.task_id !== taskId &&
        new Date(event.starts_at) < end &&
        new Date(event.ends_at) > start,
    );
    if (
      conflict &&
      !(await confirm({
        title: "Schedule over a calendar event?",
        description: "This time overlaps an existing Google Calendar event.",
        confirmLabel: "Schedule anyway",
      }))
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
      {/* Clean Un-congested Header */}
      <header className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-violet-700">
              <CalendarClock size={14} /> Today's Focus & Schedule
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              {format(cursor, "EEEE, MMMM d, yyyy")}
            </h1>
            <p className="mt-1 text-xs text-zinc-500 font-medium">
              Calls, tasks, meetings, and lead follow-ups in one clear rhythm.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unplanned.length > 0 && (
              <button
                onClick={populateAllUnscheduledTasks}
                className="button-primary py-2.5 px-4 text-xs font-black bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-xs gap-1.5"
              >
                <Sparkles size={15} /> Populate All {unplanned.length} Tasks
              </button>
            )}
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="button-primary liquid-button py-2.5 px-4 text-xs font-extrabold gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
            >
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>

        {/* Today Summary Metrics Row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-zinc-100 pt-4">
          <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/60">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Planned Tasks</p>
            <p className="text-lg font-black text-zinc-950 mt-0.5">{planned.length}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/60">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Unscheduled</p>
            <p className="text-lg font-black text-amber-700 mt-0.5">{unplanned.length}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/60">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Calendar Events</p>
            <p className="text-lg font-black text-violet-700 mt-0.5">{(calendar.data ?? []).length}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/60">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Active View</p>
            <p className="text-lg font-black text-zinc-900 capitalize mt-0.5">{view}</p>
          </div>
        </div>
      </header>

      {/* Navigation Toolbar */}
      <section className="panel flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-zinc-200/90 shadow-2xs rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="scrollbar-hide flex overflow-x-auto rounded-xl bg-zinc-100 p-0.5">
            {[
              ["map", "Day map"],
              ["today", "Timeline"],
              ["week", "Week"],
              ["team", "Team"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  view === key ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-900"
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
              className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-2xs"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setCursor(startOfDay(new Date()))}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-extrabold text-zinc-800 hover:bg-zinc-50 shadow-2xs"
            >
              Today
            </button>
            <button
              aria-label="Next"
              onClick={() => setCursor(addDays(cursor, view === "week" ? 7 : 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-2xs"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="control rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 outline-none"
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
            className="control rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 outline-none"
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
          unplanned={unplanned}
          suggestions={timeSuggestions}
          onOpen={openTask}
          onSchedule={schedule}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <Unplanned tasks={unplanned} api={taskApi} onOpen={openTask} onSchedule={schedule} day={cursor} />
          {view === "team" ? (
            <TeamView tasks={filtered} members={taskApi.members} onOpen={openTask} />
          ) : (
            <Timeline days={days} tasks={planned} events={calendar.data ?? []} onDrop={schedule} onOpen={openTask} />
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
        <TaskDrawer
          task={
            taskApi.tasks.find((item) => item.id === selectedTask.id) ||
            selectedTask
          }
          members={taskApi.members}
          api={taskApi}
          onClose={closeTask}
          onEdit={(task) => {
            closeTask();
            setEditing(task);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

// The new PlanDay surface replaces this legacy branch-based presentation.
// oxlint-disable-next-line no-unused-vars
function DayMap({ day, tasks, events, members, onOpen }) {
  const entries = [
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
  ].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const periods = [
    ["Morning", "Before noon", (hour) => hour < 12],
    ["Afternoon", "12–5 PM", (hour) => hour >= 12 && hour < 17],
    ["Evening", "After 5 PM", (hour) => hour >= 17],
  ];
  const activeEntries = entries.filter((entry) =>
    isSameDay(new Date(entry.startsAt), day),
  );
  return (
    <section className="panel overflow-hidden p-5 sm:p-7">
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Visual workflow</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">
            Your day as a workflow
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Start at today, then follow each branch to the work that belongs in
            that part of the day.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-500">
          {Object.entries(TASK_CATEGORIES).map(([key, item]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative mx-auto mt-7 max-w-6xl">
        <div className="relative z-10 mx-auto w-fit text-center lg:after:absolute lg:after:left-1/2 lg:after:top-full lg:after:h-8 lg:after:w-px lg:after:-translate-x-1/2 lg:after:bg-violet-200">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[25px] border-4 border-white bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[10px] font-extrabold uppercase tracking-[.14em] text-white shadow-[0_12px_28px_rgba(124,58,237,.32)]">
            Today
          </span>
          <p className="mt-2 text-sm font-extrabold text-zinc-800">
            {format(day, "EEEE, MMM d")}
          </p>
          <p className="text-[11px] text-zinc-400">
            {activeEntries.length} planned commitment
            {activeEntries.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="relative mt-7 grid gap-6 lg:mt-12 lg:grid-cols-3 lg:gap-8 lg:before:absolute lg:before:left-[16.66%] lg:before:right-[16.66%] lg:before:top-0 lg:before:h-px lg:before:bg-violet-200">
          {periods.map(([label, detail, matches]) => {
            const periodEntries = activeEntries.filter((entry) =>
              matches(new Date(entry.startsAt).getHours()),
            );
            return (
              <section
                key={label}
                className="relative border-l border-violet-200 pl-5 lg:border-l-0 lg:pl-0 lg:pt-7 lg:before:absolute lg:before:left-1/2 lg:before:top-0 lg:before:h-7 lg:before:w-px lg:before:-translate-x-1/2 lg:before:bg-violet-200"
              >
                <div className="relative z-10 flex items-center gap-3 lg:block lg:text-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-4 border-white bg-zinc-950 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-lg lg:mx-auto">
                    {label.slice(0, 3)}
                  </span>
                  <div className="lg:pt-3">
                    <p className="text-sm font-extrabold">{label}</p>
                    <p className="text-[11px] text-zinc-400">{detail}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {periodEntries.map((entry) => (
                    <DayBubble
                      key={entry.id}
                      entry={entry}
                      members={members}
                      onOpen={onOpen}
                    />
                  ))}
                  {!periodEntries.length && (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-400">
                      Open space for focused work.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {!activeEntries.length && (
        <div className="mt-6 rounded-3xl border border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
          <Clock3 className="mx-auto text-violet-500" size={23} />
          <p className="mt-3 text-sm font-extrabold text-zinc-800">
            Your day is still open.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Drag an unplanned task into the Timeline, or add a task with a time.
          </p>
        </div>
      )}
    </section>
  );
}

function DayBubble({ entry, members, onOpen }) {
  const category = TASK_CATEGORIES[entry.category] ?? TASK_CATEGORIES.meeting;
  const start = new Date(entry.startsAt);
  const end = entry.endsAt ? new Date(entry.endsAt) : null;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.12em]">
          {entry.type === "event" ? "Meeting" : category.label}
        </span>
        <span className="text-[10px] font-bold opacity-65">
          {format(start, "h:mm a")}
          {end ? ` – ${format(end, "h:mm a")}` : ""}
        </span>
      </div>
      <p className="mt-4 text-base font-extrabold leading-5">{entry.title}</p>
      {entry.task?.leads?.name && (
        <p className="mt-2 truncate text-xs font-bold opacity-65">
          {entry.task.leads.name}
        </p>
      )}
      {entry.task?.assignee_ids?.length > 0 && (
        <div className="mt-4 flex -space-x-1">
          {entry.task.assignee_ids.map((id) => {
            const member = members.find((item) => item.id === id);
            return (
              <span
                key={id}
                title={member?.full_name || member?.email}
                className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-white/80 text-[9px] font-extrabold text-zinc-700"
              >
                {(member?.full_name || member?.email || "?")[0].toUpperCase()}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
  if (entry.type === "event")
    return (
      <article className="min-h-36 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm">
        {content}
      </article>
    );
  return (
    <button
      onClick={() => onOpen(entry.task)}
      className={`min-h-36 rounded-[24px] border p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${category.card}`}
    >
      {content}
    </button>
  );
}

function PlanDay({
  day,
  tasks,
  events,
  unplanned,
  suggestions,
  onOpen,
  onSchedule,
}) {
  // Auto-schedule all unscheduled tasks across the day (10-min slots for calls, 30-min for others)
  const autoScheduleAll = async () => {
    let currentHour = 9;
    for (const task of unplanned) {
      const isCallTask =
        task.category === "call" ||
        task.category === "follow_up" ||
        /call|phone|contact|dial|follow/i.test(task.title || "");

      const durationMins = isCallTask ? 10 : 30;
      await onSchedule(task.id, day, currentHour);
      currentHour += durationMins / 60;
      if (currentHour >= 18) currentHour = 9;
    }
  };

  const plannedEntries = [
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

  // If no planned entries, convert unplanned tasks to agenda items (10-min slots for call tasks)
  const allEntries = plannedEntries.length > 0
    ? plannedEntries
    : unplanned.map((task, idx) => {
        const dummyStart = new Date(day);
        const totalMinutesOffset = idx * 10;
        dummyStart.setHours(9 + Math.floor(totalMinutesOffset / 60), totalMinutesOffset % 60, 0, 0);

        const isCallTask =
          task.category === "call" ||
          task.category === "follow_up" ||
          /call|phone|contact|dial|follow/i.test(task.title || "");

        const durationMins = isCallTask ? 10 : 30;

        return {
          id: task.id,
          type: "task",
          title: task.title,
          startsAt: dummyStart.toISOString(),
          endsAt: new Date(dummyStart.getTime() + durationMins * 60000).toISOString(),
          category: task.category,
          task,
        };
      });

  const reference = isSameDay(day, new Date()) ? new Date() : startOfDay(day);
  const nextIndex = allEntries.findIndex(
    (entry) => new Date(entry.endsAt || entry.startsAt) >= reference,
  );

  const current = nextIndex > 0 ? allEntries.slice(0, nextIndex) : [];
  const upcoming = nextIndex >= 0 ? allEntries.slice(nextIndex, nextIndex + 4) : allEntries.slice(0, 4);
  const later = nextIndex >= 0 ? allEntries.slice(nextIndex + 4) : allEntries.slice(4);

  const minutes = allEntries.reduce(
    (total, entry) =>
      total +
      (entry.endsAt
        ? Math.max(30, (new Date(entry.endsAt) - new Date(entry.startsAt)) / 60000)
        : 60),
    0,
  );

  return (
    <section className="panel overflow-hidden border border-zinc-200/90 rounded-2xl bg-white shadow-2xs">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Daily Schedule & Action Plan</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950 sm:text-3xl">Plan & Focus Your Day</h2>
              <p className="mt-1 max-w-md text-xs font-semibold text-zinc-500">
                {plannedEntries.length > 0
                  ? "All commitments scheduled for today in clear rhythm."
                  : `Showing ${allEntries.length} pending tasks auto-prioritized for your attention.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {unplanned.length > 0 && (
                <button
                  onClick={autoScheduleAll}
                  className="button-primary py-2 px-3.5 text-xs font-black bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-xs gap-1.5"
                >
                  <Sparkles size={14} /> Auto-Plan All {unplanned.length} Tasks
                </button>
              )}

              <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-extrabold text-violet-700 border border-violet-100">
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

        {/* Right Inbox Sidebar */}
        <aside className="flex max-h-[820px] flex-col border-t border-zinc-100 bg-zinc-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-violet-600 shadow-2xs border border-zinc-200/80">
              <Inbox size={18} />
            </span>
            <div>
              <p className="font-extrabold text-zinc-950 text-sm">Unscheduled Queue</p>
              <p className="text-[11px] text-zinc-400 font-semibold">Lead tasks & follow-ups</p>
            </div>
            <span className="mono ml-auto text-xs font-black text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full border border-violet-200">
              {unplanned.length}
            </span>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-violet-700">
                <Sparkles size={14} /> AI Time Suggestions
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500 font-medium">
                1-tap to lock suggested times into your calendar.
              </p>
            </div>
          )}

          <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {unplanned.map((task) => {
              const suggestion = suggestions.find((item) => item.task.id === task.id)?.suggestion;
              const category = TASK_CATEGORIES[task.category] ?? TASK_CATEGORIES.development;
              return (
                <article
                  key={task.id}
                  className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs hover:border-violet-300 transition"
                >
                  <button onClick={() => onOpen(task)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${category.dot}`} />
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400">
                          {category.label}
                        </span>
                      </div>
                      {task.priority && (
                        <span className="text-[9px] font-extrabold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100">
                          {task.priority}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs font-extrabold leading-4 text-zinc-900">
                      {task.title}
                    </p>

                    {task.leads?.name && (
                      <p className="mt-1.5 truncate text-[11px] font-bold text-violet-700">
                        Opportunity: {task.leads.name}
                      </p>
                    )}
                  </button>

                  {/* 1-Tap Quick Schedule Buttons */}
                  <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => onSchedule(task.id, day, 9)}
                      className="flex-1 rounded-lg bg-violet-50 hover:bg-violet-100 px-2 py-1.2 text-[10px] font-extrabold text-violet-700 transition"
                    >
                      Today 9 AM
                    </button>
                    <button
                      onClick={() => onSchedule(task.id, day, 14)}
                      className="flex-1 rounded-lg bg-violet-50 hover:bg-violet-100 px-2 py-1.2 text-[10px] font-extrabold text-violet-700 transition"
                    >
                      Today 2 PM
                    </button>
                    <button
                      onClick={() => onSchedule(task.id, addDays(day, 1), 9)}
                      className="flex-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-1.2 text-[10px] font-extrabold text-zinc-700 transition"
                    >
                      Tomorrow
                    </button>
                  </div>
                </article>
              );
            })}
            {!unplanned.length && (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-xs font-bold text-zinc-400">
                All tasks are scheduled! 🎉
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AgendaSection({ label, detail, entries, onOpen, empty }) {
  return <section><div className="flex items-baseline justify-between gap-3"><div><p className="text-base font-extrabold text-zinc-950">{label}</p><p className="mt-0.5 text-xs text-zinc-400">{detail}</p></div><span className="mono text-xs text-zinc-400">{entries.length}</span></div><div className="mt-3 space-y-2">{entries.map((entry) => <AgendaRow key={entry.id} entry={entry} onOpen={onOpen} />)}{!entries.length && <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-400">{empty}</div>}</div></section>;
}

function AgendaRow({ entry, onOpen }) {
  const category = TASK_CATEGORIES[entry.category] ?? TASK_CATEGORIES.meeting;
  const start = new Date(entry.startsAt);
  const end = entry.endsAt ? new Date(entry.endsAt) : null;
  const content = <><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${entry.type === "event" ? "bg-rose-500" : category.dot}`} /><span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-zinc-400">{entry.type === "event" ? "Calendar" : category.label}</span></div><p className="mt-1 truncate text-sm font-extrabold text-zinc-900">{entry.title}</p>{entry.task?.leads?.name && <p className="mt-1 truncate text-xs font-bold text-violet-700">Opportunity: {entry.task.leads.name}</p>}</div><div className="shrink-0 text-right"><p className="text-xs font-extrabold text-zinc-800">{format(start, "h:mm a")}</p><p className="mt-0.5 text-[11px] text-zinc-400">{end ? formatDuration((end - start) / 60000) : "60 min"}</p></div></>;
  if (entry.type === "event") return <article className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-3">{content}</article>;
  return <button onClick={() => onOpen(entry.task)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${category.card}`}>{content}</button>;
}

function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${hours ? `${hours}h ` : ""}${remainder ? `${remainder}m` : ""}`.trim() || "0m";
}

function taskTiming(task) {
  const value = task.scheduled_start || task.due_at;
  if (!value) return "No time chosen yet";
  const date = new Date(value);
  const relative = formatDistanceToNow(date, { addSuffix: true });
  return `${task.scheduled_start ? "Scheduled" : "Due"} ${relative} · ${format(date, "EEE, MMM d · h:mm a")}`;
}

function inferTaskTime(task, fallbackDay) {
  const text = `${task.title || ""}\n${task.description || ""}`.trim();
  const result = parseNaturalDate(text, fallbackDay, { forwardDate: true })[0];
  if (!result) return task.due_at ? inferredDueDate(task.due_at) : null;
  const date = result.start.date();
  const hasExplicitTime = result.start.isCertain("hour");
  const hasNaturalDaypart = /\b(morning|afternoon|evening|night|noon|midnight)\b/i.test(result.text);
  return {
    day: date,
    hour: date.getHours() + date.getMinutes() / 60,
    label: format(date, "EEEE, MMM d · h:mm a"),
    sourceText: result.text,
    isClear: hasExplicitTime || hasNaturalDaypart,
  };
}

function inferredDueDate(value) {
  const date = new Date(value);
  return {
    day: date,
    hour: date.getHours() + date.getMinutes() / 60,
    label: format(date, "EEEE, MMM d · h:mm a"),
    sourceText: "task due date",
    isClear: true,
  };
}

function _legacyInferTaskTime(task, fallbackDay) {
  const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();
  let day = task.due_at ? startOfDay(new Date(task.due_at)) : startOfDay(fallbackDay);
  let foundDate = Boolean(task.due_at);
  if (/\btomorrow\b/.test(text)) { day = addDays(startOfDay(fallbackDay), 1); foundDate = true; }
  if (/\btoday\b/.test(text)) foundDate = true;
  const dateMatch = text.match(/\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/);
  if (dateMatch) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].findIndex((item) => dateMatch[2].startsWith(item));
    day = new Date(fallbackDay.getFullYear(), month, Number(dateMatch[1]));
    if (day < startOfDay(fallbackDay) && !task.due_at) day.setFullYear(day.getFullYear() + 1);
    foundDate = true;
  }
  const timeMatch = text.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  let hour = 10;
  let minute = 0;
  let foundTime = false;
  if (timeMatch) { hour = Number(timeMatch[1]) % 12 + (timeMatch[3].startsWith("p") ? 12 : 0); minute = Number(timeMatch[2] || 0); foundTime = true; }
  else if (/\bmorning\b/.test(text)) { hour = 9; foundTime = true; }
  else if (/\bafternoon\b/.test(text)) { hour = 14; foundTime = true; }
  else if (/\bevening\b/.test(text)) { hour = 18; foundTime = true; }
  if (!foundDate && !foundTime) return null;
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return { day: date, hour: hour + minute / 60, label: `${format(date, "EEE, MMM d · h:mm a")}${foundTime ? "" : " · suggested"}` };
}

function Unplanned({ tasks, api, onOpen, onSchedule, day }) {
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
            onSchedule={onSchedule}
            day={day}
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

function TaskCard({ task, members, onOpen, onSchedule, day }) {
  const category = TASK_CATEGORIES[task.category];
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData("task-id", task.id)}
      className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${category.card}`}
    >
      <button onClick={() => onOpen(task)} className="w-full text-left">
      <span className="text-[9px] font-extrabold uppercase tracking-[.12em] opacity-60">
        {category.label}
      </span>
      <p className="mt-1 text-sm font-extrabold leading-5">{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-70">{task.description}</p>}
      {task.leads?.name && <p className="mt-2 truncate text-xs font-extrabold text-violet-700">Opportunity: {task.leads.name}</p>}
      {(task.scheduled_start || task.due_at) && <p className="mt-2 text-xs font-bold opacity-70">{taskTiming(task)}</p>}
      {task.created_at && <p className="mt-1 text-[11px] font-medium opacity-60">Added {format(new Date(task.created_at), "EEE, MMM d · h:mm a")}</p>}
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
      {onSchedule && !task.scheduled_start && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onSchedule(task.id, day, 9)} className="rounded-lg bg-white/80 px-2 py-1.5 text-[10px] font-extrabold text-violet-700">Today 9 AM</button><button onClick={() => onSchedule(task.id, addDays(day, 1), 9)} className="rounded-lg bg-white/80 px-2 py-1.5 text-[10px] font-extrabold text-violet-700">Tomorrow</button></div>}
    </article>
  );
}

function TaskInfo({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
        <Icon size={13} /> {label}
      </div>
      <p className="mt-1 text-xs font-extrabold leading-5 text-zinc-700">{value}</p>
    </div>
  );
}

function TaskDrawer({ task, members, api, onClose, onEdit }) {
  const comments = useTaskComments(task.id);
  const { confirm, notify } = useFeedback();
  const [body, setBody] = useState("");
  const category = TASK_CATEGORIES[task.category];
  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await api.addComment(task.id, body);
    setBody("");
    await comments.refetch();
  };
  const remove = async () => {
    if (
      !(await confirm({
        title: "Delete this task?",
        description: "Its discussion and notifications will also be removed.",
        confirmLabel: "Delete task",
        danger: true,
      }))
    )
      return;
    try {
      await api.deleteTask(task.id);
      notify("Task deleted.");
      onClose();
    } catch (error) {
      notify(error.message, "error");
    }
  };
  return (
    <div
      className="fixed inset-0 z-[75] bg-zinc-950/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 right-0 top-0 w-full max-w-md overflow-y-auto bg-white p-4 shadow-2xl sm:p-6"
      >
        <button onClick={onClose} className="text-sm font-bold text-zinc-400">
          Close
        </button>
        <div
          className={`mt-5 inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${category.card}`}
        >
          {category.label}
        </div>
        <h2
          id="task-drawer-title"
          className="mt-3 text-2xl font-extrabold tracking-[-.05em] sm:text-3xl"
        >
          {task.title}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-extrabold capitalize text-zinc-700">{task.status.replace("_", " ")}</span>
          <span className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-extrabold capitalize text-zinc-700"><Flag className="mr-1 inline" size={13} />{task.priority} priority</span>
        </div>
        <section className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <p className="eyebrow">Task details</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{task.description || "No extra details were added to this task."}</p>
        </section>
        <section className="mt-4 grid gap-2 sm:grid-cols-2">
          <TaskInfo label="Added" value={task.created_at ? format(new Date(task.created_at), "EEEE, MMM d · h:mm a") : "Not available"} icon={CalendarDays} />
          <TaskInfo label="Due" value={task.due_at ? format(new Date(task.due_at), "EEEE, MMM d · h:mm a") : "No due date"} icon={CalendarClock} />
          <TaskInfo label="Scheduled start" value={task.scheduled_start ? format(new Date(task.scheduled_start), "EEEE, MMM d · h:mm a") : "Not scheduled"} icon={Clock3} />
          <TaskInfo label="Scheduled end" value={task.scheduled_end ? format(new Date(task.scheduled_end), "EEEE, MMM d · h:mm a") : "No end time"} icon={Clock3} />
        </section>
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
        {task.lead_id && (
          <Link
            to={`/leads/${task.lead_id}`}
            onClick={onClose}
            className="mt-4 flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 p-3 text-sm font-extrabold text-violet-700"
          >
            <span>
              Opportunity: {task.leads?.name || "View linked opportunity"}
            </span>
            <ChevronRight size={16} />
          </Link>
        )}
        {(task.scheduled_start || task.due_at) && (
          <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-500">
            {task.scheduled_start
              ? `Scheduled ${format(new Date(task.scheduled_start), "MMM d · h:mm a")}`
              : `Due ${format(new Date(task.due_at), "MMM d · h:mm a")}`}
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={() =>
              api.updateTask(task.id, {
                status: task.status === "done" ? "planned" : "done",
              })
            }
            className="button-primary w-full sm:w-auto"
          >
            <CheckCircle2 size={16} />
            {task.status === "done" ? "Reopen" : "Complete"}
          </button>
          <button onClick={() => onEdit(task)} className="button-secondary w-full sm:w-auto">
            Edit
          </button>
          <button
            onClick={remove}
            className="button-secondary col-span-2 w-full text-rose-600 sm:ml-auto sm:w-auto"
          >
            <Trash2 size={15} /> Delete
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
                  {members.find((member) => member.id === comment.author_id)
                    ?.full_name ||
                    members.find((member) => member.id === comment.author_id)
                      ?.email ||
                    "Workspace member"}{" "}
                  {" · "}
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
