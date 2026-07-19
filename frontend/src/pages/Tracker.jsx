import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Save, X, Plus } from 'lucide-react';
import AddLeadModal from '../components/AddLeadModal';

export default function Tracker() {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState('priority'); // priority, name, newest
  
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const fetchLeads = () => {
    axios.get('http://localhost:3001/api/leads')
      .then(res => setLeads(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const uniqueNiches = [...new Set(leads.map(l => l.niche).filter(Boolean))].sort();
  const statuses = ['new', 'to_call', 'called', 'follow_up', 'interested', 'proposal_sent', 'won', 'lost'];

  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.business_name && l.business_name.toLowerCase().includes(filter.toLowerCase())) || 
                          (l.niche && l.niche.toLowerCase().includes(filter.toLowerCase()));
    const matchesNiche = nicheFilter === '' || l.niche === nicheFilter;
    const matchesStatus = statusFilter === '' || l.status === statusFilter;
    return matchesSearch && matchesNiche && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return (a.business_name || '').localeCompare(b.business_name || '');
    } else if (sortBy === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else {
      // Priority sort: everything not 'new' or 'lost' at top
      const getPriority = (status) => {
        if (status === 'lost' || status === 'rejected') return 3;
        if (status === 'new') return 2;
        return 1;
      };
      const pA = getPriority(a.status);
      const pB = getPriority(b.status);
      if (pA !== pB) return pA - pB;
      return (b.score || 0) - (a.score || 0); // fallback to score
    }
  });

  const handleEditClick = (lead) => {
    setEditingId(lead.id);
    setEditFormData({ ...lead });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleEditChange = (e) => {
    setEditFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveEdit = async (id) => {
    try {
      await axios.patch(`http://localhost:3001/api/leads/${id}`, editFormData);
      setEditingId(null);
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert('Failed to save changes');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`http://localhost:3001/api/leads/${id}`, { status: newStatus });
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 flex flex-col h-full max-w-full overflow-hidden">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center shrink-0 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">CRM Tracker</h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">Spreadsheet view for managing all your leads.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
            <Plus size={16} /> Add Custom Lead
          </button>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 w-full sm:w-40 focus:outline-none focus:border-blue-500/50 text-sm appearance-none shadow-sm cursor-pointer"
          >
            <option value="priority">Sort: Active First</option>
            <option value="newest">Sort: Newest</option>
            <option value="name">Sort: Name</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 w-full sm:w-40 focus:outline-none focus:border-blue-500/50 text-sm appearance-none shadow-sm cursor-pointer"
          >
            <option value="">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
          <select
            value={nicheFilter}
            onChange={e => setNicheFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 w-full sm:w-40 focus:outline-none focus:border-blue-500/50 text-sm appearance-none shadow-sm cursor-pointer"
          >
            <option value="">All Niches</option>
            {uniqueNiches.map(niche => (
              <option key={niche} value={niche}>{niche}</option>
            ))}
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

      <div className="flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-sm relative">
        <table className="w-full text-sm text-left text-zinc-300">
          <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/80 sticky top-0 z-10 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Business Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Niche</th>
              <th className="px-4 py-3 font-medium">Area</th>
              <th className="px-4 py-3 font-medium">Remarks</th>
              <th className="px-4 py-3 font-medium text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 bg-zinc-950/30">
            {filteredLeads.map(lead => {
              const isEditing = editingId === lead.id;
              
              return (
                <tr key={lead.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input name="business_name" value={editFormData.business_name || ''} onChange={handleEditChange} className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white" />
                    ) : (
                      <span className="font-medium text-zinc-200">{lead.business_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <select name="status" value={editFormData.status || ''} onChange={handleEditChange} className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white appearance-none">
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <select 
                        value={lead.status || ''} 
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 ${
                          lead.status === 'won' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          lead.status === 'interested' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {statuses.map(s => <option key={s} value={s} className="bg-zinc-900 text-zinc-300">{s.replace('_', ' ')}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input name="phone" value={editFormData.phone || ''} onChange={handleEditChange} className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white" />
                    ) : (
                      <span className="text-zinc-400">{lead.phone || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input name="niche" value={editFormData.niche || ''} onChange={handleEditChange} className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white" />
                    ) : (
                      <span className="text-zinc-400">{lead.niche || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input name="area" value={editFormData.area || ''} onChange={handleEditChange} className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white" />
                    ) : (
                      <span className="text-zinc-400">{lead.area || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input name="remarks" value={editFormData.remarks || ''} onChange={handleEditChange} className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white" />
                    ) : (
                      <span className="text-zinc-500 truncate block max-w-[200px]" title={lead.remarks}>{lead.remarks || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <div className="flex justify-end items-center gap-2">
                        <button onClick={() => handleSaveEdit(lead.id)} className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-blue-500/10 transition-colors" title="Save">
                          <Save size={16} />
                        </button>
                        <button onClick={handleCancelEdit} className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors" title="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleEditClick(lead)} className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Edit row">
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                  No leads found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onLeadAdded={fetchLeads} />
    </div>
  );
}
