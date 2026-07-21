import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
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
  const [view, setView] = useState("mine");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState(searchParams.get("note"));
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
      <header className="relative overflow-hidden rounded-[30px] bg-[#171719] p-6 text-white shadow-[0_20px_50px_rgba(50,35,105,.22)] sm:p-7">
        <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-violet-500/70 blur-[78px]" />
        <div className="absolute right-[31%] top-0 h-36 w-36 rounded-full bg-emerald-300/20 blur-[55px]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200">
              <Sparkles size={13} /> Notes room
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.06em] sm:text-5xl">Keep the thread.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
              Capture your own thinking, open the right context to your team, and turn the next sentence into real work.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[.08] px-3 py-2 text-xs font-bold text-zinc-300">
              {activeWorkspace?.type === "team" ? "Team workspace" : "Personal workspace"}
            </div>
            <button onClick={createNoteAndFocus} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-zinc-950">
              <Plus size={17} /> New note
            </button>
          </div>
        </div>
        <div className="relative mt-7 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
          <Stat icon={FileText} value={visibleNotes.length} label="notes in view" />
          <Stat icon={ListChecks} value={noteApi.notes.reduce((sum, note) => sum + (note.lines?.length ?? 0), 0)} label="action lines" />
          <Stat icon={CheckCircle2} value={taskApi.tasks.filter((task) => task.source_note_id).length} label="tasks sparked" />
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="panel flex min-h-[680px] flex-col p-3">
          <div className="flex rounded-2xl bg-zinc-100 p-1">
            <TabButton active={view === "mine"} onClick={() => setView("mine")} icon={LockKeyhole} label="My notes" count={noteApi.notes.filter((note) => note.visibility === "private").length} />
            <TabButton active={view === "workspace"} onClick={() => setView("workspace")} icon={UsersRound} label="Workspace" count={noteApi.notes.filter((note) => note.visibility === "shared").length} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="control flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search size={15} className="shrink-0 text-zinc-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes or lines" className="min-w-0 flex-1 bg-transparent py-0.5 text-xs outline-none placeholder:text-zinc-400" />
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="control w-[92px] px-2 text-[11px] font-bold">
              <option value="recent">Recent</option>
              <option value="pinned">Pinned</option>
              <option value="active">Open lines</option>
            </select>
          </div>
          <div className="mt-4 flex items-center justify-between px-1">
            <p className="eyebrow">{view === "mine" ? "Your thinking" : "Shared context"}</p>
            <button onClick={createNoteAndFocus} className="grid h-7 w-7 place-items-center rounded-xl bg-zinc-950 text-white" aria-label="Create note"><Plus size={14} /></button>
          </div>
          <div className="scrollbar-thin mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {visibleNotes.map((note) => (
              <NoteCard key={note.id} note={note} active={note.id === selectedId} onClick={() => selectNote(note.id)} taskCount={taskCountForNote(note, taskApi.tasks)} />
            ))}
            {!visibleNotes.length && <EmptyNotes view={view} onCreate={createNoteAndFocus} />}
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-white/40 p-3">
            <div className="flex items-start gap-2">
              <LayoutList size={15} className="mt-0.5 text-violet-500" />
              <p className="text-[11px] leading-5 text-zinc-500">Tip: start a line with the next move. Every line has a one-click path into Rewind.</p>
            </div>
          </div>
        </aside>

        <main className="panel min-h-[680px] overflow-hidden">
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

        <aside className="space-y-4">
          <CollaborationCard note={activeNote} members={noteApi.members} currentUserId={user?.id} />
          <MomentumCard note={activeNote} tasks={taskApi.tasks} />
          <CommentsCard note={activeNote} comments={comments} members={noteApi.members} />
        </aside>
      </div>
    </div>
  );
}

