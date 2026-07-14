import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Loader2, Target, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default function ScrapeJobs() {
  const [jobs, setJobs] = useState([]);
  const [formData, setFormData] = useState({
    query: '',
    niche: '',
    area: '',
    source: 'Google Maps',
    limit: 10,
    headless: true
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = () => {
    axios.get('http://localhost:3001/api/scrape-jobs')
      .then(res => setJobs(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    axios.post('http://localhost:3001/api/scrape-jobs', formData)
      .then(() => {
        setFormData({ ...formData, query: '', niche: '', area: '' });
        fetchJobs();
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4">
        <Target className="text-blue-400" size={28} />
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Scrape Jobs</h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">Automated Google Maps data extraction.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="glass p-6 rounded-lg sticky top-8">
            <h2 className="text-sm font-semibold text-zinc-300 mb-6 uppercase tracking-wider">New Job Config</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Search Query</label>
                <input 
                  type="text" 
                  placeholder="e.g. dentists in Jaipur (optional if Niche/Area provided)"
                  value={formData.query}
                  onChange={e => setFormData({...formData, query: e.target.value})}
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600 shadow-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Niche</label>
                  <input 
                    type="text" 
                    placeholder="e.g. doctor, dentist"
                    value={formData.niche}
                    onChange={e => setFormData({...formData, niche: e.target.value})}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Area</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Delhi, Noida"
                    value={formData.area}
                    onChange={e => setFormData({...formData, area: e.target.value})}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Max Leads</label>
                  <input 
                    type="number" 
                    min="1" max="100"
                    value={formData.limit}
                    onChange={e => setFormData({...formData, limit: parseInt(e.target.value)})}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Source</label>
                  <select 
                    value={formData.source}
                    onChange={e => setFormData({...formData, source: e.target.value})}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    <option>Google Maps</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2 pb-4">
                <input 
                  type="checkbox" 
                  id="headless"
                  checked={formData.headless}
                  onChange={e => setFormData({...formData, headless: e.target.checked})}
                  className="w-4 h-4 rounded text-blue-500 bg-zinc-900 border-zinc-800 focus:ring-blue-500/50 cursor-pointer"
                />
                <label htmlFor="headless" className="text-xs font-medium text-zinc-400 cursor-pointer select-none">
                  Run invisibly (Headless)
                </label>
              </div>
              
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-900/20"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Play size={16} className="mr-2" fill="currentColor" /> Start Scraping</>}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="glass rounded-lg shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-800/80 text-sm text-left">
              <thead className="bg-zinc-900/50 text-zinc-500">
                <tr>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Query</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Results</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 bg-zinc-900/20">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-200 text-sm">{job.query}</div>
                      <div className="text-xs font-medium text-zinc-500 mt-1">{job.niche} in {job.area} &bull; Target: {job.lead_limit}</div>
                    </td>
                    <td className="px-6 py-4">
                      {job.status === 'queued' && <span className="inline-flex items-center px-2.5 py-1 bg-zinc-800/80 text-zinc-400 text-xs font-medium rounded-md"><Clock size={12} className="mr-1"/> Queued</span>}
                      {job.status === 'running' && <span className="inline-flex items-center px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-md border border-blue-500/20"><Loader2 size={12} className="mr-1 animate-spin"/> Running</span>}
                      {job.status === 'completed' && <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20"><CheckCircle2 size={12} className="mr-1"/> Completed</span>}
                      {job.status === 'failed' && <span className="inline-flex items-center px-2.5 py-1 bg-rose-500/10 text-rose-400 text-xs font-medium rounded-md border border-rose-500/20"><AlertCircle size={12} className="mr-1"/> Failed</span>}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-medium text-sm">
                      <div className="flex gap-4">
                        <div title="Leads Found">Fnd: <span className="text-zinc-200">{job.found_count}</span></div>
                        <div title="Saved (Unique)" className="text-emerald-400">Sav: {job.saved_count}</div>
                      </div>
                      {job.error_message && (
                        <div className="text-xs text-rose-500 mt-1 max-w-[200px] truncate" title={job.error_message}>
                          Err: {job.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-zinc-500 whitespace-nowrap">
                      {new Date(job.created_at + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-zinc-600 font-medium text-sm">
                      No jobs in queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
