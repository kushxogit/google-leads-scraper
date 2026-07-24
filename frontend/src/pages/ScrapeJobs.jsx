import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Radar,
  XCircle,
} from "lucide-react";
import { useAuthWorkspace } from "../context/authWorkspace";
import { supabase } from "../lib/supabase";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ScrapeJobs() {
  const { activeWorkspaceId } = useAuthWorkspace();
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({
    query: "",
    niche: "",
    area: "",
    source: "Google Maps",
    limit: 10,
    headless: true,
    exclude_website: false,
  });
  const [sending, setSending] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState("");
  const requestConfig = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in again to use the scraper.");
    return {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "X-Supabase-Url": supabaseUrl,
        "X-Supabase-Key": supabaseKey,
      },
      params: {
        workspace_id: activeWorkspaceId,
      },
    };
  }, [activeWorkspaceId]);
  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const config = await requestConfig();
      const response = await axios.get(`${apiBase}/api/scrape-jobs`, config);
      setJobs(response.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError.response?.data?.error ||
          loadError.message ||
          "Could not load scraper jobs.",
      );
    }
  }, [activeWorkspaceId, requestConfig]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.query.trim() && !form.niche.trim())
      return setError("Enter a search query or an industry and area.");
    setSending(true);
    setError("");
    try {
      const config = await requestConfig();
      await axios.post(
        `${apiBase}/api/scrape-jobs`,
        {
          ...form,
          workspace_id: activeWorkspaceId,
        },
        { headers: config.headers },
      );
      setForm({ ...form, query: "", niche: "", area: "" });
      await load();
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.message ||
          "Could not launch this scan.",
      );
    } finally {
      setSending(false);
    }
  };
  const review = async (job, reviewed) => {
    setReviewingId(job.id);
    try {
      const config = await requestConfig();
      await axios.patch(
        `${apiBase}/api/scrape-jobs/${job.id}/review`,
        { reviewed },
        { headers: config.headers },
      );
      await load();
    } catch (reviewError) {
      setError(
        reviewError.response?.data?.error ||
          reviewError.message ||
          "Could not update this review.",
      );
    } finally {
      setReviewingId(null);
    }
  };
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-[30px] bg-[#171719] p-5 text-white shadow-[0_20px_50px_rgba(43,31,70,.18)] sm:p-7">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            <details className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3">
              <summary className="cursor-pointer text-sm font-extrabold text-zinc-700">
                Filters
              </summary>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-600">
                <input
                  type="checkbox"
                  checked={form.exclude_website}
                  onChange={(e) =>
                    setForm({ ...form, exclude_website: e.target.checked })
                  }
                  className="accent-violet-600"
                />
                Exclude businesses with a website
              </label>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Only save businesses for which Google Maps does not list a website.
              </p>
            </details>
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
            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-600"
              >
                {error}
              </p>
            )}
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
          <div className="divide-y divide-zinc-100 md:hidden">
            {jobs.map((job) => (
              <article key={job.id} className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-zinc-800">
                      {job.query}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {job.niche} {job.area && `Â· ${job.area}`} Â· Target {job.lead_limit}
                    </p>
                  </div>
                  <Status status={job.status} />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-500">
                    Found <b className="text-zinc-800">{job.found_count}</b> Â· Saved{" "}
                    <b className="text-emerald-600">{job.saved_count}</b>
                  </span>
                  <span className="shrink-0 text-zinc-400">
                    {new Date(job.created_at + "Z").toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {job.error_message && (
                  <p className="text-xs text-rose-500">{job.error_message}</p>
                )}
                {job.status === "completed" && job.saved_count > 0 && (
                  <ReviewButton
                    job={job}
                    reviewing={reviewingId === job.id}
                    onReview={review}
                  />
                )}
                {job.status === "completed" && job.saved_count > 0 && (
                  <Link to={`/leads?scrape_job=${job.id}`} className="inline-flex text-xs font-extrabold text-violet-600">
                    View saved leads â†’
                  </Link>
                )}
              </article>
            ))}
            {!jobs.length && (
              <p className="p-10 text-center text-sm text-zinc-400">
                Your scans will appear here.
              </p>
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
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
                      {job.status === "completed" && job.saved_count > 0 && (
                        <ReviewButton
                          job={job}
                          reviewing={reviewingId === job.id}
                          onReview={review}
                        />
                      )}
                      {job.status === "completed" && job.saved_count > 0 && (
                        <Link
                          to={`/leads?scrape_job=${job.id}`}
                          className="mt-2 inline-flex text-[11px] font-extrabold text-violet-600"
                        >
                          View saved leads →
                        </Link>
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
function ReviewButton({ job, reviewing, onReview }) {
  return (
    <button
      type="button"
      disabled={reviewing}
      onClick={() => onReview(job, !job.reviewed_at)}
      className={`rounded-lg px-2 py-1 text-[10px] font-extrabold ${job.reviewed_at ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}
    >
      {reviewing
        ? "Saving…"
        : job.reviewed_at
          ? "Reviewed"
          : "Mark reviewed"}
    </button>
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
