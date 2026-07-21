import { CalendarClock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspaceLeads } from "../hooks/useCrm";

export default function FollowUps() {
  const { leads, isLoading } = useWorkspaceLeads();
  const followUps = leads
    .filter((lead) => lead.follow_up_date)
    .sort((a, b) =>
      String(a.follow_up_date).localeCompare(String(b.follow_up_date)),
    );
  if (isLoading)
    return <div className="panel p-8 text-zinc-500">Loading follow-ups…</div>;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-[30px] bg-gradient-to-br from-amber-100 via-white to-rose-100 p-5 shadow-[0_16px_45px_rgba(155,95,30,.10)] sm:p-7">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-amber-600 shadow-sm">
          <CalendarClock size={18} />
        </span>
        <p className="mt-5 eyebrow">Your rhythm</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-[-.06em]">
          Follow-ups
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Small consistent actions compound into great relationships.
        </p>
      </section>
      <section className="panel p-3">
        {followUps.map((lead) => (
          <Link
            key={lead.id}
            to={`/leads/${lead.id}`}
            className="group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-violet-50"
          >
            <span className="mono grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-xs text-white">
              {new Date(lead.follow_up_date).getDate()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">
                {lead.business_name}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-400">
                Due {lead.follow_up_date}
              </span>
            </span>
            <ChevronRight
              size={17}
              className="text-zinc-300 group-hover:text-violet-600"
            />
          </Link>
        ))}
        {!followUps.length && (
          <div className="p-10 text-center">
            <p className="text-sm font-extrabold">A clear day ahead.</p>
            <p className="mt-1 text-sm text-zinc-400">
              No follow-ups scheduled yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
