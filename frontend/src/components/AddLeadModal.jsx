import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { PIPELINE_STATUSES, useWorkspaceLeads } from "../hooks/useCrm";
import { useFeedback } from "../context/feedback";

const fields = [
  ["business_name", "Business name", true],
  ["phone", "Phone"],
  ["email", "Email"],
  ["website", "Website"],
  ["niche", "Industry"],
  ["area", "Location"],
];

export default function AddLeadModal({ isOpen, onClose }) {
  const { addLead } = useWorkspaceLeads();
  const { notify } = useFeedback();
  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    email: "",
    website: "",
    niche: "",
    area: "",
    status: "new",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!isOpen) return undefined;
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await addLead(form);
      notify(`${form.business_name} was added to Pipeline.`);
      setForm({
        business_name: "",
        phone: "",
        email: "",
        website: "",
        niche: "",
        area: "",
        status: "new",
      });
      onClose();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-zinc-950/35 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="panel w-full max-w-xl overflow-hidden bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-zinc-100 p-6">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-600">
              <Sparkles size={18} />
            </span>
            <div>
              <p id="add-lead-title" className="text-lg font-extrabold">
                Add opportunity
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Capture the essentials now. Enrich the profile later.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add opportunity"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X size={20} />
          </button>
        </header>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          {fields.map(([key, label, required]) => (
            <label
              key={key}
              className={`text-xs font-bold uppercase tracking-[.12em] text-zinc-500 ${key === "business_name" ? "sm:col-span-2" : ""}`}
            >
              {label}
              <input
                required={required}
                type={key === "email" ? "email" : "text"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="control mt-2 w-full normal-case tracking-normal"
                placeholder={
                  key === "business_name" ? "e.g. Northstar Studios" : ""
                }
              />
            </label>
          ))}
          <label className="text-xs font-bold uppercase tracking-[.12em] text-zinc-500">
            Starting stage
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="control mt-2 w-full normal-case tracking-normal"
            >
              {PIPELINE_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
        <footer className="flex justify-end gap-3 border-t border-zinc-100 bg-zinc-50/60 p-5">
          <button type="button" onClick={onClose} className="button-secondary">
            Cancel
          </button>
          <button disabled={saving} className="button-primary">
            {saving ? "Creating…" : "Create lead"}
          </button>
        </footer>
      </form>
    </div>
  );
}
