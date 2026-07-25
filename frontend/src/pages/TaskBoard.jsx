import { useMemo, useState, useCallback, useRef } from "react";
import { isToday, isBefore, isAfter, addDays, startOfDay, format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
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
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  FolderHeart,
  GripVertical,
  Inbox,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  Search,
  Settings2,
  Target,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useWorkspaceTasks, useTaskProjects, PROJECT_COLORS, TASK_CATEGORIES } from "../hooks/useTasks";
import { useWorkspaceLeads } from "../hooks/useCrm";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useFeedback } from "../context/feedback";
import TaskModal from "../components/TaskModal";
import TaskDetailPanel from "../components/TaskDetailPanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { id: "unplanned",   label: "Unplanned",   color: "border-t-zinc-300",   dot: "bg-zinc-400",   countBg: "bg-zinc-100 text-zinc-500"   },
  { id: "planned",     label: "Planned",     color: "border-t-blue-400",   dot: "bg-blue-500",   countBg: "bg-blue-50 text-blue-600"    },
  { id: "in_progress", label: "In Progress", color: "border-t-violet-500", dot: "bg-violet-500", countBg: "bg-violet-50 text-violet-600" },
  { id: "waiting",     label: "Waiting",     color: "border-t-amber-400",  dot: "bg-amber-500",  countBg: "bg-amber-50 text-amber-600"  },
  { id: "done",        label: "Done",        color: "border-t-emerald-400",dot: "bg-emerald-500",countBg: "bg-emerald-50 text-emerald-600"},
];

