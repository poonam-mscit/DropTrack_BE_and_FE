'use client';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  Building2,
  DollarSign,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { clearSession } from '@/lib/auth';

type Active = 'dashboard' | 'jobs' | 'queue' | 'map' | 'droppers' | 'clients' | 'users' | 'fraud' | 'finance' | 'reports' | 'pricing';

export function AdminSidebar({ active, queueCount }: { active?: Active; queueCount?: number }) {
  const router = useRouter();
  function signOut() {
    clearSession();
    router.push('/login');
  }

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[252px] bg-white border-r border-border p-5 flex flex-col gap-1">
      <a href="/admin/jobs" className="flex items-center gap-2.5 px-2 mb-7 text-[17px] font-extrabold tracking-tight">
        <div
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-white font-black text-sm shrink-0"
          style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 50%,#A3E635 100%)' }}
        >
          D
        </div>
        DropTrack
        <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded tracking-wider ml-1">
          OPS
        </span>
      </a>

      <NavLabel>Operations</NavLabel>
      <NavLink href="#" icon={<LayoutDashboard size={16} />} active={active === 'dashboard'}>
        Dashboard
      </NavLink>
      <NavLink href="/admin/jobs" icon={<Briefcase size={16} />} active={active === 'jobs'}>
        Jobs
      </NavLink>
      <NavLink href="/admin/queue" icon={<Inbox size={16} />} active={active === 'queue'} count={queueCount}>
        Assignment Queue
      </NavLink>
      <NavLink href="#" icon={<Map size={16} />} active={active === 'map'}>Master Map</NavLink>

      <NavLabel>People</NavLabel>
      <NavLink href="/admin/droppers" icon={<Users size={16} />} active={active === 'droppers'}>
        Droppers
      </NavLink>
      <NavLink href="#" icon={<Building2 size={16} />} active={active === 'clients'}>Clients</NavLink>
      <NavLink href="/admin/users" icon={<KeyRound size={16} />} active={active === 'users'}>
        Users &amp; access
      </NavLink>

      <NavLabel>Trust &amp; Money</NavLabel>
      <NavLink href="#" icon={<ShieldCheck size={16} />} active={active === 'fraud'}>Fraud Shield</NavLink>
      <NavLink href="#" icon={<Wallet size={16} />} active={active === 'finance'}>Finance</NavLink>
      <NavLink href="/admin/pricing" icon={<DollarSign size={16} />} active={active === 'pricing'}>Pricing</NavLink>
      <NavLink href="#" icon={<BarChart3 size={16} />} active={active === 'reports'}>Reports</NavLink>

      <button
        onClick={signOut}
        className="mt-auto flex items-center gap-3 px-3 py-2 rounded-[10px] text-text-secondary hover:bg-bg-muted text-sm font-medium"
      >
        <LogOut size={16} /> Sign out
      </button>
    </aside>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[.14em] uppercase text-text-muted px-3 pt-3 pb-1.5">
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  active,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  count?: number;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors ${
        active
          ? 'bg-white text-text-primary font-semibold shadow-[inset_0_0_0_1px_var(--color-border)]'
          : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary'
      }`}
    >
      <span className={active ? 'text-primary' : 'text-text-muted'}>{icon}</span>
      <span className="flex-1">{children}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-[10.5px] font-semibold rounded-full min-w-[18px] text-center px-1.5 py-0.5 ${active ? 'bg-primary-50 text-primary' : 'bg-bg-muted text-text-muted'}`}>
          {count}
        </span>
      )}
    </a>
  );
}
