import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, Target, Menu, X } from 'lucide-react';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 glass flex flex-col border-r border-zinc-800/80
        transform transition-transform duration-300 ease-in-out bg-zinc-950
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 shrink-0 flex items-center justify-between lg:justify-center">
          <div className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 select-none flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <Target size={18} />
            </div>
            LeadPilot
          </div>
          <button className="lg:hidden text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/leads" icon={<Users size={18} />} label="Pipeline" onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/follow-ups" icon={<Clock size={18} />} label="Tasks" onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/jobs" icon={<Target size={18} />} label="Scraper" onClick={() => setMobileMenuOpen(false)} />
        </nav>

        <div className="p-6 shrink-0 border-t border-zinc-800/80">
          <div className="text-xs text-zinc-500 font-medium">
            System Online &bull; v1.0.0
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden shrink-0 h-16 border-b border-zinc-800/80 flex items-center px-4 bg-zinc-950/80 backdrop-blur-md">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="ml-4 font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            LeadPilot
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 bg-gradient-to-br from-zinc-950 to-zinc-900/50">
          {children}
        </div>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label, onClick }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <NavLink 
      to={to} 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
        isActive 
          ? 'text-white bg-blue-500/10 border border-blue-500/20 shadow-sm' 
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
      )}
      <span className={`${isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'} transition-colors`}>{icon}</span>
      {label}
    </NavLink>
  );
}
