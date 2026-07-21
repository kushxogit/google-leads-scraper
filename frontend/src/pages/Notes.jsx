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
  LayoutList,
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
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState(searchParams.get("note"));
  const [mobileTab, setMobileTab] = useState("list"); // "list" | "editor" | "discussion"
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
    return <div className="panel p-8 text-zinc-500">Opening your notes room...</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-[26px] bg-[#171719] p-5 text-white shadow-lg sm:p-7">
        <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-violet-500/70 blur-[78px]" />
        <div className="absolute right-[31%] top-0 h-36 w-36 rounded-full bg-emerald-300/20 blur-[55px]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200">
              <Sparkles size={13} /> Notes room
            </div>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">Keep the thread.</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-300 sm:text-sm">
              Capture your own thinking, open context to your team, and turn lines into real work.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/[.08] px-3 py-1.5 text-xs font-bold text-zinc-300 hidden sm:block">
              {activeWorkspace?.type === "team" ? "Team workspace" : "Personal workspace"}
            </div>
            <button
              onClick={createNoteAndFocus}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-zinc-950 transition hover:bg-zinc-100 active:scale-95"
            >
              <Plus size={16} /> New note
            </button>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:max-w-xl">
          <Stat icon={FileText} value={visibleNotes.length} label="notes" />
          <Stat icon={ListChecks} value={noteApi.notes.reduce((sum, note) => sum + (note.lines?.length ?? 0), 0)} label="action lines" />
          <Stat icon={CheckCircle2} value={taskApi.tasks.filter((task) => task.source_note_id).length} label="tasks sparked" />
        </div>
      </header>

      {/* Mobile Screen Navigation Tabs (Visible only on screens below lg) */}
      <nav className="flex rounded-2xl bg-zinc-100 p-1 lg:hidden">
        <button
          onClick={() => setMobileTab("list")}
          className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition ${
            mobileTab === "list" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-600"
          }`}
        >
          Notes ({visibleNotes.length})
        </button>
        <button
          onClick={() => setMobileTab("editor")}
          disabled={!activeNote}
          className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition ${
            mobileTab === "editor" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-600 disabled:opacity-40"
          }`}
        >
          Note Editor
        </button>
        <button
          onClick={() => setMobileTab("discussion")}
          disabled={!activeNote}
          className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition ${
            mobileTab === "discussion" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-600 disabled:opacity-40"
          }`}
        >
          Info & Discussion
        </button>
      </nav>

      {/* Main Grid Section */}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_310px]">
        {/* 1. Left Sidebar: Notes List */}
        <aside className={`panel flex flex-col p-3 ${mobileTab !== "list" ? "hidden lg:flex" : "flex"} min-h-[500px]`}>
          <div className="flex rounded-2xl bg-zinc-100 p-1">
            <TabButton active={view === "mine"} onClick={() => setView("mine")} icon={LockKeyhole} label="My notes" count={noteApi.notes.filter((note) => note.visibility === "private").length} />
            <TabButton active={view === "workspace"} onClick={() => setView("workspace")} icon={UsersRound} label="Workspace" count={noteApi.notes.filter((note) => note.visibility === "shared").length} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="control flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search size={14} className="shrink-0 text-zinc-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notes or lines..."
                className="min-w-0 flex-1 bg-transparent py-0.5 text-xs outline-none placeholder:text-zinc-400"
              />
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="control w-[88px] px-2 text-[11px] font-bold">
              <option value="recent">Recent</option>
              <option value="pinned">Pinned</option>
              <option value="active">Open lines</option>
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <p className="eyebrow">{view === "mine" ? "Private" : "Workspace shared"}</p>
            <button onClick={createNoteAndFocus} className="grid h-6 w-6 place-items-center rounded-lg bg-zinc-950 text-white hover:bg-zinc-800" aria-label="Create note">
              <Plus size={13} />
            </button>
          </div>
          <div className="scrollbar-thin mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            {visibleNotes.map((note) => (
              <NoteCard key={note.id} note={note} active={note.id === selectedId} onClick={() => selectNote(note.id)} taskCount={taskCountForNote(note, taskApi.tasks)} />
            ))}
            {!visibleNotes.length && <EmptyNotes view={view} onCreate={createNoteAndFocus} />}
          </div>
          <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-2.5">
            <div className="flex items-start gap-2">
              <LayoutList size={14} className="mt-0.5 shrink-0 text-violet-500" />
              <p className="text-[11px] leading-4 text-zinc-500">Tip: turn any action line into a task with one click.</p>
            </div>
          </div>
        </aside>

        {/* 2. Middle Main: Note Editor */}
        <main className={`panel overflow-hidden ${mobileTab !== "editor" ? "hidden lg:block" : "block"} min-h-[500px]`}>
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
        <aside className={`space-y-4 ${mobileTab !== "discussion" ? "hidden lg:block" : "block"}`}>
          <CollaborationCard note={activeNote} members={noteApi.members} currentUserId={user?.id} />
          <MomentumCard note={activeNote} tasks={taskApi.tasks} />
          <CommentsCard note={activeNote} comments={comments} members={noteApi.members} />
        </aside>
      </div>
    </div>
  );
}

function NoteEditor({ note, task, tasks, members, currentUserId, canEdit, title, body, dirty, newLine, savingLine, onBackToList, onTitleChange, onBodyChange, onSave, onVisibilityChange, onColorChange, onPin, onArchive, onDelete, onNewLineChange, onAddLine, onToggleLine, onUpdateLine, onDeleteLine, onMakeTask, onOpenTask }) {
  const owner = members.find((member) => member.id === note.owner_id);
  const isShared = note.visibility === "shared";

  return (
    <article className="flex min-h-[500px] flex-col">
      <div className={`h-2 w-full ${NOTE_ACCENTS[note.color] || NOTE_ACCENTS.violet}`} />
      
      {/* Top Bar inside Editor */}
      <div className="border-b border-zinc-100 px-4 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Mobile Back Button */}
            <button
              onClick={onBackToList}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-50 lg:hidden"
            >
              <ArrowLeft size={13} /> Notes
            </button>

            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] ${isShared ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
              {isShared ? <Globe2 size={12} /> : <LockKeyhole size={12} />} {isShared ? "Workspace note" : "Private note"}
            </span>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">Updated {relative(note.updated_at)}</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {dirty && <span className="mr-1 text-[11px] font-bold text-amber-600">Saving...</span>}
            {dirty && <button onClick={onSave} className="button-primary px-2.5 py-1 text-xs">Save</button>}
            <button onClick={onPin} disabled={!canEdit} className={`grid h-8 w-8 place-items-center rounded-xl ${note.is_pinned ? "bg-amber-100 text-amber-600" : "bg-zinc-100 text-zinc-400 hover:text-zinc-700"}`} aria-label={note.is_pinned ? "Unpin note" : "Pin note"}>
              <Pin size={14} fill={note.is_pinned ? "currentColor" : "none"} />
            </button>
            <button onClick={onArchive} disabled={!canEdit} className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-100 text-zinc-400 hover:text-zinc-700" aria-label="Archive note">
              <Archive size={14} />
            </button>
            <button onClick={onDelete} disabled={note.owner_id !== currentUserId} className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-100 text-zinc-400 hover:text-rose-600" aria-label="Delete note">
              <Trash2 size={14} />
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
              className="w-full bg-transparent text-2xl font-extrabold tracking-[-.04em] text-zinc-950 outline-none placeholder:text-zinc-300 sm:text-3xl"
              placeholder="Untitled note"
            />
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
              <UserRound size={13} /> {note.owner_id === currentUserId ? "Created by you" : `Started by ${owner?.full_name || owner?.email || "Teammate"}`}
              <span className="text-zinc-300">•</span> {note.lines?.length ?? 0} action lines
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <select value={note.visibility} disabled={!canEdit} onChange={(event) => onVisibilityChange(event.target.value)} className="control py-1.5 px-2 text-xs font-bold">
              <option value="private">Private</option>
              <option value="shared">Workspace shared</option>
            </select>
            {task ? (
              <button onClick={() => onOpenTask(task)} className="button-secondary py-1.5 px-3 text-xs">
                <CheckCircle2 size={13} /> Open task
              </button>
            ) : (
              <button onClick={() => onMakeTask()} disabled={!canEdit} className="button-primary py-1.5 px-3 text-xs">
                <ListPlus size={13} /> Make task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Note Body & Action Lines */}
      <div className="flex-1 px-4 py-4 sm:px-7 sm:py-6">
        {!canEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            <LockKeyhole size={14} /> Private note belonging to another workspace member.
          </div>
        )}

        <div className="relative min-h-[140px]">
          <textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            disabled={!canEdit}
            rows={5}
            className="w-full resize-none bg-transparent text-sm leading-6 text-zinc-700 outline-none placeholder:text-zinc-300 sm:text-base sm:leading-7"
            placeholder="What is this note trying to hold onto? Add context, decisions, or links..."
          />
        </div>

        {/* Action Lines Checklist */}
        <section className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-zinc-950 text-white">
                <ListChecks size={14} />
              </span>
              <div>
                <p className="text-xs font-extrabold text-zinc-900">Action lines</p>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Tasks and next steps derived from this note.</p>
              </div>
            </div>
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-extrabold text-zinc-600 shadow-2xs">
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
            <form onSubmit={onAddLine} className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-white p-1.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400">
                <Plus size={14} />
              </span>
              <input
                value={newLine}
                onChange={(event) => onNewLineChange(event.target.value)}
                placeholder="Add an action line..."
                className="min-w-0 flex-1 bg-transparent px-1 text-xs sm:text-sm outline-none placeholder:text-zinc-400"
              />
              <button
                disabled={savingLine || !newLine.trim()}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
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
        <div className="mt-5 flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400">
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
    <div className={`group flex items-center gap-2 rounded-xl border p-2 transition ${line.is_done ? "border-emerald-100 bg-emerald-50/50" : "border-zinc-100 bg-white"}`}>
      <button
        disabled={!canEdit}
        onClick={onToggle}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${line.is_done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"}`}
        aria-label={line.is_done ? "Mark line open" : "Mark line done"}
      >
        {line.is_done ? <Check size={14} /> : <Circle size={14} />}
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
        <button onClick={onOpenTask} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-100 px-2 py-1 text-[10px] font-extrabold text-violet-700">
          <CheckCircle2 size={12} /> Task
        </button>
      ) : (
        <button disabled={!canEdit} onClick={onMakeTask} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-extrabold text-zinc-500 hover:bg-violet-100 hover:text-violet-700 transition">
          <ListPlus size={12} /> Task
        </button>
      )}
      <button disabled={!canEdit} onClick={onDelete} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100 transition" aria-label="Delete line">
        <X size={13} />
      </button>
    </div>
  );
}