const PRIORITY_META = {
  low:    { label: "Low",    icon: "▽", color: "text-zinc-400" },
  medium: { label: "Med",    icon: "◈", color: "text-amber-500" },
  high:   { label: "High",   icon: "▲", color: "text-orange-500" },
  urgent: { label: "Urgent", icon: "⚡",color: "text-rose-500" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaskBoard() {
  const { user } = useAuthWorkspace();
  const taskApi = useWorkspaceTasks();
  const projectApi = useTaskProjects();
  const { leads } = useWorkspaceLeads();
  const { notify } = useFeedback();

  const [tab, setTab] = useState("all"); // "all" | "mine" | "shared"
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "list"
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStatus, setModalDefaultStatus] = useState("unplanned");
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterLead, setFilterLead] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);

  // Local order override for optimistic Kanban DnD
  const [localOrder, setLocalOrder] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const allTasks = useMemo(() => {
    const tasks = localOrder
      ? localOrder.map((id) => taskApi.tasks.find((t) => t.id === id)).filter(Boolean)
      : taskApi.tasks;

    return tasks.filter((task) => {
      if (task.status === "cancelled") return false;
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProject !== "all" && task.project_id !== filterProject) return false;
      if (filterLead !== "all") {
        if (filterLead === "none" && task.lead_id) return false;
        if (filterLead !== "none" && task.lead_id !== filterLead) return false;
      }
      if (filterAssignee !== "all" && !(task.assignee_ids ?? []).includes(filterAssignee)) return false;
      
      if (tab === "mine" && !(task.assignee_ids ?? []).includes(user?.id)) return false;
      if (tab === "shared" && (task.assignee_ids ?? []).length <= 1) return false;
      
      return true;
    });
  }, [taskApi.tasks, localOrder, search, filterProject, filterLead, filterAssignee, tab, user?.id]);

  const tasksByStatus = useMemo(() => {
    const map = {};
    KANBAN_COLUMNS.forEach((col) => { map[col.id] = []; });
    allTasks.forEach((t) => { if (map[t.status]) map[t.status].push(t); });
    return map;
  }, [allTasks]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openCreate = (status = "unplanned") => {
    setModalDefaultStatus(status);
    setModalOpen(true);
  };

  const handleCreate = async (form) => {
    await taskApi.createTask({ ...form, status: modalDefaultStatus });
    setLocalOrder(null);
  };

  const handleUpdate = useCallback(async (id, changes) => {
    await taskApi.updateTask(id, changes);
    if (selectedTask?.id === id) {
      setSelectedTask((prev) => prev ? { ...prev, ...changes } : null);
    }
    setLocalOrder(null);
  }, [taskApi, selectedTask?.id]);

  // Attach addComment to handleUpdate so TaskDetailPanel can access it
  handleUpdate.__addComment = taskApi.addComment;

  const handleDelete = useCallback(async (id) => {
    await taskApi.deleteTask(id);
    setSelectedTask(null);
    setLocalOrder(null);
  }, [taskApi]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => {
    setActiveDragId(active.id);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeData = active.data.current ?? {};
    const overData = over.data.current ?? {};

    if (activeData.type === "task" && overData.type === "kanban-column") {
      const activeTask = taskApi.tasks.find((t) => t.id === active.id);
      if (activeTask && activeTask.status !== overData.id) {
        await taskApi.updateTask(active.id, { status: overData.id });
      }
      return;
    }

    if (activeData.type === "task" && overData.type === "lead-column") {
      const activeTask = taskApi.tasks.find((t) => t.id === active.id);
      if (activeTask) {
        const targetLeadId = overData.id === "unlinked" ? null : overData.id;
        if (activeTask.lead_id !== targetLeadId) {
          await taskApi.updateTask(active.id, { lead_id: targetLeadId });
        }
      }
      return;
    }

    const overTask = taskApi.tasks.find((t) => t.id === over.id);
    if (!overTask) return;
    const activeTask = taskApi.tasks.find((t) => t.id === active.id);
    
    // Optimistically reorder
    const allIds = taskApi.tasks.map((t) => t.id);
    const oldIdx = allIds.indexOf(active.id);
    const newIdx = allIds.indexOf(over.id);
    setLocalOrder(arrayMove(allIds, oldIdx, newIdx));

    // Update status if moved to a different column
    if (overTask.status !== activeTask.status) {
      await taskApi.updateTask(active.id, { status: overTask.status });
      setLocalOrder(null);
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setLocalOrder(null);
  };

  const activeDragTask = activeDragId ? taskApi.tasks.find((t) => t.id === activeDragId) : null;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (taskApi.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-[-.04em]">
            Tasks
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProjectManagerOpen(true)}
            className="button-secondary gap-1.5 py-2 text-xs"
          >
            <Settings2 size={13} /> Projects
          </button>
          <button
            onClick={() => openCreate()}
            className="button-primary gap-1.5 py-2 text-xs"
          >
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-zinc-200/80 pb-3">
        <div className="flex gap-1">
          {[
            { id: "all", label: "All Tasks", Icon: ClipboardList },
            { id: "mine",  label: "My Tasks", Icon: User },
            { id: "shared", label: "Shared Tasks", Icon: Users },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${tab === id ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 w-44 rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-xs font-medium text-zinc-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Project filter */}
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-8 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-600 outline-none focus:border-violet-400"
          >
            <option value="all">All Projects</option>
            {projectApi.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.emoji ? `${p.emoji} ` : ""}{p.name}</option>
            ))}
          </select>

          {/* Lead filter */}
          <select
            value={filterLead}
            onChange={(e) => setFilterLead(e.target.value)}
            className="h-8 w-36 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-600 outline-none focus:border-violet-400"
          >
            <option value="all">All Opps</option>
            <option value="none">No Opp</option>
            {leads?.map((l) => (
              <option key={l.id} value={l.id}>{l.business_name || l.name}</option>
            ))}
          </select>

          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="h-8 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-600 outline-none focus:border-violet-400"
          >
              <option value="all">All Members</option>
              {taskApi.members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>

          {/* View toggle */}
          <div className="flex rounded-xl border border-zinc-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`grid h-7 w-7 place-items-center rounded-lg transition ${viewMode === "kanban" ? "bg-zinc-950 text-white" : "text-zinc-400 hover:text-zinc-700"}`}
              title="Kanban view"
            >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`grid h-7 w-7 place-items-center rounded-lg transition ${viewMode === "list" ? "bg-zinc-950 text-white" : "text-zinc-400 hover:text-zinc-700"}`}
                title="List view"
              >
                <List size={13} />
              </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {viewMode === "kanban" ? (
            <KanbanBoard
              columns={KANBAN_COLUMNS}
              tasksByStatus={tasksByStatus}
              members={taskApi.members}
              projects={projectApi.projects}
              leads={leads ?? []}
              onSelectTask={setSelectedTask}
              onUpdateTask={handleUpdate}
              onAddTask={openCreate}
            />
          ) : (
            <ListView
              columns={KANBAN_COLUMNS}
              tasksByStatus={tasksByStatus}
              members={taskApi.members}
              projects={projectApi.projects}
              leads={leads ?? []}
              onSelectTask={setSelectedTask}
              onUpdateTask={handleUpdate}
              onAddTask={openCreate}
            />
          )}

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeDragTask && (
              <TaskCard
                task={activeDragTask}
                members={taskApi.members}
                projects={projectApi.projects}
                leads={leads ?? []}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          members={taskApi.members}
          projects={projectApi.projects}
          leads={leads ?? []}
          currentUserId={user?.id}
        />
      )}

      {/* Create Task Modal */}
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
        initialValues={{ status: modalDefaultStatus, project_id: filterProject !== "all" ? filterProject : "" }}
      />

      {/* Project Manager */}
      {projectManagerOpen && (
        <ProjectManagerModal
          projects={projectApi.projects}
          leads={leads ?? []}
          onCreate={projectApi.createProject}
          onDelete={projectApi.deleteProject}
          onConvertTasks={async (leadId, projectId) => {
            const tasksToMove = taskApi.tasks.filter((t) => t.lead_id === leadId);
            await Promise.all(tasksToMove.map((t) => taskApi.updateTask(t.id, { project_id: projectId })));
          }}
          onClose={() => setProjectManagerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ columns, tasksByStatus, members, projects, leads, onSelectTask, onUpdateTask, onAddTask }) {
  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <KanbanColumn
          key={col.id}
          col={col}
          tasks={tasksByStatus[col.id] ?? []}
          members={members}
          projects={projects}
          leads={leads}
          onSelectTask={onSelectTask}
          onUpdateTask={onUpdateTask}
          onAddTask={() => onAddTask(col.id)}
        />
      ))}
    </div>
  );
}

