import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Filter,
  CalendarClock,
  CheckSquare2,
  ChevronRight,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  BookmarkPlus,
  Phone,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  PanelRightOpen,
  PanelRightClose,
  Clock,
  Layers,
  ChevronLeft,
  ArrowUpDown,
  Download,
  Minimize2,
  Maximize2,
  Kanban,
  List,
  LayoutGrid,
  Flame,
  Target,
  Sparkle,
  Inbox,
} from "lucide-react";
import AddLeadModal from "../components/AddLeadModal";
import CsvImportModal from "../components/CsvImportModal";
import TaskModal from "../components/TaskModal";
import { TASK_CATEGORIES, useWorkspaceTasks } from "../hooks/useTasks";
import { useFeedback } from "../context/feedback";
import {
  PIPELINE_STATUSES,
  usePipelineViews,
  useWorkspaceLeadTags,
  useWorkspaceLeads,
  useWorkspaceMembers,
} from "../hooks/useCrm";

const stageConfig = {
  new: {
    label: "New Leads",
    subtitle: "Fresh prospects ready to qualify",
    color: "bg-[#52525B]",
    columnBg: "bg-[#F4F4F6]/90 border-[#E4E4E7]",
    headerBg: "bg-transparent text-zinc-900",
    pillBg: "bg-zinc-200/80 text-zinc-800 border-zinc-300/60",
    borderLeft: "border-l-zinc-400",
    dropRing: "ring-zinc-400/50 bg-zinc-100/50",
  },
  contacted: {
    label: "In Contact",
    subtitle: "Conversations underway",
    color: "bg-[#7C3AED]",
    columnBg: "bg-[#F3EEFE]/90 border-[#E8DEF8]",
    headerBg: "bg-transparent text-purple-950",
    pillBg: "bg-purple-100 text-purple-800 border-purple-200",
    borderLeft: "border-l-purple-500",
    dropRing: "ring-purple-400/50 bg-purple-50/40",
  },
  qualified: {
    label: "Qualified",
    subtitle: "Verified opportunity & need",
    color: "bg-[#2563EB]",
    columnBg: "bg-[#EBF5FE]/90 border-[#D6EAFE]",
    headerBg: "bg-transparent text-sky-950",
    pillBg: "bg-sky-100 text-sky-800 border-sky-200",
    borderLeft: "border-l-sky-500",
    dropRing: "ring-sky-400/50 bg-sky-50/40",
  },
  proposal: {
    label: "Proposal Sent",
    subtitle: "Offer delivered, negotiating",
    color: "bg-[#9333EA]",
    columnBg: "bg-[#FAF5FF]/90 border-[#F3E8FF]",
    headerBg: "bg-transparent text-fuchsia-950",
    pillBg: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    borderLeft: "border-l-fuchsia-500",
    dropRing: "ring-fuchsia-400/50 bg-fuchsia-50/40",
  },
  won: {
    label: "Closed Won 🎉",
    subtitle: "Deals signed & converted",
    color: "bg-[#10B981]",
    columnBg: "bg-[#ECFDF5]/90 border-[#D1FAE5]",
    headerBg: "bg-transparent text-emerald-950",
    pillBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
    borderLeft: "border-l-emerald-500",
    dropRing: "ring-emerald-400/50 bg-emerald-50/40",
  },
  lost: {
    label: "Closed Lost",
    subtitle: "Passed or unresponsive",
    color: "bg-[#71717A]",
    columnBg: "bg-[#F4F4F5]/90 border-[#E4E4E7]",
    headerBg: "bg-transparent text-zinc-700",
    pillBg: "bg-zinc-200/70 text-zinc-600 border-zinc-300",
    borderLeft: "border-l-zinc-300",
    dropRing: "ring-zinc-400/50 bg-zinc-100/50",
  },
};

