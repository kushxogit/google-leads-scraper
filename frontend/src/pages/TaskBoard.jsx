import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { isToday, isBefore, isAfter, addDays, startOfDay, format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  MeasuringStrategy,
  useDndContext,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  Check,
  CheckSquare,
  ChevronDown,
  Folder,
  Inbox,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  X,
  Zap,
  Calendar as CalendarIcon,
  BarChart3,
  Grid,
  AlertCircle,
  Clock,
  Square,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useWorkspaceTasks, useTaskProjects, PROJECT_COLORS, TASK_CATEGORIES } from "../hooks/useTasks";
import { useWorkspaceLeads } from "../hooks/useCrm";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useFeedback } from "../context/feedback";
import TaskModal from "../components/TaskModal";
import TaskDetailPanel from "../components/TaskDetailPanel";
import AiTaskModal from "../components/AiTaskModal";
import AiNextActions from "../components/AiNextActions";

// ─── Status & Priority Configuration (Colorful Translucent Pastel Bars) ───────

const KANBAN_COLUMNS = [
  {
    id: "unplanned",
    label: "No status",
    dot: "bg-slate-400",
    colBg: "bg-slate-500/[0.07] border-slate-300/60 backdrop-blur-md",
    headerBg: "bg-slate-500/10 border-slate-300/40 text-slate-900",
    badgeBg: "bg-slate-500/20 text-slate-800 font-extrabold",
  },
  {
    id: "planned",
    label: "Todo",
    dot: "bg-sky-500",
    colBg: "bg-sky-500/[0.08] border-sky-300/60 backdrop-blur-md",
    headerBg: "bg-sky-500/10 border-sky-300/40 text-sky-950",
    badgeBg: "bg-sky-500/20 text-sky-900 font-extrabold",
  },
  {
    id: "in_progress",
    label: "In progress",
    dot: "bg-violet-500",
    colBg: "bg-violet-500/[0.08] border-violet-300/60 backdrop-blur-md",
    headerBg: "bg-violet-500/10 border-violet-300/40 text-violet-950",
    badgeBg: "bg-violet-500/20 text-violet-900 font-extrabold",
  },
  {
    id: "waiting",
    label: "Waiting on",
    dot: "bg-amber-500",
    colBg: "bg-amber-500/[0.08] border-amber-300/60 backdrop-blur-md",
    headerBg: "bg-amber-500/10 border-amber-300/40 text-amber-950",
    badgeBg: "bg-amber-500/20 text-amber-900 font-extrabold",
  },
  {
    id: "done",
    label: "Done",
    dot: "bg-emerald-500",
    colBg: "bg-emerald-500/[0.08] border-emerald-300/60 backdrop-blur-md",
    headerBg: "bg-emerald-500/10 border-emerald-300/40 text-emerald-950",
    badgeBg: "bg-emerald-500/20 text-emerald-900 font-extrabold",
  },
];

