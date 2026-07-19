import { useEffect, useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Radar,
  XCircle,
} from "lucide-react";

export default function ScrapeJobs() {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({
    query: "",
    niche: "",
    area: "",
    source: "Google Maps",
    limit: 10,
    headless: true,
  });
  const [sending, setSending] = useState(false);
  const load = () =>
    axios
      .get("http://localhost:3001/api/scrape-jobs")
      .then((r) => setJobs(r.data))
      .catch(console.error);
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);
  const submit = (e) => {
    e.preventDefault();
    setSending(true);
    axios
      .post("http://localhost:3001/api/scrape-jobs", form)
      .then(() => {
        setForm({ ...form, query: "", niche: "", area: "" });
        load();
      })
      .finally(() => setSending(false));
  };
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-[30px] bg-[#171719] p-7 text-white shadow-[0_20px_50px_rgba(43,31,70,.18)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl liquid-button">
            <Radar size={20} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-200">
              Local intelligence
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-.05em]">
              Prospecting radar
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-sm text-zinc-300">
          Launch local Google Maps research jobs and watch fresh opportunities
          arrive.
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
        <form onSubmit={submit} className="panel h-fit p-5">
          <p className="eyebrow">New scan</p>
          <h2 className="mt-1 text-lg font-extrabold">Set your target</h2>
          <div className="mt-5 space-y-4">
            <Input
              label="Search query"
              value={form.query}
              onChange={(query) => setForm({ ...form, query })}
              placeholder="Dentists in Jaipur"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Industry"
                value={form.niche}
                onChange={(niche) => setForm({ ...form, niche })}
                placeholder="Dentists"
              />
              <Input
                label="Area"
                value={form.area}
                onChange={(area) => setForm({ ...form, area })}
                placeholder="Jaipur"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-extrabold uppercase tracking-[.12em] text-zinc-400">
                Max leads
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.limit}
                  onChange={(e) =>
                    setForm({ ...form, limit: Number(e.target.value) })
                  }
                  className="control mt-2 w-full normal-case tracking-normal"
                />
              </label>
              <label className="text-xs font-extrabold uppercase tracking-[.12em] text-zinc-400">
                Source
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="control mt-2 w-full normal-case tracking-normal"
                >
                  <option>Google Maps</option>
                </select>
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-zinc-50 p-3 text-sm font-semibold text-zinc-600">
              <input
                type="checkbox"
                checked={form.headless}
                onChange={(e) =>
                  setForm({ ...form, headless: e.target.checked })
                }
                className="accent-violet-600"
              />{" "}
              Run invisibly
            </label>
            <button
              disabled={sending}
              className="button-primary liquid-button w-full"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
              {sending ? "Starting…" : "Launch scan"}
            </button>
          </div>
        </form>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <p className="eyebrow">Live queue</p>
              <h2 className="mt-0.5 text-lg font-extrabold">Recent scans</h2>
            </div>
            <span className="mono rounded-xl bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
              {jobs.length} jobs
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[730px] w-full text-left text-sm">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-[.14em] text-zinc-400">
                <tr>
                  <th className="px-5 py-3">Query</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Yield</th>
                  <th className="px-5 py-3">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-violet-50/45">
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-zinc-800">
                        {job.query}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {job.niche} {job.area && `· ${job.area}`} · Target{" "}
                        {job.lead_limit}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Status status={job.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3 text-xs">
                        <span className="text-zinc-500">
                          Found{" "}
                          <b className="text-zinc-800">{job.found_count}</b>
                        </span>
                        <span className="text-emerald-600">
                          Saved <b>{job.saved_count}</b>
                        </span>
                      </div>
                      {job.error_message && (
                        <p
                          title={job.error_message}
                          className="mt-1 max-w-[210px] truncate text-xs text-rose-500"
                        >
                          {job.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-400">
                      {new Date(job.created_at + "Z").toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
                {!jobs.length && (
                  <tr>
                    <td
                      colSpan="4"
                      className="p-12 text-center text-sm text-zinc-400"
                    >
                      Your scans will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-[.12em] text-zinc-400">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="control mt-2 w-full normal-case tracking-normal"
      />
    </label>
  );
}
function Status({ status }) {
  const props = {
    completed: [CheckCircle2, "bg-emerald-50 text-emerald-600", "Completed"],
    running: [Loader2, "bg-violet-50 text-violet-600", "Running"],
    failed: [XCircle, "bg-rose-50 text-rose-500", "Failed"],
    queued: [Clock, "bg-zinc-100 text-zinc-500", "Queued"],
  }[status] || [Clock, "bg-zinc-100 text-zinc-500", status];
  const [Icon, css, text] = props;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold ${css}`}
    >
      <Icon size={13} className={status === "running" ? "animate-spin" : ""} />
      {text}
    </span>
  );
}