const labels = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export default function LeadsTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { leads, isLoading, error, updateLead, bulkUpdate, addLead } =
    useWorkspaceLeads();
  const members = useWorkspaceMembers();
  const taskApi = useWorkspaceTasks();
  const tagApi = useWorkspaceLeadTags();
  const viewApi = usePipelineViews();
  const { notify, confirm } = useFeedback();

  const searchInputRef = useRef(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addInitialStatus, setAddInitialStatus] = useState("new");
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [layoutMode, setLayoutMode] = useState("kanban"); // 'kanban' | 'list' | 'matrix'
  const [quickTab, setQuickTab] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [workFilter, setWorkFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [scrapeJobFilter, setScrapeJobFilter] = useState(
    searchParams.get("scrape_job") || "all",
  );
  const [selectedViewId, setSelectedViewId] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewVisibility, setViewVisibility] = useState("personal");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [taskLead, setTaskLead] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState([]);

  // Keyboard Shortcuts: '/' to focus search, 'Escape' to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setAddInitialStatus("new");
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

  useEffect(() => {
    setScrapeJobFilter(searchParams.get("scrape_job") || "all");
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("needs_action") !== "1") return;
    setWorkFilter("needs_action");
    setQuickTab("needs_action");
    setFiltersOpen(true);
  }, [searchParams]);

  const handleOpenLeadDetail = (id) => {
    setActiveLeadId(id);
    setDrawerOpen(true);
  };

  const handleOpenAddLeadModal = (status = "new") => {
    setAddInitialStatus(status);
    setAddOpen(true);
  };

  const toggleCollapseStage = (stg) => {
    setCollapsedStages((prev) =>
      prev.includes(stg) ? prev.filter((s) => s !== stg) : [...prev, stg],
    );
  };

  const exportFilteredCsv = () => {
    if (!visible.length) {
      notify("No leads to export", "error");
      return;
    }
    const headers = [
      "Business Name",
      "Status",
      "Score",
      "Rating",
      "Reviews",
      "Area",
      "Niche",
      "Phone",
      "Email",
      "Website",
    ];
    const rows = visible.map((l) => [
      `"${(l.business_name || "").replace(/"/g, '""')}"`,
      `"${l.status || ""}"`,
      l.score || 0,
      l.rating || "",
      l.reviews || "",
      `"${(l.area || "").replace(/"/g, '""')}"`,
      `"${(l.niche || "").replace(/"/g, '""')}"`,
      `"${l.phone || ""}"`,
      `"${l.email || ""}"`,
      `"${l.website || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `pipeline_leads_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${visible.length} leads to CSV.`);
  };

  const visible = useMemo(() => {
    let filtered = leads.filter((lead) => {
      const matchesSearch =
        `${lead.business_name} ${lead.phone ?? ""} ${lead.email ?? ""} ${lead.niche ?? ""} ${lead.area ?? ""} ${lead.remarks ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesOwner =
        ownerFilter === "all" ||
        (ownerFilter === "unassigned"
          ? !lead.assigned_to
          : lead.assigned_to === ownerFilter);

      const relatedTasks = taskApi.tasks.filter(
        (task) =>
          task.lead_id === lead.id &&
          !["done", "cancelled"].includes(task.status),
      );
      const dates = relatedTasks
        .map((task) => task.scheduled_start || task.due_at)
        .filter(Boolean);

      const matchesWork =
        workFilter === "all" ||
        (workFilter === "needs_action" && !relatedTasks.length) ||
        (workFilter === "overdue" &&
          dates.some((date) => new Date(date) < new Date())) ||
        (workFilter === "planned" &&
          relatedTasks.some((task) => task.scheduled_start));

      const matchesTag =
        tagFilter === "all" ||
        tagApi.tags
          .find((tag) => tag.id === tagFilter)
          ?.lead_ids.includes(lead.id);

      const matchesScrapeJob =
        scrapeJobFilter === "all" ||
        String(lead.metadata?.scrape_job_id) === scrapeJobFilter;

      let matchesQuickTab = true;
      const isScraped =
        lead.source_type === "scraped" ||
        ["scraped", "google maps"].includes(String(lead.source || "").toLowerCase());

      if (quickTab === "scraped") matchesQuickTab = isScraped;
      if (quickTab === "manual") matchesQuickTab = !isScraped;
      if (quickTab === "needs_action") matchesQuickTab = !relatedTasks.length;
      if (quickTab === "high_score") matchesQuickTab = (lead.score || 0) >= 70;

      return (
        matchesSearch &&
        matchesOwner &&
        matchesWork &&
        matchesTag &&
        matchesScrapeJob &&
        matchesQuickTab
      );
    });

    if (sortBy === "score") {
      filtered = [...filtered].sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === "rating") {
      filtered = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "name") {
      filtered = [...filtered].sort((a, b) =>
        a.business_name.localeCompare(b.business_name),
      );
    }

    return filtered;
  }, [
    leads,
    ownerFilter,
    scrapeJobFilter,
    search,
    tagApi.tags,
    taskApi.tasks,
    tagFilter,
    workFilter,
    quickTab,
    sortBy,
  ]);

  const hasActiveFilters =
    ownerFilter !== "all" ||
    workFilter !== "all" ||
    tagFilter !== "all" ||
    scrapeJobFilter !== "all" ||
    quickTab !== "all" ||
    sortBy !== "default";

  const activeLead = leads.find((lead) => lead.id === activeLeadId) || null;
  const activeLeadTasks = activeLead
    ? taskApi.tasks.filter((task) => task.lead_id === activeLead.id)
    : [];

  const openTaskCount = visible.reduce(
    (count, lead) =>
      count +
      taskApi.tasks.filter(
        (task) =>
          task.lead_id === lead.id &&
          !["done", "cancelled"].includes(task.status),
      ).length,
    0,
  );

  const needsActionCount = visible.filter(
    (lead) =>
      !taskApi.tasks.some(
        (task) =>
          task.lead_id === lead.id &&
          !["done", "cancelled"].includes(task.status),
      ),
  ).length;

  const overdueTaskCount = visible.filter((lead) => {
    const relatedTasks = taskApi.tasks.filter(
      (task) =>
        task.lead_id === lead.id &&
        !["done", "cancelled"].includes(task.status),
    );
    return relatedTasks.some((t) => {
      const d = t.scheduled_start || t.due_at;
      return d && new Date(d) < new Date();
    });
  }).length;

  const applyView = (id) => {
    setSelectedViewId(id);
    const view = viewApi.views.find((item) => item.id === id);
    if (!view) return;
    const filters = view.filters ?? {};
    setOwnerFilter(filters.assigneeIds?.[0] ?? "all");
    setWorkFilter(filters.workState ?? "all");
    setTagFilter(filters.tagIds?.[0] ?? "all");
    setScrapeJobFilter(
      filters.scrapeJobIds?.[0] ? String(filters.scrapeJobIds[0]) : "all",
    );
  };

  const saveView = async (event) => {
    event.preventDefault();
    if (!viewName.trim()) return;
    try {
      const view = await viewApi.createView({
        name: viewName,
        visibility: viewVisibility,
        filters: {
          ...(ownerFilter !== "all" ? { assigneeIds: [ownerFilter] } : {}),
          ...(workFilter !== "all" ? { workState: workFilter } : {}),
          ...(tagFilter !== "all" ? { tagIds: [tagFilter] } : {}),
          ...(scrapeJobFilter !== "all"
            ? { scrapeJobIds: [Number(scrapeJobFilter)] }
            : {}),
        },
      });
      setSelectedViewId(view.id);
      setViewName("");
      setSaveViewOpen(false);
      notify("Pipeline view saved.");
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const toggle = (id) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );

  const toggleAll = () => {
    if (selected.length === visible.length && visible.length > 0) {
      setSelected([]);
    } else {
      setSelected(visible.map((lead) => lead.id));
    }
  };

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
      <div className="panel flex items-center justify-center p-8 text-zinc-500 gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        <span className="font-semibold text-xs">Opening pipeline board…</span>
      </div>
    );

  if (error)
    return (
      <div className="panel border-rose-200 p-6 text-rose-600 text-xs font-semibold">
        Could not load leads: {error.message}
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* Sleek Compact Top Bar Toolbar */}
      <header className="flex flex-col gap-2 bg-white/75 px-3.5 py-2 rounded-[20px] border border-white/90 shadow-[0_6px_25px_rgba(40,30,70,.04)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Title & View Switcher (Board vs List vs Priority Matrix) & Metrics */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-extrabold tracking-tight text-zinc-950">
              Pipeline
            </h1>

            {/* Layout Mode Switcher (Board vs Power Calling vs Priority Matrix) */}
            <div className="flex items-center gap-0.5 rounded-xl bg-zinc-100/90 p-0.5 border border-zinc-200/60">
              <button
                onClick={() => setLayoutMode("kanban")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all ${
                  layoutMode === "kanban"
                    ? "bg-white text-zinc-950 shadow-2xs ring-1 ring-zinc-200"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
                title="Kanban Board View"
              >
                <Kanban size={13} />
                <span>Board</span>
              </button>
              <button
                onClick={() => setLayoutMode("table")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all ${
                  layoutMode === "table"
                    ? "bg-white text-zinc-950 shadow-2xs ring-1 ring-zinc-200"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
                title="Cold Calling Table View"
              >
                <List size={13} />
                <span>Table List</span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.2 text-[10px] font-bold text-zinc-700">
                <Layers size={11} className="text-zinc-500" />
                {visible.length}
              </span>

              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.2 text-[10px] font-extrabold text-amber-800 border border-amber-200/60">
                <Zap size={11} className="text-amber-600" />
                {needsActionCount} need action
              </span>

              {overdueTaskCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.2 text-[10px] font-extrabold text-rose-700 border border-rose-200/60">
                  <Clock size={11} className="text-rose-500" />
                  {overdueTaskCount} overdue
                </span>
              )}
            </div>
          </div>

          {/* Controls & Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Jira Quick Filter Tabs */}
            <div className="flex items-center gap-0.5 rounded-xl bg-zinc-100/90 p-0.5">
              <QuickTabButton
                active={quickTab === "all"}
                onClick={() => setQuickTab("all")}
                label="All"
                count={leads.length}
              />
              <QuickTabButton
                active={quickTab === "scraped"}
                onClick={() => setQuickTab("scraped")}
                label="Scraped"
              />
              <QuickTabButton
                active={quickTab === "manual"}
                onClick={() => setQuickTab("manual")}
                label="Manual"
              />
              <QuickTabButton
                active={quickTab === "needs_action"}
                onClick={() => setQuickTab("needs_action")}
                label="Needs Action"
                highlight
              />
              <QuickTabButton
                active={quickTab === "high_score"}
                onClick={() => setQuickTab("high_score")}
                label="⚡ Top"
              />
            </div>

            {/* Sort Selector */}
            <label className="control flex items-center gap-1 py-0.5 px-2 shadow-2xs text-xs">
              <ArrowUpDown size={12} className="text-zinc-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="default">Sort: Default</option>
                <option value="score">Sort: Score</option>
                <option value="rating">Sort: Rating</option>
                <option value="name">Sort: A-Z</option>
              </select>
            </label>

            {/* Search Input with Hotkey Tooltip */}
            <label className="control flex items-center gap-1 py-0.5 px-2 shadow-2xs min-w-[130px] text-xs">
              <Search size={12} className="text-zinc-400 shrink-0" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search (/)..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-zinc-400"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="text-zinc-400 hover:text-zinc-700">
                  <X size={11} />
                </button>
              ) : (
                <span className="mono rounded bg-zinc-200/70 px-1 py-0.2 text-[9px] font-bold text-zinc-500">
                  /
                </span>
              )}
            </label>

            {/* Saved Views Selector */}
            <select
              value={selectedViewId}
              onChange={(event) => applyView(event.target.value)}
              className="control py-0.5 px-2 text-xs font-semibold cursor-pointer"
              aria-label="Choose a saved Pipeline view"
            >
              <option value="">Views</option>
              {viewApi.views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`button-secondary py-0.5 px-2 text-xs gap-1 ${
                filtersOpen || hasActiveFilters
                  ? "border-violet-300 bg-violet-50 text-violet-700 font-bold"
                  : ""
              }`}
              title="Filters"
            >
              <Filter size={12} />
              {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />}
            </button>

            {/* Export CSV */}
            <button
              onClick={exportFilteredCsv}
              className="button-secondary py-0.5 px-2 text-xs gap-1"
              title="Export visible leads to CSV"
            >
              <Download size={12} /> Export
            </button>

            {/* Import */}
            <button
              onClick={() => setImportOpen(true)}
              className="button-secondary py-0.5 px-2 text-xs gap-1"
            >
              <Upload size={12} /> Import
            </button>

            {/* Add Lead */}
            <button
              onClick={() => handleOpenAddLeadModal("new")}
              className="button-primary liquid-button py-0.5 px-2.5 text-xs gap-1"
            >
              <Plus size={13} /> Add
            </button>

            {/* Toggle Drawer button */}
            {activeLead && (
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className={`button-secondary py-0.5 px-1.5 text-xs ${
                  drawerOpen ? "bg-zinc-900 text-white" : ""
                }`}
                title={drawerOpen ? "Close lead drawer" : "Open lead drawer"}
              >
                {drawerOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Filter Options Bar */}
      {filtersOpen && (
        <section className="panel flex flex-wrap items-end gap-2.5 p-2.5 bg-white/95 text-xs">
          <label className="text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
            Owner
            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="control mt-0.5 block w-full min-w-36 text-xs normal-case tracking-normal sm:w-auto py-0.5"
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
              className="control mt-0.5 block w-full min-w-36 text-xs normal-case tracking-normal sm:w-auto py-0.5"
            >
              <option value="all">All work states</option>
              <option value="needs_action">No next action</option>
              <option value="overdue">Overdue</option>
              <option value="planned">Scheduled</option>
            </select>
          </label>

          <label className="text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
            Tag
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="control mt-0.5 block w-full min-w-36 text-xs normal-case tracking-normal sm:w-auto py-0.5"
            >
              <option value="all">All tags</option>
              {tagApi.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>

          {scrapeJobFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 border border-sky-200">
              <Tag size={11} /> Scrape #{scrapeJobFilter}
            </span>
          )}

          <div className="flex items-center gap-3 sm:ml-auto pb-0.5">
            <button
              onClick={() => {
                setOwnerFilter("all");
                setWorkFilter("all");
                setTagFilter("all");
                setScrapeJobFilter("all");
                setQuickTab("all");
                setSortBy("default");
                setSelectedViewId("");
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete("scrape_job");
                  return next;
                });
              }}
              className="text-xs font-bold text-rose-600 hover:underline"
            >
              Reset filters
            </button>
            <button
              onClick={() => setSaveViewOpen(!saveViewOpen)}
              className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline"
            >
              <BookmarkPlus size={12} /> Save view
            </button>
          </div>
        </section>
      )}

      {/* Save View Form */}
      {saveViewOpen && (
        <form
          onSubmit={saveView}
          className="panel flex flex-wrap items-end gap-2.5 p-2.5 bg-white text-xs"
        >
          <label className="flex-1 font-bold text-zinc-600">
            View name
            <input
              autoFocus
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              className="control mt-0.5 w-full py-0.5 text-xs"
              maxLength="80"
              placeholder="e.g. High value leads needing action"
            />
          </label>
          <label className="font-bold text-zinc-600">
            Share with
            <select
              value={viewVisibility}
              onChange={(event) => setViewVisibility(event.target.value)}
              className="control mt-0.5 py-0.5 text-xs"
            >
              <option value="personal">Only me</option>
              <option value="workspace">Workspace team</option>
            </select>
          </label>
          <button className="button-primary text-xs py-1 px-2.5">Save view</button>
        </form>
      )}

      {/* Bulk Action Bar */}
      {selected.length > 0 && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-white p-2 shadow-md text-xs">
          <span className="grid h-5.5 min-w-5.5 place-items-center rounded-lg bg-violet-600 px-1.5 text-xs font-bold text-white">
            {selected.length}
          </span>
          <span className="mr-1 font-extrabold text-zinc-800">selected</span>
          <select
            defaultValue=""
            onChange={(e) =>
              e.target.value && bulk({ status: e.target.value })
            }
            disabled={busy}
            className="control py-0.5 text-xs"
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
            className="control py-0.5 text-xs"
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
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
          >
            <Trash2 size={12} /> Delete
          </button>
          <button
            onClick={() => setSelected([])}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-900 sm:ml-auto"
          >
            Clear selection
          </button>
        </section>
      )}

      {/* Main Container Viewport (Kanban Board vs Upgraded List vs Priority Matrix) */}
      <section className="relative flex min-h-0 flex-1 overflow-hidden">
        {layoutMode === "kanban" ? (
          /* Kanban Horizontal Scroll Container with Mobile Snap Scroll */
          <div className="scrollbar-thin flex min-h-0 flex-1 gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pt-0.5 px-0.5">
            {PIPELINE_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={visible.filter((lead) => lead.status === status)}
                selected={selected}
                activeLeadId={activeLeadId}
                isCollapsed={collapsedStages.includes(status)}
                onToggleCollapse={() => toggleCollapseStage(status)}
                onToggle={toggle}
                onOpen={handleOpenLeadDetail}
                onDrop={(id) => updateLead(id, { status })}
                tasks={taskApi.tasks}
                members={taskApi.members}
                onAddTask={setTaskLead}
                onAddLeadToStage={() => handleOpenAddLeadModal(status)}
                onQuickMoveStage={(leadId, newStatus) => updateLead(leadId, { status: newStatus })}
              />
            ))}
          </div>
        ) : (
          /* High-Productivity Cold Calling & Leads Table View */
          <div className="flex-1 min-h-0 overflow-hidden">
            <PipelineTableView
              leads={visible}
              tasks={taskApi.tasks}
              members={taskApi.members}
              activeLeadId={activeLeadId}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onOpen={handleOpenLeadDetail}
              onUpdateLead={updateLead}
              onAddTask={setTaskLead}
            />
          </div>
        )}

        {/* Slide-Over / Floating Lead Detail Panel */}
        {drawerOpen && activeLead && (
          <aside className="absolute inset-y-0 right-0 z-40 w-full max-w-[390px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all animate-in slide-in-from-right duration-200">
            <PipelineDetailPanel
              lead={activeLead}
              tasks={activeLeadTasks}
              members={taskApi.members}
              tags={tagApi.tags}
              onClose={() => setDrawerOpen(false)}
              onStageChange={(status) =>
                activeLead && updateLead(activeLead.id, { status })
              }
              onAddTask={() => activeLead && setTaskLead(activeLead)}
            />
          </aside>
        )}
      </section>

      {/* Modals */}
      <AddLeadModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        initialStatus={addInitialStatus}
      />
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

