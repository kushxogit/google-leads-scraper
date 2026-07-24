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
  Globe2,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Paperclip,
  Phone,
  Send,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  addLeadNote,
  PIPELINE_STATUSES,
  trackOutreachDraft,
  useLeadDetail,
  useWorkspaceLeadTags,
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
  const { lead, notes, timeline, members } = useLeadDetail(id);
  const { updateLead, deleteLead } = useWorkspaceLeads();
  const taskApi = useWorkspaceTasks();
  const tagApi = useWorkspaceLeadTags();
  const { notify, confirm } = useFeedback();
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEditing, setTaskEditing] = useState(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [outreachTab, setOutreachTab] = useState("whatsapp");
  const [emailDraft, setEmailDraft] = useState({ to: "", subject: "", body: "" });
  const [whatsAppDraft, setWhatsAppDraft] = useState({ phone: "", body: "" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const taskOrder = (a, b) => new Date(a.due_date) - new Date(b.due_date);
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

  useEffect(() => {
    if (current) {
      const bName = current.business_name || "there";
      const niche = current.niche || "business";
      const area = current.area ? ` in ${current.area}` : "";
      const ratingStr = current.rating ? ` with a ${current.rating}★ rating` : "";

      setWhatsAppDraft({
        phone: current.phone || "",
        body: `Hi ${bName}! 👋 I noticed your ${niche} business${area}${ratingStr}. We help local ${niche} businesses get 3x more phone calls and client inquiries from Google Maps.\n\nWould you be open to a quick 2-minute demo of how it works for ${bName}?`,
      });

      setEmailDraft({
        to: current.email || "",
        subject: `Growth & Client Inquiry System for ${bName}`,
        body: `Hi ${bName},\n\nI hope you are having a great week!\n\nI was looking at top-rated ${niche} businesses${area} and came across ${bName}${ratingStr}.\n\nWe specialize in building high-converting local lead systems for ${niche}s that consistently double monthly customer bookings. I'd love to share 3 quick ideas tailored specifically for ${bName}.\n\nWould you have 5 minutes for a quick call this week?\n\nBest regards,\nGrowth Team`,
      });
    }
  }, [current?.id]);
  if (lead.isLoading)
    return <div className="panel p-8 text-zinc-500">Opening opportunity…</div>;
  if (!current)
    return (
      <div className="panel p-8 text-rose-500">
        This opportunity is unavailable.
      </div>
    );
  const leadTagIds = tagApi.tags
    .filter((tag) => tag.lead_ids.includes(id))
    .map((tag) => tag.id);
  const toggleTag = async (tagId) => {
    setTagBusy(true);
    try {
      await tagApi.setLeadTags(
        id,
        leadTagIds.includes(tagId)
          ? leadTagIds.filter((item) => item !== tagId)
          : [...leadTagIds, tagId],
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setTagBusy(false);
    }
  };
  const addTag = async (event) => {
    event.preventDefault();
    if (!newTag.trim()) return;
    setTagBusy(true);
    try {
      const tag = await tagApi.createTag({ name: newTag });
      await tagApi.setLeadTags(id, [...leadTagIds, tag.id]);
      setNewTag("");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setTagBusy(false);
    }
  };
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
    try {
      await trackOutreachDraft(id, outreachTab);
      await timeline.refetch();
    } catch {
      notify("Your draft opened, but its activity could not be recorded.", "error");
    }
    if (outreachTab === "email") window.location.href = `mailto:${preview.target}?subject=${encodeURIComponent(preview.subject)}&body=${encodeURIComponent(preview.body)}`;
    else window.open(`https://wa.me/${String(preview.target || "").replace(/\D/g, "")}?text=${encodeURIComponent(preview.body)}`, "_blank", "noopener,noreferrer");
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
        className="inline-flex items-center gap-2 text-xs font-extrabold text-zinc-500 hover:text-zinc-950 transition"
      >
        <ArrowLeft size={15} /> Back to pipeline
      </Link>

      {/* Revamped Light & Elegant Header Card */}
      <section className="relative overflow-hidden rounded-[28px] border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full bg-violet-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 border border-violet-100/80">
              Opportunity Profile
            </span>
            <h1 className="mt-2 truncate text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
              {current.business_name}
            </h1>
            <p className="mt-2 text-xs font-bold text-zinc-500 flex flex-wrap items-center gap-2">
              <span>{[current.niche, current.area, current.company].filter(Boolean).join(" · ") || "Prospect"}</span>
              {current.rating && (
                <span className="inline-flex items-center gap-0.5 font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/50">
                  ⭐ {current.rating} {current.reviews ? `(${current.reviews} reviews)` : ""}
                </span>
              )}
            </p>
            {isExternalUrl(current.source_url) && (
              <a
                href={current.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-violet-600 transition hover:text-violet-800"
              >
                Open Google Maps profile <ExternalLink size={13} />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={openNewTask}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-700 transition shadow-2xs"
            >
              <CheckSquare2 size={15} /> Add Task
            </button>

            <select
              value={current.status}
              onChange={(e) => update({ status: e.target.value })}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-extrabold text-zinc-800 outline-none hover:bg-zinc-100 cursor-pointer"
            >
              {PIPELINE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  Stage: {status.toUpperCase()}
                </option>
              ))}
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
              className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
              title="Delete opportunity"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <main className="space-y-5">
          {/* 1-Tap Quick Action & Contact Essentials Banner */}
          <section className="rounded-[24px] border border-zinc-200/90 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                  Direct Communication
                </span>
                <h2 className="mt-1 text-xl font-black text-zinc-950">
                  1-Tap Lead Outreach & Contact Info
                </h2>
              </div>
              <span className="mono rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800 border border-violet-200">
                ⚡ Score {current.score || 85}
              </span>
            </div>

            {/* Quick Contact Action Pills Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Phone Dial Pill */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Phone Number
                  </p>
                  <p className="text-sm font-black text-emerald-950 truncate mt-0.5">
                    {current.phone && !/^n\/?a$/i.test(current.phone.trim()) ? current.phone : "No Phone Available"}
                  </p>
                </div>

                {current.phone && !/^n\/?a$/i.test(current.phone.trim()) && (
                  <a
                    href={`tel:${current.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 transition shadow-2xs shrink-0"
                  >
                    <Phone size={13} /> Call
                  </a>
                )}
              </div>

              {/* Email Pill */}
              <div className="rounded-2xl border border-violet-200/80 bg-violet-50/60 p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-800">
                    Email Address
                  </p>
                  <p className="text-sm font-black text-violet-950 truncate mt-0.5">
                    {current.email && !/^n\/?a$/i.test(current.email.trim()) ? current.email : "No Email Available"}
                  </p>
                </div>

                {current.email && !/^n\/?a$/i.test(current.email.trim()) && (
                  <a
                    href={`mailto:${current.email}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-700 transition shadow-2xs shrink-0"
                  >
                    <Mail size={13} /> Email
                  </a>
                )}
              </div>

              {/* Website Pill */}
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800">
                    Website URL
                  </p>
                  <p className="text-sm font-black text-sky-950 truncate mt-0.5">
                    {current.website && !/^n\/?a$/i.test(current.website.trim()) ? current.website.replace(/^https?:\/\//, '') : "No Website Listed"}
                  </p>
                </div>

                {current.website && !/^n\/?a$/i.test(current.website.trim()) && (
                  <a
                    href={isExternalUrl(current.website) ? current.website : `https://${current.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white hover:bg-sky-700 transition shadow-2xs shrink-0"
                  >
                    <Globe2 size={13} /> Visit
                  </a>
                )}
              </div>

              {/* Location Pill */}
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                    Location & Area
                  </p>
                  <p className="text-sm font-black text-amber-950 truncate mt-0.5">
                    {[current.niche, current.area].filter(Boolean).join(" · ") || "Location Unspecified"}
                  </p>
                </div>

                {isExternalUrl(current.source_url) && (
                  <a
                    href={current.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-700 transition shadow-2xs shrink-0"
                  >
                    <MapPin size={13} /> Maps
                  </a>
                )}
              </div>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
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
          <OutreachCenter
            tab={outreachTab}
            onTabChange={setOutreachTab}
            email={emailDraft}
            onEmailChange={setEmailDraft}
            whatsapp={whatsAppDraft}
            onWhatsAppChange={setWhatsAppDraft}
            lead={current}
            onPreview={() => setPreviewOpen(true)}
          />
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-violet-600" />
              <div>
                <p className="eyebrow">Organize</p>
                <h2 className="mt-0.5 text-lg font-extrabold">Tags</h2>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tagApi.tags.map((tag) => {
                const active = leadTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={tagBusy}
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${active ? "border-violet-200 bg-violet-100 text-violet-800" : "border-zinc-200 bg-white text-zinc-500 hover:border-violet-200"}`}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {!tagApi.tags.length && (
                <p className="text-xs text-zinc-400">Add a tag to group opportunities across the pipeline.</p>
              )}
            </div>
            <form onSubmit={addTag} className="mt-4 flex gap-2">
              <input
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                className="control min-w-0 flex-1 py-2"
                placeholder="New tag"
                maxLength="40"
              />
              <button disabled={tagBusy} className="button-secondary px-3">Add</button>
            </form>
          </section>
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
            <h2 className="mt-1 text-lg font-extrabold">Timeline</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Lead changes, outreach drafts, and linked task activity in one place.
            </p>
            <div className="mt-5 max-h-52 space-y-4 overflow-y-auto">
              {(timeline.data ?? []).map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                  <div>
                    <p className="text-sm font-bold capitalize text-zinc-700">
                      {timelineLabel(item)}
                    </p>
                    {item.details?.task_title && (
                      <p className="mt-0.5 text-xs text-zinc-500">{item.details.task_title}</p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {!timeline.data?.length && (
                <p className="text-sm text-zinc-400">No timeline activity yet.</p>
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
function OutreachCenter({
  tab,
  onTabChange,
  email,
  onEmailChange,
  whatsapp,
  onWhatsAppChange,
  lead,
  onPreview,
}) {
  const whatsappReady = Boolean((whatsapp.phone || lead.phone) && whatsapp.body);
  const emailReady = Boolean((email.to || lead.email) && email.subject && email.body);

  const applyPitchAngle = (angle) => {
    const bName = lead.business_name || "there";
    const niche = lead.niche || "business";
    const area = lead.area ? ` in ${lead.area}` : "";
    const ratingStr = lead.rating ? ` with ${lead.rating}★ rating` : "";

    if (tab === "whatsapp") {
      let text = "";
      if (angle === "reviews") {
        text = `Hi ${bName}! 🌟 Saw your ${ratingStr}${area}. We help top ${niche}s get 50+ new 5-star Google reviews monthly automatically. Open to seeing how it works?`;
      } else if (angle === "leads") {
        text = `Hi ${bName}! 👋 Are you accepting new ${niche} clients${area} right now? We generate 20+ verified local inquiries weekly. Can I send a 1-min quick breakdown?`;
      } else {
        text = `Hi ${bName}! 👋 I noticed your ${niche} business${area}. We help local ${niche}s get 3x more phone calls & inquiries from Google Maps. Open to a 2-min demo?`;
      }
      onWhatsAppChange({ ...whatsapp, body: text });
    } else {
      let bodyText = "";
      let subjectText = "";
      if (angle === "reviews") {
        subjectText = `Automated 5-Star Reviews System for ${bName}`;
        bodyText = `Hi ${bName},\n\nCongrats on your ${ratingStr}${area}!\n\nWe built an automated system that turns happy customers into 5-star Google reviews for ${niche} businesses.\n\nWould you be open to a 3-min quick preview?\n\nBest,\nGrowth Team`;
      } else {
        subjectText = `Growth & Client Inquiry System for ${bName}`;
        bodyText = `Hi ${bName},\n\nI hope you are having a great week!\n\nI was looking at top-rated ${niche} businesses${area} and came across ${bName}.\n\nWe specialize in building high-converting local lead systems for ${niche}s that consistently double monthly customer bookings. I'd love to share 3 quick ideas tailored specifically for ${bName}.\n\nWould you have 5 minutes for a quick call this week?\n\nBest regards,\nGrowth Team`;
      }
      onEmailChange({ ...email, subject: subjectText, body: bodyText });
    }
  };

  return (
    <section className="panel overflow-hidden p-0 border border-zinc-200/90 rounded-2xl bg-white shadow-2xs">
      {/* Header & Tab Switcher (WhatsApp Primary) */}
      <div className="border-b border-zinc-100 p-5 pb-4">
        <div className="flex items-center justify-between">
          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 border border-emerald-200/60">
            Outreach Suite
          </span>
          <span className="text-[10px] font-bold text-zinc-400">Auto-Populated AI Script</span>
        </div>
        <h2 className="mt-1 text-lg font-black text-zinc-950">Intelligent Outreach Center</h2>
      </div>

      {/* Tab Selector: WhatsApp Primary vs Email Secondary */}
      <div className="grid grid-cols-2 bg-zinc-100/80 p-1 border-b border-zinc-100">
        <button
          type="button"
          onClick={() => onTabChange("whatsapp")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition ${
            tab === "whatsapp"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60"
          }`}
        >
          <MessageCircle size={14} /> WhatsApp (Primary)
        </button>

        <button
          type="button"
          onClick={() => onTabChange("email")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition ${
            tab === "email"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60"
          }`}
        >
          <Mail size={14} /> Email (Secondary)
        </button>
      </div>

      <div className="space-y-3.5 p-5">
        {/* Quick Pitch Remixers */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
            Auto Script Pitch Angle
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPitchAngle("default")}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-700 hover:bg-violet-50 hover:border-violet-200 transition"
            >
              🚀 Local Growth Demo
            </button>
            <button
              type="button"
              onClick={() => applyPitchAngle("reviews")}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-700 hover:bg-amber-50 hover:border-amber-200 transition"
            >
              ⭐ Review Boost
            </button>
            <button
              type="button"
              onClick={() => applyPitchAngle("leads")}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-700 hover:bg-emerald-50 hover:border-emerald-200 transition"
            >
              🎯 Direct Inquiries
            </button>
          </div>
        </div>

        {tab === "whatsapp" ? (
          <>
            <label className="text-xs font-bold text-zinc-700 block">
              WhatsApp Phone Number
              <input
                value={whatsapp.phone || lead.phone || ""}
                onChange={(event) => onWhatsAppChange({ ...whatsapp, phone: event.target.value })}
                className="control mt-1 w-full text-xs font-semibold"
                placeholder="+91 98765 43210"
              />
            </label>

            <label className="text-xs font-bold text-zinc-700 block">
              Auto-Populated WhatsApp Message
              <textarea
                rows={6}
                value={whatsapp.body}
                onChange={(event) => onWhatsAppChange({ ...whatsapp, body: event.target.value })}
                className="control mt-1 w-full text-xs font-semibold resize-none"
                placeholder="Script auto-populates here..."
              />
            </label>

            <button
              type="button"
              onClick={onPreview}
              disabled={!whatsappReady}
              className="button-primary w-full justify-center text-xs font-black py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 shadow-xs gap-2"
            >
              <MessageCircle size={15} /> Launch WhatsApp Outreach
            </button>
          </>
        ) : (
          <>
            <label className="text-xs font-bold text-zinc-700 block">
              To Address
              <input
                value={email.to || lead.email || ""}
                onChange={(event) => onEmailChange({ ...email, to: event.target.value })}
                className="control mt-1 w-full text-xs font-semibold"
                placeholder="name@example.com"
              />
            </label>

            <label className="text-xs font-bold text-zinc-700 block">
              Subject Line
              <input
                value={email.subject}
                onChange={(event) => onEmailChange({ ...email, subject: event.target.value })}
                className="control mt-1 w-full text-xs font-semibold"
                placeholder="Follow up on your inquiry"
              />
            </label>

            <label className="text-xs font-bold text-zinc-700 block">
              Auto-Populated Email Message
              <textarea
                rows={6}
                value={email.body}
                onChange={(event) => onEmailChange({ ...email, body: event.target.value })}
                className="control mt-1 w-full text-xs font-semibold resize-none"
                placeholder="Email body auto-populates here..."
              />
            </label>

            <button
              type="button"
              onClick={onPreview}
              disabled={!emailReady}
              className="button-primary w-full justify-center text-xs font-black py-2.5 disabled:opacity-40 gap-2"
            >
              <Mail size={15} /> Launch Email Outreach
            </button>
          </>
        )}
      </div>
    </section>
  );
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
function timelineLabel(item) {
  const labels = {
    lead_created: "Opportunity created",
    status_changed: "Stage changed",
    note_added: "Note added",
    attachment_added: "Attachment added",
    email_opened: "Email draft opened",
    whatsapp_opened: "WhatsApp draft opened",
    created: "Task created",
    updated: "Task updated",
    scheduled: "Task scheduled",
    completed: "Task completed",
    commented: "Task comment added",
    assignees_changed: "Task owners changed",
  };
  return labels[item.event_type] || item.event_type.replaceAll("_", " ");
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
