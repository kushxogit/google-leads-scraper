import { ArrowUpRight, CalendarDays, ClipboardList, FileSearch, MessageSquare, NotebookPen, RotateCcw, Settings, Users2 } from "lucide-react";
import { Link } from "react-router-dom";

const links = [
  ["/leads", "Pipeline", "Legacy pipeline view for sorting and bulk updates.", Users2],
  ["/jobs", "Find leads", "Scrape and review new acquisition sources.", FileSearch],
  ["/tasks", "Tasks", "Project and client work across the workspace.", ClipboardList],
  ["/rewind", "Timeline", "The existing daily timeline and follow-up view.", RotateCcw],
  ["/notes", "Notes", "Workspace notes and collaboration.", NotebookPen],
  ["/project-chat", "Project chat", "Keep team conversations beside delivery.", MessageSquare],
  ["/settings", "Settings", "Workspace, integrations, imports, and preferences.", Settings],
];
export default function More() {
  return <div className="mx-auto max-w-[1100px] space-y-5 pb-6"><header><p className="eyebrow">Workspace tools</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.05em]">More</h1><p className="mt-2 text-sm leading-6 text-zinc-500">The supporting tools stay available without competing with today’s client work.</p></header><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{links.map(([to,title,body,Icon]) => <Link key={to} to={to} className="panel group p-5 transition hover:-translate-y-0.5 hover:border-violet-200"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-950 text-white"><Icon size={17} /></span><ArrowUpRight size={16} className="text-zinc-300 transition group-hover:text-violet-600" /></div><h2 className="mt-5 text-base font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{body}</p></Link>)}</section><section className="panel flex items-center gap-3 p-5 text-sm"><CalendarDays size={18} className="text-violet-600" /><span className="font-semibold text-zinc-600">Calendar auth callback remains at <code className="rounded bg-zinc-100 px-1.5 py-1 text-xs">/calendar/callback</code>.</span></section></div>;
}

