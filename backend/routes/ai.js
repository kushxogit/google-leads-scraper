const express = require("express");

const router = express.Router();

const CATEGORIES = new Set([
  "meeting",
  "document",
  "proposal",
  "follow_up",
  "development",
  "admin",
]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

router.post("/next-actions", async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({
      error: "AI next-action suggestions are not configured. Add OPENROUTER_API_KEY to the backend environment.",
    });
  }

  const project = sanitizeProject(req.body?.project);
  const tasks = sanitizeProjectTasks(req.body?.tasks);
  const opportunities = sanitizeOpportunities(req.body?.opportunities);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "LeadPilot Next Actions",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        temperature: 0.2,
        max_tokens: 1800,
        messages: [{ role: "system", content: nextActionsPrompt({ project, tasks, opportunities }) }],
      }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.error?.message || "OpenRouter could not suggest next actions.";
      return res.status(response.status >= 500 ? 503 : 502).json({ error: detail });
    }

    const parsed = parseJsonContent(body?.choices?.[0]?.message?.content);
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.slice(0, 4).map((item) => sanitizeSuggestion(item, opportunities)).filter((item) => item.title)
      : [];
    if (!suggestions.length) throw new Error("The AI did not return any actionable suggestions.");
    return res.json({ suggestions });
  } catch (error) {
    console.error("AI next actions failed:", error);
    return res.status(503).json({
      error: error.message || "Unable to suggest next actions right now. Please try again.",
    });
  }
});

router.post("/task-draft", async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({
      error: "AI task planning is not configured. Add OPENROUTER_API_KEY to the backend environment.",
    });
  }

  const conversation = sanitizeConversation(req.body?.conversation);
  if (!conversation.length) {
    return res.status(400).json({ error: "Write a task request first." });
  }

  const project = sanitizeProject(req.body?.project);
  const projectTasks = sanitizeProjectTasks(req.body?.projectTasks);
  const opportunities = sanitizeOpportunities(req.body?.opportunities);
  const hasAssistantTurn = conversation.some((message) => message.role === "assistant");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "LeadPilot Task Assistant",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        temperature: 0.2,
        max_tokens: 2000,
        messages: [
          { role: "system", content: taskAssistantPrompt({ project, projectTasks, opportunities, hasAssistantTurn }) },
          ...conversation,
        ],
      }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.error?.message || "OpenRouter could not plan this task.";
      return res.status(response.status >= 500 ? 503 : 502).json({ error: detail });
    }

    const content = body?.choices?.[0]?.message?.content;
    const parsed = parseJsonContent(content);
    if (!parsed) throw new Error("The AI returned an invalid task plan.");

    if (parsed.mode === "question") {
      return res.json({
        mode: "question",
        message: cleanText(parsed.message, 360) || "What deadline should this task have?",
      });
    }

    if (parsed.mode !== "ready") throw new Error("The AI returned an unknown task plan.");
    const rawDrafts = Array.isArray(parsed.drafts) ? parsed.drafts.slice(0, 10) : [parsed.draft];
    const drafts = rawDrafts
      .map((draft) => sanitizeDraft(draft, opportunities))
      .filter((draft) => draft.title);
    if (!drafts.length) throw new Error("The AI did not provide a task title.");
    return res.json({ mode: "ready", message: cleanText(parsed.message, 240), drafts });
  } catch (error) {
    console.error("AI task draft failed:", error);
    return res.status(503).json({
      error: error.message || "Unable to plan a task right now. Please try again.",
    });
  }
});

