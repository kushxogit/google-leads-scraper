import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Phone, Globe, MessageSquare, Clock, AlertCircle, CheckCircle2, Copy, Check, ArrowLeft } from 'lucide-react';

export default function LeadDetail() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchLead = () => {
    axios.get(`http://localhost:3001/api/leads/${id}`)
      .then(res => setLead(res.data))
      .catch(err => console.error(err));
  };

  const fetchInteractions = () => {
    axios.get(`http://localhost:3001/api/leads/${id}/interactions`)
      .then(res => setInteractions(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchLead();
    fetchInteractions();
  }, [id]);

  const updateLead = (field, value) => {
    axios.patch(`http://localhost:3001/api/leads/${id}`, { [field]: value }).then(fetchLead);
  };

  const addInteraction = (e) => {
    e.preventDefault();
    if (!note) return;
    axios.post(`http://localhost:3001/api/leads/${id}/interactions`, { type: 'note', notes: note })
      .then(() => {
        setNote('');
        fetchInteractions();
      });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!lead) return <div className="animate-pulse text-zinc-500 font-bold uppercase tracking-widest">// LOADING_PROFILE</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header section */}
      <div className="flex items-center gap-4 border-b border-zinc-800/80 pb-6">
        <Link to="/leads" className="text-zinc-500 hover:text-blue-400 transition-colors p-2 hover:bg-zinc-900 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight truncate">{lead.business_name}</h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">
            {lead.niche} &bull; {lead.area}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column - Details & Pitch */}
        <div className="flex-1 w-full space-y-6">
          <div className="glass p-8 rounded-lg">
            <h2 className="text-sm font-semibold text-zinc-400 mb-6 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span> Lead Profile
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start mb-8">
              {/* Score visualizer */}
              <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="8" />
                  <circle 
                    cx="50" cy="50" r="45" fill="none" 
                    stroke={lead.score >= 70 ? '#34d399' : '#60a5fa'} 
                    strokeWidth="8" 
                    strokeDasharray={`${Math.max(0, lead.score * 2.83)} 283`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${lead.score >= 70 ? 'text-emerald-400' : 'text-blue-400'}`}>{lead.score}</span>
                  <span className="text-xs text-zinc-500 font-medium mt-1">Score</span>
                </div>
              </div>

              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-xs text-zinc-500 font-medium mb-1">Phone</p>
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-sm font-semibold text-blue-400 hover:underline truncate block">{lead.phone}</a>
                  ) : <span className="text-zinc-600 text-sm">N/A</span>}
                </div>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-xs text-zinc-500 font-medium mb-1">Website</p>
                  {lead.website && lead.website !== 'N/A' ? (
                    <a href={lead.website} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-400 hover:underline truncate block">Visit Site</a>
                  ) : <span className="text-rose-400 text-sm font-medium">No Website</span>}
                </div>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-xs text-zinc-500 font-medium mb-1">Google Maps</p>
                  {lead.source_url ? (
                    <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-400 hover:underline truncate block">View Profile</a>
                  ) : <span className="text-zinc-600 text-sm">N/A</span>}
                </div>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg sm:col-span-3">
                  <p className="text-xs text-zinc-500 font-medium mb-1">Reviews & Rating</p>
                  <p className="text-zinc-300 font-medium text-sm">
                    {lead.rating ? `${lead.rating} ⭐` : 'N/A'} 
                    <span className="text-zinc-700 mx-2">|</span> 
                    {lead.reviews ? `${lead.reviews} Reviews` : '0 Reviews'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800/80 pt-6">
              <h3 className="text-xs text-zinc-400 font-semibold mb-3">Score Breakdown</h3>
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80">
                <pre className="text-sm text-zinc-400 font-mono leading-relaxed overflow-x-auto">
                  {lead.score_breakdown}
                </pre>
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
              <MessageSquare className="text-blue-400" size={20} /> Pitch Generator
            </h2>
            
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Recommended Offer</h3>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-blue-400 font-medium text-sm">
                {lead.recommended_offer}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Phone size={14}/> Primary: Call Script</h3>
                <button 
                  onClick={() => copyToClipboard(lead.templates?.call)}
                  className="flex items-center text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-md"
                >
                  {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/80 p-5 rounded-lg text-sm text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap selection:bg-emerald-900">
                {lead.templates?.call}
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1"><MessageSquare size={14}/> Secondary: WhatsApp</h3>
                <button 
                  onClick={() => copyToClipboard(lead.templates?.whatsapp)}
                  className="flex items-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-md"
                >
                  {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/80 p-5 rounded-lg text-sm text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap selection:bg-blue-900">
                {lead.templates?.whatsapp}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">✉️ Email Outreach</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => copyToClipboard(lead.templates?.emailBody)}
                    className="flex items-center text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-3 py-1.5 rounded-md"
                  >
                    {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                    Copy
                  </button>
                  {lead.email && (
                    <a 
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(lead.templates?.emailSubject || '')}&body=${encodeURIComponent(lead.templates?.emailBody || '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center text-xs font-medium text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-1.5 rounded-md"
                    >
                      Open in Gmail
                    </a>
                  )}
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/80 p-5 rounded-lg text-sm text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap selection:bg-purple-900">
                <span className="text-zinc-500 font-medium block mb-2">Subject: {lead.templates?.emailSubject}</span>
                {lead.templates?.emailBody}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Actions & Tracking */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
          <div className="glass p-6 rounded-lg sticky top-8">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4 tracking-wide">Pipeline Status</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Stage</label>
                <select 
                  value={lead.status} 
                  onChange={(e) => updateLead('status', e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none appearance-none cursor-pointer shadow-sm"
                >
                  <option value="new">New</option>
                  <option value="to_call">To Call</option>
                  <option value="called">Called</option>
                  <option value="interested">Interested</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="do_not_contact">Do Not Contact</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={lead.email || ''} 
                  onChange={(e) => updateLead('email', e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Follow-up Date</label>
                <input 
                  type="date" 
                  value={lead.follow_up_date || ''} 
                  onChange={(e) => updateLead('follow_up_date', e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none shadow-sm"
                />
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="called"
                  checked={lead.called}
                  onChange={(e) => updateLead('called', e.target.checked ? 1 : 0)}
                  className="w-4 h-4 rounded text-blue-500 bg-zinc-900 border-zinc-800 focus:ring-blue-500/50"
                />
                <label htmlFor="called" className="text-sm font-medium text-zinc-400 cursor-pointer select-none">
                  Mark as Called
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">General Remarks</label>
                <textarea 
                  value={lead.remarks || ''} 
                  onChange={(e) => updateLead('remarks', e.target.value)}
                  rows="3"
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none resize-none placeholder:text-zinc-600 shadow-sm"
                  placeholder="Private notes..."
                />
              </div>
            </div>

            <hr className="my-6 border-zinc-800/80" />

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-zinc-100 tracking-wide">Logs & Activity</h2>
              <button 
                onClick={() => {
                  if(window.confirm('Are you sure you want to delete this lead?')) {
                    axios.delete(`http://localhost:3001/api/leads/${id}`).then(() => window.location.href = '/leads');
                  }
                }}
                className="text-xs text-rose-500 hover:text-rose-400 font-medium px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
            
            <form onSubmit={addInteraction} className="mb-6 space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  required
                  placeholder="Add a note..." 
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="flex-1 bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 text-sm focus:border-blue-500/50 outline-none placeholder:text-zinc-600 shadow-sm"
                />
                <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-zinc-700 shadow-sm">
                  Add
                </button>
              </div>
            </form>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
              {interactions.map(int => (
                <div key={int.id} className="relative pl-4 border-l-2 border-zinc-800">
                  <div className="absolute w-2 h-2 bg-zinc-700 rounded-full -left-[5px] top-1.5"></div>
                  <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mb-1">
                    {new Date(int.created_at + 'Z').toLocaleString()}
                  </div>
                  {int.type === 'note' ? (
                    <p className="text-sm text-zinc-300">{int.notes}</p>
                  ) : (
                    <p className="text-sm text-zinc-300">
                      <span className="text-blue-400 font-medium capitalize">{int.type}:</span> {int.notes}
                    </p>
                  )}
                </div>
              ))}
              {interactions.length === 0 && (
                <p className="text-zinc-600 text-xs italic">No activity logs yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
