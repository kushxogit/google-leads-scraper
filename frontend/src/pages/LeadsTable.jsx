import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Filter,
  CalendarClock,
  CheckSquare2,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import AddLeadModal from "../components/AddLeadModal";
import CsvImportModal from "../components/CsvImportModal";
import TaskModal from "../components/TaskModal";
import { TASK_CATEGORIES, useWorkspaceTasks } from "../hooks/useTasks";
import { useFeedback } from "../context/feedback";
import {
  PIPELINE_STATUSES,
  useWorkspaceLeads,
  useWorkspaceMembers,
} from "../hooks/useCrm";

const labels = {
  new: "Incoming",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const colors = {
  new: "bg-sky-400",
  contacted: "bg-violet-400",
  qualified: "bg-amber-400",
  proposal: "bg-fuchsia-400",
  won: "bg-emerald-400",
  lost: "bg-zinc-300",
};

export default function LeadsTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { leads, isLoading, error, updateLead, bulkUpdate, addLead } =
    useWorkspaceLeads();
  const members = useWorkspaceMembers();
  const taskApi = useWorkspaceTasks();
  const { notify, confirm } = useFeedback();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [workFilter, setWorkFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [taskLead, setTaskLead] = useState(null);
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("new");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);
  const visible = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesSearch =
          `${lead.business_name} ${lead.phone ?? ""} ${lead.email ?? ""} ${lead.niche ?? ""} ${lead.area ?? ""} ${lead.remarks ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase());
        const matchesOwner =
          ownerFilter === "all" ||
          (ownerFilter === "unassigned"
            ? !lead.assigned_to
            : lead.assigned_to === ownerFilter);
        const related = taskApi.tasks.filter(
          (task) =>
            task.lead_id === lead.id &&
            !["done", "cancelled"].includes(task.status),
        );
        const dates = related
          .map((task) => task.scheduled_start || task.due_at)
          .filter(Boolean);
        const matchesWork =
          workFilter === "all" ||
          (workFilter === "none" && !related.length) ||
          (workFilter === "overdue" &&
            dates.some((date) => new Date(date) < new Date())) ||
          (workFilter === "planned" &&
            related.some((task) => task.scheduled_start));
        return matchesSearch && matchesOwner && matchesWork;
      }),
    [leads, ownerFilter, search, taskApi.tasks, workFilter],
  );
  const toggle = (id) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  const bulk = async (action) => {
    if (
      !selected.length ||
      (action.remove &&
        !(await confirm({
          title: `Delete ${selected.length} selected lead${selected.length === 1 ? "" : "s"}?`,
          description: "Linked notes, tasks, and files will also be removed.",
          confirmLabel: "Delete selected",
          danger: true,
        })))
    )
      return;
    setBusy(true);
    try {
      await bulkUpdate({ ids: selected, ...action });
      setSelected([]);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (isLoading)
    return (
      <div className="panel p-8 text-zinc-500">Loading your pipeline…</div>
    );
  if (error)
    return (
      <div className="panel border-rose-200 p-8 text-rose-600">
        Could not load leads: {error.message}
      </div>
    );
  return (
    <div className="flex min-h-0 flex-col gap-4 sm:gap-5 md:h-[calc(100vh-7.8rem)] md:min-h-[580px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Opportunity studio</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-[-.065em] text-zinc-950">
            Pipeline
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            A fluid view of every conversation in motion.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="control flex w-full items-center gap-2 py-2.5 shadow-sm sm:min-w-[220px]">
            <Search size={16} className="text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a company"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`button-secondary px-3 ${filtersOpen || ownerFilter !== "all" || workFilter !== "all" ? "border-violet-300 text-violet-700" : ""}`}
            title="Filters"
          >
            <Filter size={17} />
            <span className="sr-only">Filters</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="button-secondary flex-1 sm:flex-none"
          >
            <Upload size={16} /> Import CSV
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="button-primary liquid-button flex-1 sm:flex-none"
          >
            <Plus size={17} /> New opportunity
          </button>
        </div>
      </header>
      {filtersOpen && (
        <section className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
            Owner
            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="control mt-1 block w-full min-w-44 normal-case tracking-normal sm:w-auto"
            >
              <option value="all">Everyone</option>
              <option value="unassigned">Unassigned</option>
              {taskApi.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || member.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
            Next action
            <select
              value={workFilter}
              onChange={(event) => setWorkFilter(event.target.value)}
              className="control mt-1 block w-full min-w-44 normal-case tracking-normal sm:w-auto"
            >
              <option value="all">All work states</option>
              <option value="none">No next action</option>
              <option value="overdue">Overdue</option>
              <option value="planned">Scheduled</option>
            </select>
          </label>
          <p className="pb-2 text-xs font-bold text-zinc-400">
            Showing {visible.length} of {leads.length} opportunities
          </p>
          <button
            onClick={() => {
              setOwnerFilter("all");
              setWorkFilter("all");
            }}
            className="pb-2 text-xs font-bold text-violet-600 sm:ml-auto"
          >
            Clear filters
          </button>
        </section>
      )}
      {selected.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-violet-200 bg-white/75 px-4 py-3 shadow-[0_12px_30px_rgba(91,65,150,.10)] backdrop-blur-xl">
          <span className="grid h-8 min-w-8 place-items-center rounded-2xl bg-violet-600 px-2 text-xs font-bold text-white">
            {selected.length}
          </span>
          <span className="mr-1 text-sm font-extrabold">selected</span>
          <select
            defaultValue=""
            onChange={(e) => e.target.value && bulk({ status: e.target.value })}
            disabled={busy}
            className="control py-1.5"
          >
            <option value="">Move to stage…</option>
            {PIPELINE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labels[status]}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) =>
              e.target.value && bulk({ assignedTo: e.target.value })
            }
            disabled={busy}
            className="control py-1.5"
          >
            <option value="">Assign owner…</option>
            {(members.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name || member.email}
              </option>
            ))}
          </select>
          <button
            onClick={() => bulk({ remove: true })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-500"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            onClick={() => setSelected([])}
            className="text-sm font-bold text-zinc-400 hover:text-zinc-900 sm:ml-auto"
          >
            Clear
          </button>
        </section>
      )}
      <section className="scrollbar-thin flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:pb-2">
        {PIPELINE_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            leads={visible.filter((lead) => lead.status === status)}
            selected={selected}
            onToggle={toggle}
            onDrop={(id) => updateLead(id, { status })}
            tasks={taskApi.tasks}
            members={taskApi.members}
            onAddTask={setTaskLead}
          />
        ))}
      </section>
      <AddLeadModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        addLead={addLead}
        existingLeads={leads}
      />
      <TaskModal
        open={Boolean(taskLead)}
        onClose={() => setTaskLead(null)}
        onSave={taskApi.createTask}
        members={taskApi.members}
        defaultOwnerId={taskApi.currentUserId}
        leads={taskLead ? [taskLead] : []}
        initialLeadId={taskLead?.id || ""}
        initialValues={taskLead ? taskSuggestion(taskLead) : undefined}
      />
    </div>
  );
}
function Column({
  status,
  leads,
  selected,
  onToggle,
  onDrop,
  tasks,
  members,
  onAddTask,
}) {
  return (
    <section
      className="flex w-[calc(100vw-24px)] shrink-0 snap-center flex-col rounded-[26px] border border-white/80 bg-white/45 p-2.5 shadow-[0_10px_35px_rgba(55,45,85,.07)] backdrop-blur-md sm:w-[290px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("lead-id");
        if (id) onDrop(id);
      }}
    >
      <header className="mb-2 flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,.65)] ${colors[status]}`}
          />
          <h2 className="text-sm font-extrabold text-zinc-700">
            {labels[status]}
          </h2>
        </div>
        <span className="mono rounded-lg bg-zinc-900/[.06] px-2 py-0.5 text-[11px] text-zinc-500">
          {leads.length}
        </span>
      </header>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-visible md:overflow-y-auto">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            checked={selected.includes(lead.id)}
            onToggle={() => onToggle(lead.id)}
            tasks={tasks.filter((task) => task.lead_id === lead.id)}
            members={members}
            onAddTask={() => onAddTask(lead)}
          />
        ))}
        {!leads.length && (
          <div className="m-1 rounded-2xl border border-dashed border-zinc-200 bg-white/30 p-5 text-center text-xs text-zinc-400">
            Drop an opportunity here
          </div>
        )}
      </div>
    </section>
  );
}
function LeadCard({ lead, checked, onToggle, tasks, members, onAddTask }) {
  const score = lead.score || 0;
  const openTasks = tasks.filter(
    (task) => !["done", "cancelled"].includes(task.status),
  );
  const nextTask = [...openTasks].sort((a, b) =>
    String(a.scheduled_start || a.due_at || "9999").localeCompare(
      String(b.scheduled_start || b.due_at || "9999"),
    ),
  )[0];
  const nextDate = nextTask?.scheduled_start || nextTask?.due_at;
  const overdue = nextDate && new Date(nextDate) < new Date();
  const owner = members.find((member) => member.id === lead.assigned_to);
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData("lead-id", lead.id)}
      className="group rounded-2xl border border-white bg-white/85 p-3.5 shadow-[0_4px_12px_rgba(57,46,89,.07)] transition hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(76,54,132,.16)] md:cursor-grab md:active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <input
          aria-label={`Select ${lead.business_name}`}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-3.5 w-3.5 accent-violet-600"
        />
        <Link to={`/leads/${lead.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-zinc-900 group-hover:text-violet-700">
            {lead.business_name}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            {lead.company || lead.niche || "Opportunity"}
          </p>
        </Link>
        {score > 0 && (
          <span
            className={`mono grid h-7 min-w-7 place-items-center rounded-xl text-[10px] font-bold ${score >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}
          >
            {score}
          </span>
        )}
      </div>
      <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-2.5">
        {nextTask ? (
          <Link
            to={`/rewind?task=${nextTask.id}`}
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${TASK_CATEGORIES[nextTask.category]?.dot || "bg-violet-400"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-extrabold text-zinc-700">
                {nextTask.title}
              </span>
              <span
                className={`mt-0.5 flex items-center gap-1 text-[9px] font-bold ${overdue ? "text-rose-500" : "text-zinc-400"}`}
              >
                <CalendarClock size={10} />
                {nextDate
                  ? new Date(nextDate).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Unplanned"}
              </span>
            </span>
            <span className="rounded-lg bg-white px-1.5 py-1 text-[9px] font-bold text-zinc-400">
              {openTasks.length}
            </span>
          </Link>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
            className="flex w-full items-center gap-2 text-[11px] font-bold text-violet-600"
          >
            <CheckSquare2 size={13} /> Add the next action
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-zinc-100 pt-3 pl-5 text-xs text-zinc-400">
        {lead.area && (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <MapPin size={13} />
            {lead.area}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {lead.assigned_to ? (
            <>
              <Users size={13} />
              {owner?.full_name || owner?.email || "Assigned"}
            </>
          ) : (
            "Unassigned"
          )}
        </span>
        {lead.phone && (
          <a
            onClick={(e) => e.stopPropagation()}
            href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-500 hover:text-emerald-600"
          >
            <MessageCircle size={15} />
          </a>
        )}
      </div>
    </article>
  );
}
function taskSuggestion(lead) {
  return {
    new: {
      title: `Research and contact ${lead.business_name}`,
      category: "follow_up",
    },
    contacted: {
      title: `Schedule discovery call with ${lead.business_name}`,
      category: "meeting",
    },
    qualified: {
      title: `Prepare proposal for ${lead.business_name}`,
      category: "proposal",
    },
    proposal: {
      title: `Follow up on proposal with ${lead.business_name}`,
      category: "follow_up",
    },
    won: {
      title: `Plan delivery kickoff for ${lead.business_name}`,
      category: "development",
    },
    lost: {
      title: `Review lost opportunity: ${lead.business_name}`,
      category: "admin",
    },
  }[lead.status];
}