function taskAssistantPrompt({ project, projectTasks, opportunities, hasAssistantTurn }) {
  return `You are LeadPilot's task-planning assistant. Turn plain-English work requests into one or more actionable CRM tasks.

Current project: ${project ? project.name : "No project selected"}.
Current project task state:
${projectTasks.length ? projectTasks.map((task, index) => `${index + 1}. [${task.status}] ${task.title}${task.priority ? ` (priority: ${task.priority})` : ""}${task.due_at ? ` (due: ${task.due_at})` : ""}${task.lead_name ? ` (opportunity: ${task.lead_name})` : ""}${task.description ? ` â€” ${task.description}` : ""}`).join("\n") : "No existing tasks in this project."}
Lead association is disabled for this project-planning flow. Create the task in the selected project without a lead.

Return only valid JSON. Do not use markdown or add fields outside this schema:
{"mode":"question"|"ready","message":"short text","drafts":[{"title":"string","description":"string","category":"meeting|document|proposal|follow_up|development|admin","priority":"low|medium|high|urgent","due_at":"ISO 8601 string or null","lead_id":""}]}

The selected project is already confirmed and is always where this task will be created. Never ask the user to confirm, choose, or associate the project. A project task does not need to be linked to an opportunity: never ask which opportunity or lead to associate. When no opportunity is clearly relevant, set lead_id to null/empty and still create the task in the selected project.

Use the current project task state to resolve references such as â€œitâ€, â€œthisâ€, or a named person. If â€œhimâ€ cannot be resolved from the project state, preserve the user's wording in the task title/description instead of asking about a lead.

If the user provides a numbered list, bullet list, or multiple distinct action lines, create one separate draft for each item, preserving their order. Do not merge list items. Return at most 10 drafts. A normal single request must return exactly one draft.

Return mode ready on the first message whenever you can make a useful task draft from the request and the project context. Ask exactly one short question only when an essential detail cannot be inferred from that context. ${hasAssistantTurn ? "The user has already answered one clarification; return a complete draft now." : ""}
Never invent dates, opportunity IDs, commitments, or facts not provided by the user.`;
}

function nextActionsPrompt({ project, tasks, opportunities }) {
  return `You are LeadPilot's pragmatic task coach. Suggest the few highest-value next actions that would move this work forward.

Scope: ${project ? `project â€œ${project.name}â€` : "the current Tasks view"}.
Current tasks:
${tasks.length ? tasks.map((task, index) => `${index + 1}. [${task.status}] ${task.title}${task.priority ? ` (priority: ${task.priority})` : ""}${task.due_at ? ` (due: ${task.due_at})` : ""}${task.lead_name ? ` (opportunity: ${task.lead_name})` : ""}${task.description ? ` â€” ${task.description}` : ""}`).join("\n") : "No tasks yet."}

Return only valid JSON with this schema, no markdown:
{"suggestions":[{"title":"string","description":"string","reason":"short explanation","category":"meeting|document|proposal|follow_up|development|admin","priority":"low|medium|high|urgent","due_at":"ISO 8601 string or null","lead_id":"known ID or empty"}]}

Suggest 2â€“4 specific, independently actionable tasks. Prioritize overdue or blocked work, then work with a clear dependency or customer impact. Do not repeat an existing task, invent deadlines, people, commitments, or lead IDs. If there are no tasks, propose foundational first steps. Keep titles under 90 characters, descriptions under 240 characters, and reasons under 140 characters.`;
}

function sanitizeConversation(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-6)
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: cleanText(message?.content, 2400),
    }))
    .filter((message) => message.content);
}

function sanitizeProject(value) {
  const name = cleanText(value?.name, 180);
  return name ? { name } : null;
}

function sanitizeProjectTasks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((task) => ({
    title: cleanText(task?.title, 240),
    description: cleanText(task?.description, 320),
    status: cleanText(task?.status, 40),
    priority: cleanText(task?.priority, 40),
    due_at: cleanText(task?.due_at, 80),
    lead_name: cleanText(task?.lead_name, 180),
  })).filter((task) => task.title);
}

function sanitizeOpportunities(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((lead) => ({
    id: cleanText(lead?.id, 80),
    name: cleanText(lead?.name, 180),
  })).filter((lead) => lead.id && lead.name);
}

function sanitizeDraft(value, opportunities) {
  const dueAt = cleanText(value?.due_at, 80);
  const validDate = dueAt && !Number.isNaN(new Date(dueAt).getTime()) ? new Date(dueAt).toISOString() : null;
  const leadId = cleanText(value?.lead_id, 80);
  return {
    title: cleanText(value?.title, 240),
    description: cleanText(value?.description, 4000),
    category: CATEGORIES.has(value?.category) ? value.category : "admin",
    priority: PRIORITIES.has(value?.priority) ? value.priority : "medium",
    due_at: validDate,
    lead_id: opportunities.some((lead) => lead.id === leadId) ? leadId : "",
    assignee_ids: [],
  };
}

