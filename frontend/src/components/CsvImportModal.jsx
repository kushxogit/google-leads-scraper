import { useMemo, useState } from "react";
import Papa from "papaparse";
import { CheckCircle2, FileUp, Upload, X } from "lucide-react";

const legacyStatuses = {
  CALLED: "contacted",
  "FOLLOW UP": "contacted",
  "TO CALL": "new",
  "PROPOSAL SENT": "proposal",
  INTERESTED: "qualified",
  NEW: "new",
  LOST: "lost",
};
const allowedStatuses = new Set([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
]);
const pick = (row, ...names) =>
  names
    .map(
      (name) =>
        row[name] ??
        row[name.toUpperCase()] ??
        row[name.replaceAll("_", " ")] ??
        row[name.replaceAll("_", " ").toUpperCase()],
    )
    .find((value) => String(value ?? "").trim()) ?? "";

export default function CsvImportModal({
  open,
  onClose,
  addLead,
  existingLeads,
}) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const parsed = useMemo(
    () => rows.map((row) => normalize(row)).filter(Boolean),
    [rows],
  );
  const keys = useMemo(
    () =>
      new Set(
        existingLeads.map((lead) => identity(lead.business_name, lead.phone)),
      ),
    [existingLeads],
  );
  const fresh = parsed.filter(
    (lead) => !keys.has(identity(lead.business_name, lead.phone)),
  );
  const loadFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setProgress(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: ({ data, errors }) => {
        if (errors.length)
          return setMessage(`Could not read this CSV: ${errors[0].message}`);
        setRows(data);
      },
    });
  };
  const importRows = async () => {
    if (!fresh.length) return;
    setImporting(true);
    setMessage("");
    setProgress({ completed: 0, total: fresh.length });
    let done = 0;
    try {
      for (const lead of fresh) {
        await addLead(lead);
        done += 1;
        setProgress({ completed: done, total: fresh.length });
      }
      setMessage(`Imported ${done} lead${done === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(
        `Imported ${done} lead${done === 1 ? "" : "s"}; stopped: ${error.message}`,
      );
    } finally {
      setImporting(false);
    }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/35 p-4 backdrop-blur-sm">
      <section className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-5 sm:p-7">
        <header className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">
              Import CSV
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Use columns such as Business Name, Status, Phone, Niche, Area, and
              Remarks.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-500"
          >
            <X size={17} />
          </button>
        </header>
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-8 text-center transition hover:border-violet-400 hover:bg-violet-50">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm">
            <FileUp size={20} />
          </span>
          <span className="mt-3 text-sm font-extrabold text-zinc-800">
            Choose a CSV file
          </span>
          <span className="mt-1 text-xs text-zinc-500">
            The supplied CRM Tracker CSV is ready to use.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={loadFile}
            className="hidden"
          />
        </label>
        {rows.length > 0 && (
          <section className="mt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold">Ready to import</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {fresh.length} new · {parsed.length - fresh.length} already in
                  your pipeline
                </p>
              </div>
              <button
                disabled={!fresh.length || importing}
                onClick={importRows}
                className="button-primary"
              >
                <Upload size={16} />
                {importing
                  ? "Importing…"
                  : `Import ${fresh.length} lead${fresh.length === 1 ? "" : "s"}`}
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-100">
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-50 text-[10px] font-extrabold uppercase tracking-[.12em] text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Business</th>
                      <th className="px-3 py-2">Pipeline stage</th>
                      <th className="px-3 py-2">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {parsed.slice(0, 20).map((lead, index) => (
                      <tr key={`${lead.business_name}-${index}`}>
                        <td className="px-3 py-2 font-bold text-zinc-700">
                          {lead.business_name}
                        </td>
                        <td className="px-3 py-2 capitalize text-zinc-500">
                          {lead.status}
                        </td>
                        <td className="px-3 py-2 text-zinc-500">
                          {lead.phone || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {progress && (
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-violet-700">
                  <span>
                    {importing
                      ? "Writing leads to your workspace…"
                      : "Import finished"}
                  </span>
                  <span>
                    {progress.completed} / {progress.total}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-300"
                    style={{
                      width: `${Math.round((progress.completed / progress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        )}
        {message && (
          <p
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-2xl p-3 text-sm ${message.startsWith("Imported") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}
          >
            {message.startsWith("Imported") && <CheckCircle2 size={17} />}
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

function normalize(row) {
  const business_name = String(
    pick(row, "business_name", "business name", "name"),
  ).trim();
  if (!business_name) return null;
  const original = String(pick(row, "status")).trim().toUpperCase();
  const status =
    legacyStatuses[original] ??
    (allowedStatuses.has(original.toLowerCase())
      ? original.toLowerCase()
      : "new");
  return {
    business_name,
    phone: String(pick(row, "phone")).trim(),
    niche: String(pick(row, "niche")).trim(),
    area: String(pick(row, "area")).trim(),
    remarks: String(pick(row, "remarks", "notes")).trim(),
    source: String(pick(row, "source")).trim() || "csv-import",
    status,
    metadata: { source_status: original || "NEW", imported_from: "CSV import" },
  };
}
function identity(name, phone) {
  return `${String(name || "")
    .trim()
    .toLowerCase()}|${String(phone || "").replace(/\D/g, "")}`;
}
