import { useEffect, useState } from "react";
import { BrainCircuit, CalendarClock, Check, ChevronDown, ExternalLink, LoaderCircle, MessageSquare, RefreshCw, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useFeedback } from "../context/feedback";
import { useWorkspaceInteractions } from "../hooks/useToday";
import { useWorkspaceTasks } from "../hooks/useTasks";

const channels = ["call", "email", "whatsapp", "meeting", "other"];

export default function InteractionModal({ lead, open, onClose }) {
  const { notify } = useFeedback();
  const { interactions, logInteraction, saveQuickInteraction, processInteraction, retryInteraction, applyInteraction, reviewInteraction } = useWorkspaceInteractions(lead?.id);
  const { tasks } = useWorkspaceTasks();
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("No reply");
  const [nextStep, setNextStep] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [currentInteraction, setCurrentInteraction] = useState(null);

  const currentRemote = currentInteraction && interactions.find((item) => item.id === currentInteraction.id);
  const latestSaved = currentRemote ? { ...currentInteraction, ...currentRemote } : currentInteraction;
  const displayInteractions = latestSaved
    ? [latestSaved, ...interactions.filter((item) => item.id !== latestSaved.id)]
    : interactions;
  const latestInteraction = displayInteractions[0] || null;

  useEffect(() => {
    if (open) {
      setNote("");
      setChannel("call");
      setExpanded(null);
      setCurrentInteraction(null);
    }
  }, [open, lead?.id]);

  if (!open || !lead) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const interaction = await saveQuickInteraction({ lead, channel, outcome, note, nextStep, followUpDate });
      setCurrentInteraction(interaction);
      setNote("");
      notify("Saved. LeadPilot is processing the interaction.");
      void processInteraction(interaction, lead).catch(() => notify("Saved, but AI processing needs a retry.", "error"));
    } catch (error) {
      notify(error.message || "Could not save interaction.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/40 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="quick-log-title" className="panel max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-zinc-100 p-5 sm:p-6">
          <div>
            <p className="eyebrow">Quick log Ã‚Â· {lead.business_name}</p>
            <h2 id="quick-log-title" className="mt-1 text-xl font-extrabold tracking-tight">What happened?</h2>
            <p className="mt-1 text-sm text-zinc-500">Write naturally. Save first; AI will suggest structured updates in the background.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close interaction log" className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="border-b border-zinc-100 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="text-xs font-bold text-zinc-500 sm:w-36">
              Channel
              <select aria-label="Interaction type" value={channel} onChange={(event) => setChannel(event.target.value)} className="control mt-1.5 w-full">
                {channels.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-xs font-bold text-zinc-500">
              Note
              <textarea autoFocus required rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="control mt-1.5 w-full resize-y" placeholder="They liked the audit, asked for a proposal by Friday, and still need to send access." />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-zinc-500">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="control mt-1.5 w-full">{["No reply", "Spoke", "Interested", "Not interested", "Proposal requested", "Won"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs font-bold text-zinc-500 sm:col-span-2">Next action<input value={nextStep} onChange={(event) => setNextStep(event.target.value)} className="control mt-1.5 w-full" placeholder="Call, email, send proposalÃ¢â‚¬Â¦" /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><span className="text-xs font-bold text-zinc-500">Follow up</span>{[["Tomorrow",1],["In 3 days",3],["Next week",7]].map(([label, days]) => <button key={label} type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + days); setFollowUpDate(d.toISOString().slice(0,10)); }} className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-600 hover:border-violet-300">{label}</button>)}<input aria-label="Custom follow-up date" type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="control h-8 w-auto text-xs" /></div>          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-400">The original note is always retained.</span>
            <button disabled={saving || !note.trim()} className="button-primary"><MessageSquare size={15} />{saving ? "SavingÃ¢â‚¬Â¦" : "Save & next"}</button>
          </div>
        </form>
        {false && latestInteraction && (
          <section className="border-b border-violet-100 bg-violet-50/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-violet-700 shadow-sm"><Check size={15} /></span>
                <div><p className="eyebrow text-violet-700">Latest result</p><p className="text-sm font-extrabold text-violet-950">Saved to the client timeline</p></div>
              </div>
              <Status status={latestInteraction.processing_status} reviewed={latestInteraction.reviewed_at} />
            </div>
            <p className="mt-4 rounded-2xl border border-violet-100 bg-white/80 p-3 text-sm leading-6 text-zinc-700">{latestInteraction.raw_note}</p>
            {latestInteraction.summary && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Result label="Summary" value={latestInteraction.summary} />
              <Result label="Outcome" value={latestInteraction.outcome || "No outcome captured yet."} />
            </div>}
            {latestInteraction.next_step && <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><CalendarClock size={16} className="mt-0.5 shrink-0" /><span><strong>Next action:</strong> {latestInteraction.next_step}{latestInteraction.follow_up_date ? <span className="ml-1 font-bold">Ã¯Â¿Â½ {latestInteraction.follow_up_date}</span> : <span className="ml-1 text-amber-800">Ã¯Â¿Â½ Unplanned</span>}</span></div>}
            {tasks.find((task) => task.source_interaction_id === latestInteraction.id) && (
              <Link to="/tasks" className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-extrabold text-emerald-800">
                <span>Task created: {tasks.find((task) => task.source_interaction_id === latestInteraction.id).title}</span><ExternalLink size={14} />
              </Link>
            )}
            {latestInteraction.processing_status === "needs_review" && !latestInteraction.reviewed_at && <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={async () => { try { await applyInteraction({ interaction: latestInteraction, lead }); notify("Suggestions applied and task linked."); } catch (error) { notify(error.message, "error"); } }} className="button-primary"><Check size={14} />Apply suggestions</button>
              <button type="button" onClick={() => reviewInteraction(latestInteraction).then(() => notify("Marked reviewed.")).catch((error) => notify(error.message, "error"))} className="button-secondary">Mark reviewed</button>
            </div>}
            {latestInteraction.processing_status === "failed" && <button type="button" onClick={() => retryInteraction(latestInteraction, lead).catch((error) => notify(error.message, "error"))} className="button-secondary mt-4"><RefreshCw size={14} />Retry processing</button>}
          </section>
        )}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2"><BrainCircuit size={16} className="text-violet-600" /><p className="eyebrow">Recent interaction history</p></div>
          <div className="mt-3 space-y-2">
            {displayInteractions.slice(1, 7).map((item) => (
              <article key={item.id} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold uppercase text-zinc-500">{item.channel}</span><span className="text-[11px] text-zinc-400">{new Date(item.created_at).toLocaleString()}</span></div>
                  <Status status={item.processing_status} reviewed={item.reviewed_at} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium text-zinc-800">{item.raw_note}</p>
                {item.processing_status === "needs_review" && (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs">
                    <p className="font-extrabold text-violet-900">Suggested updates</p>
                    <div className="mt-2 grid gap-1 text-violet-900 sm:grid-cols-2">
                      {item.summary && <span>Summary: {item.summary}</span>}
                      {item.outcome && <span>Outcome: {item.outcome}</span>}
                      {item.next_step && <span>Next: {item.next_step}</span>}
                      {item.service && <span>Service: {item.service}</span>}
                      {item.follow_up_date && <span>Follow-up: {item.follow_up_date}</span>}
                      {item.feedback_status !== "unchanged" && <span>Feedback: {item.feedback_status}</span>}
                      {item.payment_status !== "unchanged" && <span>Payment: {item.payment_status}</span>}
                      {item.suggested_status && <span>Status: {item.suggested_status}</span>}
                    </div>
                    <button type="button" onClick={async () => { try { await applyInteraction({ interaction: item, lead }); notify("Suggestions applied to the client record."); } catch (error) { notify(error.message, "error"); } }} className="button-primary mt-3 w-full sm:w-auto"><Check size={14} />Apply suggestions</button>
                  </div>
                )}
                {item.processing_status === "failed" && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-rose-50 p-2 text-xs text-rose-800"><span>{item.processing_error || "Processing failed."}</span><button type="button" onClick={() => retryInteraction(item, lead).catch((error) => notify(error.message, "error"))} className="button-secondary px-3 py-1.5 text-xs"><RefreshCw size={13} /> Retry</button></div>
                )}
                {item.processing_status === "processing" && <p className="mt-2 flex items-center gap-1 text-xs text-violet-600"><LoaderCircle size={13} className="animate-spin" /> Processing in backgroundÃ¢â‚¬Â¦</p>}
                {item.summary && item.processing_status === "applied" && <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="mt-2 flex items-center gap-1 text-xs font-bold text-zinc-500">View AI summary <ChevronDown size={13} className={expanded === item.id ? "rotate-180" : ""} /></button>}
                {expanded === item.id && <p className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-zinc-600">{item.summary}{item.outcome ? ` Ã‚Â· ${item.outcome}` : ""}{item.next_step ? ` Ã‚Â· Next: ${item.next_step}` : ""}</p>}
              </article>
            ))}
            {!interactions.length && <p className="rounded-2xl border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-400">No interactions yet. Your first note will anchor the client timeline.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Status({ status, reviewed }) {
  const labels = { processing: "Processing", needs_review: reviewed ? "Reviewed" : "Needs review", applied: "Applied", failed: "Failed" };
  const styles = { processing: "bg-violet-100 text-violet-700", needs_review: "bg-amber-100 text-amber-800", applied: "bg-emerald-100 text-emerald-700", failed: "bg-rose-100 text-rose-700" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${styles[status] || "bg-zinc-100 text-zinc-600"}`}>{labels[status] || status}</span>;
}

function Result({ label, value }) {
  return <div className="rounded-2xl border border-violet-100 bg-white/80 p-3"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400">{label}</p><p className="mt-1 text-sm leading-5 text-zinc-700">{value}</p></div>;
}