function sanitizeSuggestion(value, opportunities) {
  return {
    ...sanitizeDraft(value, opportunities),
    reason: cleanText(value?.reason, 180),
  };
}

function parseJsonContent(content) {
  const text = typeof content === "string" ? content.trim() : "";
  const candidate = text.replace(/^```json\s*|^```|```$/g, "").trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
  }
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

router.post("/interaction", async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "Interaction AI is not configured. Add OPENROUTER_API_KEY to the backend environment." });
  }
  const rawNote = cleanText(req.body?.rawNote, 20000);
  if (!rawNote) return res.status(400).json({ error: "Write an interaction note first." });
  const lead = req.body?.lead && typeof req.body.lead === "object" ? {
    name: cleanText(req.body.lead.name, 180),
    company: cleanText(req.body.lead.company, 180),
    status: cleanText(req.body.lead.status, 40),
    service: cleanText(req.body.lead.service, 180),
    paymentStatus: cleanText(req.body.lead.paymentStatus, 40),
  } : {};
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "LeadPilot Interaction Processor" },
      body: JSON.stringify({
        model: "openrouter/free",
        temperature: 0.1,
        max_tokens: 900,
        messages: [{
          role: "system",
          content: `Extract structured CRM suggestions from a free-form client interaction. Current client: ${JSON.stringify(lead)}.
Return only valid JSON using this exact shape:
Confidence is an overall 0-to-1 score for how directly the note supports the extracted fields. Keep it below 0.75 when lifecycle, payment, feedback, or follow-up details are ambiguous.
{"confidence":0.0,"channel":"call|email|whatsapp|meeting|other","summary":"short summary","outcome":"what happened","next_step":"next action","follow_up_date":"YYYY-MM-DD or null","feedback_status":"unchanged|pending|received|not_required","payment_status":"unchanged|not_set|pending|partial|paid|not_applicable","service":"service mentioned or empty","suggested_status":"new|contacted|qualified|proposal|won|lost or null"}
Infer cautiously. Never invent dates, money, commitments, or facts. Use null/empty/unchanged when the note does not support a value. The raw note is the source of truth.`
        }, { role: "user", content: rawNote }],
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return res.status(response.status >= 500 ? 503 : 502).json({ error: body?.error?.message || "OpenRouter could not process this interaction." });
    const parsed = parseJsonContent(body?.choices?.[0]?.message?.content);
    if (!parsed) throw new Error("The AI returned an invalid interaction summary.");
    const feedback = new Set(["unchanged", "pending", "received", "not_required"]);
    const payment = new Set(["unchanged", "not_set", "pending", "partial", "paid", "not_applicable"]);
    const statuses = new Set(["new", "contacted", "qualified", "proposal", "won", "lost"]);
    const confidence = Number(parsed.confidence);
    const followUp = cleanText(parsed.follow_up_date, 30);
    return res.json({ structured: {
      ai_confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
      channel: ["call", "email", "whatsapp", "meeting", "other"].includes(parsed.channel) ? parsed.channel : "other",
      summary: cleanText(parsed.summary, 600),
      outcome: cleanText(parsed.outcome, 600),
      next_step: cleanText(parsed.next_step, 600),
      follow_up_date: /^\d{4}-\d{2}-\d{2}$/.test(followUp) ? followUp : null,
      feedback_status: feedback.has(parsed.feedback_status) ? parsed.feedback_status : "unchanged",
      payment_status: payment.has(parsed.payment_status) ? parsed.payment_status : "unchanged",
      service: cleanText(parsed.service, 180),
      suggested_status: statuses.has(parsed.suggested_status) ? parsed.suggested_status : null,
    }});
  } catch (error) {
    console.error("AI interaction processing failed:", error);
    return res.status(503).json({ error: error.message || "Unable to process this interaction right now." });
  }
});


module.exports = router;
