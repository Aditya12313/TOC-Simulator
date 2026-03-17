import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, Layers, Cpu, ArrowRight, Zap, BookOpen, ChevronRight } from 'lucide-react';

const simulators = [
  {
    id: 'cfg',
    path: '/cfg',
    title: 'Context Free Grammar',
    subtitle: 'CFG Simulator',
    description: 'Define production rules and explore string derivations, parse trees, ambiguity detection, and grammar transformations to CNF. Powered by CYK membership testing.',
    icon: GitBranch,
    gradient: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.15)',
    borderGlow: 'rgba(16,185,129,0.3)',
    features: ['Leftmost & Rightmost Derivation', 'Parse Tree Visualization', 'Ambiguity Detection', 'CNF Conversion', 'Pumping Lemma', 'CYK Membership Test'],
    accent: 'text-emerald-400',
    tag: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  },
  {
    id: 'pda',
    path: '/pda',
    title: 'Pushdown Automata',
    subtitle: 'PDA Simulator',
    description: 'Model stack-based computation with full nondeterminism support. Visualize push/pop operations step-by-step and trace all computation paths.',
    icon: Layers,
    gradient: 'from-primary-500 to-blue-500',
    glow: 'rgba(14,165,233,0.15)',
    borderGlow: 'rgba(14,165,233,0.3)',
    features: ['Step-by-step Stack Viz', 'Nondeterminism Handling', 'Acceptance by Final State / Empty Stack', 'Configuration Trace Table', 'CFG ↔ PDA Conversion'],
    accent: 'text-primary-400',
    tag: 'bg-primary-500/10 border-primary-500/20 text-primary-400',
  },
  {
    id: 'tm',
    path: '/tm',
    title: 'Turing Machine',
    subtitle: 'TM Simulator',
    description: 'Simulate an infinite tape Turing Machine with animated head movement, halting condition detection, and loop detection for complex computations.',
    icon: Cpu,
    gradient: 'from-accent-500 to-pink-500',
    glow: 'rgba(217,70,239,0.15)',
    borderGlow: 'rgba(217,70,239,0.3)',
    features: ['Infinite Tape Visualization', 'Head Animation (L/R)', 'Halting Conditions', 'Trace Table', '4 Built-in Examples', 'Loop Detection'],
    accent: 'text-accent-400',
    tag: 'bg-accent-500/10 border-accent-500/20 text-accent-400',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero */}
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400 text-xs font-semibold mb-6">
          <Zap size={12} />
          Interactive Educational Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
          Theory of{' '}
          <span className="bg-gradient-to-r from-primary-400 via-accent-400 to-emerald-400 bg-clip-text text-transparent">
            Computation
          </span>
          <br />
          Simulator
        </h1>
        <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
          Explore formal computational models with step-by-step visualization.
          Understand <em>why</em> every step happens — not just the final answer.
        </p>
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/40">
          <span className="flex items-center gap-1.5"><BookOpen size={14} /> Educational Tool</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className="flex items-center gap-1.5"><Zap size={14} /> Step-by-Step</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className="flex items-center gap-1.5"><ChevronRight size={14} /> JFLAP-like Interface</span>
        </div>
      </motion.div>

      {/* Simulator Cards */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {simulators.map((sim) => {
          const Icon = sim.icon;
          return (
            <motion.div
              key={sim.id}
              variants={item}
              className="group relative rounded-2xl border border-white/8 cursor-pointer overflow-hidden transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.02)' }}
              onClick={() => navigate(sim.path)}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              {/* Glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${sim.glow} 0%, transparent 70%)` }}
              />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                style={{ boxShadow: `0 0 40px ${sim.glow}`, border: `1px solid ${sim.borderGlow}` }}
              />

              <div className="relative p-6">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${sim.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon size={24} className="text-white" />
                </div>

                {/* Tag */}
                <span className={`badge border ${sim.tag} mb-3`}>{sim.subtitle}</span>

                <h2 className="text-xl font-bold text-white mb-2">{sim.title}</h2>
                <p className="text-white/50 text-sm leading-relaxed mb-5">{sim.description}</p>

                {/* Features */}
                <ul className="space-y-1.5 mb-6">
                  {sim.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/40">
                      <div className={`w-1 h-1 rounded-full bg-gradient-to-r ${sim.gradient}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button className={`flex items-center gap-2 text-sm font-semibold ${sim.accent} group-hover:gap-3 transition-all duration-200`}>
                  Launch Simulator <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Bottom note */}
      <motion.p
        className="text-center text-white/30 text-xs mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Built for students learning Theory of Computation · Click any card to start simulating
      </motion.p>
    </div>
  );
}
