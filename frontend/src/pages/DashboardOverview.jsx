import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Plus,
  Sparkles,
  Target,
  Zap,
  Clock,
  Layers,
  Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useWorkspaceLeads } from "../hooks/useCrm";
import { useWorkspaceTasks } from "../hooks/useTasks";

export default function DashboardOverview() {
  const { leads, isLoading } = useWorkspaceLeads();
  const { tasks, isLoading: tasksLoading } = useWorkspaceTasks();
  const { activeWorkspace } = useAuthWorkspace();

  if (isLoading || tasksLoading)
    return (
      <div className="panel flex items-center justify-center p-10 text-xs font-semibold text-zinc-500 gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        <span>Loading workspace overview…</span>
      </div>
    );

  const count = (status) =>
    leads.filter((lead) => lead.status === status).length;
  const open = leads.filter((lead) => !["won", "lost"].includes(lead.status));
  const openTasks = tasks.filter(
    (task) => !["done", "cancelled"].includes(task.status),
  );
  const nextTaskFor = (leadId) =>
    openTasks.filter((task) => task.lead_id === leadId).sort(taskOrder)[0];

  const needsAction = open.filter((lead) => !nextTaskFor(lead.id)).length;
  const priority = [...open]
    .sort((a, b) => {
      const aTask = nextTaskFor(a.id);
      const bTask = nextTaskFor(b.id);
      if (Boolean(aTask) !== Boolean(bTask)) return aTask ? -1 : 1;
      if (aTask && bTask) return taskOrder(aTask, bTask);
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 4);

  const winRate = leads.length
    ? Math.round((count("won") / leads.length) * 100)
    : 0;

  const todayKey = new Date().toDateString();
  const todayTasks = tasks.filter(
    (task) =>
      task.scheduled_start &&
      new Date(task.scheduled_start).toDateString() === todayKey &&
      !["done", "cancelled"].includes(task.status),
  );
  const unplanned = tasks.filter(
    (task) =>
      !task.scheduled_start && !["done", "cancelled"].includes(task.status),
  );
  const nextTask = [...todayTasks].sort(
    (a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start),
  )[0];
  const overdueTasks = openTasks
    .filter((task) => {
      const date = task.scheduled_start || task.due_at;
      return date && new Date(date) < new Date();
    })
    .sort(taskOrder);

  const actionItems = [
    ...overdueTasks.map((task) => ({
      task,
      kind: "Overdue",
      tint: "text-rose-600 bg-rose-50 border-rose-200",
    })),
    ...todayTasks
      .filter((task) => !overdueTasks.some((item) => item.id === task.id))
      .map((task) => ({
        task,
        kind: "Today",
        tint: "text-violet-700 bg-violet-50 border-violet-200",
      })),
  ].slice(0, 4);

  return (
    <div className="mx-auto max-w-[1420px] space-y-4 pb-4">
      {/* Sleek Hero Banner */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#111114] px-6 py-6 text-white shadow-[0_20px_50px_rgba(30,20,70,.22)] sm:px-8 sm:py-7">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-violet-500 blur-[70px] opacity-60" />
        <div className="absolute right-[20%] top-2 h-36 w-36 rounded-full bg-fuchsia-400 blur-[60px] opacity-30" />
        <div className="absolute -bottom-24 left-[40%] h-44 w-44 rounded-full bg-cyan-400 blur-[75px] opacity-20" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[.16] bg-white/[.08] px-3 py-0.5 text-[10px] font-extrabold tracking-[.14em] text-violet-200">
              <Sparkles size={11} /> {activeWorkspace?.name || "WORKSPACE"}
            </div>
            <h1 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight tracking-[-.05em] sm:text-4xl">
              Keep every deal & next move in flow.
            </h1>
            <p className="mt-2 max-w-md text-xs leading-5 text-zinc-300">
              Triage Google Maps leads, assign tasks, and convert opportunities faster.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              to="/leads?new=1"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-xs font-extrabold text-zinc-950 shadow-xl transition hover:-translate-y-0.5"
            >
              <Plus size={15} /> Create opportunity
            </Link>
            <Link
              to="/leads"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[.18] bg-white/[.08] px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/[.14]"
            >
              Open Pipeline <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          tint="from-violet-500 to-fuchsia-500"
          label="Active Leads"
          value={open.length}
          detail="In-flight conversations"
          Icon={CircleDashed}
        />
        <Metric
          tint="from-cyan-400 to-blue-500"
          label="Qualified"
          value={count("qualified")}
          detail="Ready for proposal"
          Icon={Target}
        />
        <Metric
          tint="from-amber-400 to-orange-500"
          label="Needs Next Action"
          value={needsAction}
          detail="Leads without a task"
          Icon={Zap}
        />
        <Metric
          tint="from-emerald-400 to-lime-500"
          label="Win Rate"
          value={`${winRate}%`}
          detail={`${count("won")} deals closed won`}
          Icon={CheckCircle2}
        />
      </section>

      {/* Action Queue */}
      <section className="panel overflow-hidden p-0 bg-white/80">
        <div className="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="eyebrow">Action Queue</p>
            <h2 className="mt-0.5 text-base font-extrabold tracking-tight">
              High priority tasks & follow-ups
            </h2>
          </div>
          <Link to="/rewind" className="text-xs font-bold text-violet-600 hover:underline">
            Open Today Timeline <ChevronRight className="inline" size={14} />
          </Link>
        </div>

        <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {actionItems.map(({ task, kind, tint }) => (
            <Link
              key={task.id}
              to={`/rewind?task=${task.id}`}
              className="group min-w-0 p-4 transition hover:bg-violet-50/50"
            >
              <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${tint}`}>
                {kind}
              </span>
              <p className="mt-2 truncate text-xs font-extrabold text-zinc-900 group-hover:text-violet-700">
                {task.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                {task.leads?.name || "Workspace task"}
              </p>
            </Link>
          ))}

          {actionItems.length < 4 && (
            <Link
              to="/leads?needs_action=1"
              className="group min-w-0 p-4 transition hover:bg-amber-50/60"
            >
              <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700 border border-amber-200">
                Opportunity
              </span>
              <p className="mt-2 text-xs font-extrabold text-zinc-900 group-hover:text-amber-800">
                {needsAction} leads need a next action
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Schedule follow-ups to maintain momentum.</p>
            </Link>
          )}
        </div>
      </section>

      {/* Priority Opportunities & Today at a Glance */}
      <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="panel p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Priority Leads</p>
              <h2 className="mt-0.5 text-base font-extrabold tracking-tight">
                Top opportunities requiring focus
              </h2>
            </div>
            <Link
              to="/leads"
              className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {priority.map((lead, index) => (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
              >
                <span className="mono grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-950 text-xs font-bold text-white">
                  0{index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-zinc-900 group-hover:text-violet-700">
                    {lead.business_name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {[lead.niche, lead.area].filter(Boolean).join(" · ") ||
                      "Opportunity"}
                  </p>
                </div>

                <span className="mono shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100">
                  ⚡ {lead.score || "—"}
                </span>

                <ArrowUpRight
                  size={15}
                  className="text-zinc-300 group-hover:text-violet-600 shrink-0"
                />
              </Link>
            ))}

            {!priority.length && (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-400">
                No active opportunities yet.
              </div>
            )}
          </div>
        </div>

        <div className="panel relative overflow-hidden p-5 bg-white/80">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-600">
              <CalendarDays size={16} />
            </span>
            <div>
              <p className="eyebrow">Today</p>
              <h2 className="mt-0.5 text-base font-extrabold">At a glance</h2>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <StatRow
              label="Next planned task"
              value={
                nextTask
                  ? new Date(nextTask.scheduled_start).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Clear"
              }
              tint="bg-violet-500"
            />
            <StatRow
              label="Planned for today"
              value={todayTasks.length}
              tint="bg-blue-500"
            />
            <StatRow
              label="Still unplanned"
              value={unplanned.length}
              tint="bg-amber-500"
            />
          </div>

          <Link to="/rewind" className="button-secondary mt-4 w-full justify-center text-xs py-2">
            Open Today Timeline
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ tint, label, value, detail, Icon }) {
  return (
    <article className="panel relative overflow-hidden p-4 bg-white/90">
      <div
        className={`absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-gradient-to-br ${tint} opacity-20 blur-xl`}
      />
      <div
        className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${tint} text-white shadow-md`}
      >
        <Icon size={16} />
      </div>
      <p className="metric-number mt-3 text-3xl font-extrabold text-zinc-950">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-zinc-800">{label}</p>
      <p className="mt-0.5 text-[10px] text-zinc-400">{detail}</p>
    </article>
  );
}

function StatRow({ label, value, tint }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-white px-3 py-2">
      <span className={`h-2 w-2 rounded-full ${tint}`} />
      <span className="flex-1 text-xs font-semibold text-zinc-600">{label}</span>
      <span className="mono text-xs font-bold text-zinc-950">{value}</span>
    </div>
  );
}

function taskOrder(a, b) {
  const aTime = a.scheduled_start || a.due_at || "9999";
  const bTime = b.scheduled_start || b.due_at || "9999";
  return String(aTime).localeCompare(String(bTime));
}
