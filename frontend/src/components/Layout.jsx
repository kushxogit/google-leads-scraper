import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sparkles,
  Target,
  RotateCcw,
  Users,
  X,
  Clock3,
  Settings,
} from "lucide-react";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { useAuthWorkspace } from "../context/AuthWorkspaceContext";
import { useNotifications } from "../hooks/useTasks";

const nav = [
  ["/", "Home", LayoutDashboard],
  ["/leads", "Pipeline", Users],
  ["/rewind", "Rewind", RotateCcw],
  ["/follow-ups", "Follow-ups", Clock3],
  ["/jobs", "Scraper", Target],
  ["/settings", "Settings", Settings],
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const { user, signOut } = useAuthWorkspace();
  const notices = useNotifications();
  return (
    <div className="app-surface flex h-screen overflow-hidden p-0 md:p-3">
      <aside
        className={`fixed inset-y-3 left-3 z-50 flex w-[260px] flex-col rounded-[28px] bg-[#171719] p-3 text-white shadow-[0_24px_80px_rgba(23,18,38,.30)] transition-transform md:static md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-[110%]"}`}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl liquid-button">
              <Sparkles size={17} />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight">
              LeadPilot
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-zinc-500 md:hidden"
          >
            <X />
          </button>
        </div>
        <WorkspaceSwitcher />
        <nav className="mt-4 space-y-1 px-1">
          {nav.map(([to, label, Icon]) => (
            <NavItem
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              close={() => setMobileOpen(false)}
            />
          ))}
        </nav>
        <div className="mt-auto">
          <div className="mx-1 mb-3 rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-200/70">
              Built for momentum
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-300">
              Every lead, signal, and next move in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 border-t border-white/[.08] px-2 pt-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[.1] text-xs font-bold">
              {(user?.email?.[0] || "U").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">
              {user?.email}
            </span>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="text-zinc-500 hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[76px] shrink-0 items-center justify-between px-5 md:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-2xl bg-white/70 text-zinc-600 shadow-sm md:hidden"
            >
              <Menu size={19} />
            </button>
            <div className="hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/55 px-3 py-2 text-xs font-semibold text-zinc-500 shadow-sm sm:flex">
              <Search size={15} />
              <span>Search anything</span>
              <kbd className="ml-8 flex items-center gap-1 rounded-lg bg-zinc-100 px-1.5 py-1 text-[10px] text-zinc-400">
                <Command size={10} />K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNoticesOpen(!noticesOpen)}
                className="glass-orb relative grid h-10 w-10 place-items-center rounded-2xl text-zinc-600"
              >
                <Bell size={17} />
                {notices.unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                    {notices.unread}
                  </span>
                )}
              </button>
              {noticesOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] rounded-3xl border border-white bg-white/95 p-3 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div>
                      <p className="eyebrow">Collaboration</p>
                      <p className="text-sm font-extrabold">Notifications</p>
                    </div>
                    {notices.unread > 0 && (
                      <button
                        onClick={notices.markAllRead}
                        className="flex items-center gap-1 text-xs font-bold text-violet-600"
                      >
                        <CheckCheck size={14} /> Mark read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {notices.notifications.map((notice) => (
                      <NavLink
                        key={notice.id}
                        to={notice.task_id ? "/rewind" : "#"}
                        onClick={() => setNoticesOpen(false)}
                        className={`block rounded-2xl p-3 ${notice.read_at ? "text-zinc-500" : "bg-violet-50 text-zinc-800"}`}
                      >
                        <p className="text-sm font-extrabold">{notice.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-70">
                          {notice.body}
                        </p>
                      </NavLink>
                    ))}
                    {!notices.notifications.length && (
                      <p className="p-6 text-center text-sm text-zinc-400">
                        All quiet for now.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden h-10 items-center rounded-2xl border border-white/80 bg-white/55 px-3 text-xs font-bold text-zinc-600 shadow-sm sm:flex">
              Realtime synced{" "}
              <span className="ml-2 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.16)]" />
            </div>
          </div>
        </header>
        <div className="scrollbar-thin relative flex-1 overflow-y-auto px-4 pb-6 md:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
function NavItem({ to, label, Icon, close }) {
  const location = useLocation();
  const active =
    location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(to));
  return (
    <NavLink
      to={to}
      onClick={close}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${active ? "bg-white text-zinc-950 shadow-[0_8px_20px_rgba(0,0,0,.18)]" : "text-zinc-400 hover:bg-white/[.07] hover:text-white"}`}
    >
      <Icon
        size={16}
        className={
          active ? "text-violet-600" : "text-zinc-500 group-hover:text-zinc-300"
        }
      />
      <span className="font-bold">{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />
      )}
    </NavLink>
  );
}
