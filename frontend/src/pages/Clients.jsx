import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  CircleDollarSign,
  Globe2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useFeedback } from "../context/feedback";
import { useWorkspaceLeads, PIPELINE_STATUSES, trackOutreachDraft } from "../hooks/useCrm";
import { clientFromRow, useClientActions } from "../hooks/useToday";
import AddLeadModal from "../components/AddLeadModal";
import InteractionModal from "../components/InteractionModal";

const filters = ["all", "active", "won", "follow-up", "feedback", "payment", "value"];

export default function Clients() {
  const { leads: rows, isLoading } = useWorkspaceLeads();
  const { updateClient } = useClientActions();
  const { notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [addOpen, setAddOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState(null);
  const [logging, setLogging] = useState(null);

  const leads = rows.map(clientFromRow);
  const visible = useMemo(
    () =>
      leads.filter((lead) => {
        const haystack = [
          lead.business_name,
          lead.company,
          lead.email,
          lead.required_service,
        ]
          .join(" ")
          .toLowerCase();
        if (query && !haystack.includes(query.toLowerCase())) return false;
        if (filter === "active" && ["won", "lost"].includes(lead.status)) return false;
        if (filter === "won" && lead.status !== "won") return false;
        if (
          filter === "follow-up" &&
          !(lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= endOfToday())
        ) return false;
        if (filter === "feedback" && !lead.pending_feedback) return false;
        if (filter === "payment" && !["pending", "partial"].includes(lead.payment_status)) return false;
        if (filter === "value" && !lead.project_value) return false;
        return true;
      }),
    [filter, leads, query],
  );

  useEffect(() => {
    if (searchParams.get("new") === "1") setAddOpen(true);
  }, [searchParams]);

  const change = async (lead, changes) => {
    try {
      await updateClient(lead, changes);
      notify("Client record updated.");
    } catch (error) {
      notify(error.message, "error");
      throw error;
    }
  };

  const activeCount = leads.filter((lead) => !["won", "lost"].includes(lead.status)).length;
  const actionCount = leads.filter((lead) => nextAction(lead).tone !== "quiet").length;
  const valueTotal = leads.reduce((sum, lead) => sum + Number(lead.project_value || 0), 0);
  const wonCount = leads.filter((lead) => lead.status === "won").length;

  if (isLoading) {
    return (
      <div className="panel flex min-h-48 items-center justify-center gap-3 p-10 text-sm text-zinc-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        Loading clients…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1420px] space-y-5 pb-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Your client desk</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.05em]">Clients</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            One list for prospects, active clients, and completed work. Scan the next action first.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/leads" className="button-secondary">
            Open pipeline <ArrowUpRight size={15} />
          </Link>
          <button onClick={() => setAddOpen(true)} className="button-primary">
            <Plus size={16} /> New client
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Active records" value={activeCount} note="Still in motion" />
        <Summary label="Needs attention" value={actionCount} note="Follow-up or blocker" tone="amber" />
        <Summary label="Project value" value={formatCurrency(valueTotal)} note="Across saved records" tone="violet" />
        <Summary label="Completed" value={wonCount} note="Marked won" tone="emerald" />
      </section>

      <section className="panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search size={15} className="absolute left-3 top-3 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="control w-full pl-9"
              placeholder="Find a client, company, or service"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setFilter(item);
                  setSearchParams(item === "all" ? {} : { filter: item });
                }}
                className={
                  "whitespace-nowrap rounded-full px-3 py-2 text-xs font-extrabold capitalize transition " +
                  (filter === item
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200")
                }
              >
                {item.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Showing {visible.length} of {leads.length} records
          <span className="hidden sm:inline">· Each row has one obvious next move.</span>
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="hidden grid-cols-[minmax(230px,1.8fr)_minmax(170px,1.3fr)_110px_120px_230px] gap-4 border-b border-zinc-200/70 bg-white/45 px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-zinc-400 md:grid">
          <span>Client</span>
          <span>Next action</span>
          <span>Value</span>
          <span>Payment</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-zinc-100">
          {visible.map((lead) => (
            <ClientRow
              key={lead.id}
              lead={lead}
              onEdit={() => setEditing(lead)}
              onLog={() => setLogging(lead)}
              onChange={change}
              notify={notify}
            />
          ))}
          {!visible.length && (
            <div className="grid place-items-center px-5 py-16 text-center">
              <UserRound size={26} className="text-zinc-300" />
              <p className="mt-3 text-sm font-extrabold">No records in this view</p>
              <p className="mt-1 text-xs text-zinc-500">Try a different filter or add the next client.</p>
            </div>
          )}
        </div>
      </section>

      <AddLeadModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setSearchParams({});
        }}
      />
      <InteractionModal lead={logging} open={Boolean(logging)} onClose={() => setLogging(null)} />
      {editing && (
        <EditClient
          lead={editing}
          onClose={() => setEditing(null)}
          onSave={async (changes) => {
            try {
              await change(editing, changes);
              setEditing(null);
            } catch {
              // The inline error toast already explains the failure.
            }
          }}
        />
      )}
    </div>
  );
}

function ClientRow({ lead, onEdit, onLog, onChange, notify }) {
  const action = nextAction(lead);
  const statusColor = {
    new: "bg-zinc-100 text-zinc-600",
    contacted: "bg-sky-100 text-sky-700",
    qualified: "bg-violet-100 text-violet-700",
    proposal: "bg-amber-100 text-amber-800",
    won: "bg-emerald-100 text-emerald-700",
    lost: "bg-rose-100 text-rose-700",
  };

  const openContact = async (type) => {
    try {
      if (type === "email" && lead.email) {
        await trackOutreachDraft(lead.id, "email");
        window.location.href = "mailto:" + lead.email;
      }
      if (type === "whatsapp" && lead.phone) {
        await trackOutreachDraft(lead.id, "whatsapp");
        window.open("https://wa.me/" + lead.phone.replace(/\D/g, ""), "_blank", "noopener,noreferrer");
      }
      if (type === "website" && lead.website) {
        window.open(
          lead.website.startsWith("http") ? lead.website : "https://" + lead.website,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (error) {
      notify(error.message, "error");
    }
  };

  return (
    <article className="grid gap-4 px-4 py-4 transition hover:bg-violet-50/30 md:grid-cols-[minmax(230px,1.8fr)_minmax(170px,1.3fr)_110px_120px_230px] md:items-center md:gap-4 md:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white">
            <Building2 size={15} />
          </span>
          <div className="min-w-0">
            <Link to={"/leads/" + lead.id} className="block truncate text-sm font-extrabold text-zinc-950 hover:text-violet-700">
              {lead.business_name}
            </Link>
            <p className="truncate text-xs text-zinc-500">
              {lead.company || "Independent client"}
              {lead.required_service ? " · " + lead.required_service : ""}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-11">
          <span className={"rounded-full px-2 py-1 text-[10px] font-extrabold capitalize " + (statusColor[lead.status] || statusColor.new)}>
            {lead.status}
          </span>
          {lead.last_conversation_at ? (
            <span className="text-[10px] font-semibold text-zinc-400">
              Last conversation {formatDate(lead.last_conversation_at)}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-zinc-400">No conversation logged</span>
          )}
        </div>
        <div className="mt-2 flex gap-3 pl-11 text-[11px] font-bold text-zinc-400">
          <button onClick={() => openContact("email")} disabled={!lead.email} className="inline-flex items-center gap-1 hover:text-violet-700 disabled:opacity-30">
            <Mail size={12} /> Email
          </button>
          <button onClick={() => openContact("whatsapp")} disabled={!lead.phone} className="inline-flex items-center gap-1 hover:text-violet-700 disabled:opacity-30">
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button onClick={() => openContact("website")} disabled={!lead.website} className="inline-flex items-center gap-1 hover:text-violet-700 disabled:opacity-30">
            <Globe2 size={12} /> Website
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400 md:hidden">Next action</p>
        <div className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-extrabold " + action.className}>
          {action.tone === "quiet" ? <Check size={13} /> : <CalendarClock size={13} />}
          {action.label}
        </div>
        <p className="mt-1 text-xs text-zinc-500">{action.detail}</p>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400 md:hidden">Value</p>
        <p className="text-sm font-extrabold text-zinc-900">{lead.project_value ? formatCurrency(lead.project_value) : "Not set"}</p>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400 md:hidden">Payment</p>
        <select
          aria-label={"Payment status for " + lead.business_name}
          value={lead.payment_status}
          onChange={(event) => onChange(lead, { payment_status: event.target.value })}
          className="control w-full px-2 py-2 text-xs capitalize md:max-w-[120px]"
        >
          <option value="not_set">Not set</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="not_applicable">N/A</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <button onClick={onLog} className="button-primary px-3 py-2 text-xs">
          <MessageCircle size={14} /> Log interaction
        </button>
        <Link to={"/leads/" + lead.id} className="button-secondary px-3 py-2 text-xs">
          View
        </Link>
        <button onClick={onEdit} aria-label={"Edit " + lead.business_name} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:border-violet-300 hover:text-violet-700">
          <Pencil size={14} />
        </button>
      </div>
    </article>
  );
}

function Summary({ label, value, note, tone = "sky" }) {
  const classes = {
    sky: "border-sky-200 bg-sky-50/60 text-sky-700",
    amber: "border-amber-200 bg-amber-50/60 text-amber-800",
    violet: "border-violet-200 bg-violet-50/60 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
  };
  return (
    <div className="panel flex min-w-0 items-center gap-3 p-4">
      <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-2xl border " + classes[tone]}>
        <CircleDollarSign size={16} />
      </span>
      <div className="min-w-0">
        <p className="eyebrow truncate">{label}</p>
        <p className="mt-1 truncate text-xl font-extrabold tracking-[-.05em]">{value}</p>
        <p className="truncate text-[10px] font-semibold text-zinc-400">{note}</p>
      </div>
    </div>
  );
}

function EditClient({ lead, onClose, onSave }) {
  const [form, setForm] = useState({
    business_name: lead.business_name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    company: lead.company || "",
    website: lead.website || "",
    required_service: lead.required_service || "",
    project_value: lead.project_value || "",
    next_follow_up_at: lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 10) : "",
    pending_feedback: Boolean(lead.pending_feedback),
    payment_status: lead.payment_status || "not_set",
    important_notes: lead.important_notes || "",
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    await onSave({
      ...form,
      next_follow_up_at: form.next_follow_up_at
        ? new Date(form.next_follow_up_at + "T09:00:00").toISOString()
        : null,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-zinc-950/35 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="panel max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-6"
      >
        <header className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Edit client</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">Keep the record useful</h2>
            <p className="mt-1 text-sm text-zinc-500">Only the essentials belong here. Log the story through interactions.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close edit client" className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950">
            <X size={18} />
          </button>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Client / person" value={form.business_name} onChange={(value) => set("business_name", value)} required />
          <Field label="Company" value={form.company} onChange={(value) => set("company", value)} />
          <Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} />
          <Field label="Email" type="email" value={form.email} onChange={(value) => set("email", value)} />
          <Field label="Website" value={form.website} onChange={(value) => set("website", value)} />
          <Field label="Required service" value={form.required_service} onChange={(value) => set("required_service", value)} />
          <Field label="Project value" type="number" value={form.project_value} onChange={(value) => set("project_value", value)} />
          <Field label="Next follow-up" type="date" value={form.next_follow_up_at} onChange={(value) => set("next_follow_up_at", value)} />

          <label className="text-xs font-extrabold text-zinc-500">
            Lifecycle status
            <select value={form.status || lead.status} onChange={(event) => set("status", event.target.value)} className="control mt-1.5 w-full capitalize">
              {PIPELINE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="text-xs font-extrabold text-zinc-500">
            Payment
            <select value={form.payment_status} onChange={(event) => set("payment_status", event.target.value)} className="control mt-1.5 w-full capitalize">
              <option value="not_set">Not set</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-2xl bg-amber-50 p-3 text-xs font-extrabold text-amber-900">
            <input type="checkbox" checked={form.pending_feedback} onChange={(event) => set("pending_feedback", event.target.checked)} />
            Feedback pending
          </label>
          <label className="text-xs font-extrabold text-zinc-500 sm:col-span-2">
            Important notes
            <textarea rows={3} value={form.important_notes} onChange={(event) => set("important_notes", event.target.value)} className="control mt-1.5 w-full" placeholder="Only durable context, not a conversation transcript." />
          </label>
        </div>

        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="button-secondary">Cancel</button>
          <button className="button-primary"><Check size={15} /> Save changes</button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="text-xs font-extrabold text-zinc-500">
      {label}
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="control mt-1.5 w-full" />
    </label>
  );
}

function nextAction(lead) {
  if (lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= endOfToday()) {
    return {
      label: "Follow up today",
      detail: "Due " + formatDate(lead.next_follow_up_at),
      tone: "hot",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (lead.pending_feedback) {
    return {
      label: "Get feedback",
      detail: "Ask for approval or a review.",
      tone: "warm",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (["pending", "partial"].includes(lead.payment_status)) {
    return {
      label: "Check payment",
      detail: lead.payment_status === "partial" ? "Partial payment is open." : "Payment is pending.",
      tone: "hot",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (!lead.last_conversation_at && !["won", "lost"].includes(lead.status)) {
    return {
      label: "Start outreach",
      detail: "No conversation logged yet.",
      tone: "warm",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  return {
    label: "No blocker",
    detail: "Nothing urgent is saved.",
    tone: "quiet",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}