function PipelineTableView({
  leads,
  tasks,
  members,
  activeLeadId,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  onUpdateLead,
  onAddTask,
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* List Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200/60 bg-zinc-50/70 mb-2 rounded-xl">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={leads.length > 0 && selected.length === leads.length}
            onChange={onToggleAll}
            className="h-3.5 w-3.5 accent-violet-600 rounded cursor-pointer"
          />
          <span className="text-xs font-black text-zinc-700">
            Select All ({leads.length} Leads)
          </span>
        </div>
        <span className="text-[11px] font-bold text-zinc-400">
          Click any card to open detail panel
        </span>
      </div>

      {/* Floating Cards Container */}
      <div className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto pr-1">
        {leads.map((lead) => {
          const active = lead.id === activeLeadId;
          const isSelected = selected.includes(lead.id);
          const cfg = stageConfig[lead.status] || stageConfig.new;
          const owner = members.find((m) => m.id === lead.assigned_to);
          const leadTasks = tasks.filter(
            (t) => t.lead_id === lead.id && !["done", "cancelled"].includes(t.status),
          );
          const nextTask = leadTasks[0];
          const score = lead.score || 0;

          const hasPhone = Boolean(lead.phone && !/^n\/?a$/i.test(lead.phone.trim()));
          const hasEmail = Boolean(lead.email && !/^n\/?a$/i.test(lead.email.trim()));
          const hasWebsite = Boolean(lead.website && !/^n\/?a$/i.test(lead.website.trim()));

          return (
            <article
              key={lead.id}
              onClick={() => onOpen(lead.id)}
              className={`group relative flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                active
                  ? "border-violet-500 ring-2 ring-violet-200 shadow-md"
                  : "border-zinc-200/80 hover:border-violet-300"
              }`}
            >
              {/* Left Column: Checkbox, Logo Badge, Business Title & Subtitle */}
              <div className="flex items-start gap-3 min-w-0 md:w-1/3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(lead.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 accent-violet-600 rounded cursor-pointer shrink-0"
                />

                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-sm font-black text-white shadow-2xs">
                  {lead.business_name ? lead.business_name[0].toUpperCase() : "B"}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-sm text-zinc-950 truncate group-hover:text-violet-700 transition-colors">
                      {lead.business_name}
                    </h3>
                    {score > 0 && (
                      <span className="mono rounded-full bg-violet-50 px-1.5 py-0.1 text-[9px] font-black text-violet-700 border border-violet-100 shrink-0">
                        ⚡{score}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-xs text-zinc-500 font-semibold truncate">
                    {[lead.niche, lead.area].filter(Boolean).join(" · ") || "Prospect"}
                  </p>

                  {lead.rating && (
                    <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-md">
                      <Star size={9} fill="currentColor" /> {lead.rating}
                    </span>
                  )}
                </div>
              </div>

              {/* Middle Column: Interactive Stage Dropdown, Owner & Quick Contact Actions */}
              <div className="flex flex-wrap items-center gap-2 md:w-1/3" onClick={(e) => e.stopPropagation()}>
                <select
                  value={lead.status}
                  onChange={(e) => onUpdateLead(lead.id, { status: e.target.value })}
                  className={`control py-1 px-2.5 text-xs font-black rounded-xl border cursor-pointer ${cfg.pillBg}`}
                >
                  {PIPELINE_STATUSES.map((stg) => (
                    <option key={stg} value={stg}>
                      {labels[stg]}
                    </option>
                  ))}
                </select>

                <select
                  value={lead.assigned_to || ""}
                  onChange={(e) => onUpdateLead(lead.id, { assignedTo: e.target.value || null })}
                  className="control py-1 px-2 text-[11px] font-bold rounded-xl bg-zinc-50 text-zinc-700 border-zinc-200 cursor-pointer"
                >
                  <option value="">👤 Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      👤 {m.full_name || m.email}
                    </option>
                  ))}
                </select>

                {/* Contact Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {hasPhone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-extrabold text-emerald-800 hover:bg-emerald-100 transition text-[10px]"
                      title="Call Phone"
                    >
                      <Phone size={10} className="text-emerald-600" />
                      <span>{lead.phone}</span>
                    </a>
                  )}

                  {hasEmail && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 font-bold text-violet-800 hover:bg-violet-100 transition text-[10px]"
                      title="Send Email"
                    >
                      <Mail size={10} />
                      <span className="truncate max-w-[90px]">{lead.email}</span>
                    </a>
                  )}

                  {hasWebsite && (
                    <a
                      href={isExternalUrl(lead.website) ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 font-bold text-sky-800 hover:bg-sky-100 transition text-[10px]"
                      title="Visit Website"
                    >
                      <Globe2 size={10} />
                      <span className="truncate max-w-[80px]">{lead.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Scheduled Task Box & Action Buttons */}
              <div className="flex items-center justify-between md:justify-end gap-3 md:w-1/3 border-t md:border-t-0 border-zinc-100 pt-2 md:pt-0">
                <div className="min-w-0 flex-1 max-w-[180px]" onClick={(e) => e.stopPropagation()}>
                  {nextTask ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2">
                      <p className="truncate text-[11px] font-extrabold text-zinc-900 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-600 shrink-0" />
                        <span className="truncate">{nextTask.title}</span>
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddTask(lead)}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-violet-700 hover:text-violet-900 bg-violet-50 px-2.5 py-1 rounded-xl border border-violet-200"
                    >
                      <Plus size={12} /> Add Task
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onOpen(lead.id)}
                    className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                    title="Open Lead Details"
                  >
                    <PanelRightOpen size={14} />
                  </button>

                  <button
                    onClick={() => onUpdateLead(lead.id, { remove: true })}
                    className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-500 hover:bg-rose-100 transition"
                    title="Delete Lead"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function QuickTabButton({ active, onClick, label, count, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold transition-all ${
        active
          ? "bg-white text-zinc-950 shadow-2xs ring-1 ring-zinc-200"
          : highlight
          ? "text-amber-800 hover:bg-amber-100/60"
          : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1 py-0.1 text-[9px] font-extrabold ${
            active
              ? "bg-zinc-100 text-zinc-800"
              : "bg-zinc-200/70 text-zinc-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function KanbanColumn({
  status,
  leads,
  selected,
  activeLeadId,
  isCollapsed,
  onToggleCollapse,
  onToggle,
  onOpen,
  onDrop,
  tasks,
  members,
  onAddTask,
  onAddLeadToStage,
  onQuickMoveStage,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cfg = stageConfig[status] || stageConfig.new;

  if (isCollapsed) {
    return (
      <section
        onClick={onToggleCollapse}
        className={`flex w-[46px] shrink-0 flex-col items-center justify-between rounded-[18px] border border-zinc-200 bg-[#F7F6F3]/90 py-3 cursor-pointer hover:bg-white transition-all shadow-2xs ${cfg.borderLeft}`}
        title={`Expand ${cfg.label} column (${leads.length} leads)`}
      >
        <div className="flex flex-col items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,.8)] ${cfg.color}`}
          />
          <span className="mono rounded-full bg-zinc-200/80 px-1.5 py-0.2 text-[9px] font-bold text-zinc-700">
            {leads.length}
          </span>
        </div>

        <div className="writing-mode-vertical rotate-180 py-4 text-xs font-extrabold tracking-wider text-zinc-600">
          {cfg.label}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="rounded p-1 text-zinc-400 hover:text-zinc-800"
        >
          <Maximize2 size={12} />
        </button>
      </section>
    );
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const id = e.dataTransfer.getData("lead-id");
        if (id) onDrop(id);
      }}
      className={`flex w-[calc(100vw-2.5rem)] sm:w-[305px] shrink-0 snap-center flex-col rounded-[24px] border p-3 shadow-2xs transition-all duration-200 ${cfg.columnBg} ${
        isDragOver ? `${cfg.dropRing} scale-[1.01] ring-2` : ""
      }`}
    >
      {/* Screenshot 1 Column Header */}
      <header className="mb-3 flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-3 w-3 shrink-0 rounded-md ${cfg.color}`} />
          <h2 className="truncate text-sm font-extrabold tracking-tight text-zinc-950">
            {cfg.label}
          </h2>
          <span className="mono rounded-full bg-white/90 px-2 py-0.2 text-[10px] font-black text-zinc-700 border border-zinc-200/80 shadow-2xs">
            {leads.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddLeadToStage}
            title={`Add lead to ${cfg.label}`}
            className="grid h-6 w-6 place-items-center rounded-lg bg-white/80 text-zinc-600 shadow-2xs transition hover:bg-white hover:text-zinc-950 border border-zinc-200/60"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onToggleCollapse}
            title={`Collapse ${cfg.label} column`}
            className="grid h-6 w-6 place-items-center rounded-lg bg-white/60 text-zinc-400 shadow-2xs transition hover:bg-white hover:text-zinc-800 border border-zinc-200/60"
          >
            <Minimize2 size={12} />
          </button>
        </div>
      </header>

      {/* Cards List */}
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            currentStage={status}
            active={lead.id === activeLeadId}
            checked={selected.includes(lead.id)}
            onToggle={() => onToggle(lead.id)}
            onOpen={() => onOpen(lead.id)}
            tasks={tasks.filter((t) => t.lead_id === lead.id)}
            members={members}
            onAddTask={() => onAddTask(lead)}
            onQuickMoveStage={(newStatus) => onQuickMoveStage(lead.id, newStatus)}
          />
        ))}

        {!leads.length && (
          <div
            onClick={onAddLeadToStage}
            className="group flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300/70 bg-white/50 p-6 text-center transition hover:border-violet-300 hover:bg-white cursor-pointer"
          >
            <p className="text-xs font-bold text-zinc-400 group-hover:text-violet-600">
              Empty column
            </p>
            <span className="mt-0.5 text-[10px] text-zinc-400">
              Drop card or click + to add
            </span>
          </div>
        )}
      </div>

      {/* Screenshot 1 Column Footer: Subtle + Add Card */}
      <footer className="mt-2.5 pt-1 px-0.5">
        <button
          onClick={onAddLeadToStage}
          className="flex w-full items-center justify-start gap-1.5 rounded-xl py-2 px-2 text-xs font-bold text-zinc-500 hover:bg-white/80 hover:text-zinc-900 transition"
        >
          <Plus size={14} className="text-zinc-400" />
          <span>Add new card</span>
        </button>
      </footer>
    </section>
  );
}

function KanbanCard({
  lead,
  currentStage,
  active,
  checked,
  onToggle,
  onOpen,
  tasks,
  members,
  onAddTask,
  onQuickMoveStage,
}) {
  const score = lead.score || 0;
  const openTasks = tasks.filter(
    (t) => !["done", "cancelled"].includes(t.status),
  );

  const nextTask = [...openTasks].sort((a, b) =>
    String(a.scheduled_start || a.due_at || "9999").localeCompare(
      String(b.scheduled_start || b.due_at || "9999"),
    ),
  )[0];

  const nextDate = nextTask?.scheduled_start || nextTask?.due_at;
  const overdue = nextDate && new Date(nextDate) < new Date();
  const cfg = stageConfig[currentStage] || stageConfig.new;
  const owner = members.find((m) => m.id === lead.assigned_to);

  // Logo square initial character (Fenway / Moxie style in Screenshot 1)
  const logoInitial = lead.business_name ? lead.business_name[0].toUpperCase() : "B";

  // Sanitize contact links to avoid rendering ugly "N/A" pills
  const hasPhone = Boolean(lead.phone && !/^n\/?a$/i.test(lead.phone.trim()));
  const hasEmail = Boolean(lead.email && !/^n\/?a$/i.test(lead.email.trim()));
  const hasWebsite = Boolean(lead.website && !/^n\/?a$/i.test(lead.website.trim()));

  // Dynamic Date string (use scheduled task date or lead creation date)
  const displayDate = nextDate
    ? format(new Date(nextDate), "MMM d")
    : lead.created_at
    ? format(new Date(lead.created_at), "MMM d")
    : format(new Date(), "MMM d");

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("lead-id", lead.id);
      }}
      onClick={onOpen}
      className={`group relative rounded-2xl border bg-white p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-grab active:cursor-grabbing ${
        active
          ? "border-violet-500 ring-2 ring-violet-200 shadow-md"
          : "border-zinc-200/80 hover:border-violet-300"
      }`}
    >
      {/* Screenshot 1 Top Row: Checkbox + Square Logo + Location Pill */}
      <div className="flex items-center justify-between gap-1.5 border-b border-zinc-100/70 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <input
            aria-label={`Select ${lead.business_name}`}
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 accent-violet-600 rounded cursor-pointer shrink-0"
          />

          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-amber-500 text-[10px] font-black text-white shadow-2xs">
            {logoInitial}
          </span>

          <span className="truncate text-[11px] font-bold text-zinc-600">
            {lead.area || "Prospect"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {score > 0 && (
            <span className="mono rounded-full bg-violet-50 px-1.5 py-0.1 text-[9px] font-extrabold text-violet-700 border border-violet-100">
              ⚡{score}
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            title="Open Lead Details"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition"
          >
            <PanelRightOpen size={13} />
          </button>
        </div>
      </div>

      {/* Title & Subtitle Tag */}
      <div className="mt-2">
        <h3 className="text-sm font-extrabold text-zinc-950 leading-snug group-hover:text-violet-700 transition-colors truncate">
          {lead.business_name}
        </h3>
        {lead.niche && (
          <p className="mt-0.5 text-xs font-bold text-violet-600 truncate capitalize">
            {lead.niche}
          </p>
        )}
      </div>

      {/* Embedded Contact Pills (Only render valid phone, email, website links) */}
      {(hasPhone || hasEmail || hasWebsite) && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
          {hasPhone && (
            <a
              href={`tel:${lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2 py-0.5 font-bold text-zinc-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition"
              title="Call Phone"
            >
              <Phone size={10} className="text-emerald-600" />
              <span className="truncate max-w-[110px]">{lead.phone}</span>
            </a>
          )}

          {hasEmail && (
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2 py-0.5 font-bold text-zinc-700 hover:bg-violet-50 hover:text-violet-800 hover:border-violet-200 transition"
              title="Send Email"
            >
              <Mail size={10} className="text-violet-600" />
              <span className="truncate max-w-[110px]">{lead.email}</span>
            </a>
          )}

          {hasWebsite && (
            <a
              href={isExternalUrl(lead.website) ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2 py-0.5 font-bold text-zinc-700 hover:bg-sky-50 hover:text-sky-800 hover:border-sky-200 transition"
              title="Visit Website"
            >
              <Globe2 size={10} className="text-sky-600" />
              <span className="truncate max-w-[120px]">{lead.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      )}

      {/* Embedded Task Box & + Add Task Option on Card */}
      <div className="mt-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2 transition-colors hover:border-violet-300">
        {nextTask ? (
          <Link
            to={`/rewind?task=${nextTask.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between gap-1.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600" />
                <span className="truncate text-[11px] font-extrabold text-zinc-900">
                  {nextTask.title}
                </span>
              </div>
              <p className={`mt-0.5 text-[9px] font-bold ${overdue ? "text-rose-600" : "text-zinc-500"}`}>
                {overdue ? "⚠️ Overdue · " : "📅 "}
                {nextDate ? format(new Date(nextDate), "MMM d, h:mm a") : "Scheduled"}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddTask();
              }}
              title="Add another task for this lead"
              className="rounded p-1 text-violet-700 hover:bg-violet-100 transition shrink-0 font-extrabold text-[10px]"
            >
              + Task
            </button>
          </Link>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
            className="flex w-full items-center justify-between text-[11px] font-extrabold text-violet-700 hover:text-violet-900"
          >
            <span className="flex items-center gap-1">
              <CalendarClock size={12} className="text-violet-600" /> + Add Task / Follow-up Call
            </span>
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Screenshot 1 Bottom Row: Date & Subtask counter + Overlapping Avatars */}
      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100/70 pt-2 text-[11px] text-zinc-500 font-semibold">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <CalendarDays size={11} className="text-zinc-400" />
            <span>{displayDate}</span>
          </span>

          <span className="flex items-center gap-1">
            <CheckCircle2 size={11} className="text-zinc-400" />
            <span>{openTasks.length} task{openTasks.length === 1 ? "" : "s"}</span>
          </span>
        </div>

        {/* Screenshot 1 Avatar Stack */}
        <div className="flex items-center -space-x-1.5">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[8px] font-bold text-white ring-2 ring-white shadow-2xs">
            {owner ? (owner.full_name || owner.email)[0].toUpperCase() : "A"}
          </div>
          <div className="grid h-5 w-5 place-items-center rounded-full bg-zinc-800 text-[8px] font-bold text-white ring-2 ring-white shadow-2xs">
            K
          </div>
        </div>
      </div>
    </article>
  );
}

function PipelineDetailPanel({
  lead,
  tasks,
  members,
  tags,
  onClose,
  onStageChange,
  onAddTask,
}) {
  if (!lead) return null;

  const owner = members.find((m) => m.id === lead.assigned_to);
  const openTasks = tasks
    .filter((t) => !["done", "cancelled"].includes(t.status))
    .sort((a, b) =>
      String(a.scheduled_start || a.due_at || "9999").localeCompare(
        String(b.scheduled_start || b.due_at || "9999"),
      ),
    );
  const nextTask = openTasks[0];
  const leadTags = tags.filter((t) => t.lead_ids.includes(lead.id));
  const stageIndex = PIPELINE_STATUSES.indexOf(lead.status);
  const score = lead.score || 0;

  return (
    <aside className="flex h-full flex-col bg-white p-5 border-l border-zinc-200 shadow-2xl overflow-y-auto w-full max-w-md">
      {/* Drawer Header */}
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 border border-violet-100">
            Opportunity Record
          </span>
          <h2 className="mt-1.5 truncate text-xl font-black tracking-tight text-zinc-950">
            {lead.business_name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-zinc-500 font-medium">
            <MapPin size={12} className="text-zinc-400 shrink-0" />
            <span className="truncate">{lead.area || lead.niche || "Location not set"}</span>
            <span>·</span>
            <span className="capitalize">{lead.source || "Manual Lead"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition"
          aria-label="Close lead panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Lead Score & Google Rating Card */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-50/90 p-3.5 border border-zinc-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 font-black text-white text-xs shadow-2xs">
            ⚡{score > 0 ? score : "70"}
          </span>
          <div>
            <p className="text-xs font-black text-zinc-950">
              Lead Score: {score > 0 ? `${score}/100` : "70/100"}
            </p>
            <p className="text-[10px] font-bold text-zinc-400">Match score based on AI signals</p>
          </div>
        </div>

        {lead.rating && (
          <span className="flex items-center gap-1 font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200/60 text-xs">
            <Star size={12} fill="currentColor" className="text-amber-500" /> {lead.rating}
            {lead.reviews ? ` (${lead.reviews})` : ""}
          </span>
        )}
      </div>

      {/* Interactive Pipeline Stage Selector Bar */}
      <div className="mt-4">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">
          Pipeline Stage
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PIPELINE_STATUSES.map((status) => {
            const isCurrent = status === lead.status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onStageChange(status)}
                className={`rounded-xl py-1.5 px-2 text-center text-[10px] font-black transition-all ${
                  isCurrent
                    ? "bg-violet-600 text-white shadow-xs"
                    : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70"
                }`}
              >
                {labels[status]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-Channel Quick Action Buttons (Call, Email, Website) */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
          >
            <Phone size={12} className="text-emerald-600" /> Call
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold text-zinc-400 opacity-60">
            <Phone size={12} /> No Phone
          </span>
        )}

        {lead.email ? (
          <a
            href={`mailto:${lead.email}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/80 py-2 text-xs font-extrabold text-violet-800 hover:bg-violet-100 transition shadow-2xs"
          >
            <Mail size={12} className="text-violet-600" /> Email
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold text-zinc-400 opacity-60">
            <Mail size={12} /> No Email
          </span>
        )}

        {lead.website ? (
          <a
            href={isExternalUrl(lead.website) ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/80 py-2 text-xs font-extrabold text-sky-800 hover:bg-sky-100 transition shadow-2xs"
          >
            <Globe2 size={12} className="text-sky-600" /> Website
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold text-zinc-400 opacity-60">
            <Globe2 size={12} /> No Site
          </span>
        )}
      </div>

      {/* Next Scheduled Action Box */}
      <section className="mt-4 rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-violet-100 pb-2">
          <p className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
            <CalendarDays size={14} className="text-violet-600" /> Next Scheduled Action
          </p>
          <button
            onClick={onAddTask}
            className="rounded-lg bg-violet-600 px-2 py-1 text-[10px] font-black text-white hover:bg-violet-700 transition"
          >
            + Add Task
          </button>
        </div>

        {nextTask ? (
          <div className="mt-3">
            <p className="text-xs font-black text-zinc-950">{nextTask.title}</p>
            <p className="mt-1 text-[11px] font-bold text-violet-700">
              📅 {nextTask.scheduled_start || nextTask.due_at
                ? format(new Date(nextTask.scheduled_start || nextTask.due_at), "EEE, MMM d, h:mm a")
                : "Scheduled"}
            </p>
            <Link
              to={`/rewind?task=${nextTask.id}`}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2 text-xs font-black text-white hover:bg-violet-700 transition shadow-2xs"
            >
              <span>Open Task Details</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="mt-3 text-center py-2">
            <p className="text-xs font-bold text-zinc-500">No upcoming tasks scheduled for this lead.</p>
            <button
              onClick={onAddTask}
              className="mt-2 inline-flex items-center gap-1 text-xs font-black text-violet-700 hover:text-violet-900"
            >
              + Schedule Follow-up Call or Task
            </button>
          </div>
        )}
      </section>

      {/* Bottom Action: View Full Lead Record */}
      <div className="mt-auto pt-5">
        <Link
          to={`/leads/${lead.id}`}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-black text-zinc-800 hover:bg-zinc-100 hover:border-zinc-300 transition"
        >
          <span>View Full Lead Record & Activity Timeline</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </aside>
  );
}

function isExternalUrl(value) {
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
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
