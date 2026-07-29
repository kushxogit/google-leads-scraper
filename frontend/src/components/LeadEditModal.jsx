import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useFeedback } from "../context/feedback";

export default function LeadEditModal({ lead, isOpen: isOpenProp, open: openProp, onClose, onSave }) {
  const isOpen = Boolean(isOpenProp || openProp);
  const { notify } = useFeedback();
  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    email: "",
    company: "",
    source_url: "",
  });

  useEffect(() => {
    if (lead) {
      setForm({
        business_name: lead.business_name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        company: lead.company || "",
        source_url: lead.source_url || "",
      });
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave({
        ...form,
        metadata: {
          ...lead.metadata,
          source_url: form.source_url,
        }
      });
      notify("Lead updated successfully!");
      onClose();
    } catch (error) {
      notify(error.message || "Failed to update lead", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-5 border-b border-zinc-100">
          <h2 className="text-lg font-black text-zinc-900">Edit Lead</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition"
          >
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          <form id="edit-lead-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-zinc-700 mb-1">
                Business Name
              </label>
              <input
                required
                type="text"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-xs font-extrabold text-zinc-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-zinc-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-zinc-700 mb-1">
                Company/Category
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-xs font-extrabold text-zinc-700 mb-1">
                Source URL (Google Maps)
              </label>
              <input
                type="url"
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
            </div>
          </form>
        </div>

        <footer className="p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-sm font-extrabold text-zinc-600 hover:bg-zinc-200/50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-lead-form"
            className="px-5 py-2.5 rounded-2xl text-sm font-extrabold text-white bg-violet-600 hover:bg-violet-700 shadow-sm transition"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}
