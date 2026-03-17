import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const MODULES = [
  { path: '/cfg', label: 'CFG', full: 'Context Free Grammar', color: 'cfg' },
  { path: '/pda', label: 'PDA', full: 'Pushdown Automata',    color: 'pda' },
  { path: '/tm',  label: 'TM',  full: 'Turing Machine',        color: 'tm'  },
];

const colorMap: Record<string, string> = {
  cfg: 'bg-green-100 text-green-700 border-green-300',
  pda: 'bg-orange-100 text-orange-700 border-orange-300',
  tm:  'bg-rose-100 text-rose-700 border-rose-300',
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentModule = MODULES.find(m => location.pathname.startsWith(m.path));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top Nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: 'var(--surface)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center gap-4">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group shrink-0"
          >
            <div className="w-7 h-7 rounded-md bg-[var(--ink)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-[var(--ink)] group-hover:opacity-70 transition-opacity">
              TOC<span className="font-light opacity-50 ml-0.5">lab</span>
            </span>
          </button>

          <span className="text-[var(--border)] select-none">|</span>

          {/* Module Nav Pills */}
          <nav className="flex items-center gap-1.5">
            {MODULES.map(m => {
              const active = location.pathname.startsWith(m.path);
              return (
                <motion.button
                  key={m.path}
                  onClick={() => navigate(m.path)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`pill transition-all duration-150 ${
                    active ? colorMap[m.color] : 'pill-gray hover:border-[var(--ink-3)]'
                  }`}
                >
                  {m.label}
                </motion.button>
              );
            })}
          </nav>

          {/* Current page breadcrumb */}
          {currentModule && (
            <span className="ml-auto text-xs font-mono text-[var(--ink-3)] hidden sm:block truncate">
              / {currentModule.full}
            </span>
          )}
          {!currentModule && location.pathname === '/' && (
            <span className="ml-auto text-xs font-mono text-[var(--ink-3)] hidden sm:block">
              / select a simulator
            </span>
          )}
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
