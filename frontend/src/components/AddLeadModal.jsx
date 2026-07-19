import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

export default function AddLeadModal({ isOpen, onClose, onLeadAdded }) {
  const [formData, setFormData] = useState({
    business_name: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    niche: '',
    area: '',
    status: 'new',
    remarks: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/leads', formData);
      onLeadAdded();
      onClose();
      setFormData({
        business_name: '', phone: '', email: '', website: '', address: '',
        niche: '', area: '', status: 'new', remarks: ''
      });
    } catch (err) {
      console.error(err);
      alert('Failed to add lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Add Custom Lead</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Business Name *</label>
              <input required name="business_name" value={formData.business_name} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="e.g. Acme Corp" />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Phone</label>
              <input name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="+1 234 567 890" />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="contact@acme.com" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Website</label>
              <input name="website" value={formData.website} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="https://acme.com" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors appearance-none">
                <option value="new">New</option>
                <option value="to_call">To Call</option>
                <option value="called">Called</option>
                <option value="follow_up">Follow Up</option>
                <option value="interested">Interested</option>
                <option value="proposal_sent">Proposal Sent</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Niche</label>
              <input name="niche" value={formData.niche} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="e.g. Plumbers" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Area</label>
              <input name="area" value={formData.area} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="e.g. New York" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Address</label>
              <input name="address" value={formData.address} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors" placeholder="123 Main St, NY" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Remarks</label>
              <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="2" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors resize-none" placeholder="Any additional notes..." />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
