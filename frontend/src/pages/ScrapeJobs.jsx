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
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header Banner */}
      <header className="rounded-[26px] bg-[#171719] p-5 text-white shadow-[0_20px_50px_rgba(43,31,70,.18)] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl liquid-button shadow-md">
            <Radar size={18} />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-200">
              Local intelligence
            </p>
            <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Prospecting Radar
            </h1>
          </div>
        </div>
        <p className="mt-2 max-w-xl text-xs leading-5 text-zinc-300">
          Launch local Google Maps research jobs and watch fresh opportunities arrive in real time.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
        {/* Search Target Form */}
        <form onSubmit={submit} className="panel h-fit p-5 rounded-[24px]">
          <p className="eyebrow">New scan</p>
          <h2 className="mt-0.5 text-base font-extrabold text-zinc-950">Set your target</h2>

          <div className="mt-4 space-y-3.5 text-xs">
            <Input
              label="Search query"
              value={form.query}
              onChange={(query) => setForm({ ...form, query })}
              placeholder="Dentists in Jaipur"
            />

            <div className="grid gap-2.5 sm:grid-cols-2">
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

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Max leads
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.limit}
                  onChange={(e) =>
                    setForm({ ...form, limit: Number(e.target.value) })
                  }
                  className="control mt-1 w-full text-xs rounded-xl"
                />
              </label>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Source
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="control mt-1 w-full text-xs rounded-xl"
                >
                  <option>Google Maps</option>
                </select>
              </label>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-100/80 p-2.5 text-xs font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={form.headless}
                onChange={(e) =>
                  setForm({ ...form, headless: e.target.checked })
                }
                className="accent-violet-600 rounded"
              />{" "}
              Run invisibly
            </label>

            <details className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-2.5">
              <summary className="cursor-pointer text-xs font-extrabold text-zinc-800">
                Filters
              </summary>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.exclude_website}
                  onChange={(e) =>
                    setForm({ ...form, exclude_website: e.target.checked })
                  }
                  className="accent-violet-600 rounded"
                />
                Exclude businesses with a website
              </label>
              <p className="mt-1.5 text-[11px] leading-4 text-zinc-400">
                Only save businesses for which Google Maps does not list a website.
              </p>
            </details>

            <button
              disabled={sending}
              className="button-primary liquid-button w-full justify-center rounded-full text-xs py-2.5 font-extrabold text-white"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              {sending ? "Starting…" : "Launch scan"}
            </button>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-600 font-semibold border border-rose-200/60"
              >
                {error}
              </p>
            )}
          </div>
        </form>

        {/* Live Queue Container */}
        <section className="panel overflow-hidden rounded-[24px]">
          <div className="flex items-center justify-between border-b border-zinc-200/60 px-5 py-3.5">
            <div>
              <p className="eyebrow">Live queue</p>
              <h2 className="mt-0.5 text-base font-extrabold text-zinc-950">Recent scans</h2>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600 border border-zinc-200/60">
              {jobs.length} jobs
            </span>
          </div>

          <div className="divide-y divide-zinc-100 md:hidden">
            {jobs.map((job) => (
              <article key={job.id} className="space-y-2.5 px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-zinc-950 text-xs">
                      {job.query}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {job.niche} {job.area && `· ${job.area}`} · Target {job.lead_limit}
                    </p>
                  </div>
                  <Status status={job.status} />
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-500">
                    Found <b className="text-zinc-950">{job.found_count}</b> · Saved{" "}
                    <b className="text-emerald-600">{job.saved_count}</b>
                  </span>
                  <span className="shrink-0 text-zinc-400 text-[11px]">
                    {new Date(job.created_at + "Z").toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {job.error_message && (
                  <p className="text-xs text-rose-500 font-semibold">{job.error_message}</p>
                )}

                {job.status === "completed" && job.saved_count > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <ReviewButton
                      job={job}
                      reviewing={reviewingId === job.id}
                      onReview={review}
                    />
                    <Link to={`/leads?scrape_job=${job.id}`} className="text-xs font-extrabold text-violet-600 hover:underline">
                      View saved leads →
                    </Link>
                  </div>
                )}
              </article>
            ))}

            {!jobs.length && (
              <p className="p-10 text-center text-xs text-zinc-400 font-medium">
                Your scans will appear here.
              </p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[730px] w-full text-left text-xs">
              <thead className="bg-zinc-50/80 text-[10px] uppercase tracking-wider text-zinc-400 font-extrabold">
                <tr>
                  <th className="px-5 py-3">Query</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Yield</th>
                  <th className="px-5 py-3">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/70">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-violet-50/40 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-extrabold text-zinc-950">
                        {job.query}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {job.niche} {job.area && `· ${job.area}`} · Target{" "}
                        {job.lead_limit}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Status status={job.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-3 text-xs">
                        <span className="text-zinc-500">
                          Found <b className="text-zinc-950">{job.found_count}</b>
                        </span>
                        <span className="text-emerald-600 font-bold">
                          Saved <b>{job.saved_count}</b>
                        </span>
                      </div>
                      {job.error_message && (
                        <p
                          title={job.error_message}
                          className="mt-1 max-w-[210px] truncate text-xs text-rose-500 font-semibold"
                        >
                          {job.error_message}
                        </p>
                      )}
                      {job.status === "completed" && job.saved_count > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <ReviewButton
                            job={job}
                            reviewing={reviewingId === job.id}
                            onReview={review}
                          />
                          <Link
                            to={`/leads?scrape_job=${job.id}`}
                            className="inline-flex text-[11px] font-extrabold text-violet-600 hover:underline"
                          >
                            View saved leads →
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-400 font-semibold">
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
                      className="p-12 text-center text-xs text-zinc-400 font-medium"
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
    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="control mt-1 w-full text-xs rounded-xl"
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
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold shadow-2xs border ${job.reviewed_at ? "bg-emerald-100/90 text-emerald-800 border-emerald-200/70" : "bg-zinc-100 text-zinc-600 border-zinc-200/60"}`}
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
    completed: [CheckCircle2, "bg-emerald-100/90 text-emerald-800 border border-emerald-200/70", "Completed"],
    running: [Loader2, "bg-violet-100/90 text-violet-800 border border-violet-200/70", "Running"],
    failed: [XCircle, "bg-rose-100/90 text-rose-700 border border-rose-200/70", "Failed"],
    queued: [Clock, "bg-zinc-100 text-zinc-600 border border-zinc-200/60", "Queued"],
  }[status] || [Clock, "bg-zinc-100 text-zinc-600 border border-zinc-200/60", status];
  const [Icon, css, text] = props;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs ${css}`}
    >
      <Icon size={12} className={status === "running" ? "animate-spin" : ""} />
      {text}
    </span>
  );
}
