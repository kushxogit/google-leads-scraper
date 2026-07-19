import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Phone, Globe, MoreHorizontal, MessageCircle, MapPin } from 'lucide-react';
import Papa from 'papaparse';
import AddLeadModal from '../components/AddLeadModal';

export default function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const [nicheFilter, setNicheFilter] = useState('');

  const [scoreFilter, setScoreFilter] = useState('all');

  const fetchLeads = () => {
    axios.get('http://localhost:3001/api/leads')
      .then(res => setLeads(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const uniqueNiches = [...new Set(leads.map(l => l.niche).filter(Boolean))].sort();

  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.business_name && l.business_name.toLowerCase().includes(filter.toLowerCase())) || 
                          (l.niche && l.niche.toLowerCase().includes(filter.toLowerCase()));
    const matchesNiche = nicheFilter === '' || l.niche === nicheFilter;
    
    let matchesScore = true;
    if (scoreFilter === 'high') matchesScore = l.score >= 70;
    else if (scoreFilter === 'medium') matchesScore = l.score >= 40 && l.score < 70;
    else if (scoreFilter === 'low') matchesScore = l.score < 40;

    return matchesSearch && matchesNiche && matchesScore;
  });

  const columns = [
    { title: 'New & To Call', statuses: ['new', 'to_call'], dropStatus: 'to_call' },
    { title: 'In Progress', statuses: ['called', 'follow_up'], dropStatus: 'called' },
    { title: 'Hot Leads', statuses: ['interested', 'proposal_sent'], dropStatus: 'interested' },
    { title: 'Won', statuses: ['won'], dropStatus: 'won' }
  ];

  const exportCSV = () => {
    const csv = Papa.unparse(filteredLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'leads_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        axios.post('http://localhost:3001/api/leads/import', { leads: results.data })
          .then(res => {
            alert(`Imported ${res.data.importedCount} leads. Skipped ${res.data.duplicateCount} duplicates.`);
            fetchLeads();
          })
          .catch(err => {
            console.error(err);
            alert('Failed to import CSV');
          });
      }
    });
    e.target.value = '';
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId && targetStatus) {
      axios.patch(`http://localhost:3001/api/leads/${leadId}`, { status: targetStatus })
        .then(() => fetchLeads())
        .catch(err => {
          console.error('Failed to update status on drop', err);
          alert('Failed to update status');
        });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Required to allow dropping
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col max-w-full overflow-hidden">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center shrink-0 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Pipeline</h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">Track and manage your leads.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
            Add Lead
          </button>
          <button onClick={exportCSV} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
            Export CSV
          </button>
          <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap text-center">
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          <select
            value={nicheFilter}
            onChange={e => setNicheFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 w-full sm:w-48 focus:outline-none focus:border-blue-500/50 appearance-none text-sm font-medium cursor-pointer shadow-sm"
          >
            <option value="">All Niches</option>
            {uniqueNiches.map(niche => (
              <option key={niche} value={niche}>{niche}</option>
            ))}
          </select>
          <select
            value={scoreFilter}
            onChange={e => setScoreFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 w-full sm:w-40 focus:outline-none focus:border-blue-500/50 appearance-none text-sm font-medium cursor-pointer shadow-sm"
          >
            <option value="all">All Scores</option>
            <option value="high">High (70+)</option>
            <option value="medium">Medium (40-69)</option>
            <option value="low">Low (&lt; 40)</option>
          </select>
          <input 
            type="text" 
            placeholder="Search leads..." 
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 w-full sm:w-64 focus:outline-none focus:border-blue-500/50 text-sm placeholder:text-zinc-600 shadow-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 flex-1 items-start scrollbar-hide">
        {columns.map(col => {
          const colLeads = filteredLeads.filter(l => col.statuses.includes(l.status));
          return (
            <div 
              key={col.title} 
              className="flex-shrink-0 w-80 glass p-4 flex flex-col max-h-full"
              onDrop={(e) => handleDrop(e, col.dropStatus)}
              onDragOver={handleDragOver}
            >
              <div className="flex justify-between items-center mb-4 px-1 pb-2 border-b border-zinc-800/80">
                <h3 className="font-semibold text-zinc-300 text-sm">{col.title}</h3>
                <span className="bg-zinc-800 text-zinc-400 text-xs font-medium px-2 py-0.5 rounded-full">{colLeads.length}</span>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 scrollbar-hide pr-1">
                {colLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} refresh={fetchLeads} />
                ))}
                {colLeads.length === 0 && (
                  <div className="text-center p-4 text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
                    No leads found
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onLeadAdded={fetchLeads} />
    </div>
  );
}

function LeadCard({ lead, refresh }) {
  const updateStatus = (newStatus) => {
    axios.patch(`http://localhost:3001/api/leads/${lead.id}`, { status: newStatus }).then(refresh);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div 
      draggable={true}
      onDragStart={handleDragStart}
      className="bg-zinc-900/80 border border-zinc-800/80 p-4 cursor-grab active:cursor-grabbing hover:border-blue-500/30 hover:bg-zinc-800/60 transition-all duration-300 group relative rounded-lg shadow-sm"
    >
      <div className="flex justify-between items-start mb-2">
        <Link to={`/leads/${lead.id}`} className="font-semibold text-zinc-200 text-sm leading-tight hover:text-blue-400 block pr-6 truncate">
          {lead.business_name}
        </Link>
        <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${lead.score >= 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
          {lead.score}
        </span>
      </div>
      
      <div className="text-xs text-zinc-500 mb-3 font-medium truncate">
        {lead.niche} &bull; {lead.area}
      </div>

      <div className="flex items-center gap-3 mt-4 text-zinc-500">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="hover:text-blue-400 transition-colors" title={lead.phone}>
            <Phone size={14} />
          </a>
        ) : <Phone size={14} className="opacity-20" />}
        
        {lead.website && lead.website !== 'N/A' ? (
          <a href={lead.website} target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors" title="Visit website">
            <Globe size={14} />
          </a>
        ) : <Globe size={14} className="opacity-20 text-rose-900" />}

        {lead.source_url ? (
          <a href={lead.source_url} target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors" title="Google Maps Profile">
            <MapPin size={14} />
          </a>
        ) : <MapPin size={14} className="opacity-20" />}

        {lead.phone && (
          <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors ml-auto" title="WhatsApp">
            <MessageCircle size={14} />
          </a>
        )}
      </div>

      {/* Hover Actions Menu */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 border border-zinc-700 flex flex-col p-1 z-10 rounded-lg shadow-xl">
        {lead.status !== 'called' && (
          <button onClick={() => updateStatus('called')} className="text-left text-xs font-medium px-3 py-1.5 hover:bg-zinc-700 rounded-md text-zinc-300 hover:text-white transition-colors">Mark Called</button>
        )}
        {lead.status !== 'interested' && (
          <button onClick={() => updateStatus('interested')} className="text-left text-xs font-medium px-3 py-1.5 hover:bg-zinc-700 rounded-md text-zinc-300 hover:text-white transition-colors">Mark Interested</button>
        )}
      </div>
    </div>
  );
}
