import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Plus,
  Sparkles,
  Target,
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
      <div className="panel p-8 text-sm text-zinc-500">
        Loading your workspace…
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
    .slice(0, 3);
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
  return (
    <div className="mx-auto max-w-[1420px] space-y-5 pb-4">
      <section className="relative overflow-hidden rounded-[32px] bg-[#111114] px-6 py-7 text-white shadow-[0_22px_60px_rgba(50,35,105,.25)] sm:px-9 sm:py-9">
        <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full bg-violet-500 blur-[75px] opacity-70" />
        <div className="absolute right-[18%] top-4 h-40 w-40 rounded-full bg-fuchsia-400 blur-[70px] opacity-35" />
        <div className="absolute -bottom-24 left-[42%] h-48 w-48 rounded-full bg-cyan-400 blur-[80px] opacity-25" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[.16] bg-white/[.08] px-3 py-1 text-[10px] font-extrabold tracking-[.16em] text-violet-100">
              <Sparkles size={12} /> {activeWorkspace?.name || "YOUR WORKSPACE"}
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[.98] tracking-[-.065em] sm:text-6xl">
              A beautiful place
              <br />
              to close great work.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-300">
              Keep every opportunity, teammate, and next step delightfully in
              flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/leads?new=1"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-zinc-950 shadow-xl transition hover:-translate-y-0.5"
            >
              <Plus size={16} /> Create opportunity
            </Link>
            <Link
              to="/leads"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/[.18] bg-white/[.08] px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/[.14]"
            >
              View pipeline <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          tint="from-violet-500 to-fuchsia-500"
          label="In play"
          value={open.length}
          detail="Active conversations"
          Icon={CircleDashed}
        />
        <Metric
          tint="from-cyan-400 to-blue-500"
          label="Qualified"
          value={count("qualified")}
          detail="Ready for a proposal"
          Icon={Target}
        />
        <Metric
          tint="from-amber-400 to-orange-500"
          label="Needs a next action"
          value={needsAction}
          detail="Active leads without an open task"
          Icon={CalendarDays}
        />
        <Metric
          tint="from-emerald-400 to-lime-500"
          label="Win rate"
          value={`${winRate}%`}
          detail={`${count("won")} opportunities won`}
          Icon={CheckCircle2}
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="panel p-5 sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Your next moves</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-.035em]">
                Priority opportunities
              </h2>
            </div>
            <Link
              to="/leads"
              className="flex items-center gap-1 text-sm font-bold text-violet-600"
            >
              All opportunities <ChevronRight size={16} />
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {priority.map((lead, index) => (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white/50 p-3.5 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-lg hover:shadow-violet-100/50"
              >
                <span className="mono grid h-10 w-10 place-items-center rounded-2xl bg-zinc-950 text-xs text-white">
                  0{index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold group-hover:text-violet-700">
                    {lead.business_name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {[lead.niche, lead.area].filter(Boolean).join(" · ") ||
                      lead.company ||
                      "Opportunity"}
                  </p>
                  <p
                    className={`mt-1 truncate text-[11px] font-bold ${nextTaskFor(lead.id) ? "text-violet-600" : "text-amber-600"}`}
                  >
                    {nextTaskFor(lead.id)?.title || "No next action planned"}
                  </p>
                </div>
                <span className="rounded-xl bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-700">
                  Score {lead.score || "—"}
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-zinc-300 group-hover:text-violet-500"
                />
              </Link>
            ))}
            {!priority.length && (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-500">
                Your first opportunity will appear here.
              </div>
            )}
          </div>
        </div>
        <div className="panel relative overflow-hidden p-6">
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-orange-300/50 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-600">
                <CalendarDays size={18} />
              </span>
              <div>
                <p className="eyebrow">Flow</p>
                <h2 className="mt-0.5 text-lg font-extrabold">
                  Today at a glance
                </h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <StatRow
                label="Next planned task"
                value={
                  nextTask
                    ? new Date(nextTask.scheduled_start).toLocaleTimeString(
                        [],
                        { hour: "numeric", minute: "2-digit" },
                      )
                    : "Clear"
                }
                tint="bg-violet-400"
              />
              <StatRow
                label="Planned today"
                value={todayTasks.length}
                tint="bg-blue-400"
              />
              <StatRow
                label="Still unplanned"
                value={unplanned.length}
                tint="bg-amber-400"
              />
            </div>
            <Link to="/rewind" className="button-secondary mt-6 w-full">
              Open Rewind
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
function Metric({ tint, label, value, detail, Icon }) {
  return (
    <article className="panel relative overflow-hidden p-5">
      <div
        className={`absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br ${tint} opacity-25 blur-2xl`}
      />
      <div
        className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${tint} text-white shadow-lg`}
      >
        <Icon size={18} />
      </div>
      <p className="metric-number mt-5 text-4xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm font-extrabold text-zinc-700">{label}</p>
      <p className="mt-1 text-xs text-zinc-400">{detail}</p>
    </article>
  );
}
function StatRow({ label, value, tint }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white/55 px-3.5 py-3">
      <span className={`h-2.5 w-2.5 rounded-full ${tint}`} />
      <span className="flex-1 text-sm font-semibold text-zinc-600">
        {label}
      </span>
      <span className="mono text-sm font-bold text-zinc-950">{value}</span>
    </div>
  );
}

function taskOrder(a, b) {
  const aTime = a.scheduled_start || a.due_at || "9999";
  const bTime = b.scheduled_start || b.due_at || "9999";
  return String(aTime).localeCompare(String(bTime));
}
