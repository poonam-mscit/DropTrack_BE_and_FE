'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, MapPin, Plus, Sparkles, FolderClock } from 'lucide-react';
import { MockFrame } from './MockFrame';
import { LogoMark } from '@/components/ui/Logo';

const CAMPAIGNS = [
  { code: 'J-2491', title: 'Bondi · Open House', status: 'active', cov: 77, n: 5000, tone: 'lime' },
  { code: 'J-2487', title: 'Mosman · Vendor Drop', status: 'complete', cov: 100, n: 3200, tone: 'indigo' },
  { code: 'J-2482', title: 'Surry Hills · Auction', status: 'complete', cov: 99, n: 2800, tone: 'indigo' },
  { code: 'J-2479', title: 'Paddington · Q2 Push', status: 'scheduled', cov: 0, n: 4500, tone: 'muted' },
];

export function MockAgentDashboard() {
  const reduce = useReducedMotion();

  return (
    <MockFrame title="app.droptrack.com.au/dashboard">
      <div className="grid grid-cols-[200px_1fr] h-[460px]">
        {/* Sidebar */}
        <aside className="border-r border-[#edeef1] bg-white p-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 mb-4">
            <LogoMark size={22} />
            <span className="text-xs font-extrabold text-[#0b0d12]">DropTrack</span>
          </div>
          <p className="text-[9px] uppercase tracking-[.18em] text-[#8b92a4] px-2 mt-2 mb-1 font-bold">
            Workspace
          </p>
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={MapPin} label="Live Tracking" />
          <NavItem icon={FolderClock} label="Campaigns" />
          <p className="text-[9px] uppercase tracking-[.18em] text-[#8b92a4] px-2 mt-4 mb-1 font-bold">
            Create
          </p>
          <NavItem icon={Plus} label="New Campaign" />
          <NavItem icon={Sparkles} label="AI Assistant" />
        </aside>

        {/* Main */}
        <div className="bg-[#f8f9fb] p-5 overflow-hidden">
          <div className="flex justify-between items-center mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[.18em] text-[#8b92a4] font-bold">
                Welcome back, Sarah
              </p>
              <h3 className="font-display text-2xl text-[#0b0d12] tracking-tight">Your campaigns</h3>
            </div>
            <button
              className="text-white text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)',
                boxShadow: '0 4px 14px -2px rgba(79,70,229,.4), inset 0 1px 0 rgba(255,255,255,.15)',
              }}
            >
              <Plus size={12} /> New campaign
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2.5 mb-5">
            {[
              ['4', 'Active'],
              ['15.5K', 'Leaflets'],
              ['98%', 'Coverage'],
              ['$3.2k', 'This month'],
            ].map(([n, l], i) => (
              <motion.div
                key={l}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.06 * i, duration: 0.4 }}
                className="rounded-xl bg-white border border-[#edeef1] p-2.5 shadow-[0_2px_6px_rgba(11,13,18,.04)]"
              >
                <p className="font-display text-xl text-[#0b0d12]">{n}</p>
                <p className="text-[9px] uppercase tracking-wider text-[#8b92a4]">{l}</p>
              </motion.div>
            ))}
          </div>

          <div className="space-y-2">
            {CAMPAIGNS.map((c, i) => (
              <motion.div
                key={c.code}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i + 0.2, duration: 0.4 }}
                className="rounded-xl bg-white border border-[#edeef1] p-3 flex items-center gap-3 shadow-[0_2px_6px_rgba(11,13,18,.04)]"
              >
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                    c.tone === 'lime'
                      ? 'bg-lime-100 text-lime-800'
                      : c.tone === 'indigo'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-[#f3f4f6] text-[#8b92a4]'
                  }`}
                >
                  {c.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0b0d12] text-sm font-semibold truncate">{c.title}</p>
                  <p className="text-[10px] text-[#8b92a4]">
                    {c.code} · {c.n.toLocaleString()} leaflets
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#0b0d12]">{c.cov}%</p>
                  <p className="text-[9px] text-[#8b92a4]">coverage</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium ${
        active
          ? 'bg-white text-[#0b0d12] shadow-[inset_0_0_0_1px_#edeef1]'
          : 'text-[#4b5161]'
      }`}
    >
      <Icon size={12} className={active ? 'text-[#4f46e5]' : 'text-[#8b92a4]'} />
      {label}
    </div>
  );
}
