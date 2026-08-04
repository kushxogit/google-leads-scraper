import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, ChevronRight, MessageCircle, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useWorkspaceLeads } from "../hooks/useCrm";
import { useWorkspaceTasks } from "../hooks/useTasks";
import { clientFromRow, useWorkspaceInteractions } from "../hooks/useToday";
import InteractionModal from "../components/InteractionModal";
import AddLeadModal from "../components/AddLeadModal";

export default function Today() {
  const { activeWorkspace } = useAuthWorkspace();
  const { leads: rawLeads, isLoading: loadingLeads } = useWorkspaceLeads();
  const { tasks, isLoading: loadingTasks } = useWorkspaceTasks();
  const interactions = useWorkspaceInteractions();
  const [activeLead, setActiveLead] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const queue = useMemo(() => {
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const leads = rawLeads.map(clientFromRow).filter((lead) => !["lost", "won"].includes(lead.status));
    const byLead = new Set(); const rows = [];
    const add = (lead, kind, action, detail, priority) => { if (!lead || byLead.has(lead.id)) return; byLead.add(lead.id); rows.push({ lead, kind, action, detail, priority }); };
    leads.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()).forEach((lead) => add(lead, "Overdue", lead.status === "proposal" ? "Follow up on proposal" : "Follow up", `Due ${new Date(lead.next_follow_up_at).toLocaleDateString()}`, 0));
    leads.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at) >= new Date() && new Date(lead.next_follow_up_at) <= today).forEach((lead) => add(lead, "Due today", "Follow up", "Conversation scheduled for today", 1));
    (interactions.interactions || []).filter((item) => !item.reviewed_at && !item.dismissed_at).forEach((item) => add(leads.find((lead) => lead.id === item.lead_id), "Waiting on you", "Review interaction", "A saved interaction needs a decision", 2));
    (tasks || []).filter((task) => !["done", "cancelled"].includes(task.status) && task.due_at && new Date(task.due_at) <= today).forEach((task) => add(leads.find((lead) => lead.id === task.lead_id), "Client work", "Complete task", task.title, 3));
    leads.filter((lead) => lead.status === "new" && !lead.last_conversation_at).forEach((lead) => add(lead, "New lead", lead.phone ? "Call" : lead.email ? "Email" : "Reach out", "First contact", 4));
    return rows.sort((a, b) => a.priority - b.priority);
  }, [rawLeads, tasks, interactions.interactions]);
  if (loadingLeads || loadingTasks || interactions.isLoading) return <div className="panel p-10 text-center text-sm text-zinc-500">Preparing today’s work…</div>;
  return <div className="mx-auto max-w-5xl space-y-5 pb-6">
    <header className="relative overflow-hidden rounded-[30px] bg-[#121214] p-6 text-white shadow-[0_24px_70px_rgba(30,20,70,.2)] sm:p-8"><div className="absolute -right-8 -top-16 h-56 w-56 rounded-full bg-violet-500/50 blur-[70px]" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-200"><Sparkles size={12} /> {activeWorkspace?.name || "Workspace"}</span><h1 className="mt-4 text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">Your next moves.</h1><p className="mt-2 text-sm text-zinc-300">Work down the list. Everything else can wait.</p></div><button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold hover:bg-white/20 sm:self-auto"><Plus size={15} /> Add lead</button></div></header>
    <section className="panel overflow-hidden p-0"><header className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-4"><div><p className="eyebrow">Today</p><h2 className="mt-1 text-lg font-extrabold">{queue.length ? `${queue.length} actions need you` : "You’re clear for today"}</h2></div><Link to="/clients" className="text-xs font-extrabold text-violet-700">Search clients <ArrowRight className="ml-1 inline" size={14} /></Link></header>{queue.length ? <div className="divide-y divide-zinc-100">{queue.map((item) => <ActionRow key={item.lead.id} item={item} onAction={() => setActiveLead(item.lead)} />)}</div> : <div className="grid place-items-center px-5 py-16 text-center"><CheckCircle2 size={28} className="text-emerald-500" /><p className="mt-3 text-sm font-extrabold">Nothing needs action right now.</p><p className="mt-1 text-xs text-zinc-500">Add a lead when you’re ready to start the next conversation.</p></div>}</section>
    <InteractionModal lead={activeLead} open={Boolean(activeLead)} onClose={() => setActiveLead(null)} /><AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
  </div>;
}
function ActionRow({ item, onAction }) { return <article className="flex items-center gap-3 px-4 py-4 transition hover:bg-violet-50/30 sm:px-5"><Link to={`/leads/${item.lead.id}`} className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-zinc-500">{item.kind}</span><span className="truncate text-sm font-extrabold text-zinc-950">{item.lead.business_name}</span></div><p className="mt-1 truncate text-xs text-zinc-500">{item.detail}</p></Link><button onClick={onAction} className="button-primary shrink-0 px-3 py-2 text-xs"><MessageCircle size={14} /> {item.action}<ChevronRight size={14} /></button></article>; }