import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Globe, Users, Briefcase, LayoutDashboard } from 'lucide-react';

export default function DashboardOverview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:3001/api/leads/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  }, []);

  if (!stats) return <div className="animate-pulse text-zinc-500 font-bold uppercase tracking-widest">// LOADING_DASHBOARD</div>;

  const chartData = [
    { name: 'New', count: stats.total - stats.called - stats.interested - stats.wonDeals },
    { name: 'Called', count: stats.called },
    { name: 'Interested', count: stats.interested },
    { name: 'Follow-Ups', count: stats.followUps },
    { name: 'Won', count: stats.wonDeals }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8 border-b border-zinc-800/80 pb-4">
        <LayoutDashboard className="text-blue-400" size={28} />
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Overview</h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">System performance and lead metrics.</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Leads" value={stats.total} icon={<Users size={24} />} color="blue" />
        <StatCard title="High Priority" value={stats.highPriority} icon={<TrendingUp size={24} />} color="emerald" />
        <StatCard title="No Website" value={stats.noWebsite} icon={<Globe size={24} />} color="rose" />
        <StatCard title="Proposals Sent" value={stats.proposalsSent} icon={<Briefcase size={24} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass p-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-6 uppercase tracking-wider">Pipeline Metrics</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#18181b'}} 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#60a5fa' }} 
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-6 flex flex-col justify-center">
          <h2 className="text-sm font-semibold text-zinc-400 mb-6 uppercase tracking-wider">Action Items</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
              <span className="text-zinc-400 font-medium text-sm">Follow Ups Due</span>
              <span className="text-xl font-bold text-blue-400">{stats.followUps}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
              <span className="text-zinc-400 font-medium text-sm">Won Deals</span>
              <span className="text-xl font-bold text-emerald-400">{stats.wonDeals}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colorMap = {
    blue: 'text-blue-400 border-blue-400/20 bg-blue-500/10',
    emerald: 'text-emerald-400 border-emerald-400/20 bg-emerald-500/10',
    rose: 'text-rose-400 border-rose-400/20 bg-rose-500/10',
    amber: 'text-amber-400 border-amber-400/20 bg-amber-500/10',
  };
  
  return (
    <div className={`glass p-6 cyber-glow group flex items-start justify-between`}>
      <div>
        <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
        <h3 className="text-4xl font-bold text-zinc-100">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl border ${colorMap[color]}`}>
        {icon}
      </div>
    </div>
  );
}
