import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const MODULES = [
  { path: '/cfg', label: 'CFG', color: 'cfg' },
  { path: '/pda', label: 'PDA', color: 'pda' },
  { path: '/tm',  label: 'TM',  color: 'tm'  },
];

const colorMap: Record<string, string> = {
  cfg: 'bg-green-100 text-green-700 border-green-300',
  pda: 'bg-orange-100 text-orange-700 border-orange-300',
  tm:  'bg-rose-100 text-rose-700 border-rose-300',
};

const darkColorMap: Record<string, string> = {
  cfg: 'bg-green-900/40 text-green-400 border-green-700',
  pda: 'bg-orange-900/40 text-orange-400 border-orange-700',
  tm:  'bg-rose-900/40 text-rose-400 border-rose-800',
};

export default function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('toc-theme') === 'dark';
    }
    return false;
  });

  // Apply / remove dark class on <html>, persist choice
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('toc-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('toc-theme', 'light');
    }
  }, [dark]);

  const currentModule = MODULES.find(m => location.pathname.startsWith(m.path));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top Nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: 'var(--surface)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center gap-4">

          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2 group shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'var(--ink)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="var(--bg)"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="var(--bg)" opacity="0.7"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="var(--bg)" opacity="0.7"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="var(--bg)" opacity="0.35"/>
              </svg>
            </div>
            <span className="font-bold text-sm group-hover:opacity-70 transition-opacity" style={{ color: 'var(--ink)' }}>
              TOC<span className="font-light opacity-50 ml-0.5">lab</span>
            </span>
          </button>

          <span className="text-[var(--border)] select-none">|</span>

          {/* Module pills */}
          <nav className="flex items-center gap-1.5">
            {MODULES.map(m => {
              const active = location.pathname.startsWith(m.path);
              const activeClass = dark ? darkColorMap[m.color] : colorMap[m.color];
              return (
                <motion.button key={m.path} onClick={() => navigate(m.path)}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
                  className={`pill transition-all duration-150 ${active ? activeClass : 'pill-gray hover:border-[var(--ink-3)]'}`}>
                  {m.label}
                </motion.button>
              );
            })}
          </nav>

          {/* Simulator breadcrumb (module pages only) */}
          {currentModule && (
            <span className="ml-auto text-xs font-mono text-[var(--ink-3)] hidden sm:block truncate">
              / {currentModule.label}
            </span>
          )}

          {/* Dark / Light toggle */}
          <motion.button
            onClick={() => setDark(d => !d)}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="ml-auto shrink-0 w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center transition-colors hover:border-[var(--ink-3)]"
            style={{ background: 'var(--bg-2)', marginLeft: currentModule ? 8 : 'auto' }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <motion.div
              initial={false}
              animate={{ rotate: dark ? 180 : 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {dark
                ? <Sun  size={14} style={{ color: 'var(--ink-3)' }} />
                : <Moon size={14} style={{ color: 'var(--ink-3)' }} />
              }
            </motion.div>
          </motion.button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
