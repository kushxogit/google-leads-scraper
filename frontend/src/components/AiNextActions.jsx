import { useEffect, useState } from "react";
import { CircleAlert, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function AiNextActions({ open, onClose, project, tasks = [], leads = [] }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSuggestions = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/ai/next-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project ? { name: project.name } : null,
          tasks: tasks.slice(0, 40).map((task) => ({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            due_at: task.due_at,
            lead_name: task.leads?.business_name || task.leads?.company || task.leads?.name || "",
          })),
          opportunities: leads.slice(0, 40).map((lead) => ({ id: lead.id, name: lead.business_name || lead.name })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The AI suggestions are unavailable right now.");
      setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSuggestions([]);
    setError("");
    void loadSuggestions();
  }, [open, project?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/35 p-3 backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-next-actions-title" onMouseDown={(event) => event.stopPropagation()} className="panel w-full max-w-xl overflow-hidden bg-white">
        <header className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={17} /></span>
            <div>
              <p className="eyebrow">AI next actions</p>
              <h2 id="ai-next-actions-title" className="mt-0.5 text-lg font-extrabold tracking-tight">What should happen next?</h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">{project ? `Based on ${project.name}` : "Based on the tasks currently in view"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close AI next actions" className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100 text-zinc-500"><X size={16} /></button>
        </header>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {loading && <div className="flex min-h-36 items-center justify-center gap-2 text-sm font-semibold text-zinc-500"><Loader2 size={16} className="animate-spin" /> Reviewing tasks…</div>}
          {!loading && suggestions.map((suggestion, index) => {
            return <article key={`${suggestion.title}-${index}`} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700"><Sparkles size={14} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-zinc-900">{suggestion.title}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold capitalize text-zinc-500">{suggestion.priority}</span>
                  </div>
                  {suggestion.description && <p className="mt-1 text-xs leading-5 text-zinc-600">{suggestion.description}</p>}
                  {suggestion.reason && <p className="mt-2 text-[11px] font-semibold leading-4 text-violet-700">Why now: {suggestion.reason}</p>}
                </div>
              </div>
            </article>;
          })}
          {!loading && !error && !suggestions.length && <p className="py-8 text-center text-sm font-medium text-zinc-500">No next actions were suggested. Try again after adding more task context.</p>}
          {error && <div className="flex gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"><CircleAlert size={16} className="shrink-0" />{error}</div>}
        </div>

        <footer className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <button type="button" onClick={loadSuggestions} disabled={loading} className="button-secondary h-9 gap-1.5 px-3 text-xs disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh suggestions</button>
        </footer>
      </section>
    </div>
  );
}
