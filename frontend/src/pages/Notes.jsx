import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Globe2,
  ListChecks,
  ListPlus,
  LockKeyhole,
  MessageCircle,
  Palette,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useFeedback } from "../context/feedback";
import {
  NOTE_ACCENTS,
  NOTE_COLORS,
  useNoteComments,
  useWorkspaceNotes,
} from "../hooks/useNotes";
import { useWorkspaceTasks } from "../hooks/useTasks";

const colorOptions = [
  ["violet", "Violet"],
  ["mint", "Mint"],
  ["amber", "Amber"],
  ["blue", "Sky"],
  ["rose", "Rose"],
];

export default function Notes() {
  const { user, activeWorkspace } = useAuthWorkspace();
  const noteApi = useWorkspaceNotes();
  const taskApi = useWorkspaceTasks();
  const { confirm, notify } = useFeedback();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("mine"); // "mine" | "workspace"
  const [search, setSearch] = useState("");
  const sort = "recent";
  const [selectedId, setSelectedId] = useState(searchParams.get("note"));
  const [mobileTab, setMobileTab] = useState("list"); // "list" | "editor" | "discussion"
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [newLine, setNewLine] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const loadedNoteId = useRef(null);
  const updateNoteRef = useRef(noteApi.updateNote);
  updateNoteRef.current = noteApi.updateNote;

  const visibleNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return noteApi.notes
      .filter((note) => (view === "mine" ? note.visibility === "private" : note.visibility === "shared"))
      .filter((note) => {
        if (!needle) return true;
        return `${note.title} ${note.body} ${(note.lines ?? []).map((line) => line.body).join(" ")}`
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (sort === "pinned") return Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.updated_at) - new Date(a.updated_at);
        if (sort === "active") return openLineCount(b) - openLineCount(a) || new Date(b.updated_at) - new Date(a.updated_at);
        return Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.updated_at) - new Date(a.updated_at);
      });
  }, [noteApi.notes, search, sort, view]);

  const activeNote = noteApi.notes.find((note) => note.id === selectedId) ?? null;
  const activeTask = activeNote
    ? taskApi.tasks.find((task) => task.source_note_id === activeNote.id && !task.source_note_line_id)
    : null;
  const canEdit = Boolean(activeNote && (activeNote.visibility === "shared" || activeNote.owner_id === user?.id));
  const comments = useNoteComments(activeNote?.id);

  useEffect(() => {
    const requested = searchParams.get("note");
    if (requested && noteApi.notes.some((note) => note.id === requested)) {
      setSelectedId(requested);
    }
  }, [noteApi.notes, searchParams]);

  useEffect(() => {
    if (!visibleNotes.some((note) => note.id === selectedId)) {
      const next = visibleNotes[0]?.id ?? null;
      setSelectedId(next);
      setSearchParams((current) => {
        const nextParams = new URLSearchParams(current);
        if (next) nextParams.set("note", next);
        else nextParams.delete("note");
        return nextParams;
      });
    }
  }, [selectedId, setSearchParams, visibleNotes]);

  useEffect(() => {
    if (activeNote?.id === loadedNoteId.current && editorDirty) return;
    loadedNoteId.current = activeNote?.id ?? null;
    if (!activeNote) {
      setTitleDraft("");
      setBodyDraft("");
      setEditorDirty(false);
      return;
    }
    setTitleDraft(activeNote.title);
    setBodyDraft(activeNote.body);
    setEditorDirty(false);
  }, [activeNote, editorDirty]);

  useEffect(() => {
    const activeNoteId = activeNote?.id;
    if (!activeNoteId || !editorDirty || !canEdit) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        await updateNoteRef.current(activeNoteId, { title: titleDraft, body: bodyDraft });
        setEditorDirty(false);
      } catch (error) {
        notify(error.message, "error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeNote?.id, bodyDraft, canEdit, editorDirty, notify, titleDraft]);

  const selectNote = (id) => {
    setSelectedId(id);
    setMobileTab("editor");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("note", id);
      return next;
    });
  };

  const createNoteAndFocus = async () => {
    try {
      const note = await noteApi.createNote({
        visibility: view === "workspace" ? "shared" : "private",
        title: view === "workspace" ? "Shared working note" : "New private note",
        color: view === "workspace" ? "mint" : "violet",
      });
      setSelectedId(note.id);
      setMobileTab("editor");
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("note", note.id);
        return next;
      });
      notify(view === "workspace" ? "Shared note created for the workspace." : "Private note created.");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const saveNow = async () => {
    if (!activeNote || !canEdit) return;
    try {
      await noteApi.updateNote(activeNote.id, { title: titleDraft, body: bodyDraft });
      setEditorDirty(false);
      notify("Note saved.");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const makeTask = async (line = null) => {
    if (!activeNote) return;
    const existing = line
      ? taskApi.tasks.find((task) => task.source_note_line_id === line.id)
      : activeTask;
    if (existing) return navigate(`/rewind?task=${existing.id}`);
    try {
      const task = await taskApi.createTask({
        title: line?.body || titleDraft || activeNote.title,
        description: line ? `From “${activeNote.title}”` : bodyDraft,
        category: "development",
        priority: "medium",
        assignee_ids: [user.id],
        source_note_id: activeNote.id,
        source_note_line_id: line?.id || null,
      });
      notify(line ? "Action line is now a task." : "Note is now a task.");
      if (line) return task;
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const addLine = async (event) => {
    event?.preventDefault();
    if (!activeNote || !newLine.trim() || !canEdit) return;
    setSavingLine(true);
    try {
      await noteApi.createLine(activeNote.id, newLine);
      setNewLine("");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSavingLine(false);
    }
  };

  const removeNote = async () => {
    if (!activeNote) return;
    if (!(await confirm({
      title: `Delete “${activeNote.title}”?`,
      description: "The note, its action lines, and its discussion will be removed. Tasks created from it will stay in Rewind.",
      confirmLabel: "Delete note",
      danger: true,
    }))) return;
    try {
      await noteApi.deleteNote(activeNote.id);
      setSelectedId(null);
      setMobileTab("list");
      notify("Note deleted.");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const archiveNote = async () => {
    if (!activeNote) return;
    try {
      await noteApi.updateNote(activeNote.id, { archived_at: new Date().toISOString() });
      setSelectedId(null);
      setMobileTab("list");
      notify("Note archived.");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  if (noteApi.isLoading || taskApi.isLoading) {
    return <div className="panel p-8 text-zinc-500 rounded-[24px]">Opening your notes room...</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-[26px] bg-[#171719] p-5 text-white shadow-lg sm:p-6">
        <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-violet-500/70 blur-[78px]" />
        <div className="absolute right-[31%] top-0 h-36 w-36 rounded-full bg-emerald-300/20 blur-[55px]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200">
              <Sparkles size={13} /> Notes room
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">Keep the thread.</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-300">
              Capture your own thinking, open context to your team, and turn lines into real work.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="rounded-full border border-white/10 bg-white/[.08] px-3.5 py-1 text-xs font-extrabold text-zinc-300 hidden sm:block">
              {activeWorkspace?.type === "team" ? "Team workspace" : "Personal workspace"}
            </div>
            <button
              onClick={createNoteAndFocus}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-zinc-950 transition hover:bg-zinc-100 active:scale-95 shadow-md"
            >
              <Plus size={15} /> New note
            </button>
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="rounded-full border border-white/20 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              {showMoreOptions ? "Hide options" : "More options"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Tabs */}
      <nav className="flex rounded-full bg-zinc-100/90 p-1 lg:hidden border border-zinc-200/60">
        <button
          onClick={() => setMobileTab("list")}
          className={`flex-1 rounded-full py-1.5 text-xs font-extrabold transition ${
            mobileTab === "list" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500"
          }`}
        >
          Notes ({visibleNotes.length})
        </button>
        <button
          onClick={() => setMobileTab("editor")}
          disabled={!activeNote}
          className={`flex-1 rounded-full py-1.5 text-xs font-extrabold transition ${
            mobileTab === "editor" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 disabled:opacity-40"
          }`}
        >
          Note Editor
        </button>
        <button onClick={() => { setMobileTab("discussion"); setShowMoreOptions(true); }} disabled={!activeNote} className={`flex-1 rounded-full py-1.5 text-xs font-extrabold transition ${mobileTab === "discussion" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 disabled:opacity-40"}`}>More</button>
      </nav>

      {/* Main Grid Section */}
      <div className={`grid gap-4 ${showMoreOptions ? "lg:grid-cols-[280px_minmax(0,1fr)_310px]" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
        {/* 1. Left Sidebar: Notes List */}
        <aside className={`panel flex flex-col p-3 rounded-[24px] ${mobileTab !== "list" ? "hidden lg:flex" : "flex"} min-h-[500px]`}>
          <div className="flex rounded-full bg-zinc-100/80 p-0.5 border border-zinc-200/60">
            <TabButton active={view === "mine"} onClick={() => setView("mine")} icon={LockKeyhole} label="My notes" count={noteApi.notes.filter((note) => note.visibility === "private").length} />
            <TabButton active={view === "workspace"} onClick={() => setView("workspace")} icon={UsersRound} label="Workspace" count={noteApi.notes.filter((note) => note.visibility === "shared").length} />
          </div>
          <div className="mt-3">
            <div className="control flex min-w-0 flex-1 items-center gap-2 px-3 rounded-full border border-zinc-200 bg-white">
              <Search size={13} className="shrink-0 text-zinc-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notes or lines..."
                className="min-w-0 flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <p className="eyebrow">{view === "mine" ? "Private" : "Workspace shared"}</p>
            <button onClick={createNoteAndFocus} className="grid h-6 w-6 place-items-center rounded-full bg-zinc-950 text-white hover:bg-zinc-800 transition shadow-2xs" aria-label="Create note">
              <Plus size={13} />
            </button>
          </div>
          <div className="scrollbar-thin mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            {visibleNotes.map((note) => (
              <NoteCard key={note.id} note={note} active={note.id === selectedId} onClick={() => selectNote(note.id)} taskCount={taskCountForNote(note, taskApi.tasks)} />
            ))}
            {!visibleNotes.length && <EmptyNotes view={view} onCreate={createNoteAndFocus} />}
          </div>
        </aside>

        {/* 2. Middle Main: Note Editor */}
        <main className={`panel overflow-hidden rounded-[24px] ${mobileTab !== "editor" ? "hidden lg:block" : "block"} min-h-[500px]`}>
          {activeNote ? (
            <NoteEditor
              note={activeNote}
              task={activeTask}
              tasks={taskApi.tasks}
              members={noteApi.members}
              currentUserId={user?.id}
              canEdit={canEdit}
              title={titleDraft}
              body={bodyDraft}
              dirty={editorDirty}
              newLine={newLine}
              savingLine={savingLine}
              onBackToList={() => setMobileTab("list")}
              onTitleChange={(value) => { setTitleDraft(value); setEditorDirty(true); }}
              onBodyChange={(value) => { setBodyDraft(value); setEditorDirty(true); }}
              onSave={saveNow}
              onVisibilityChange={(visibility) => noteApi.updateNote(activeNote.id, { visibility }).catch((error) => notify(error.message, "error"))}
              onColorChange={(color) => noteApi.updateNote(activeNote.id, { color }).catch((error) => notify(error.message, "error"))}
              onPin={() => noteApi.updateNote(activeNote.id, { is_pinned: !activeNote.is_pinned })}
              onArchive={archiveNote}
              onDelete={removeNote}
              onNewLineChange={setNewLine}
              onAddLine={addLine}
              onToggleLine={(line) => noteApi.updateLine(line.id, { is_done: !line.is_done })}
              onUpdateLine={(line, body) => noteApi.updateLine(line.id, { body })}
              onDeleteLine={(line) => noteApi.deleteLine(line.id)}
              onMakeTask={makeTask}
              onOpenTask={(task) => navigate(`/rewind?task=${task.id}`)}
            />
          ) : (
            <EmptyEditor view={view} onCreate={createNoteAndFocus} />
          )}
        </main>

        {/* 3. Right Sidebar: Info & Discussion */}
        <aside className={`space-y-4 ${(!showMoreOptions && mobileTab !== "discussion") ? "hidden" : mobileTab !== "discussion" ? "hidden lg:block" : "block"}`}>
          <button onClick={() => { setShowMoreOptions(false); setMobileTab("editor"); }} className="button-secondary w-full justify-center text-xs py-2 rounded-full font-bold">Hide extra options</button>
          <CollaborationCard note={activeNote} members={noteApi.members} currentUserId={user?.id} />
          <MomentumCard note={activeNote} tasks={taskApi.tasks} />
          <CommentsCard note={activeNote} comments={comments} members={noteApi.members} />
        </aside>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-extrabold transition ${
        active ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-500 hover:text-zinc-950"
      }`}
    >
      <Icon size={12} />
      <span>{label}</span>
      <span className="rounded-full bg-zinc-200/80 px-2 py-0.2 text-[10px] font-bold text-zinc-700">
        {count}
      </span>
    </button>
  );
}

function NoteCard({ note, active, onClick, taskCount }) {
  const accent = NOTE_ACCENTS[note.color] ?? NOTE_ACCENTS.violet;
  const lineCount = note.lines?.length ?? 0;
  const openCount = openLineCount(note);

  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-2xl p-3 border transition-all duration-150 ${
        active
          ? "border-zinc-950 bg-white shadow-xs"
          : "border-zinc-200/70 bg-white/80 hover:bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${accent}`} />
          <h3 className={`truncate text-xs font-extrabold ${active ? "text-zinc-950" : "text-zinc-900 group-hover:text-violet-700"}`}>
            {note.title || "Untitled note"}
          </h3>
        </div>
        {note.is_pinned && <Pin size={11} className="text-amber-500 shrink-0" fill="currentColor" />}
      </div>

      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">
        {note.body || "No additional notes..."}
      </p>

      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400 font-semibold">
        <span>{relative(note.updated_at)}</span>
        <div className="flex items-center gap-1.5">
          {lineCount > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-bold text-zinc-600">
              {openCount} / {lineCount} open
            </span>
          )}
          {taskCount > 0 && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 font-bold text-violet-700">
              {taskCount} task
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function NoteEditor({ note, task, tasks, members, currentUserId, canEdit, title, body, dirty, newLine, savingLine, onBackToList, onTitleChange, onBodyChange, onSave, onVisibilityChange, onColorChange, onPin, onArchive, onDelete, onNewLineChange, onAddLine, onToggleLine, onUpdateLine, onDeleteLine, onMakeTask, onOpenTask }) {
  const owner = members.find((member) => member.id === note.owner_id);
  const isShared = note.visibility === "shared";

  return (
    <article className="flex min-h-[500px] flex-col">
      <div className={`h-2 w-full ${NOTE_ACCENTS[note.color] || NOTE_ACCENTS.violet}`} />
      
      {/* Top Bar inside Editor */}
      <div className="border-b border-zinc-200/60 px-4 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToList}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-extrabold text-zinc-700 hover:bg-zinc-50 lg:hidden shadow-2xs"
            >
              <ArrowLeft size={13} /> Notes
            </button>

            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold ${isShared ? "bg-emerald-100/90 text-emerald-800 border border-emerald-200/70" : "bg-zinc-100 text-zinc-600 border border-zinc-200/60"}`}>
              {isShared ? <Globe2 size={12} /> : <LockKeyhole size={12} />} {isShared ? "Workspace note" : "Private note"}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">Updated {relative(note.updated_at)}</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {dirty && <span className="mr-1 text-[11px] font-bold text-amber-600">Saving...</span>}
            {dirty && <button onClick={onSave} className="button-primary px-3 py-1 text-xs rounded-full">Save</button>}
            <button onClick={onPin} disabled={!canEdit} className={`grid h-8 w-8 place-items-center rounded-full ${note.is_pinned ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-400 hover:text-zinc-700"}`} aria-label={note.is_pinned ? "Unpin note" : "Pin note"}>
              <Pin size={13} fill={note.is_pinned ? "currentColor" : "none"} />
            </button>
            <button onClick={onArchive} disabled={!canEdit} className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-700" aria-label="Archive note">
              <Archive size={13} />
            </button>
            <button onClick={onDelete} disabled={note.owner_id !== currentUserId} className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 text-zinc-400 hover:text-rose-600" aria-label="Delete note">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Title Input & Settings */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              disabled={!canEdit}
              className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-zinc-950 outline-none placeholder:text-zinc-300 sm:text-3xl"
              placeholder="Untitled note"
            />
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
              <UserRound size={13} /> {note.owner_id === currentUserId ? "Created by you" : `Started by ${owner?.full_name || owner?.email || "Teammate"}`}
              <span className="text-zinc-300">•</span> {note.lines?.length ?? 0} action lines
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <select value={note.visibility} disabled={!canEdit} onChange={(event) => onVisibilityChange(event.target.value)} className="control py-1 px-3 text-xs font-bold rounded-full">
              <option value="private">Private</option>
              <option value="shared">Workspace shared</option>
            </select>
            {task ? (
              <button onClick={() => onOpenTask(task)} className="button-secondary py-1 px-3.5 text-xs rounded-full font-bold">
                <CheckCircle2 size={13} /> Open task
              </button>
            ) : (
              <button onClick={() => onMakeTask()} disabled={!canEdit} className="button-primary py-1 px-3.5 text-xs rounded-full font-bold">
                <ListPlus size={13} /> Make task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Note Body & Action Lines */}
      <div className="flex-1 px-4 py-4 sm:px-7 sm:py-6 space-y-4">
        {!canEdit && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 p-3 text-xs font-bold text-amber-800">
            <LockKeyhole size={14} /> Private note belonging to another workspace member.
          </div>
        )}

        <div className="relative min-h-[140px]">
          <textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            disabled={!canEdit}
            rows={5}
            className="w-full resize-none bg-transparent text-sm leading-6 text-zinc-700 outline-none placeholder:text-zinc-300 sm:text-base sm:leading-7 font-medium"
            placeholder="What is this note trying to hold onto? Add context, decisions, or links..."
          />
        </div>

        {/* Action Lines Checklist */}
        <section className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 sm:p-4 backdrop-blur-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-zinc-950 text-white shadow-2xs">
                <ListChecks size={14} />
              </span>
              <div>
                <p className="text-xs font-extrabold text-zinc-950">Action lines</p>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Tasks and next steps derived from this note.</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-extrabold text-zinc-700 shadow-2xs border border-zinc-200/60">
              {doneCount(note.lines)} / {note.lines?.length ?? 0} done
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {(note.lines ?? []).map((line) => {
              const lineTask = tasks.find((taskItem) => taskItem.source_note_line_id === line.id);
              return (
                <NoteLine
                  key={line.id}
                  line={line}
                  task={lineTask}
                  canEdit={canEdit}
                  onToggle={() => onToggleLine(line)}
                  onUpdate={(value) => onUpdateLine(line, value)}
                  onDelete={() => onDeleteLine(line)}
                  onMakeTask={() => onMakeTask(line)}
                  onOpenTask={() => lineTask && onOpenTask(lineTask)}
                />
              );
            })}
          </div>

          {canEdit && (
            <form onSubmit={onAddLine} className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-white p-1.5 shadow-2xs">
              <span className="grid h-7 w-7 place-items-center rounded-xl text-zinc-400">
                <Plus size={14} />
              </span>
              <input
                value={newLine}
                onChange={(event) => onNewLineChange(event.target.value)}
                placeholder="Add an action line..."
                className="min-w-0 flex-1 bg-transparent px-1 text-xs sm:text-sm outline-none placeholder:text-zinc-400 font-medium"
              />
              <button
                disabled={savingLine || !newLine.trim()}
                className="rounded-full bg-zinc-950 px-3.5 py-1 text-xs font-extrabold text-white hover:bg-zinc-800 disabled:opacity-40 transition"
              >
                Add
              </button>
            </form>
          )}
          {!note.lines?.length && !canEdit && (
            <p className="mt-3 text-center text-xs text-zinc-400">No action lines yet.</p>
          )}
        </section>

        {/* Note Mood / Color options */}
        <div className="flex items-center gap-2 pt-2">
          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
            <Palette size={12} /> Note mood
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            {colorOptions.map(([key, label]) => (
              <button
                key={key}
                title={label}
                onClick={() => onColorChange(key)}
                disabled={!canEdit}
                className={`h-5 w-5 rounded-full ${NOTE_ACCENTS[key]} ${
                  note.color === key ? "ring-2 ring-zinc-950 ring-offset-2 scale-110" : "opacity-50 hover:opacity-100"
                } transition`}
                aria-label={`Use ${label} color`}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function NoteLine({ line, task, canEdit, onToggle, onUpdate, onDelete, onMakeTask, onOpenTask }) {
  const [draft, setDraft] = useState(line.body);
  useEffect(() => setDraft(line.body), [line.body]);
  const commit = () => {
    const value = draft.trim();
    if (value && value !== line.body) onUpdate(value);
  };

  return (
    <div className={`group flex items-center gap-2 rounded-2xl border p-2 transition ${line.is_done ? "border-emerald-200/60 bg-emerald-50/50" : "border-zinc-200/60 bg-white"}`}>
      <button
        disabled={!canEdit}
        onClick={onToggle}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${line.is_done ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}
        aria-label={line.is_done ? "Mark line open" : "Mark line done"}
      >
        {line.is_done ? <Check size={12} /> : <Circle size={12} />}
      </button>
      <input
        value={draft}
        disabled={!canEdit}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(line.body);
            event.currentTarget.blur();
          }
        }}
        className={`min-w-0 flex-1 bg-transparent px-1 text-xs font-semibold outline-none sm:text-sm ${
          line.is_done ? "text-zinc-400 line-through" : "text-zinc-800"
        }`}
      />
      {task ? (
        <button onClick={onOpenTask} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-extrabold text-violet-700 border border-violet-200/60">
          <CheckCircle2 size={11} /> Task
        </button>
      ) : (
        <button disabled={!canEdit} onClick={onMakeTask} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-extrabold text-zinc-500 hover:bg-violet-100 hover:text-violet-700 transition">
          <ListPlus size={11} /> Task
        </button>
      )}
      <button disabled={!canEdit} onClick={onDelete} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-zinc-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100 transition" aria-label="Delete line">
        <X size={12} />
      </button>
    </div>
  );
}

function CollaborationCard({ note, members, currentUserId }) {
  const shared = note?.visibility === "shared";
  const people = members.slice(0, 5);

  return (
    <section className="panel p-4 rounded-[24px]">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-2xl ${shared ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
          {shared ? <UsersRound size={17} /> : <LockKeyhole size={16} />}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{shared ? "Collaboration" : "Personal space"}</p>
          <h2 className="mt-0.5 text-base font-extrabold text-zinc-950">{shared ? "Shared workspace note" : "Private note"}</h2>
        </div>
      </div>
      {shared ? (
        <>
          <p className="mt-2 text-xs leading-5 text-zinc-500">All workspace members can view, edit, and turn action items into tasks.</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex -space-x-1.5">
              {people.map((member) => (
                <span key={member.id} title={member.full_name || member.email} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-violet-100 text-[10px] font-extrabold text-violet-700 shadow-2xs">
                  {initials(member)}
                </span>
              ))}
              {members.length > people.length && (
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-extrabold text-zinc-500">
                  +{members.length - people.length}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.16)]" /> Live synced
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Private notes are visible only to you.</p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-zinc-50 p-2.5 text-xs font-semibold text-zinc-600">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-zinc-700 shadow-2xs">{initials(members.find((m) => m.id === currentUserId))}</span> Only you can see this note
          </div>
        </>
      )}
    </section>
  );
}

function MomentumCard({ note, tasks }) {
  if (!note) return null;
  const noteTasks = tasks.filter((task) => task.source_note_id === note.id);
  const open = (note.lines ?? []).filter((line) => !line.is_done).length;

  return (
    <section className="panel p-4 rounded-[24px]">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-violet-100 text-violet-700">
          <ArrowUpRight size={14} />
        </span>
        <p className="eyebrow">Momentum</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat value={note.lines?.length ?? 0} label="lines" />
        <MiniStat value={open} label="open" />
        <MiniStat value={noteTasks.length} label="tasks" />
      </div>
    </section>
  );
}

function CommentsCard({ note, comments, members }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { notify } = useFeedback();

  if (!note || note.visibility !== "shared") {
    return (
      <section className="panel p-4 rounded-[24px]">
        <div className="flex items-center gap-2 text-zinc-400">
          <MessageCircle size={15} />
          <p className="font-extrabold text-xs text-zinc-600">Discussion</p>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {note ? "Discussion opens when you share this note." : "Select a note to see discussion."}
        </p>
      </section>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await comments.addComment(body);
      setBody("");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel p-4 rounded-[24px] space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
        <div className="flex items-center gap-2 text-zinc-950">
          <MessageCircle size={15} className="text-violet-600" />
          <p className="font-extrabold text-xs">Discussion</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
          {comments.comments.length}
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-2 scrollbar-thin">
        {comments.comments.map((comment) => {
          const author = members.find((m) => m.id === comment.user_id);
          return (
            <div key={comment.id} className="rounded-2xl border border-zinc-100 bg-white/90 p-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
                <span className="font-bold text-zinc-800">{author?.full_name || author?.email || "Teammate"}</span>
                <span>{relative(comment.created_at)}</span>
              </div>
              <p className="mt-1 text-zinc-700 text-xs">{comment.body}</p>
            </div>
          );
        })}
        {!comments.comments.length && (
          <p className="py-4 text-center text-xs text-zinc-400">No comments yet. Start the thread!</p>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-1.5">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="control flex-1 text-xs py-1.5 rounded-full"
        />
        <button disabled={sending || !body.trim()} className="button-primary text-xs px-3 py-1.5 rounded-full font-bold">
          <Send size={12} />
        </button>
      </form>
    </section>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-zinc-200/60 bg-white/80 p-2 text-center shadow-2xs">
      <p className="mono text-lg font-extrabold text-zinc-950">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
    </div>
  );
}

function EmptyNotes({ view, onCreate }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
      <FileText size={20} className="mx-auto mb-2 text-zinc-300" />
      <p className="font-bold text-zinc-600">No {view} notes found</p>
      <button onClick={onCreate} className="mt-2 text-violet-600 font-bold hover:underline">
        Create one now
      </button>
    </div>
  );
}

function EmptyEditor({ view, onCreate }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-8 text-center text-zinc-400">
      <FileText size={32} className="mb-3 text-zinc-300" />
      <h2 className="text-sm font-extrabold text-zinc-800">No note selected</h2>
      <p className="mt-1 max-w-xs text-xs text-zinc-400">Select a note from the left sidebar or create a new one to begin editing.</p>
      <button onClick={onCreate} className="button-primary mt-4 text-xs py-2 px-4 rounded-full font-bold">
        <Plus size={14} /> Create new note
      </button>
    </div>
  );
}

function initials(user) {
  if (!user) return "U";
  const name = user.full_name || user.email || "U";
  return name[0].toUpperCase();
}

function relative(iso) {
  if (!iso) return "just now";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch (e) {
    return "recently";
  }
}

function openLineCount(note) {
  return (note.lines ?? []).filter((line) => !line.is_done).length;
}

function doneCount(lines = []) {
  return (lines ?? []).filter((line) => line.is_done).length;
}

function taskCountForNote(note, tasks) {
  return tasks.filter((task) => task.source_note_id === note.id).length;
}