function KanbanColumn({ col, tasks, members, projects, leads, onSelectTask, onUpdateTask, onAddTask }) {
  const { setNodeRef, isOver } = useSortable({
    id: col.id,
    data: { type: "column" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] shrink-0 flex-col rounded-[22px] border border-white/70 bg-white/50 backdrop-blur-sm transition ${isOver ? "ring-2 ring-violet-400 ring-offset-1" : ""}`}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between border-t-4 ${col.color} rounded-t-[22px] px-3 py-3`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
          <span className="text-xs font-extrabold text-zinc-700">{col.label}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${col.countBg}`}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="grid h-6 w-6 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
              <SortableTaskCard
              key={task.id}
              task={task}
              members={members}
              projects={projects}
              leads={leads}
              onClick={() => onSelectTask(task)}
              onUpdateTask={onUpdateTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox size={20} className="mb-2 text-zinc-300" />
            <p className="text-xs text-zinc-400">No tasks here</p>
          </div>
        )}
      </div>

      {/* Add task footer */}
      <div className="px-2 pb-2">
        <button
          onClick={onAddTask}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
        >
          <Plus size={13} /> Add task
        </button>
      </div>
    </div>
  );
}

// ─── Sortable Task Card wrapper ───────────────────────────────────────────────

function SortableTaskCard({ task, members, projects, leads, onClick, onUpdateTask }) {
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
        onClick={onClick}
        onUpdateTask={onUpdateTask}
        isDragging={isDragging}
      />
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, members, projects, leads = [], onClick, dragListeners, onUpdateTask, isDragging }) {
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const cat  = TASK_CATEGORIES[task.category];
  const project = projects.find((p) => p.id === task.project_id);
  const projectColor = project ? (PROJECT_COLORS[project.color] ?? PROJECT_COLORS.violet) : null;
  const assignees = members.filter((m) => (task.assignee_ids ?? []).includes(m.id));
  const isOverdue = task.due_at && isBefore(new Date(task.due_at), new Date()) && task.status !== "done";
  const linkedLead = leads.find((l) => l.id === task.lead_id);
  const { confirm } = useFeedback();

  const handleMove = async (e, direction) => {
    e.stopPropagation();
    const statuses = KANBAN_COLUMNS.map(c => c.id);
    const currentIndex = statuses.indexOf(task.status);
    let newIndex = currentIndex;
    
    if (direction === "left" && currentIndex > 0) newIndex--;
    if (direction === "right" && currentIndex < statuses.length - 1) newIndex++;
    
    if (newIndex !== currentIndex) {
      const newStatus = statuses[newIndex];
      const newCol = KANBAN_COLUMNS.find(c => c.id === newStatus);
      
      if (await confirm({ 
        title: "Move task?", 
        description: `Move task to ${newCol.label}?`,
        confirmLabel: "Move"
      })) {
        if (onUpdateTask) {
          onUpdateTask(task.id, { status: newStatus });
        }
      }
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-2xl border bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,.10)] ${isDragging ? "rotate-2 scale-105 shadow-2xl ring-2 ring-violet-400" : ""}`}
      style={{ borderLeftWidth: 3, borderLeftColor: cat ? "" : "transparent" }}
    >
      {/* Drag handle removed (whole card is draggable) */}

      {/* Title */}
      <p className={`pr-5 text-sm font-semibold leading-5 ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"}`}>
        {task.title}
      </p>

      {/* Project + category */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {project && (
          <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${projectColor.light} ${projectColor.text}`}>
            {project.emoji && <span>{project.emoji}</span>}
            {project.name}
          </span>
        )}
        {cat && (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
            <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} />
            {cat.label}
          </span>
        )}
        {linkedLead && (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-100/50 truncate max-w-[140px]">
            <Link2 size={10} /> {linkedLead.business_name || linkedLead.name}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Priority */}
          <span className={`text-[11px] font-bold ${prio.color}`}>
            {prio.icon} {prio.label}
          </span>
          {/* Due */}
          {task.due_at && (
            <span className={`text-[10px] font-semibold ${isOverdue ? "text-rose-500" : "text-zinc-400"}`}>
              {format(new Date(task.due_at), "MMM d")}
            </span>
          )}
        </div>

        {/* Assignee avatars */}
        <div className="flex -space-x-1.5">
          {assignees.slice(0, 2).map((m) => (
            <span
              key={m.id}
              title={m.full_name || m.email}
              className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-zinc-200 text-[9px] font-extrabold text-zinc-600"
            >
              {(m.full_name || m.email)[0].toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Mobile status arrows */}
      <div className="mt-3 flex items-center justify-between sm:hidden pt-2 border-t border-zinc-100">
        <button
          onClick={(e) => handleMove(e, "left")}
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          disabled={task.status === KANBAN_COLUMNS[0].id}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Move Task</span>
        <button
          onClick={(e) => handleMove(e, "right")}
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          disabled={task.status === KANBAN_COLUMNS[KANBAN_COLUMNS.length - 1].id}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ columns, tasksByStatus, members, projects, leads, onSelectTask, onUpdateTask, onAddTask }) {
  return (
    <div className="h-full overflow-y-auto space-y-3 pb-4">
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
            onSelectTask={onSelectTask}
            onUpdateTask={onUpdateTask}
            onAddTask={() => onAddTask(col.id)}
          />
        );
      })}
    </div>
  );
}

function ListGroup({ col, tasks, members, projects, leads, onSelectTask, onUpdateTask, onAddTask }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 border-t-4 ${col.color} rounded-t-[26px] px-4 py-3 text-left`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
        <span className="flex-1 text-sm font-extrabold text-zinc-800">{col.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${col.countBg}`}>{tasks.length}</span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="divide-y divide-zinc-50">
          {tasks.map((task) => (
            <ListRow
              key={task.id}
              task={task}
              members={members}
              projects={projects}
              leads={leads}
              onClick={() => onSelectTask(task)}
              onStatusChange={(status) => onUpdateTask(task.id, { status })}
            />
          ))}
          <button
            onClick={onAddTask}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
          >
            <Plus size={13} /> Add task
          </button>
        </div>
      )}
    </div>
  );
}

function ListRow({ task, members, projects, leads = [], onClick, onStatusChange }) {
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const project = projects.find((p) => p.id === task.project_id);
  const projectColor = project ? (PROJECT_COLORS[project.color] ?? PROJECT_COLORS.violet) : null;
  const assignees = members.filter((m) => (task.assignee_ids ?? []).includes(m.id));
  const isOverdue = task.due_at && isBefore(new Date(task.due_at), new Date()) && task.status !== "done";
  const linkedLead = leads.find((l) => l.id === task.lead_id);

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition group"
    >
      {/* Status toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onStatusChange(task.status === "done" ? "in_progress" : "done"); }}
        className={`shrink-0 transition ${task.status === "done" ? "text-emerald-500" : "text-zinc-300 hover:text-emerald-400"}`}
      >
        <CheckCircle2 size={17} />
      </button>

      {/* Title */}
      <span className={`flex-1 text-sm font-semibold truncate ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-800"}`}>
        {task.title}
      </span>

      {/* Project chip */}
      {project && (
        <span className={`hidden sm:inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${projectColor.light} ${projectColor.text}`}>
          {project.emoji && <span>{project.emoji}</span>}
          {project.name}
        </span>
      )}

      {/* Linked lead */}
      {linkedLead && (
        <span className="hidden md:inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-100/50 truncate max-w-[120px]">
          <Link2 size={10} /> {linkedLead.business_name || linkedLead.name}
        </span>
      )}

      {/* Priority */}
      <span className={`hidden sm:inline text-[11px] font-bold ${prio.color}`}>{prio.icon} {prio.label}</span>

      {/* Due date */}
      {task.due_at && (
        <span className={`hidden md:inline text-[10px] font-semibold ${isOverdue ? "text-rose-500" : "text-zinc-400"}`}>
          {format(new Date(task.due_at), "MMM d")}
        </span>
      )}

      {/* Assignees */}
      <div className="flex -space-x-1.5">
        {assignees.slice(0, 2).map((m) => (
          <span
            key={m.id}
            title={m.full_name || m.email}
            className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-zinc-200 text-[9px] font-extrabold text-zinc-600"
          >
            {(m.full_name || m.email)[0].toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Project Manager Modal ────────────────────────────────────────────────────

const COLOR_OPTIONS = Object.keys(PROJECT_COLORS);

function ProjectManagerModal({ projects, leads = [], onCreate, onDelete, onConvertTasks, onClose }) {
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
      setName(""); setEmoji("");
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
      const project = await onCreate({ name: lead.business_name || lead.name, emoji: "🎯", color: "emerald" });
      if (project && onConvertTasks) {
        await onConvertTasks(lead.id, project.id);
      }
      setConvertLeadId("");
      notify("Opportunity converted to project!");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async (project) => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description: "Tasks in this project will become unassigned. This cannot be undone.",
      confirmLabel: "Delete project",
      danger: true,
    });
    if (ok) await onDelete(project.id);
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-zinc-950/35 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="panel w-full max-w-md overflow-hidden bg-white"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight">Manage Projects</h2>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-500">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
          {/* Existing projects */}
          <div className="space-y-2">
            {projects.map((p) => {
              const pc = PROJECT_COLORS[p.color] ?? PROJECT_COLORS.violet;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base ${pc.light}`}>
                    {p.emoji || <span className={`h-3 w-3 rounded-full ${pc.bg}`} />}
                  </span>
                  <span className="flex-1 text-sm font-bold text-zinc-800">{p.name}</span>
                  <button
                    onClick={() => handleDelete(p)}
                    className="grid h-7 w-7 place-items-center rounded-xl text-zinc-400 hover:bg-rose-50 hover:text-rose-500 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            {projects.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-400">No projects yet. Create your first one below.</p>
            )}
          </div>
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} className="border-t border-zinc-100 px-6 py-4">
          <p className="mb-3 text-xs font-extrabold text-zinc-500 uppercase tracking-wider">New project</p>
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="🚀"
              className="control w-14 text-center text-lg"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="control flex-1"
              required
            />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">Color:</span>
            {COLOR_OPTIONS.map((c) => {
              const pc = PROJECT_COLORS[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full transition ${pc.bg} ${color === c ? "ring-2 ring-offset-2 ring-zinc-400 scale-110" : "opacity-60 hover:opacity-100"}`}
                />
              );
            })}
          </div>
          <button disabled={saving || !name.trim()} className="button-primary mt-3 w-full gap-2">
            <Plus size={14} /> {saving ? "Creating…" : "Create project"}
          </button>
        </form>
        
        {/* Convert from Lead */}
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
          <p className="mb-3 text-xs font-extrabold text-zinc-500 uppercase tracking-wider">Convert Opportunity to Project</p>
          <div className="flex flex-col gap-3">
            <select
              value={convertLeadId}
              onChange={(e) => setConvertLeadId(e.target.value)}
              className="control w-full text-sm font-semibold text-zinc-700"
            >
              <option value="">Select an opportunity...</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.business_name || l.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting || !convertLeadId}
              className="button-primary w-full gap-2 !bg-emerald-600 hover:!bg-emerald-700 disabled:!bg-zinc-300"
            >
              <FolderHeart size={14} /> {converting ? "Converting..." : "Convert to Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
