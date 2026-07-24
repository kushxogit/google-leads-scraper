import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CheckSquare2,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  Link2,
  Mail,
  MessageCircle,
  Paperclip,
  Send,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  addLeadNote,
  PIPELINE_STATUSES,
  trackWhatsAppClick,
  useLeadDetail,
  useWorkspaceLeads,
} from "../hooks/useCrm";
import { useAuthWorkspace } from "../context/authWorkspace";
import TaskModal from "../components/TaskModal";
import { TASK_CATEGORIES, useWorkspaceTasks } from "../hooks/useTasks";
import { useFeedback } from "../context/feedback";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeWorkspaceId } = useAuthWorkspace();
  const { lead, notes, activity, members } = useLeadDetail(id);
  const { updateLead, deleteLead } = useWorkspaceLeads();
  const taskApi = useWorkspaceTasks();
  const { notify, confirm } = useFeedback();
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEditing, setTaskEditing] = useState(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [outreachTab, setOutreachTab] = useState("email");
  const [emailDraft, setEmailDraft] = useState({ to: "", subject: "", body: "" });
  const [whatsAppDraft, setWhatsAppDraft] = useState({ phone: "", body: "" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const current = lead.data;
  const leadTasks = taskApi.tasks.filter((task) => task.lead_id === id);
  const openLeadTasks = leadTasks
    .filter((task) => !["done", "cancelled"].includes(task.status))
    .sort(taskOrder);
  const completedLeadTasks = leadTasks
    .filter((task) => task.status === "done")
    .sort(taskOrder);
  const nextTask = openLeadTasks[0];
  const suggestedTask = current
    ? {
        new: {
          title: `Research and contact ${current.business_name}`,
          category: "follow_up",
        },
        contacted: {
          title: `Schedule discovery call with ${current.business_name}`,
          category: "meeting",
        },
        qualified: {
          title: `Prepare proposal for ${current.business_name}`,
          category: "proposal",
        },
        proposal: {
          title: `Follow up on proposal with ${current.business_name}`,
          category: "follow_up",
        },
        won: {
          title: `Plan delivery kickoff for ${current.business_name}`,
          category: "development",
        },
        lost: {
          title: `Review lost opportunity: ${current.business_name}`,
          category: "admin",
        },
      }[current.status]
    : {};
  const loadAttachments = useCallback(async () => {
    const { data } = await supabase
      .from("lead_attachments")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });
    setAttachments(data ?? []);
  }, [id]);
  useEffect(() => {
    if (id) loadAttachments();
  }, [id, loadAttachments]);
  if (lead.isLoading)
    return <div className="panel p-8 text-zinc-500">Opening opportunity…</div>;
  if (!current)
    return (
      <div className="panel p-8 text-rose-500">
        This opportunity is unavailable.
      </div>
    );
  const renderMessage = (value) => (value || "").replaceAll("{{name}}", current.business_name || "there").replaceAll("{{company}}", current.company || current.business_name || "your business");
  const preview = outreachTab === "email" ? { type: "Email", target: emailDraft.to || current.email, subject: emailDraft.subject, body: renderMessage(emailDraft.body) } : { type: "WhatsApp", target: whatsAppDraft.phone || current.phone, body: renderMessage(whatsAppDraft.body) };
  const update = async (changes) => {
    try {
      await updateLead(id, changes);
      await lead.refetch();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const openNewTask = () => {
    setTaskEditing(null);
    setTaskOpen(true);
  };
  const openTaskEditor = (task) => {
    setTaskEditing(task);
    setTaskOpen(true);
  };
  const saveTask = (values) =>
    taskEditing
      ? taskApi.updateTask(taskEditing.id, values)
      : taskApi.createTask(values);
  const submitNote = async (event) => {
    event.preventDefault();
    if (!note.trim()) return;
    try {
      await addLeadNote({
        leadId: id,
        workspaceId: activeWorkspaceId,
        authorId: user.id,
        body: note.trim(),
      });
      setNote("");
      await notes.refetch();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const sendOutreach = async () => {
    if (outreachTab === "email") window.location.href = `mailto:${preview.target}?subject=${encodeURIComponent(preview.subject)}&body=${encodeURIComponent(preview.body)}`;
    else { await trackWhatsAppClick(id); window.open(`https://wa.me/${String(preview.target || "").replace(/\D/g, "")}?text=${encodeURIComponent(preview.body)}`, "_blank", "noopener,noreferrer"); }
    setPreviewOpen(false);
    notify(`${preview.type} is ready to send.`);
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 10 * 1024 * 1024
    )
      return notify("Use a PDF, JPG, PNG, or WebP under 10 MB.", "error");
    setUploading(true);
    const path = `${activeWorkspaceId}/${id}/${crypto.randomUUID()}-${file.name}`;
    try {
      const { error: fileError } = await supabase.storage
        .from("lead-attachments")
        .upload(path, file, { contentType: file.type });
      if (fileError) throw fileError;
      const { error: metadataError } = await supabase
        .from("lead_attachments")
        .insert({
          lead_id: id,
          workspace_id: activeWorkspaceId,
          uploaded_by: user.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
      if (metadataError) throw metadataError;
      await loadAttachments();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setUploading(false);
    }
  };
  const remove = async (file) => {
    if (
      !(await confirm({
        title: "Delete this attachment?",
        description: file.file_name,
        confirmLabel: "Delete file",
        danger: true,
      }))
    )
      return;
    const { error } = await supabase
      .from("lead_attachments")
      .delete()
      .eq("id", file.id);
    if (error) return notify(error.message, "error");
    await supabase.storage.from("lead-attachments").remove([file.storage_path]);
    await loadAttachments();
  };
  const download = async (file) => {
    const { data, error } = await supabase.storage
      .from("lead-attachments")
      .createSignedUrl(file.storage_path, 60);
    if (error) return notify(error.message, "error");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="mx-auto max-w-[1320px] space-y-5 pb-8">
      <Link
        to="/leads"
        className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-950"
      >
        <ArrowLeft size={16} /> Back to pipeline
      </Link>
      <section className="relative overflow-hidden rounded-[30px] bg-[#171719] p-6 text-white shadow-[0_20px_45px_rgba(50,35,105,.18)] sm:p-8">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-violet-500/70 blur-[70px]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200">
              Opportunity profile
            </p>
            <h1 className="mt-3 truncate text-3xl font-extrabold tracking-[-.06em] sm:text-5xl">
              {current.business_name}
            </h1>
            <p className="mt-3 text-sm text-zinc-300">
              {[current.niche, current.area, current.company]
                .filter(Boolean)
                .join(" · ") || "A new opportunity"}
            </p>
            {isExternalUrl(current.source_url) && (
              <a
                href={current.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-violet-200 transition hover:text-white"
              >
                Open Google Maps profile <ExternalLink size={15} />
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openNewTask}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[.18] bg-white/[.1] px-4 py-2.5 text-sm font-extrabold sm:flex-none"
            >
              <CheckSquare2 size={16} /> Add task
            </button>
            <select
              value={current.status}
              onChange={(e) => update({ status: e.target.value })}
              className="min-w-0 flex-1 rounded-2xl border border-white/[.15] bg-white/[.1] px-3 py-2.5 text-sm font-bold text-white outline-none sm:flex-none"
            >
              <option className="text-zinc-900">{current.status}</option>
              {PIPELINE_STATUSES.filter((s) => s !== current.status).map(
                (status) => (
                  <option className="text-zinc-900" key={status}>
                    {status}
                  </option>
                ),
              )}
            </select>
            <button
              onClick={async () => {
                if (
                  await confirm({
                    title: "Delete this opportunity?",
                    description:
                      "Its notes, tasks, attachments, and activity will also be removed.",
                    confirmLabel: "Delete opportunity",
                    danger: true,
                  })
                ) {
                  await deleteLead(id);
                  navigate("/leads");
                }
              }}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[.15] text-rose-200 hover:bg-white/[.1]"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <main className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <p className="eyebrow">Contact essentials</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Everything in one quiet place.
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                value={current.email}
                onBlur={(value) => update({ email: value })}
              />
              <Field
                label="Phone"
                value={current.phone}
                onBlur={(value) => update({ phone: value })}
              />
              <Field
                label="Website"
                value={current.website}
                onBlur={(value) => update({ website: value })}
              />
              <Field
                label="Source"
                value={current.source}
                onBlur={(value) => update({ source: value })}
              />
            </div>
          </section>
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">Connected work</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  Tasks and next actions
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Everything planned for this opportunity, in one place.
                </p>
              </div>
              <button onClick={openNewTask} className="button-primary shrink-0">
                <CheckSquare2 size={16} /> Add task
              </button>
            </div>
            {nextTask && (
              <Link
                to={`/rewind?task=${nextTask.id}`}
                className="mt-5 flex items-center gap-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 transition hover:border-violet-200"
              >
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${TASK_CATEGORIES[nextTask.category]?.dot}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-violet-500">
                    Next action
                  </p>
                  <p className="mt-1 truncate text-sm font-extrabold text-zinc-900">
                    {nextTask.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {taskTiming(nextTask)}
                  </p>
                </div>
                <ChevronRight size={17} className="text-violet-400" />
              </Link>
            )}
            <div className="mt-5 space-y-2">
              {openLeadTasks.map((task) => (
                <LeadTaskRow
                  key={task.id}
                  task={task}
                  members={taskApi.members}
                  onComplete={() =>
                    taskApi.updateTask(task.id, { status: "done" })
                  }
                  onEdit={() => openTaskEditor(task)}
                />
              ))}
              {!openLeadTasks.length && (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-7 text-center">
                  <CheckCircle2
                    className="mx-auto text-emerald-500"
                    size={22}
                  />
                  <p className="mt-3 text-sm font-extrabold">
                    No open work for this lead.
                  </p>
                  <button
                    onClick={openNewTask}
                    className="mt-2 text-xs font-bold text-violet-600"
                  >
                    Create the suggested next action
                  </button>
                </div>
              )}
            </div>
            {completedLeadTasks.length > 0 && (
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <button
                  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                  className="flex w-full items-center justify-between text-xs font-extrabold text-zinc-500"
                >
                  <span>
                    {completedLeadTasks.length} completed task
                    {completedLeadTasks.length === 1 ? "" : "s"}
                  </span>
                  <ChevronRight
                    size={15}
                    className={`transition ${showCompletedTasks ? "rotate-90" : ""}`}
                  />
                </button>
                {showCompletedTasks && (
                  <div className="mt-3 space-y-2">
                    {completedLeadTasks.map((task) => (
                      <LeadTaskRow
                        key={task.id}
                        task={task}
                        members={taskApi.members}
                        completed
                        onComplete={() =>
                          taskApi.updateTask(task.id, { status: "planned" })
                        }
                        onEdit={() => openTaskEditor(task)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Files</p>
                <h2 className="mt-1 text-xl font-extrabold">
                  Shared attachments
                </h2>
              </div>
              <label className="button-secondary cursor-pointer">
                <Paperclip size={15} />
                {uploading ? "Uploading…" : "Attach"}
                <input
                  type="file"
                  disabled={uploading}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={upload}
                />
              </label>
            </div>
            <div className="mt-5 space-y-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white/55 p-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-600">
                    <Link2 size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {file.file_name}
                  </span>
                  <button
                    onClick={() => download(file)}
                    className="text-zinc-500 hover:text-violet-600"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => remove(file)}
                    className="text-zinc-400 hover:text-rose-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!attachments.length && (
                <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
                  Nothing attached yet.
                </p>
              )}
            </div>
          </section>
        </main>
        <aside className="space-y-5">
          <OutreachCenter tab={outreachTab} onTabChange={setOutreachTab} email={emailDraft} onEmailChange={setEmailDraft} whatsapp={whatsAppDraft} onWhatsAppChange={setWhatsAppDraft} lead={current} onPreview={() => setPreviewOpen(true)} />
          <section className="panel p-5">
            <p className="eyebrow">Ownership</p>
            <h2 className="mt-1 text-lg font-extrabold">Keep it moving</h2>
            <label className="mt-5 block text-xs font-bold uppercase tracking-[.12em] text-zinc-400">
              Owner
              <select
                value={current.assigned_to ?? ""}
                onChange={(e) =>
                  update({ assigned_to: e.target.value || null })
                }
                className="control mt-2 w-full normal-case tracking-normal"
              >
                <option value="">Unassigned</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="panel p-5">
            <p className="eyebrow">Shared context</p>
            <h2 className="mt-1 text-lg font-extrabold">Notes</h2>
            <form onSubmit={submitNote} className="mt-4 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Leave an update"
                className="control min-w-0 flex-1"
              />
              <button className="grid h-10 w-10 place-items-center rounded-2xl liquid-button text-white">
                <Send size={15} />
              </button>
            </form>
            <div className="mt-5 max-h-56 space-y-4 overflow-y-auto">
              {(notes.data ?? []).map((item) => (
                <div
                  key={item.id}
                  className="border-l-2 border-violet-300 pl-3"
                >
                  <p className="text-sm font-medium text-zinc-700">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {!notes.data?.length && (
                <p className="text-sm text-zinc-400">No updates yet.</p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <p className="eyebrow">Signal trail</p>
            <h2 className="mt-1 text-lg font-extrabold">Activity</h2>
            <div className="mt-5 max-h-52 space-y-4 overflow-y-auto">
              {(activity.data ?? []).map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                  <div>
                    <p className="text-sm font-bold capitalize text-zinc-700">
                      {item.event_type.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {!activity.data?.length && (
                <p className="text-sm text-zinc-400">No activity yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
      <TaskModal
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setTaskEditing(null);
        }}
        onSave={saveTask}
        members={taskApi.members}
        defaultOwnerId={taskApi.currentUserId}
        leads={[current]}
        initialLeadId={id}
        initialValues={suggestedTask}
        task={taskEditing}
      />
      {previewOpen && <OutreachPreview preview={preview} leadName={current.business_name} onClose={() => setPreviewOpen(false)} onConfirm={sendOutreach} />}
    </div>
  );
}
function OutreachCenter({ tab, onTabChange, email, onEmailChange, whatsapp, onWhatsAppChange, lead, onPreview }) {
  const emailReady = Boolean((email.to || lead.email) && email.subject && email.body);
  const whatsappReady = Boolean((whatsapp.phone || lead.phone) && whatsapp.body);
  return <section className="panel overflow-hidden p-0"><div className="border-b border-zinc-100 p-5"><p className="eyebrow">Outreach center</p><h2 className="mt-1 text-lg font-extrabold">Prepare, review, then send</h2><p className="mt-1 text-xs text-zinc-500">Nothing is sent until you review the final message.</p></div><div className="grid grid-cols-2 bg-zinc-100 p-1"><button onClick={() => onTabChange("email")} className={`rounded-xl px-2 py-2 text-xs font-extrabold ${tab === "email" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500"}`}><Mail className="mr-1 inline" size={14} /> Send Email</button><button onClick={() => onTabChange("whatsapp")} className={`rounded-xl px-2 py-2 text-xs font-extrabold ${tab === "whatsapp" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500"}`}><MessageCircle className="mr-1 inline" size={14} /> Send WhatsApp</button></div><div className="space-y-3 p-5">{tab === "email" ? <><label className="text-xs font-bold text-zinc-600">To<input value={email.to || lead.email || ""} onChange={(event) => onEmailChange({ ...email, to: event.target.value })} className="control mt-1 w-full" placeholder="name@example.com" /></label><label className="text-xs font-bold text-zinc-600">Subject<input value={email.subject} onChange={(event) => onEmailChange({ ...email, subject: event.target.value })} className="control mt-1 w-full" placeholder="Follow up on your inquiry" /></label><label className="text-xs font-bold text-zinc-600">Message<textarea rows="6" value={email.body} onChange={(event) => onEmailChange({ ...email, body: event.target.value })} className="control mt-1 w-full resize-none" placeholder="Hi {{name}}," /></label></> : <><label className="text-xs font-bold text-zinc-600">Phone number<input value={whatsapp.phone || lead.phone || ""} onChange={(event) => onWhatsAppChange({ ...whatsapp, phone: event.target.value })} className="control mt-1 w-full" placeholder="+1 555 019 2834" /></label><label className="text-xs font-bold text-zinc-600">Message<textarea rows="7" value={whatsapp.body} onChange={(event) => onWhatsAppChange({ ...whatsapp, body: event.target.value })} className="control mt-1 w-full resize-none" placeholder="Hi {{name}}," /></label></>}<button onClick={onPreview} disabled={tab === "email" ? !emailReady : !whatsappReady} className="button-primary w-full justify-center disabled:opacity-40">Preview before send</button></div></section>;
}
function OutreachPreview({ preview, leadName, onClose, onConfirm }) { return <div className="fixed inset-0 z-[90] grid place-items-center bg-zinc-950/50 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="panel w-full max-w-xl p-6"><p className="eyebrow">Final review</p><h2 className="mt-1 text-2xl font-extrabold">Review your message to {leadName}</h2><div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-violet-600">{preview.type}: {preview.target}</p>{preview.subject && <p className="mt-3 text-sm font-extrabold text-zinc-900">{preview.subject}</p>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{preview.body}</p></div><p className="mt-3 text-xs text-zinc-500">Template tags have been replaced. You can still go back and edit.</p><footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onClose} className="button-secondary justify-center">Go back & edit</button><button onClick={onConfirm} className="button-primary justify-center">Confirm & send now</button></footer></section></div>; }
function LeadTaskRow({ task, members, completed, onComplete, onEdit }) {
  const category =
    TASK_CATEGORIES[task.category] ?? TASK_CATEGORIES.development;
  const owners = task.assignee_ids
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean);
  return (
    <div
      className={`group flex items-center gap-3 rounded-2xl border p-3 ${completed ? "border-zinc-100 bg-zinc-50/60 opacity-70" : "border-zinc-100 bg-white/70"}`}
    >
      <button
        onClick={onComplete}
        aria-label={
          completed ? `Reopen ${task.title}` : `Complete ${task.title}`
        }
        className={
          completed
            ? "text-emerald-500"
            : "text-zinc-300 hover:text-emerald-500"
        }
      >
        {completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${category.dot}`} />
          <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
            {category.label}
          </span>
        </div>
        <p
          className={`mt-1 truncate text-sm font-extrabold ${completed ? "line-through text-zinc-500" : "text-zinc-800"}`}
        >
          {task.title}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
          <CalendarClock size={12} />
          {taskTiming(task)}
        </p>
      </button>
      <div className="flex -space-x-1">
        {owners.map((owner) => (
          <span
            key={owner.id}
            title={owner.full_name || owner.email}
            className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-violet-100 text-[9px] font-extrabold text-violet-700"
          >
            {(owner.full_name || owner.email)[0].toUpperCase()}
          </span>
        ))}
      </div>
      <Link
        to={`/rewind?task=${task.id}`}
        aria-label={`Open ${task.title} in Rewind`}
        className="grid h-8 w-8 place-items-center rounded-xl text-zinc-300 hover:bg-violet-50 hover:text-violet-600"
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
function taskTiming(task) {
  if (task.scheduled_start)
    return new Date(task.scheduled_start).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  if (task.due_at)
    return `Due ${new Date(task.due_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  return "Unplanned";
}
function taskOrder(a, b) {
  const aTime = a.scheduled_start || a.due_at || "9999";
  const bTime = b.scheduled_start || b.due_at || "9999";
  return String(aTime).localeCompare(String(bTime));
}
function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
function Field({ label, value, onBlur }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <label className="text-xs font-extrabold uppercase tracking-[.12em] text-zinc-400">
      {label}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== (value ?? "") && onBlur(draft)}
        className="control mt-2 w-full normal-case tracking-normal"
      />
    </label>
  );
}