const PRIORITY_META = {
  low: { label: "Low", icon: "▽", color: "text-slate-600 bg-slate-100/90 border-slate-200/80" },
  medium: { label: "Medium", color: "text-zinc-700 bg-zinc-100/90 border-zinc-200/80" },
  high: { label: "High", icon: "▲", color: "text-amber-800 bg-amber-100/90 border-amber-200/80 font-bold" },
  urgent: { label: "Urgent", icon: "⚡", color: "text-rose-700 bg-rose-100/90 border-rose-200/80 font-bold" },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TaskBoard() {
  const { user } = useAuthWorkspace();
  const taskApi = useWorkspaceTasks();
  const projectApi = useTaskProjects();
  const { leads } = useWorkspaceLeads();
  const { notify, confirm } = useFeedback();

  // Navigation & View States
  const [tab, setTab] = useState("all"); // "all" | "mine" | "shared"
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "list" | "matrix" | "schedule" | "analytics"

  // Selection & Modals
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [nextActionsOpen, setNextActionsOpen] = useState(false);
  const [modalDefaultStatus, setModalDefaultStatus] = useState("unplanned");

  // Search & Filtering
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLead, setFilterLead] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterDueDate, setFilterDueDate] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Project Management
  const [lastProjectId, setLastProjectId] = useState("");
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);
  const hasDefaultedProject = useRef(false);

  // Optimistic DnD state
  const [localOrder, setLocalOrder] = useState(null);
  const [localTaskStatus, setLocalTaskStatus] = useState({});

  useEffect(() => {
    if (!hasDefaultedProject.current && projectApi.projects.length) {
      hasDefaultedProject.current = true;
      setLastProjectId(projectApi.projects[0].id);
      setFilterProject(projectApi.projects[0].id);
    }
  }, [projectApi.projects]);

  const handleProjectChange = (projectId) => {
    if (projectId !== "all") setLastProjectId(projectId);
    setFilterProject(projectId);
    setTab("all");
  };

  const showProjectTasks = () => {
    const projectId = lastProjectId || projectApi.projects[0]?.id;
    if (projectId) handleProjectChange(projectId);
  };

  const showAllTasks = () => {
    setFilterProject("all");
    setFilterLead("all");
    setTab("all");
  };

  const resetAllFilters = () => {
    setSearch("");
    setFilterProject("all");
    setFilterPriority("all");
    setFilterCategory("all");
    setFilterLead("all");
    setFilterAssignee("all");
    setFilterDueDate("all");
    setTab("all");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ── Derived Data ──────────────────────────────────────────────────────────

  const allTasks = useMemo(() => {
    const rawTasks = localOrder
      ? localOrder.map((id) => taskApi.tasks.find((t) => t.id === id)).filter(Boolean)
      : taskApi.tasks;

    const mappedTasks = rawTasks.map((t) =>
      localTaskStatus[t.id] ? { ...t, status: localTaskStatus[t.id] } : t,
    );

    return mappedTasks.filter((task) => {
      if (task.status === "cancelled") return false;
      if (
        search &&
        !task.title.toLowerCase().includes(search.toLowerCase()) &&
        !task.description?.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (filterProject !== "all" && task.project_id !== filterProject) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterCategory !== "all" && task.category !== filterCategory) return false;

      if (filterLead !== "all") {
        if (filterLead === "none" && task.lead_id) return false;
        if (filterLead !== "none" && task.lead_id !== filterLead) return false;
      }
      if (
        filterAssignee !== "all" &&
        !(task.assignee_ids ?? []).includes(filterAssignee)
      ) {
        return false;
      }

      if (filterDueDate !== "all") {
        if (!task.due_at) return false;
        const dueDate = new Date(task.due_at);
        const today = startOfDay(new Date());
        if (
          filterDueDate === "overdue" &&
          (!isBefore(dueDate, today) || task.status === "done")
        ) {
          return false;
        }
        if (filterDueDate === "today" && !isToday(dueDate)) return false;
        if (filterDueDate === "upcoming" && !isAfter(dueDate, today)) return false;
        if (
          filterDueDate === "this_week" &&
          (isBefore(dueDate, today) || !isBefore(dueDate, addDays(today, 7)))
        ) return false;
        if (filterDueDate === "later" && isBefore(dueDate, addDays(today, 7))) return false;
      }

      if (tab === "mine" && !(task.assignee_ids ?? []).includes(user?.id)) return false;
      if (tab === "shared" && (task.assignee_ids ?? []).length <= 1) return false;

      return true;
    });
  }, [
    taskApi.tasks,
    localOrder,
    localTaskStatus,
    search,
    filterProject,
    filterPriority,
    filterCategory,
    filterLead,
    filterAssignee,
    filterDueDate,
    tab,
    user?.id,
  ]);

  const tasksByStatus = useMemo(() => {
    const map = {};
    KANBAN_COLUMNS.forEach((col) => {
      map[col.id] = [];
    });
    allTasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [allTasks]);

  const metrics = useMemo(() => {
    const validTasks = taskApi.tasks.filter((t) => t.status !== "cancelled");
    const total = validTasks.length;
    const completed = validTasks.filter((t) => t.status === "done").length;
    const inProgress = validTasks.filter((t) => t.status === "in_progress").length;
    const overdue = validTasks.filter((t) => {
      if (t.status === "done" || !t.due_at) return false;
      return isBefore(new Date(t.due_at), startOfDay(new Date()));
    }).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, overdue, completionRate };
  }, [taskApi.tasks]);

  const selectedProject = projectApi.projects.find((p) => p.id === filterProject);
  const activeFiltersCount =
    (filterLead !== "all" ? 1 : 0) +
    (filterAssignee !== "all" ? 1 : 0) +
    (filterPriority !== "all" ? 1 : 0) +
    (filterCategory !== "all" ? 1 : 0) +
    (filterDueDate !== "all" ? 1 : 0);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openCreate = (status = "unplanned") => {
    setModalDefaultStatus(status);
    setModalOpen(true);
  };

  const handleCreate = async (form) => {
    await taskApi.createTask({ ...form, status: modalDefaultStatus });
    setLocalOrder(null);
  };

  const handleAiCreate = async (draft) => {
    await taskApi.createTask({
      ...draft,
      project_id: draft.project_id || selectedProject?.id || "",
      assignee_ids: draft.assignee_ids?.length ? draft.assignee_ids : [user?.id].filter(Boolean),
    });
    setLocalOrder(null);
  };

  const handleUpdate = useCallback(
    async (id, changes) => {
      await taskApi.updateTask(id, changes);
      if (selectedTask?.id === id) {
        setSelectedTask((prev) => (prev ? { ...prev, ...changes } : null));
      }
      setLocalOrder(null);
    },
    [taskApi, selectedTask?.id],
  );

  handleUpdate.__addComment = taskApi.addComment;

  const handleDelete = useCallback(
    async (id) => {
      await taskApi.deleteTask(id);
      setSelectedTask(null);
      setLocalOrder(null);
    },
    [taskApi],
  );

  const handleToggleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  };

  const handleSelectAll = (tasksToSelect) => {
    const ids = tasksToSelect.map((t) => t.id);
    const allSelected = ids.every((id) => selectedTaskIds.includes(id));
    if (allSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedTaskIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const handleBulkStatus = async (status) => {
    if (!selectedTaskIds.length) return;
    await Promise.all(selectedTaskIds.map((id) => taskApi.updateTask(id, { status })));
    notify(`Updated ${selectedTaskIds.length} tasks`);
    setSelectedTaskIds([]);
  };

  const handleBulkDelete = async () => {
    if (!selectedTaskIds.length) return;
    const ok = await confirm({
      title: `Delete ${selectedTaskIds.length} tasks?`,
      description: "This action cannot be undone.",
      confirmLabel: "Delete all",
      danger: true,
    });
    if (ok) {
      await Promise.all(selectedTaskIds.map((id) => taskApi.deleteTask(id)));
      notify(`Deleted ${selectedTaskIds.length} tasks`);
      setSelectedTaskIds([]);
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => {
    setActiveDragId(active.id);
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const overData = over.data.current ?? {};
    let newStatus = null;
    if (overData.type === "column") {
      newStatus = over.id;
    } else if (overData.type === "task") {
      const overTask = allTasks.find((t) => t.id === over.id);
      if (overTask) newStatus = overTask.status;
    }
    if (newStatus) {
      setLocalTaskStatus((prev) => {
        if (prev[active.id] === newStatus) return prev;
        return { ...prev, [active.id]: newStatus };
      });
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) {
      setLocalTaskStatus((prev) => {
        const next = { ...prev };
        delete next[active.id];
        return next;
      });
      return;
    }

    const activeData = active.data.current ?? {};
    const overData = over.data.current ?? {};

    if (activeData.type === "task" && overData.type === "column") {
      const activeTask = allTasks.find((t) => t.id === active.id);
      if (activeTask && activeTask.status !== overData.id) {
        setLocalTaskStatus((prev) => ({ ...prev, [active.id]: overData.id }));
        taskApi.updateTask(active.id, { status: overData.id }).finally(() => {
          setLocalTaskStatus((prev) => {
            const next = { ...prev };
            delete next[active.id];
            return next;
          });
        });
      } else {
        setLocalTaskStatus((prev) => {
          const next = { ...prev };
          delete next[active.id];
          return next;
        });
      }
      return;
    }

    const overTask = allTasks.find((t) => t.id === over.id);
    if (!overTask) {
      setLocalTaskStatus((prev) => {
        const next = { ...prev };
        delete next[active.id];
        return next;
      });
      return;
    }
    const activeTask = allTasks.find((t) => t.id === active.id);

    const allIds = allTasks.map((t) => t.id);
    const oldIdx = allIds.indexOf(active.id);
    const newIdx = allIds.indexOf(over.id);
    setLocalOrder(arrayMove(allIds, oldIdx, newIdx));

    if (overTask.status !== activeTask.status) {
      setLocalTaskStatus((prev) => ({ ...prev, [active.id]: overTask.status }));
      taskApi.updateTask(active.id, { status: overTask.status }).finally(() => {
        setLocalOrder(null);
        setLocalTaskStatus((prev) => {
          const next = { ...prev };
          delete next[active.id];
          return next;
        });
      });
    } else {
      setLocalTaskStatus((prev) => {
        const next = { ...prev };
        delete next[active.id];
        return next;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setLocalOrder(null);
    setLocalTaskStatus({});
  };

  const activeDragTask = activeDragId
    ? taskApi.tasks.find((t) => t.id === activeDragId)
    : null;

  if (taskApi.isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center flex-col gap-2 text-zinc-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-violet-600" />
        <span className="text-xs font-semibold text-zinc-500">Loading tasks…</span>
      </div>
    );
  }

  return (
    <div className="panel p-4 sm:p-5 flex h-full flex-col font-sans text-zinc-900 space-y-3 rounded-[24px] border border-white/70 bg-white/65 shadow-[0_18px_60px_rgba(55,45,85,.10)] backdrop-blur-2xl overflow-hidden">
      {/* ─── Row 1: Title, Project Picker, Metric Pill & Action Buttons ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-zinc-950">Tasks</h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
              {allTasks.length}
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-300/60" />

          {/* Project Picker Dropdown */}
          <ProjectPicker
            projects={projectApi.projects}
            value={filterProject}
            onChange={handleProjectChange}
            onManage={() => setProjectManagerOpen(true)}
          />

          {/* Metric Pill Badge */}
          <div className="hidden md:flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 px-3 py-1 text-[11px] font-semibold text-emerald-800">
            <TrendingUp size={12} className="text-emerald-600" />
            <span className="font-extrabold">{metrics.completionRate}% Done</span>
            <span className="text-emerald-300">·</span>
            <span>{metrics.completed}/{metrics.total}</span>
            {metrics.overdue > 0 && (
              <>
                <span className="text-emerald-300">·</span>
                <span className="font-extrabold text-rose-600">{metrics.overdue} overdue</span>
              </>
            )}
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setNextActionsOpen(true)}
            className="flex h-8 items-center gap-1 rounded-xl border border-amber-200/80 bg-amber-50 px-2.5 font-semibold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
            title="Next actions"
          >
            <Zap size={13} className="text-amber-600" />
            <span className="hidden sm:inline text-xs">Next</span>
          </button>

          <button
            onClick={() =>
              selectedProject
                ? setAiModalOpen(true)
                : notify("Select a project first.", "error")
            }
            className="liquid-button flex h-8 items-center gap-1.5 rounded-xl px-3 font-bold text-white shadow-xs transition hover:scale-[1.01]"
            title="Plan project with AI"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline text-xs">AI Copilot</span>
          </button>

          <button
            onClick={() => openCreate()}
            className="button-primary flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 transition"
          >
            <Plus size={14} /> Task
          </button>
        </div>
      </div>

      {/* ─── Row 2: Unified Controls Dock (Scope, View Switcher, Search, Filter) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200/80 bg-white/70 p-1.5 backdrop-blur-md shadow-2xs">
        {/* Left: Scope & View Switcher */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Scope Segment Tabs */}
          <div className="flex rounded-xl bg-zinc-100 p-0.5 border border-zinc-200/60">
            <button
              onClick={showProjectTasks}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${filterProject !== "all" && tab === "all" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-950"}`}
            >
              Project
            </button>
            <button
              onClick={showAllTasks}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${filterProject === "all" && tab === "all" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-950"}`}
            >
              All
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${tab === "mine" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-950"}`}
            >
              Mine
            </button>
            <button
              onClick={() => setTab("shared")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${tab === "shared" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-950"}`}
            >
              Shared
            </button>
          </div>

          <div className="flex rounded-xl bg-zinc-100 p-0.5 border border-zinc-200/60">
            {[
              { id: "urgent", label: "Urgent", onClick: () => { setFilterPriority("urgent"); setFilterDueDate("all"); } },
              { id: "this_week", label: "This week", onClick: () => { setFilterDueDate("this_week"); setFilterPriority("all"); } },
              { id: "later", label: "Later", onClick: () => { setFilterDueDate("later"); setFilterPriority("all"); } },
            ].map((item) => {
              const active = item.id === "urgent" ? filterPriority === "urgent" : filterDueDate === item.id;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${active ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-950"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-zinc-200" />

          {/* View Mode Switcher Pills */}
          <div className="flex rounded-xl bg-zinc-100 p-0.5 border border-zinc-200/60">
            {[
              { id: "kanban", icon: LayoutGrid, title: "Board" },
              { id: "list", icon: List, title: "List" },
              { id: "matrix", icon: Grid, title: "Matrix" },
              { id: "schedule", icon: CalendarIcon, title: "Timeline" },
              { id: "analytics", icon: BarChart3, title: "Stats" },
            ].map(({ id, icon: Icon, title }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${viewMode === id ? "bg-zinc-950 text-white shadow-2xs" : "text-zinc-500 hover:text-zinc-950"}`}
              >
                <Icon size={12} />
                <span>{title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search & Filter */}
        <div className="flex items-center gap-2 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-7 w-32 sm:w-44 rounded-xl border border-zinc-200 bg-white pl-7 pr-6 text-xs text-zinc-800 outline-none transition focus:border-violet-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Filter Popover Button */}
          <div className="relative">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex h-7 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold transition ${activeFiltersCount > 0 ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              <SlidersHorizontal size={12} /> Filter
              {activeFiltersCount > 0 && <span>({activeFiltersCount})</span>}
            </button>

            {filtersOpen && (
              <div className="absolute right-0 z-40 mt-1.5 w-60 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xl text-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <span className="font-extrabold text-zinc-900">Filters</span>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="text-xs font-semibold text-violet-600 hover:underline"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                <div className="mt-2.5 space-y-2.5">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Priority
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-1.5 text-xs text-zinc-800 outline-none"
                    >
                      <option value="all">All priorities</option>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>

                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Category
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-1.5 text-xs text-zinc-800 outline-none"
                    >
                      <option value="all">All categories</option>
                      {Object.entries(TASK_CATEGORIES).map(([catKey, cat]) => (
                        <option key={catKey} value={catKey}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Due Date
                    <select
                      value={filterDueDate}
                      onChange={(e) => setFilterDueDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-1.5 text-xs text-zinc-800 outline-none"
                    >
                      <option value="all">Any time</option>
                      <option value="overdue">Overdue</option>
                      <option value="today">Due today</option>
                      <option value="this_week">This week</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="later">Later</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Content Viewport ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "analytics" ? (
          <TaskAnalyticsView tasks={taskApi.tasks} projects={projectApi.projects} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {allTasks.length === 0 ? (
              <ProjectEmptyState
                project={selectedProject}
                hasFilters={activeFiltersCount > 0 || search !== ""}
                onResetFilters={resetAllFilters}
                onAddTask={openCreate}
              />
            ) : viewMode === "kanban" ? (
              <KanbanBoard
                columns={KANBAN_COLUMNS}
                tasksByStatus={tasksByStatus}
                members={taskApi.members}
                projects={projectApi.projects}
                leads={leads ?? []}
                selectedTaskIds={selectedTaskIds}
                onToggleSelectTask={handleToggleSelectTask}
                onSelectTask={setSelectedTask}
                onUpdateTask={handleUpdate}
                onAddTask={openCreate}
              />
            ) : viewMode === "list" ? (
              <ListView
                columns={KANBAN_COLUMNS}
                tasksByStatus={tasksByStatus}
                members={taskApi.members}
                projects={projectApi.projects}
                leads={leads ?? []}
                selectedTaskIds={selectedTaskIds}
                onToggleSelectTask={handleToggleSelectTask}
                onSelectAll={handleSelectAll}
                onSelectTask={setSelectedTask}
                onUpdateTask={handleUpdate}
                onAddTask={openCreate}
              />
            ) : viewMode === "matrix" ? (
              <PriorityMatrixView
                tasks={allTasks}
                members={taskApi.members}
                projects={projectApi.projects}
                leads={leads ?? []}
                onSelectTask={setSelectedTask}
                onUpdateTask={handleUpdate}
                onAddTask={openCreate}
              />
            ) : (
              <ScheduleView
                tasks={allTasks}
                members={taskApi.members}
                projects={projectApi.projects}
                leads={leads ?? []}
                onSelectTask={setSelectedTask}
                onUpdateTask={handleUpdate}
                onAddTask={openCreate}
              />
            )}

            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeDragTask && (
                <div className="w-[249px]">
                  <TaskCard
                    task={activeDragTask}
                    members={taskApi.members}
                    projects={projectApi.projects}
                    leads={leads ?? []}
                    isDragging
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Multi-Select Floating Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-5 py-2 text-white shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-bottom-3">
          <span className="text-zinc-300">
            <span className="text-white font-bold text-sm">{selectedTaskIds.length}</span> selected
          </span>
          <div className="h-3.5 w-px bg-zinc-800" />
          <button
            onClick={() => handleBulkStatus("done")}
            className="rounded-full bg-zinc-800 px-3 py-1 font-semibold text-emerald-400 hover:bg-zinc-700 transition"
          >
            Mark Done
          </button>
          <button
            onClick={() => handleBulkStatus("in_progress")}
            className="rounded-full bg-zinc-800 px-3 py-1 font-semibold text-amber-400 hover:bg-zinc-700 transition"
          >
            In Progress
          </button>
          <button
            onClick={handleBulkDelete}
            className="rounded-full bg-rose-950 border border-rose-800/50 px-3 py-1 font-semibold text-rose-300 hover:bg-rose-900 transition"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedTaskIds([])}
            className="ml-1 text-zinc-400 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddComment={(id, body) => taskApi.addComment(id, body)}
          members={taskApi.members}
          projects={projectApi.projects}
          leads={leads ?? []}
          currentUserId={user?.id}
        />
      )}

      {/* Modal Dialogs */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        members={taskApi.members}
        defaultOwnerId={user?.id}
        leads={leads ?? []}
        projects={projectApi.projects}
        onManageProjects={() => {
          setModalOpen(false);
          setProjectManagerOpen(true);
        }}
        initialValues={{
          status: modalDefaultStatus,
          project_id: filterProject !== "all" ? filterProject : "",
        }}
      />

      <AiTaskModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        project={selectedProject}
        tasks={taskApi.tasks}
        leads={leads ?? []}
        onCreate={handleAiCreate}
      />

      <AiNextActions
        open={nextActionsOpen}
        onClose={() => setNextActionsOpen(false)}
        project={selectedProject}
        tasks={allTasks}
        leads={leads ?? []}
      />

      {projectManagerOpen && (
        <ProjectManagerModal
          projects={projectApi.projects}
          leads={leads ?? []}
          onCreate={projectApi.createProject}
          onDelete={projectApi.deleteProject}
          onConvertTasks={async (leadId, projectId) => {
            const tasksToMove = taskApi.tasks.filter((t) => t.lead_id === leadId);
            await Promise.all(
              tasksToMove.map((t) => taskApi.updateTask(t.id, { project_id: projectId })),
            );
          }}
          onClose={() => setProjectManagerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Project Picker Dropdown ────────────────────────────────────────────────

function ProjectPicker({ projects, value, onChange, onManage }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const selectedProject = projects.find((project) => project.id === value);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/80 px-2.5 py-1 text-xs font-bold text-zinc-900 hover:bg-white transition shadow-2xs"
      >
        <span className="truncate max-w-[130px]">
          {selectedProject
            ? `${selectedProject.emoji || "📁"} ${selectedProject.name}`
            : "All projects"}
        </span>
        <ChevronDown size={12} className="text-zinc-400" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-52 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl text-xs">
          <div className="max-h-44 overflow-y-auto space-y-0.5 scrollbar-thin">
            {projects.map((project) => {
              const selected = project.id === value;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    onChange(project.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-bold transition ${selected ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  <span className="truncate">
                    {project.emoji || "📁"} {project.name}
                  </span>
                  {selected && <Check size={12} className="ml-auto text-white" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-zinc-100 pt-1">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-bold transition ${value === "all" ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              <span>All projects</span>
              {value === "all" && <Check size={12} className="ml-auto text-white" />}
            </button>
          </div>
          <div className="mt-1 border-t border-zinc-100 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManage?.();
              }}
              className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 font-bold"
            >
              <Settings2 size={12} /> Manage projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Empty State ─────────────────────────────────────────────────────

function ProjectEmptyState({ project, hasFilters, onResetFilters, onAddTask }) {
  return (
    <div className="grid h-full min-h-[300px] place-items-center rounded-2xl border border-dashed border-zinc-200/80 bg-white/40 p-6 text-center">
      <div className="max-w-xs space-y-2">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-white text-zinc-400 shadow-2xs">
          <Inbox size={18} />
        </span>
        <h2 className="text-xs font-bold text-zinc-800">
          {hasFilters
            ? "No matching tasks"
            : project
              ? `No tasks in ${project.name}`
              : "No tasks created"}
        </h2>
        <p className="text-[11px] text-zinc-400">
          {hasFilters
            ? "Try clearing your search terms or active filters."
            : "Create your first task to get started."}
        </p>
        <div className="mt-2.5 flex justify-center gap-2">
          {hasFilters && (
            <button
              onClick={onResetFilters}
              className="button-secondary text-xs px-3 py-1 rounded-xl font-semibold"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => onAddTask()}
            className="button-primary text-xs px-3.5 py-1 rounded-xl font-bold"
          >
            <Plus size={12} className="inline mr-1" /> Add task
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Translucent Pastel Kanban Board ─────────────────────────────────────────

function KanbanBoard({
  columns,
  tasksByStatus,
  members,
  projects,
  leads,
  selectedTaskIds,
  onToggleSelectTask,
  onSelectTask,
  onUpdateTask,
  onAddTask,
}) {
  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {columns.map((col) => (
        <KanbanColumn
          key={col.id}
          col={col}
          tasks={tasksByStatus[col.id] ?? []}
          members={members}
          projects={projects}
          leads={leads}
          selectedTaskIds={selectedTaskIds}
          onToggleSelectTask={onToggleSelectTask}
          onSelectTask={onSelectTask}
          onUpdateTask={onUpdateTask}
          onAddTask={() => onAddTask(col.id)}
        />
      ))}
    </div>
  );
}

function KanbanColumn({
  col,
  tasks,
  members,
  projects,
  leads,
  selectedTaskIds,
  onToggleSelectTask,
  onSelectTask,
  onUpdateTask,
  onAddTask,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
    data: { type: "column" },
  });

  const { over } = useDndContext();
  const isOverChild =
    over?.data?.current?.type === "task" && tasks.some((t) => t.id === over.id);
  const shouldHighlight = isOver || isOverChild;

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div className="flex w-[265px] shrink-0 flex-col h-full">
      <div
        ref={setNodeRef}
        className={`flex min-h-0 flex-col h-full rounded-2xl ${col.colBg} transition ${shouldHighlight ? "ring-2 ring-violet-400 shadow-md" : ""}`}
      >
        {/* Column Pastel Translucent Header */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${col.headerBg} rounded-t-2xl text-xs`}>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
            <span className="font-extrabold tracking-tight">{col.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${col.badgeBg}`}>
              {tasks.length}
            </span>
          </div>
          <button
            onClick={onAddTask}
            className="text-zinc-500 hover:text-zinc-950 transition"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Task List Container */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                members={members}
                projects={projects}
                leads={leads}
                isSelected={selectedTaskIds.includes(task.id)}
                onToggleSelect={() => onToggleSelectTask(task.id)}
                onClick={() => onSelectTask(task)}
                onUpdateTask={onUpdateTask}
              />
            ))}
          </SortableContext>
          {tasks.length === 0 && (
            <div className="py-8 text-center text-[11px] font-medium text-zinc-400">
              No tasks
            </div>
          )}
        </div>

        {/* Column Footer */}
        <div className="p-1.5 border-t border-zinc-200/40 rounded-b-2xl">
          <button
            onClick={onAddTask}
            className="flex w-full items-center justify-center gap-1 rounded-xl py-1 text-xs font-semibold text-zinc-500 hover:bg-white/80 hover:text-zinc-900 transition"
          >
            <Plus size={12} /> Add Task
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  members,
  projects,
  leads,
  isSelected,
  onToggleSelect,
  onClick,
  onUpdateTask,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        members={members}
        projects={projects}
        leads={leads}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onClick={onClick}
        onUpdateTask={onUpdateTask}
        isDragging={isDragging}
      />
    </div>
  );
}

// ─── Translucent Glass Task Card ──────────────────────────────────────────────

function TaskCard({
  task,
  members,
  projects,
  leads = [],
  isSelected,
  onToggleSelect,
  onClick,
  onUpdateTask,
  isDragging,
}) {
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const project = projects.find((p) => p.id === task.project_id);
  const assignees = members.filter((m) => (task.assignee_ids ?? []).includes(m.id));
  const isOverdue =
    task.due_at &&
    isBefore(new Date(task.due_at), startOfDay(new Date())) &&
    task.status !== "done";
  const linkedLead = leads.find((l) => l.id === task.lead_id);

  const toggleDone = (e) => {
    e.stopPropagation();
    if (onUpdateTask) {
      onUpdateTask(task.id, {
        status: task.status === "done" ? "in_progress" : "done",
      });
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl bg-white/90 p-3 border border-white/80 shadow-2xs backdrop-blur-xs transition-all duration-150 hover:border-zinc-300 hover:shadow-xs ${isSelected ? "border-zinc-950 bg-white ring-1 ring-zinc-950/10" : ""} ${isDragging ? "shadow-md opacity-40 scale-105" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`mt-0.5 shrink-0 ${isSelected ? "text-zinc-950" : "text-zinc-300 group-hover:text-zinc-400"}`}
        >
          <Square size={13} className={isSelected ? "hidden" : "block"} />
          <CheckSquare size={13} className={isSelected ? "block" : "hidden"} />
        </button>

        <p
          className={`flex-1 text-xs font-semibold leading-snug ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"}`}
        >
          {task.title}
        </p>

        <button
          onClick={toggleDone}
          className={`shrink-0 transition ${task.status === "done" ? "text-emerald-600" : "text-zinc-300 hover:text-emerald-600"}`}
        >
          <CheckCircle2 size={15} />
        </button>
      </div>

      {/* Meta tags */}
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
        {project && (
          <span className="rounded-full bg-zinc-100/90 px-2 py-0.5 font-bold text-zinc-600 border border-zinc-200/60">
            {project.emoji || "📁"} {project.name}
          </span>
        )}
        {linkedLead && (
          <span className="rounded-full bg-violet-50/90 px-2 py-0.5 font-bold text-violet-700 truncate max-w-[160px] border border-violet-100">
            <Link2 size={9} className="inline mr-1" />
            <span className="truncate">
              {linkedLead.business_name || linkedLead.name}
            </span>
          </span>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-1.5 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          {prio.label !== "Medium" && (
            <span className={`rounded-full px-2 py-0.5 font-bold border ${prio.color}`}>
              {prio.icon} {prio.label}
            </span>
          )}
          {task.due_at && (
            <span
              className={`font-semibold rounded-full px-2 py-0.5 ${isOverdue ? "bg-rose-50 text-rose-600 font-bold border border-rose-200/70" : "text-zinc-400"}`}
            >
              <Clock size={10} className="inline mr-0.5" />
              {format(new Date(task.due_at), "MMM d")}
            </span>
          )}
          {task.status === "waiting" && task.waiting_on && (
            <span className="max-w-[145px] truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-800" title={`Waiting on ${task.waiting_on}`}>
              Waiting: {task.waiting_on}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {assignees.length === 0 && <span className="text-[10px] font-semibold text-rose-500">Unassigned</span>}
          {assignees.length > 0 && <span className="max-w-[72px] truncate text-[10px] font-semibold text-zinc-500">{assignees[0].full_name || assignees[0].email}</span>}
          <div className="flex -space-x-1">
          {assignees.slice(0, 2).map((m) => (
            <span
              key={m.id}
              title={m.full_name || m.email}
              className="grid h-4 w-4 place-items-center rounded-full border border-white bg-zinc-900 text-[8px] font-bold text-white shadow-2xs"
            >
              {(m.full_name || m.email)[0].toUpperCase()}
            </span>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({
  columns,
  tasksByStatus,
  members,
  projects,
  leads,
  selectedTaskIds,
  onToggleSelectTask,
  onSelectAll,
  onSelectTask,
  onUpdateTask,
  onAddTask,
}) {
  return (
    <div className="h-full min-h-[480px] overflow-y-auto space-y-3 pb-3 scrollbar-thin">
      {columns.map((col) => {
        const tasks = tasksByStatus[col.id] ?? [];
        return (
          <ListGroup
            key={col.id}
            col={col}
            tasks={tasks}
            members={members}
            projects={projects}
            leads={leads}
            selectedTaskIds={selectedTaskIds}
            onToggleSelectTask={onToggleSelectTask}
            onSelectAll={onSelectAll}
            onSelectTask={onSelectTask}
            onUpdateTask={onUpdateTask}
            onAddTask={() => onAddTask(col.id)}
          />
        );
      })}
    </div>
  );
}

function ListGroup({
  col,
  tasks,
  members,
  projects,
  leads,
  selectedTaskIds,
  onToggleSelectTask,
  onSelectAll,
  onSelectTask,
  onUpdateTask,
  onAddTask,
}) {
  const [open, setOpen] = useState(true);
  const allGroupSelected =
    tasks.length > 0 && tasks.every((t) => selectedTaskIds.includes(t.id));

  return (
    <div className={`rounded-2xl border ${col.colBg} overflow-hidden text-xs shadow-2xs`}>
      <div className={`flex items-center justify-between border-b ${col.headerBg} px-3.5 py-2`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectAll(tasks)}
            className={`transition ${allGroupSelected ? "text-zinc-950" : "text-zinc-300 hover:text-zinc-500"}`}
          >
            <CheckSquare size={14} />
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 font-extrabold text-zinc-900"
          >
            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
            <span>{col.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${col.badgeBg}`}>
              {tasks.length}
            </span>
          </button>
        </div>

        <button
          onClick={onAddTask}
          className="text-zinc-400 hover:text-zinc-800 transition"
        >
          <Plus size={13} />
        </button>
      </div>

      {open && (
        <div className="divide-y divide-zinc-100/60">
          {tasks.map((task) => (
            <ListRow
              key={task.id}
              task={task}
              members={members}
              projects={projects}
              leads={leads}
              isSelected={selectedTaskIds.includes(task.id)}
              onToggleSelect={() => onToggleSelectTask(task.id)}
              onClick={() => onSelectTask(task)}
              onStatusChange={(status) => onUpdateTask(task.id, { status })}
            />
          ))}
          {tasks.length === 0 && (
            <div className="py-3 text-center text-zinc-400 text-xs font-medium">
              No tasks
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListRow({
  task,
  members,
  projects,
  leads = [],
  isSelected,
  onToggleSelect,
  onClick,
  onStatusChange,
}) {
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const project = projects.find((p) => p.id === task.project_id);
  const assignees = members.filter((m) => (task.assignee_ids ?? []).includes(m.id));
  const isOverdue =
    task.due_at &&
    isBefore(new Date(task.due_at), startOfDay(new Date())) &&
    task.status !== "done";
  const linkedLead = leads.find((l) => l.id === task.lead_id);

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 hover:bg-white/80 transition ${isSelected ? "bg-zinc-100/70" : ""}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className={`shrink-0 ${isSelected ? "text-zinc-950" : "text-zinc-300 hover:text-zinc-500"}`}
      >
        <Square size={13} className={isSelected ? "hidden" : "block"} />
        <CheckSquare size={13} className={isSelected ? "block" : "hidden"} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onStatusChange(task.status === "done" ? "in_progress" : "done");
        }}
        className={`shrink-0 ${task.status === "done" ? "text-emerald-600" : "text-zinc-300 hover:text-emerald-600"}`}
      >
        <CheckCircle2 size={15} />
      </button>

      <span
        className={`flex-1 font-semibold truncate ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"}`}
      >
        {task.title}
      </span>

      {project && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 hidden sm:inline">
          {project.emoji || "📁"} {project.name}
        </span>
      )}

      {linkedLead && (
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hidden md:inline truncate max-w-xs border border-violet-100">
          <Link2 size={9} className="inline mr-1" />
          <span className="truncate">
            {linkedLead.business_name || linkedLead.name}
          </span>
        </span>
      )}

      {prio.label !== "Medium" && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${prio.color} hidden sm:inline`}
        >
          {prio.icon} {prio.label}
        </span>
      )}

      {task.due_at && (
        <span
          className={`text-[10px] font-semibold hidden md:inline ${isOverdue ? "text-rose-600" : "text-zinc-400"}`}
        >
          {format(new Date(task.due_at), "MMM d")}
        </span>
      )}

      <div className="flex -space-x-1">
        {assignees.slice(0, 2).map((m) => (
          <span
            key={m.id}
            title={m.full_name || m.email}
            className="grid h-4 w-4 place-items-center rounded-full border border-white bg-zinc-900 text-[8px] font-bold text-white shadow-2xs"
          >
            {(m.full_name || m.email)[0].toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Priority Matrix View ───────────────────────────────────────────────────

function PriorityMatrixView({
  tasks,
  members,
  projects,
  leads,
  onSelectTask,
  onUpdateTask,
  onAddTask,
}) {
  const quadrants = useMemo(() => {
    return {
      q1: tasks.filter(
        (t) =>
          (t.priority === "urgent" || t.priority === "high") &&
          (t.status === "planned" || t.status === "in_progress"),
      ),
      q2: tasks.filter(
        (t) =>
          (t.priority === "urgent" || t.priority === "high") &&
          t.status === "unplanned",
      ),
      q3: tasks.filter(
        (t) =>
          (t.priority === "medium" || t.priority === "low") &&
          (t.status === "planned" || t.status === "in_progress"),
      ),
      q4: tasks.filter(
        (t) =>
          (t.priority === "medium" || t.priority === "low") &&
          t.status === "unplanned",
      ),
    };
  }, [tasks]);

  return (
    <div className="grid h-full min-h-[500px] grid-cols-1 gap-3 md:grid-cols-2 pb-3 scrollbar-thin">
      <MatrixQuadrant
        title="Urgent & High Priority"
        accent="text-rose-700 bg-rose-100"
        cardBg="bg-rose-500/[0.06] border-rose-300/50"
        tasks={quadrants.q1}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
        onAddTask={() => onAddTask("in_progress")}
      />

      <MatrixQuadrant
        title="High Priority & Planned"
        accent="text-amber-800 bg-amber-100"
        cardBg="bg-amber-500/[0.06] border-amber-300/50"
        tasks={quadrants.q2}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
        onAddTask={() => onAddTask("planned")}
      />

      <MatrixQuadrant
        title="Urgent & Low Priority"
        accent="text-violet-800 bg-violet-100"
        cardBg="bg-violet-500/[0.06] border-violet-300/50"
        tasks={quadrants.q3}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
        onAddTask={() => onAddTask("waiting")}
      />

      <MatrixQuadrant
        title="Backlog"
        accent="text-slate-700 bg-slate-200"
        cardBg="bg-slate-500/[0.06] border-slate-300/50"
        tasks={quadrants.q4}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
        onAddTask={() => onAddTask("unplanned")}
      />
    </div>
  );
}

function MatrixQuadrant({
  title,
  accent,
  cardBg,
  tasks,
  members,
  projects,
  leads,
  onSelectTask,
  onUpdateTask,
  onAddTask,
}) {
  return (
    <div className={`rounded-2xl p-3 flex flex-col h-full border ${cardBg} backdrop-blur-md`}>
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/40 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-zinc-900">{title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${accent}`}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="text-zinc-400 hover:text-zinc-800 transition"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 space-y-2 max-h-64 scrollbar-thin">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            projects={projects}
            leads={leads}
            onClick={() => onSelectTask(task)}
            onUpdateTask={onUpdateTask}
          />
        ))}
        {tasks.length === 0 && (
          <p className="py-6 text-center text-zinc-400 text-xs font-medium">
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Timeline / Schedule View ────────────────────────────────────────────────

function ScheduleView({
  tasks,
  members,
  projects,
  leads,
  onSelectTask,
  onUpdateTask,
}) {
  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    return {
      overdue: tasks.filter(
        (t) => t.due_at && isBefore(new Date(t.due_at), today) && t.status !== "done",
      ),
      today: tasks.filter((t) => t.due_at && isToday(new Date(t.due_at))),
      upcoming: tasks.filter((t) => t.due_at && isAfter(new Date(t.due_at), tomorrow)),
      unscheduled: tasks.filter((t) => !t.due_at),
    };
  }, [tasks]);

  return (
    <div className="h-full min-h-[480px] overflow-y-auto space-y-3 pb-3 scrollbar-thin">
      <ScheduleGroup
        title="Overdue"
        accent="bg-rose-500 text-white"
        cardBg="bg-rose-500/[0.06] border-rose-300/50"
        tasks={groups.overdue}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
      />

      <ScheduleGroup
        title="Due Today"
        accent="bg-sky-500 text-white"
        cardBg="bg-sky-500/[0.06] border-sky-300/50"
        tasks={groups.today}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
      />

      <ScheduleGroup
        title="Upcoming"
        accent="bg-emerald-600 text-white"
        cardBg="bg-emerald-500/[0.06] border-emerald-300/50"
        tasks={groups.upcoming}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
      />

      <ScheduleGroup
        title="Unscheduled"
        accent="bg-slate-400 text-white"
        cardBg="bg-slate-500/[0.06] border-slate-300/50"
        tasks={groups.unscheduled}
        members={members}
        projects={projects}
        leads={leads}
        onSelectTask={onSelectTask}
        onUpdateTask={onUpdateTask}
      />
    </div>
  );
}

function ScheduleGroup({
  title,
  accent,
  cardBg,
  tasks,
  members,
  projects,
  leads,
  onSelectTask,
  onUpdateTask,
}) {
  if (tasks.length === 0) return null;

  return (
    <div className={`rounded-2xl p-3 border ${cardBg} text-xs backdrop-blur-md`}>
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/40">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 font-bold text-[10px] ${accent}`}>
            {title}
          </span>
          <span className="text-zinc-500 font-bold">({tasks.length})</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            projects={projects}
            leads={leads}
            onClick={() => onSelectTask(task)}
            onUpdateTask={onUpdateTask}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Analytics View ─────────────────────────────────────────────────────────

function TaskAnalyticsView({ tasks, projects }) {
  const statusData = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      name: col.label,
      count: tasks.filter((t) => t.status === col.id).length,
    }));
  }, [tasks]);

  const priorityData = useMemo(() => {
    return [
      {
        name: "Urgent",
        value: tasks.filter((t) => t.priority === "urgent").length,
        color: "#f43f5e",
      },
      {
        name: "High",
        value: tasks.filter((t) => t.priority === "high").length,
        color: "#f97316",
      },
      {
        name: "Medium",
        value: tasks.filter((t) => t.priority === "medium").length,
        color: "#71717a",
      },
      {
        name: "Low",
        value: tasks.filter((t) => t.priority === "low").length,
        color: "#a1a1aa",
      },
    ];
  }, [tasks]);

  return (
    <div className="h-full min-h-[480px] overflow-y-auto space-y-3 pb-3 scrollbar-thin text-xs">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4">
          <h3 className="font-bold text-zinc-900 mb-2">Status Breakdown</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4">
          <h3 className="font-bold text-zinc-900 mb-2">Priority Breakdown</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  innerRadius={30}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Project Manager Modal ──────────────────────────────────────────────────

function ProjectManagerModal({
  projects,
  leads = [],
  onCreate,
  onDelete,
  onConvertTasks,
  onClose,
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [emoji, setEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState("");
  const [converting, setConverting] = useState(false);
  const { confirm, notify } = useFeedback();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name, color, emoji });
      setName("");
      setEmoji("");
      notify("Project created!");
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!convertLeadId) return;
    const lead = leads.find((l) => l.id === convertLeadId);
    if (!lead) return;

    setConverting(true);
    try {
      const project = await onCreate({
        name: lead.business_name || lead.name,
        emoji: "🎯",
        color: "emerald",
      });
      if (project && onConvertTasks) {
        await onConvertTasks(lead.id, project.id);
      }
      setConvertLeadId("");
      notify("Converted lead into project");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async (project) => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description: "Tasks will become unassigned.",
      confirmLabel: "Delete project",
      danger: true,
    });
    if (ok) await onDelete(project.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 backdrop-blur-xs p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl text-xs"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
          <h2 className="font-bold text-zinc-900">Manage Projects</h2>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-800"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-36 overflow-y-auto py-2 space-y-1 scrollbar-thin">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 font-medium text-zinc-800"
            >
              <span>
                {p.emoji || "📁"} {p.name}
              </span>
              <button
                onClick={() => handleDelete(p)}
                className="text-zinc-400 hover:text-rose-600 transition"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} className="border-t border-zinc-100 pt-2 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            New Project
          </span>
          <div className="flex gap-1.5">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="📁"
              className="control w-10 text-center text-xs py-1 rounded-xl"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project Name"
              className="control flex-1 text-xs py-1 rounded-xl"
              required
            />
          </div>
          <button
            disabled={saving || !name.trim()}
            className="button-primary w-full text-xs py-1.5 rounded-xl font-bold"
          >
            {saving ? "Creating…" : "Create Project"}
          </button>
        </form>

        <div className="border-t border-zinc-100 pt-2 mt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">
            Convert Lead to Project
          </span>
          <div className="flex gap-1.5">
            <select
              value={convertLeadId}
              onChange={(e) => setConvertLeadId(e.target.value)}
              className="control flex-1 text-xs py-1 rounded-xl"
            >
              <option value="">Select Lead...</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name || l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting || !convertLeadId}
              className="button-secondary text-xs px-2.5 py-1 rounded-xl font-semibold"
            >
              Convert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