function NoteEditor({ note, task, tasks, members, currentUserId, canEdit, title, body, dirty, newLine, savingLine, onTitleChange, onBodyChange, onSave, onVisibilityChange, onColorChange, onPin, onArchive, onDelete, onNewLineChange, onAddLine, onToggleLine, onUpdateLine, onDeleteLine, onMakeTask, onOpenTask }) {
  const owner = members.find((member) => member.id === note.owner_id);
  const isShared = note.visibility === "shared";
  return (
    <article className="flex min-h-[680px] flex-col">
      <div className={`h-2 w-full ${NOTE_ACCENTS[note.color] || NOTE_ACCENTS.violet}`} />
      <div className="border-b border-zinc-100 px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] ${isShared ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
            {isShared ? <Globe2 size={12} /> : <LockKeyhole size={12} />} {isShared ? "Workspace note" : "Private note"}
          </span>
          <span className="text-[11px] text-zinc-400">Updated {relative(note.updated_at)}</span>
          <div className="ml-auto flex items-center gap-1">
            {dirty && <span className="mr-2 text-[11px] font-bold text-amber-600">Saving soon...</span>}
            {dirty && <button onClick={onSave} className="button-primary px-3 py-2 text-xs">Save</button>}
            <button onClick={onPin} disabled={!canEdit} className={`grid h-9 w-9 place-items-center rounded-xl ${note.is_pinned ? "bg-amber-100 text-amber-600" : "bg-zinc-100 text-zinc-400"}`} aria-label={note.is_pinned ? "Unpin note" : "Pin note"}><Pin size={15} fill={note.is_pinned ? "currentColor" : "none"} /></button>
            <button onClick={onArchive} disabled={!canEdit} className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-400 hover:text-zinc-700" aria-label="Archive note"><Archive size={15} /></button>
            <button onClick={onDelete} disabled={note.owner_id !== currentUserId} className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-400 hover:text-rose-600" aria-label="Delete note"><Trash2 size={15} /></button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} disabled={!canEdit} className="w-full bg-transparent text-3xl font-extrabold tracking-[-.055em] text-zinc-950 outline-none placeholder:text-zinc-300 sm:text-4xl" placeholder="Untitled note" />
            <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400"><UserRound size={13} /> {note.owner_id === currentUserId ? "You started this" : `${owner?.full_name || owner?.email || "A teammate"} started this`} <span className="text-zinc-300">/</span> {note.lines?.length ?? 0} action lines</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <select value={note.visibility} disabled={!canEdit} onChange={(event) => onVisibilityChange(event.target.value)} className="control py-2 text-xs font-bold">
              <option value="private">Private to me</option>
              <option value="shared">Share with workspace</option>
            </select>
            {task ? <button onClick={() => onOpenTask(task)} className="button-secondary py-2 text-xs"><CheckCircle2 size={14} /> Open task</button> : <button onClick={() => onMakeTask()} disabled={!canEdit} className="button-primary py-2 text-xs"><ListPlus size={14} /> Make task</button>}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 sm:px-8 sm:py-7">
        {!canEdit && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-800"><LockKeyhole size={15} /> This private note belongs to another workspace member.</div>}
        <div className="relative">
          <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} disabled={!canEdit} rows={5} className="w-full resize-none bg-transparent text-[15px] leading-7 text-zinc-700 outline-none placeholder:text-zinc-300" placeholder="What is this note trying to hold onto? Add context, decisions, links, or a quick brain dump..." />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/60 to-transparent" />
        </div>

        <section className="mt-8 rounded-[26px] border border-zinc-100 bg-zinc-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-zinc-950 text-white"><ListChecks size={16} /></span>
            <div>
              <p className="text-sm font-extrabold">Action lines</p>
              <p className="mt-0.5 text-xs text-zinc-400">Small enough to finish. Clear enough to assign.</p>
            </div>
            <span className="ml-auto rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-zinc-500">{doneCount(note.lines)} / {note.lines?.length ?? 0} done</span>
          </div>
          <div className="mt-4 space-y-2">
            {(note.lines ?? []).map((line) => {
              const lineTask = tasks.find((taskItem) => taskItem.source_note_line_id === line.id);
              return <NoteLine key={line.id} line={line} task={lineTask} canEdit={canEdit} onToggle={() => onToggleLine(line)} onUpdate={(value) => onUpdateLine(line, value)} onDelete={() => onDeleteLine(line)} onMakeTask={() => onMakeTask(line)} onOpenTask={() => lineTask && onOpenTask(lineTask)} />;
            })}
          </div>
          {canEdit && <form onSubmit={onAddLine} className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-white/70 p-2"><span className="grid h-8 w-8 place-items-center rounded-xl text-zinc-300"><Plus size={15} /></span><input value={newLine} onChange={(event) => onNewLineChange(event.target.value)} placeholder="Add an action line and press Enter" className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-zinc-400" /><button disabled={savingLine || !newLine.trim()} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-extrabold text-zinc-600 disabled:opacity-40">Add</button></form>}
          {!note.lines?.length && !canEdit && <p className="mt-4 text-center text-sm text-zinc-400">No action lines yet.</p>}
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400"><Palette size={13} /> Note mood</span>
          {colorOptions.map(([key, label]) => <button key={key} title={label} onClick={() => onColorChange(key)} disabled={!canEdit} className={`h-6 w-6 rounded-full ${NOTE_ACCENTS[key]} ${note.color === key ? "ring-2 ring-zinc-950 ring-offset-2" : "opacity-55 hover:opacity-100"}`} aria-label={`Use ${label} note color`} />)}
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
    <div className={`group flex items-center gap-2 rounded-2xl border p-2 transition ${line.is_done ? "border-emerald-100 bg-emerald-50/60" : "border-zinc-100 bg-white"}`}>
      <button disabled={!canEdit} onClick={onToggle} className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${line.is_done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-300 hover:text-zinc-500"}`} aria-label={line.is_done ? "Mark line open" : "Mark line done"}>{line.is_done ? <Check size={15} /> : <Circle size={15} />}</button>
      <input value={draft} disabled={!canEdit} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(line.body); event.currentTarget.blur(); } }} className={`min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold outline-none ${line.is_done ? "text-zinc-400 line-through" : "text-zinc-700"}`} />
      {task ? <button onClick={onOpenTask} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-violet-100 px-2.5 py-2 text-[10px] font-extrabold text-violet-700"><CheckCircle2 size={13} /> Task</button> : <button disabled={!canEdit} onClick={onMakeTask} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-zinc-100 px-2.5 py-2 text-[10px] font-extrabold text-zinc-500 transition hover:bg-violet-100 hover:text-violet-700"><ListPlus size={13} /> Task</button>}
      <button disabled={!canEdit} onClick={onDelete} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-zinc-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100" aria-label="Delete action line"><X size={14} /></button>
    </div>
  );
}

