import { Link } from "react-router-dom";
import { useWorkspaceLeads } from "../hooks/useCrm";
import { Table2 } from "lucide-react";

export default function Tracker() {
  const { leads, isLoading, updateLead } = useWorkspaceLeads();
  if (isLoading)
    return <div className="panel p-8 text-zinc-500">Loading tracker…</div>;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <p className="eyebrow">Workspace database</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-[-.06em]">
          Lead tracker
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Fast inline updates without leaving your flow.
        </p>
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-violet-100 text-violet-600">
            <Table2 size={17} />
          </span>
          <span className="text-sm font-extrabold">All opportunities</span>
          <span className="mono ml-auto text-xs text-zinc-400">
            {leads.length} records
          </span>
        </div>
        <div className="divide-y divide-zinc-100 md:hidden">
          {leads.map((lead) => (
            <article key={lead.id} className="space-y-3 px-5 py-4">
              <div>
                <Link
                  className="font-extrabold text-zinc-800 hover:text-violet-700"
                  to={`/leads/${lead.id}`}
                >
                  {lead.business_name}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {lead.company || lead.niche || "Opportunity"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">
                  {lead.phone || "â€”"} Â· Updated {new Date(lead.updated_at).toLocaleDateString()}
                </span>
                <select
                  value={lead.status}
                  onChange={(e) =>
                    updateLead(lead.id, { status: e.target.value })
                  }
                  className="control py-1.5 text-xs"
                  aria-label={`Change stage for ${lead.business_name}`}
                >
                  <option>new</option>
                  <option>contacted</option>
                  <option>qualified</option>
                  <option>proposal</option>
                  <option>won</option>
                  <option>lost</option>
                </select>
              </div>
            </article>
          ))}
          {!leads.length && (
            <p className="p-10 text-center text-zinc-400">No opportunities yet.</p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-zinc-50 text-[10px] font-extrabold uppercase tracking-[.14em] text-zinc-400">
              <tr>
                <th className="px-5 py-3">Opportunity</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition hover:bg-violet-50/45">
                  <td className="px-5 py-4">
                    <Link
                      className="font-extrabold text-zinc-800 hover:text-violet-700"
                      to={`/leads/${lead.id}`}
                    >
                      {lead.business_name}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {lead.company || lead.niche || "Opportunity"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-zinc-500">
                    {lead.phone || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        updateLead(lead.id, { status: e.target.value })
                      }
                      className="control py-1.5 text-xs"
                    >
                      <option>new</option>
                      <option>contacted</option>
                      <option>qualified</option>
                      <option>proposal</option>
                      <option>won</option>
                      <option>lost</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-400">
                    {new Date(lead.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!leads.length && (
                <tr>
                  <td colSpan="4" className="p-10 text-center text-zinc-400">
                    No opportunities yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