function CollaborationCard({ note, members, currentUserId }) {
  const shared = note?.visibility === "shared";
  const people = members.slice(0, 5);

  return (
    <section className="panel p-4">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${shared ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
          {shared ? <UsersRound size={17} /> : <LockKeyhole size={16} />}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{shared ? "Collaboration" : "Personal space"}</p>
          <h2 className="mt-0.5 text-base font-extrabold">{shared ? "Shared workspace note" : "Private note"}</h2>
        </div>
      </div>
      {shared ? (
        <>
          <p className="mt-2 text-xs leading-5 text-zinc-500">All workspace members can view, edit, and turn action items into tasks.</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex -space-x-1.5">
              {people.map((member) => (
                <span key={member.id} title={member.full_name || member.email} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-violet-100 text-[10px] font-extrabold text-violet-700">
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
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-50 p-2.5 text-xs font-semibold text-zinc-500">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-zinc-700">{initials(members.find((m) => m.id === currentUserId))}</span> Only you can see this note
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
    <section className="panel p-4">
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

/**
 * CommentsCard Component with @Mention Autocomplete Dropup/Dropdown
 */
function CommentsCard({ note, comments, members }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef(null);
  const { notify } = useFeedback();

  if (!note) {
    return (
      <section className="panel p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <MessageCircle size={15} />
          <p className="font-extrabold text-xs text-zinc-600">Discussion</p>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Select a note to see discussion.</p>
      </section>
    );
  }

  if (note.visibility !== "shared") {
    return (
      <section className="panel p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <MessageCircle size={15} />
          <p className="font-extrabold text-xs text-zinc-600">Discussion</p>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Discussion opens when you share this note with the workspace.</p>
      </section>
    );
  }

  // Filter members for @mention dropdown based on query
  const matchingTeammates = (members || []).filter((member) => {
    if (mentionQuery === null) return false;
    const q = mentionQuery.toLowerCase();
    const name = (member.full_name || "").toLowerCase();
    const email = (member.email || "").toLowerCase();
    const handle = email.split("@")[0];
    return name.includes(q) || email.includes(q) || handle.includes(q);
  });

  const handleInputChange = (event) => {
    const val = event.target.value;
    const cursor = event.target.selectionStart;
    setBody(val);
    setCursorPos(cursor);

    // Detect if cursor is preceded by @ query
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf("@");

    if (lastAt !== -1) {
      const queryAfterAt = textBeforeCursor.slice(lastAt + 1);
      if (!/\s/.test(queryAfterAt)) {
        setMentionQuery(queryAfterAt);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (member) => {
    const handle = member.full_name?.trim() || member.email.split("@")[0];
    const textBeforeCursor = body.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = body.slice(cursorPos);

    const newBody = `${body.slice(0, lastAt)}@${handle} ${textAfterCursor}`;
    setBody(newBody);
    setMentionQuery(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastAt + handle.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (event) => {
    if (mentionQuery !== null && matchingTeammates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % matchingTeammates.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((prev) => (prev - 1 + matchingTeammates.length) % matchingTeammates.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(matchingTeammates[mentionIndex]);
      } else if (event.key === "Escape") {
        setMentionQuery(null);
      }
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setMentionQuery(null);
    try {
      await comments.addComment(body);
      setBody("");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel p-4 relative">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-100 text-cyan-700">
            <MessageCircle size={14} />
          </span>
          <div>
            <p className="eyebrow">Shared note</p>
            <h2 className="text-sm font-extrabold text-zinc-900">Discussion</h2>
          </div>
        </div>
        <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-600">
          {comments.comments.length}
        </span>
      </div>

      {/* Comment Form with Floating @Mention Dropup */}
      <form onSubmit={submit} className="relative mt-3">
        {/* @Mention Dropup Popup */}
        {mentionQuery !== null && (
          <div className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              Mention teammate
            </div>
            {matchingTeammates.map((member, idx) => {
              const isSelected = idx === mentionIndex;
              const displayName = member.full_name || member.email.split("@")[0];
              return (
                <button
                  key={member.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(member);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                    isSelected ? "bg-violet-50 text-violet-900 font-bold" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                    {initials(member)}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <p className="truncate font-semibold text-xs">{displayName}</p>
                    <p className="truncate text-[10px] text-zinc-400">{member.email}</p>
                  </div>
                </button>
              );
            })}
            {matchingTeammates.length === 0 && (
              <div className="p-2.5 text-center text-xs text-zinc-400">No teammates found</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={body}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Add context or type @ to mention..."
            className="control min-w-0 flex-1 text-xs py-2 px-3"
          />
          <button
            disabled={sending || !body.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:opacity-40"
            aria-label="Send comment"
          >
            <Send size={14} />
          </button>
        </div>
      </form>

      <p className="mt-1.5 text-[10px] text-zinc-400 flex items-center gap-1">
        <AtSign size={11} className="inline text-violet-500" /> Type @ to mention a teammate in this note.
      </p>

      {/* Comments List */}
      <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1">
        {comments.comments.slice(-10).map((comment) => {
          const author = members.find((member) => member.id === comment.author_id);
          return (
            <article key={comment.id} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-zinc-400">
                <span className="text-zinc-700">{author?.full_name || author?.email || "Workspace member"}</span>
                <span>{relative(comment.created_at)}</span>
              </div>
              <p className="mt-1 text-zinc-800 leading-relaxed font-normal">{renderCommentBody(comment.body, members)}</p>
            </article>
          );
        })}
        {!comments.comments.length && (
          <p className="rounded-xl bg-zinc-50 p-3 text-center text-xs text-zinc-400">No discussion yet. Leave a note comment.</p>
        )}
      </div>
    </section>
  );
}

function NoteCard({ note, active, onClick, taskCount }) {
  const done = doneCount(note.lines);
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${
        active ? "border-violet-300 bg-violet-50/80 shadow-xs" : `${NOTE_COLORS[note.color] || NOTE_COLORS.violet} hover:shadow-xs`
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${NOTE_ACCENTS[note.color] || NOTE_ACCENTS.violet}`} />
        <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-zinc-900">{note.title}</span>
        {note.is_pinned && <Pin size={12} className="shrink-0 text-amber-500" fill="currentColor" />}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 opacity-70">{note.body || "Empty note canvas."}</p>
      <div className="mt-2.5 flex items-center gap-2 text-[10px] font-bold opacity-60">
        <span>{relative(note.updated_at)}</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <ListChecks size={11} /> {done}/{note.lines?.length ?? 0}
        </span>
        {taskCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-violet-700 font-extrabold">
            <CheckCircle2 size={11} /> {taskCount}
          </span>
        )}
      </div>
    </button>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-extrabold transition ${
        active ? "bg-white text-violet-700 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
      }`}
    >
      <Icon size={13} />
      <span className="truncate">{label}</span>
      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px]">{count}</span>
    </button>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.08] p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 text-violet-200">
        <Icon size={13} />
        <span className="mono text-base font-medium text-white sm:text-lg">{value}</span>
      </div>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-zinc-400">{label}</p>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-2.5 text-center">
      <p className="mono text-lg font-medium text-zinc-900">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-zinc-400">{label}</p>
    </div>
  );
}

function EmptyNotes({ view, onCreate }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
      <span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-600">
        {view === "mine" ? <LockKeyhole size={15} /> : <UsersRound size={15} />}
      </span>
      <p className="mt-2 text-xs font-extrabold">{view === "mine" ? "No private notes" : "No shared notes"}</p>
      <button onClick={onCreate} className="mt-3 text-xs font-extrabold text-violet-600 hover:underline">
        Create one <ArrowUpRight size={12} className="inline" />
      </button>
    </div>
  );
}

function EmptyEditor({ view, onCreate }) {
  return (
    <div className="grid min-h-[500px] place-items-center p-6 text-center">
      <div className="max-w-xs">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-600">
          <FileText size={20} />
        </span>
        <p className="eyebrow mt-4">{view === "mine" ? "Private space" : "Team room"}</p>
        <h2 className="mt-1.5 text-xl font-extrabold tracking-[-.03em]">Select a note or create a new one.</h2>
        <button onClick={onCreate} className="button-primary mt-5">
          <Plus size={15} /> New note
        </button>
      </div>
    </div>
  );
}

function renderCommentBody(text, _members = []) {
  if (!text) return "";
  const parts = text.split(/(@[\w.-]+(?:\s+[\w.-]+)?)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("@")) {
      return (
        <span key={idx} className="font-extrabold text-violet-700 bg-violet-100/70 px-1 py-0.5 rounded text-[11px]">
          {part}
        </span>
      );
    }
    return part;
  });
}

function doneCount(lines = []) {
  return lines.filter((line) => line.is_done).length;
}

function openLineCount(note) {
  return (note.lines ?? []).filter((line) => !line.is_done).length;
}

function taskCountForNote(note, tasks) {
  return tasks.filter((task) => task.source_note_id === note.id).length;
}

function initials(member) {
  return (member?.full_name || member?.email || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

function relative(value) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "recently";
  }
}