function CollaborationCard({ note, members, currentUserId }) {
  const shared = note?.visibility === "shared";
  const people = members.slice(0, 5);
  return <section className="panel p-5"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${shared ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{shared ? <UsersRound size={18} /> : <LockKeyhole size={17} />}</span><div className="min-w-0"><p className="eyebrow">{shared ? "Collaboration" : "Personal space"}</p><h2 className="mt-1 text-lg font-extrabold">{shared ? "A lovely shared room" : "Just for your head"}</h2></div></div>{shared ? <><p className="mt-3 text-sm leading-6 text-zinc-500">Everyone in this workspace can shape the note, add context, and turn a line into work.</p><div className="mt-5 flex items-center"><div className="flex -space-x-2">{people.map((member) => <span key={member.id} title={member.full_name || member.email} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-violet-100 text-[10px] font-extrabold text-violet-700">{initials(member)}</span>)}{members.length > people.length && <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-extrabold text-zinc-500">+{members.length - people.length}</span>}</div><span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.16)]" /> Live synced</span></div><div className="mt-4 rounded-2xl bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-800"><AtSign size={13} className="mr-1 inline" /> Mention a teammate in the discussion when a thought needs a response.</div></> : <><p className="mt-3 text-sm leading-6 text-zinc-500">Private notes are yours alone, even when you are working inside a team workspace.</p><div className="mt-5 flex items-center gap-2 rounded-2xl bg-zinc-50 p-3 text-xs font-semibold text-zinc-500"><span className="grid h-7 w-7 place-items-center rounded-full bg-white text-zinc-600">{initials(members.find((member) => member.id === currentUserId))}</span> Only you can see this note</div></>}</section>;
}

function MomentumCard({ note, tasks }) {
  if (!note) return <section className="panel p-5"><p className="eyebrow">Momentum</p><h2 className="mt-1 text-lg font-extrabold">Pick a note to get moving</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Your action lines and task links will show up here.</p></section>;
  const noteTasks = tasks.filter((task) => task.source_note_id === note.id);
  const open = (note.lines ?? []).filter((line) => !line.is_done).length;
  return <section className="panel p-5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-700"><ArrowUpRight size={15} /></span><p className="eyebrow">Momentum</p></div><h2 className="mt-3 text-lg font-extrabold">From thought to motion</h2><div className="mt-5 grid grid-cols-3 gap-2"><MiniStat value={note.lines?.length ?? 0} label="lines" /><MiniStat value={open} label="open" /><MiniStat value={noteTasks.length} label="tasks" /></div><div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 text-xs leading-5 text-zinc-500">Use <span className="font-extrabold text-violet-700">Task</span> beside any line to preserve its context in Rewind.</div></section>;
}

function CommentsCard({ note, comments, members }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { notify } = useFeedback();
  if (!note) return <section className="panel p-5"><div className="flex items-center gap-2"><MessageCircle size={16} className="text-zinc-400" /><p className="font-extrabold">Discussion</p></div><p className="mt-3 text-sm leading-6 text-zinc-400">Select a note to see its conversation.</p></section>;
  if (note.visibility !== "shared") return <section className="panel p-5"><div className="flex items-center gap-2"><MessageCircle size={16} className="text-zinc-400" /><p className="font-extrabold">Discussion</p></div><p className="mt-3 text-sm leading-6 text-zinc-400">Discussion opens when you share this note with the workspace.</p></section>;
  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try { await comments.addComment(body); setBody(""); } catch (error) { notify(error.message, "error"); } finally { setSending(false); }
  };
  return <section className="panel p-5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-100 text-cyan-700"><MessageCircle size={15} /></span><div><p className="eyebrow">Shared note</p><h2 className="mt-1 text-lg font-extrabold">Discussion</h2></div><span className="ml-auto rounded-xl bg-zinc-100 px-2 py-1 text-[10px] font-extrabold text-zinc-500">{comments.comments.length}</span></div><form onSubmit={submit} className="mt-4 flex items-center gap-2"><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add context or @mention..." className="control min-w-0 flex-1 text-xs" /><button disabled={sending || !body.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl liquid-button text-white disabled:opacity-50" aria-label="Send comment"><Send size={15} /></button></form><p className="mt-2 text-[10px] text-zinc-400"><AtSign size={11} className="mr-1 inline" /> Mention a name or email handle to notify them.</p><div className="mt-5 space-y-4">{comments.comments.slice(-5).map((comment) => { const author = members.find((member) => member.id === comment.author_id); return <article key={comment.id} className="border-l-2 border-cyan-200 pl-3"><p className="text-sm leading-5 text-zinc-700">{comment.body}</p><p className="mt-1 text-[10px] text-zinc-400">{author?.full_name || author?.email || "Workspace member"} <span className="mx-1">/</span> {relative(comment.created_at)}</p></article>; })}{!comments.comments.length && <p className="rounded-2xl bg-zinc-50 p-4 text-center text-xs leading-5 text-zinc-400">No discussion yet. Leave the first useful breadcrumb.</p>}</div></section>;
}

