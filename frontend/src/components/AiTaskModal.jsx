import { useEffect, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function AiTaskModal({ open, onClose, project, tasks = [], leads = [], onCreate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setError("");
    setCreated(false);
  }, [open, project?.id]);

  if (!open) return null;

  const send = async (event) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading || created) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/ai/task-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project ? { name: project.name } : null,
          projectTasks: tasks
            .filter((task) => task.project_id === project?.id)
            .slice(0, 30)
            .map((task) => ({
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              due_at: task.due_at,
              lead_name: task.leads?.business_name || task.leads?.name || "",
            })),
          opportunities: leads.map((lead) => ({ id: lead.id, name: lead.business_name || lead.name })),
          conversation: nextMessages,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The task assistant is unavailable right now.");

      if (body.mode === "question") {
        setMessages([...nextMessages, { role: "assistant", content: body.message }]);
        return;
      }
      const drafts = Array.isArray(body.drafts) ? body.drafts : body.draft ? [body.draft] : [];
      if (body.mode !== "ready" || !drafts.length) throw new Error("The task assistant returned an incomplete task.");

      let createdCount = 0;
      for (const draft of drafts) {
        await onCreate({ ...draft, project_id: project?.id || "" });
        createdCount += 1;
      }
      setMessages([...nextMessages, { role: "assistant", content: body.message || `Created ${createdCount} task${createdCount === 1 ? "" : "s"}.` }]);
      setCreated(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/35 p-3 backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-task-title" onMouseDown={(event) => event.stopPropagation()} className="panel w-full max-w-lg overflow-hidden bg-white">
        <header className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={17} /></span>
            <div>
              <p className="eyebrow">AI task assistant</p>
              <h2 id="ai-task-title" className="mt-0.5 text-lg font-extrabold tracking-tight">Plan a task for {project?.name || "this workspace"}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close AI task assistant" className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100 text-zinc-500"><X size={16} /></button>
        </header>

        <div className="min-h-56 space-y-3 px-5 py-4">
          {messages.length === 0 && (
            <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-5 text-zinc-600">
              Describe what needs doing, or paste a list of up to 10 items. I’ll create each item as a task in this project.
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700"><Bot size={14} /></span>}
              <p className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-5 ${message.role === "user" ? "bg-zinc-950 text-white" : "bg-violet-50 text-zinc-700"}`}>{message.content}</p>
            </div>
          ))}
          {loading && <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500"><Loader2 size={15} className="animate-spin" /> Planning task…</div>}
          {created && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Task created in {project?.name || "the workspace"}.</p>}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        </div>

        {!created && (
          <form onSubmit={send} className="border-t border-zinc-100 p-4">
            <label className="sr-only" htmlFor="ai-task-request">Describe the task</label>
            <div className="flex gap-2">
              <textarea id="ai-task-request" autoFocus value={input} onChange={(event) => setInput(event.target.value)} rows="2" placeholder={messages.length ? "Answer the question…" : "Paste one task or a list of tasks…"} className="control min-h-11 flex-1 resize-none text-sm" />
              <button disabled={!input.trim() || loading} className="button-primary grid h-11 w-11 place-items-center p-0 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send task request"><Send size={16} /></button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
