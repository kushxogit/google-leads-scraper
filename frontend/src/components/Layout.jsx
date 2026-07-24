import { useState, useEffect } from "react";
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
  Plus,
  Users,
  X,
  Settings,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { useAuthWorkspace } from "../context/authWorkspace";
import { useNotifications } from "../hooks/useTasks";
import CommandPalette from "./CommandPalette";

const nav = [
  ["/", "Home", LayoutDashboard],
  ["/leads", "Pipeline", Users],
  ["/rewind", "Today", RotateCcw],
  ["/notes", "Notes", NotebookPen],
  ["/jobs", "Find leads", Target],
  ["/settings", "Settings", Settings],
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { user, signOut, activeWorkspace } = useAuthWorkspace();
  const notices = useNotifications();

  useEffect(() => {
    const listener = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="app-surface flex h-dvh min-h-dvh overflow-hidden p-0 md:p-3">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-3 left-3 z-50 flex w-[min(300px,calc(100vw-24px))] flex-col rounded-[28px] bg-[#171719] text-white shadow-[0_24px_80px_rgba(23,18,38,.30)] transition-all duration-300 md:static md:translate-x-0 ${
          collapsed ? "md:w-[68px] p-2" : "md:w-[250px] p-3"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-[110%]"}`}
      >
        {/* Header / Logo / Collapse Toggle */}
        <div className="flex h-12 items-center justify-between px-1">
          {collapsed ? (
            <div className="flex w-full flex-col items-center gap-2">
              <button
                onClick={() => setCollapsed(false)}
                title="Expand sidebar"
                className="grid h-9 w-9 place-items-center rounded-2xl liquid-button shadow-md transition hover:scale-105"
              >
                <Sparkles size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl liquid-button">
                  <Sparkles size={17} />
                </span>
                <span className="text-[15px] font-extrabold tracking-tight truncate">
                  LeadPilot
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCollapsed(true)}
                  title="Collapse sidebar"
                  className="hidden md:grid h-8 w-8 place-items-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition"
                >
                  <PanelLeftClose size={16} />
                </button>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="text-zinc-500 md:hidden p-1"
                >
                  <X size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Workspace Switcher / Collapsed Indicator */}
        {collapsed ? (
          <div
            className="my-3 grid h-9 w-9 mx-auto place-items-center rounded-2xl bg-white/10 text-xs font-extrabold text-violet-300 border border-white/10"
            title={activeWorkspace?.name || "Workspace"}
          >
            {(activeWorkspace?.name?.[0] || "W").toUpperCase()}
          </div>
        ) : (
          <WorkspaceSwitcher />
        )}

        {/* Navigation Items */}
        <nav className="mt-2 space-y-1.5 px-0.5">
          {nav.map(([to, label, Icon]) => (
            <NavItem
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              collapsed={collapsed}
              close={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 border-t border-white/[.08] pt-3">
              <span
                className="grid h-8 w-8 place-items-center rounded-full bg-white/[.1] text-xs font-bold text-white shadow-2xs"
                title={user?.email}
              >
                {(user?.email?.[0] || "U").toUpperCase()}
              </span>
              <button
                onClick={() => void signOut()}
                title="Sign out"
                className="text-zinc-500 hover:text-rose-400 p-1 transition"
              >
                <LogOut size={15} />
              </button>
              <button
                onClick={() => setCollapsed(false)}
                title="Expand sidebar"
                className="mt-1 text-zinc-500 hover:text-white transition"
              >
                <PanelLeftOpen size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="mx-0.5 mb-3 rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-200/70">
                  Built for momentum
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-300">
                  Every lead & next move in flow.
                </p>
              </div>

              <div className="flex items-center gap-2 border-t border-white/[.08] px-1 pt-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.1] text-xs font-bold"
                  title={user?.email}
                >
                  {(user?.email?.[0] || "U").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">
                  {user?.email}
                </span>
                <button
                  onClick={() => void signOut()}
                  title="Sign out"
                  className="text-zinc-500 hover:text-white p-1"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Viewport */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] shrink-0 items-center justify-between px-3 sm:h-[64px] sm:px-5 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="grid h-9 w-9 place-items-center rounded-2xl bg-white/70 text-zinc-600 shadow-sm md:hidden"
            >
              <Menu size={18} />
            </button>
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/55 px-3 py-1.5 text-xs font-semibold text-zinc-500 shadow-sm sm:flex"
            >
              <Search size={14} />
              <span>Search anything</span>
              <kbd className="ml-6 flex items-center gap-1 rounded-lg bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-400">
                <Command size={10} />K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCommandOpen(true)}
              aria-label="Create lead or task"
              className="glass-orb grid h-9 w-9 place-items-center rounded-2xl text-violet-600"
            >
              <Plus size={17} />
            </button>

            <div className="relative">
              <button
                onClick={() => setNoticesOpen(!noticesOpen)}
                aria-label={noticesOpen ? "Close notifications" : "Open notifications"}
                aria-expanded={noticesOpen}
                className="glass-orb relative grid h-9 w-9 place-items-center rounded-2xl text-zinc-600"
              >
                <Bell size={16} />
                {notices.unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                    {notices.unread}
                  </span>
                )}
              </button>

              {noticesOpen && (
                <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-32px))] rounded-3xl border border-white bg-white/95 p-3 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div>
                      <p className="eyebrow">Collaboration</p>
                      <p className="text-xs font-extrabold">Notifications</p>
                    </div>
                    {notices.unread > 0 && (
                      <button
                        onClick={notices.markAllRead}
                        className="flex items-center gap-1 text-xs font-bold text-violet-600"
                      >
                        <CheckCheck size={13} /> Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {notices.notifications.map((notice) => (
                      <NavLink
                        key={notice.id}
                        to={
                          notice.task_id
                            ? `/rewind?task=${notice.task_id}`
                            : notice.note_id
                              ? `/notes?note=${notice.note_id}`
                            : "/"
                        }
                        onClick={() => {
                          void notices.markRead(notice.id);
                          setNoticesOpen(false);
                        }}
                        className={`block rounded-2xl p-3 ${
                          notice.read_at ? "text-zinc-500" : "bg-violet-50 text-zinc-800"
                        }`}
                      >
                        <p className="text-xs font-extrabold">{notice.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-4 opacity-70">
                          {notice.body}
                        </p>
                      </NavLink>
                    ))}
                    {!notices.notifications.length && (
                      <p className="p-6 text-center text-xs text-zinc-400">
                        All quiet for now.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden h-9 items-center rounded-2xl border border-white/80 bg-white/55 px-3 text-xs font-bold text-zinc-600 shadow-sm sm:flex">
              Synced{" "}
              <span className="ml-2 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.16)]" />
            </div>
          </div>
        </header>

        <div className="scrollbar-thin relative flex-1 overflow-y-auto px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 md:px-5">
          {children}
        </div>
      </main>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}

function NavItem({ to, label, Icon, collapsed, close }) {
  const location = useLocation();
  const active =
    location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(to));

  if (collapsed) {
    return (
      <NavLink
        to={to}
        onClick={close}
        title={label}
        className={`group grid h-10 w-10 mx-auto place-items-center rounded-2xl transition ${
          active
            ? "bg-white text-violet-600 shadow-md font-extrabold scale-105"
            : "text-zinc-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon size={18} />
      </NavLink>
    );
  }

  return (
    <NavLink
      to={to}
      onClick={close}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2 text-xs transition ${
        active
          ? "bg-white text-zinc-950 shadow-[0_8px_20px_rgba(0,0,0,.18)] font-extrabold"
          : "text-zinc-400 hover:bg-white/[.07] hover:text-white font-semibold"
      }`}
    >
      <Icon
        size={16}
        className={`shrink-0 ${
          active ? "text-violet-600" : "text-zinc-400 group-hover:text-zinc-200"
        }`}
      />
      <span>{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />
      )}
    </NavLink>
  );
}