function NoteCard({ note, active, onClick, taskCount }) {
  const done = doneCount(note.lines);
  return <button onClick={onClick} className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-violet-200 bg-violet-50 shadow-sm" : `${NOTE_COLORS[note.color] || NOTE_COLORS.violet} hover:-translate-y-0.5 hover:shadow-md`}`}><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${NOTE_ACCENTS[note.color] || NOTE_ACCENTS.violet}`} /><span className="min-w-0 flex-1 truncate text-sm font-extrabold">{note.title}</span>{note.is_pinned && <Pin size={13} className="shrink-0 text-amber-500" fill="currentColor" />}</div><p className="mt-2 line-clamp-2 text-xs leading-5 opacity-65">{note.body || "A blank page waiting for a useful thought."}</p><div className="mt-3 flex items-center gap-2 text-[10px] font-bold opacity-60"><span>{relative(note.updated_at)}</span><span className="text-zinc-300">/</span><span className="flex items-center gap-1"><ListChecks size={12} /> {done}/{note.lines?.length ?? 0}</span>{taskCount > 0 && <span className="ml-auto flex items-center gap-1 text-violet-700"><CheckCircle2 size={12} /> {taskCount}</span>}</div></button>;
}

function TabButton({ active, onClick, icon: Icon, label, count }) { return <button onClick={onClick} className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-extrabold ${active ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500"}`}><Icon size={13} /><span className="truncate">{label}</span><span className="rounded-lg bg-zinc-100 px-1.5 py-0.5 text-[9px]">{count}</span></button>; }
function Stat({ icon: Icon, value, label }) { return <div className="rounded-2xl border border-white/10 bg-white/[.08] p-3"><div className="flex items-center gap-2 text-violet-200"><Icon size={14} /><span className="mono text-lg font-medium text-white">{value}</span></div><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-zinc-400">{label}</p></div>; }
function MiniStat({ value, label }) { return <div className="rounded-2xl bg-zinc-50 p-3 text-center"><p className="mono text-xl font-medium text-zinc-900">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-zinc-400">{label}</p></div>; }
function EmptyNotes({ view, onCreate }) { return <div className="rounded-2xl border border-dashed border-zinc-200 p-5 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-600">{view === "mine" ? <LockKeyhole size={17} /> : <UsersRound size={17} />}</span><p className="mt-3 text-sm font-extrabold">{view === "mine" ? "No private notes yet" : "No shared notes yet"}</p><p className="mt-1 text-xs leading-5 text-zinc-400">{view === "mine" ? "Keep a rough thought, decision, or personal plan here." : "Start a shared room for a decision, launch, or customer thread."}</p><button onClick={onCreate} className="mt-4 text-xs font-extrabold text-violet-600">Create one <ArrowUpRight size={13} className="inline" /></button></div>; }
function EmptyEditor({ view, onCreate }) { return <div className="grid min-h-[680px] place-items-center p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-violet-100 text-violet-600"><FileText size={23} /></span><p className="eyebrow mt-5">{view === "mine" ? "Your private canvas" : "A room for the whole team"}</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em]">Choose a note, or start from a blank page.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Write the context once. Keep decisions, action lines, and task links close together.</p><button onClick={onCreate} className="button-primary mt-6"><Plus size={16} /> New note</button></div></div>; }
function doneCount(lines = []) { return lines.filter((line) => line.is_done).length; }
function openLineCount(note) { return (note.lines ?? []).filter((line) => !line.is_done).length; }
function taskCountForNote(note, tasks) { return tasks.filter((task) => task.source_note_id === note.id).length; }
function initials(member) { return (member?.full_name || member?.email || "U").split(/[\s@]/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U"; }
function relative(value) { try { return formatDistanceToNow(new Date(value), { addSuffix: true }); } catch { return "recently"; } }
