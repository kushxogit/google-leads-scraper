import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Clock, MapPin, Phone } from 'lucide-react';

export default function FollowUps() {
  const [leads, setLeads] = useState([]);

  const fetchLeads = () => {
    axios.get('http://localhost:3001/api/leads')
      .then(res => setLeads(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const followUps = leads.filter(l => l.follow_up_date && l.follow_up_date <= today && l.status !== 'won' && l.status !== 'lost' && l.status !== 'do_not_contact');

  const markDone = (id) => {
    axios.patch(`http://localhost:3001/api/leads/${id}`, { follow_up_date: null }).then(fetchLeads);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8 border-b border-zinc-800/80 pb-4">
        <Clock className="text-blue-400" size={28} />
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Today's Tasks</h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">Follow ups and scheduled tasks for today.</p>
        </div>
      </div>

      <div className="space-y-4">
        {followUps.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center border-2 border-dashed border-zinc-800/80">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-zinc-300">All Caught Up!</h3>
            <p className="text-zinc-500 mt-2 text-sm">No follow-ups due today.</p>
          </div>
        ) : (
          followUps.map(lead => {
            const isOverdue = lead.follow_up_date < today;
            return (
              <div key={lead.id} className="bg-zinc-900/60 p-5 rounded-lg flex items-center justify-between group hover:border-blue-500/30 hover:bg-zinc-800/60 transition-all border border-zinc-800/80 shadow-sm">
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <button 
                    onClick={() => markDone(lead.id)}
                    className="shrink-0 w-6 h-6 rounded-md border border-zinc-700 text-transparent hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all"
                    title="Mark as done"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <div className="min-w-0 pr-4">
                    <Link to={`/leads/${lead.id}`} className="font-semibold text-base text-zinc-200 hover:text-blue-400 block truncate leading-tight">
                      {lead.business_name}
                    </Link>
                    <div className="flex items-center gap-4 text-xs font-medium mt-2">
                      <span className={`px-2 py-0.5 rounded-md border ${isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {isOverdue ? 'Overdue' : 'Today'}
                      </span>
                      <span className="text-zinc-500 flex items-center gap-1"><MapPin size={12}/> {lead.niche}</span>
                      {lead.phone && <span className="text-zinc-500 flex items-center gap-1"><Phone size={12}/> {lead.phone}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="hidden sm:block shrink-0 w-1/3 border-l border-zinc-800/80 pl-4 h-full">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Remarks</p>
                  <p className="text-sm text-zinc-400 line-clamp-2" title={lead.remarks}>{lead.remarks || 'No remarks added'}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
