import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, File, MessageSquare, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useTaskProjects } from "../hooks/useTasks";
import { useProjectChat } from "../hooks/useProjectChat";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useFeedback } from "../context/feedback";

const urlPattern = /(https?:\/\/[^\s]+)/g;

function RichText({ text }) {
  return text.split(urlPattern).map((part, index) =>
    /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 underline underline-offset-2">{part}</a> : part,
  );
}

export default function ProjectChat() {
  const { user } = useAuthWorkspace();
  const { notify } = useFeedback();
  const projects = useTaskProjects();
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const bottom = useRef(null);
  useEffect(() => { if (!projectId && projects.projects[0]) setProjectId(projects.projects[0].id); }, [projectId, projects.projects]);
  const chat = useProjectChat(projectId);
  const project = projects.projects.find((item) => item.id === projectId);
  const saved = useMemo(() => chat.messages.filter((message) => message.saved_by_me), [chat.messages]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [chat.messages.length]);
  const send = async (event) => {
    event.preventDefault();
    if ((!draft.trim() && !files.length) || !projectId) return;
    setSaving(true);
    try { await chat.sendMessage({ body: draft, files }); setDraft(""); setFiles([]); }
    catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  };
  if (projects.isLoading) return <div className="panel rounded-[24px] p-8 text-zinc-500">Opening project chat…</div>;
  if (!projects.projects.length) return <EmptyProjectChat />;
  return (
    <div className="mx-auto flex h-[calc(100dvh-92px)] max-w-[1500px] min-h-[620px] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/75 shadow-[0_18px_60px_rgba(55,45,85,.10)] backdrop-blur-2xl lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200/70 bg-zinc-50/80 p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-violet-600 text-white"><MessageSquare size={17} /></span><div><p className="text-sm font-extrabold">Project chat</p><p className="text-[11px] text-zinc-500">The team’s dev room</p></div></div>
        <label className="mt-5 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-800 outline-none focus:border-violet-400">
          {projects.projects.map((item) => <option key={item.id} value={item.id}>{item.emoji || "📁"} {item.name}</option>)}
        </select>
        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-950"><p className="font-extrabold">Use this for PRs, handoffs, and decisions.</p><p className="mt-1 leading-5 text-violet-800">Links and files stay attached to this project—not lost in chat history.</p></div>
        <div className="mt-auto hidden lg:block"><p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Your saved items</p><div className="mt-2 space-y-2">{saved.slice(0, 4).map((message) => <div key={message.id} className="rounded-xl bg-white p-2 text-[11px] leading-4 text-zinc-600 shadow-2xs line-clamp-3">{message.body || message.attachments?.[0]?.name}</div>)}{!saved.length && <p className="text-xs text-zinc-400">Save useful messages here.</p>}</div></div>
      </aside>
      <section className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200/70 bg-white/70 px-4 py-3 sm:px-6"><div><p className="text-xs font-bold text-violet-600">{project?.emoji || "📁"} {project?.name}</p><h1 className="text-lg font-extrabold tracking-tight text-zinc-950">Workspace chat</h1></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Saved & live</span></header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {chat.isLoading ? <p className="text-sm text-zinc-400">Loading messages…</p> : chat.messages.length === 0 ? <div className="grid h-full place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={20} /></span><h2 className="mt-3 font-extrabold">Start the project room</h2><p className="mt-1 max-w-sm text-sm leading-6 text-zinc-500">Share a PR link, a screenshot, or a decision. Save the messages your team will need again.</p></div></div> : <div className="space-y-5">{chat.messages.map((message) => <ChatMessage key={message.id} message={message} members={chat.members} currentUserId={user?.id} onSave={() => chat.toggleSave(message)} />)}<div ref={bottom} /></div>}
        </div>
        <form onSubmit={send} className="border-t border-zinc-200/70 bg-white/85 p-3 sm:p-4">
          {files.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800"><File size={12} />{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X size={12} /></button></span>)}</div>}
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xs"><button type="button" onClick={() => fileInput.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-violet-700" title="Attach image or file"><Paperclip size={17} /></button><input ref={fileInput} type="file" multiple className="hidden" accept="image/*,.pdf,.txt,.md,.zip" onChange={(e) => setFiles((current) => [...current, ...Array.from(e.target.files ?? [])])} /><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows="2" placeholder="Share an update, PR link, handoff, or decision…" className="min-h-[42px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-400" /><button disabled={saving || (!draft.trim() && !files.length)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:opacity-40" title="Send message"><Send size={15} /></button></div>
        </form>
      </section>
    </div>
  );
}

function ChatMessage({ message, members, currentUserId, onSave }) {
  const author = members.find((member) => member.id === message.author_id);
  const name = author?.full_name || author?.email || "Teammate";
  const mine = message.author_id === currentUserId;
  return <article className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${mine ? "bg-zinc-950 text-white" : "bg-violet-100 text-violet-700"}`}>{name[0].toUpperCase()}</span><div className={`max-w-[82%] ${mine ? "items-end" : "items-start"} flex flex-col`}><div className="mb-1 flex items-center gap-2 text-[11px] text-zinc-400"><span className="font-bold text-zinc-700">{name}</span><span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span></div><div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${mine ? "rounded-tr-md bg-zinc-950 text-white" : "rounded-tl-md bg-zinc-100 text-zinc-800"}`}>{message.body && <p className="whitespace-pre-wrap break-words"><RichText text={message.body} /></p>}{message.attachments?.length > 0 && <div className="mt-2 grid gap-2">{message.attachments.map((attachment) => attachment.type?.startsWith("image/") ? <a key={attachment.path} href={attachment.url} target="_blank" rel="noreferrer"><img src={attachment.url} alt={attachment.name} className="max-h-64 rounded-xl border border-white/20 object-cover" /></a> : <a key={attachment.path} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-bold"><File size={14} />{attachment.name}</a>)}</div>}</div><button onClick={onSave} className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${message.saved_by_me ? "text-violet-700" : "text-zinc-400 hover:text-zinc-700"}`}><Bookmark size={12} fill={message.saved_by_me ? "currentColor" : "none"} />{message.saved_by_me ? "Saved" : "Save"}{message.saved_count > 1 ? ` · ${message.saved_count}` : ""}</button></div></article>;
}

function EmptyProjectChat() { return <div className="panel mx-auto mt-16 max-w-lg rounded-[28px] p-8 text-center"><MessageSquare className="mx-auto text-violet-600" /><h1 className="mt-3 text-xl font-extrabold">Create a project first</h1><p className="mt-2 text-sm leading-6 text-zinc-500">Project chat is scoped to a project so PRs, decisions, files, and handoffs always have a home.</p></div>; }
