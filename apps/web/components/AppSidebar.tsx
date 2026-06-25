'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  CreditCard,
  FolderClock,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react';
import { clearSession, getSession } from '@/lib/auth';
import { Logo } from '@/components/Logo';

interface Props {
  active?: 'dashboard' | 'tracking' | 'campaigns' | 'create' | 'ai' | 'billing' | 'profile';
  /** Per-item badge counts (e.g. number of jobs going live right now). */
  badges?: { tracking?: number; campaigns?: number };
  /** Show a notification dot on AI Assistant (e.g. new insight available). */
  aiNotify?: boolean;
}

export function AppSidebar({ active, badges, aiNotify }: Props) {
  const router = useRouter();

  // Server render uses neutral placeholders, then localStorage hydrates on the
  // client. Keeps SSR + first-paint HTML identical → no hydration mismatch.
  const [email, setEmail] = useState('you@droptrack.au');
  useEffect(() => {
    const s = getSession();
    if (s?.email) setEmail(s.email);
  }, []);

  const displayName = friendlyName(email);
  const company = friendlyCompany(email);
  const initials = (displayName[0] ?? 'D') + (displayName.split(' ')[1]?.[0] ?? '');

  function signOut() {
    clearSession();
    router.push('/login');
  }

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[264px] bg-white border-r border-border p-5 flex flex-col">
      <div className="px-2 mb-8">
        <Logo size={36} className="text-text-primary" href="/dashboard" />
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavLabel>Workspace</NavLabel>
        <NavLink href="/dashboard" icon={LayoutDashboard} active={active === 'dashboard'}>
          Dashboard
        </NavLink>
        <NavLink
          href="/dashboard#live-tracking"
          icon={MapPin}
          active={active === 'tracking'}
          badge={badges?.tracking}
        >
          Live Tracking
        </NavLink>
        <NavLink
          href="/campaigns"
          icon={FolderClock}
          active={active === 'campaigns'}
          badge={badges?.campaigns}
        >
          Campaigns
        </NavLink>

        <NavLabel>Create</NavLabel>
        <NavLink href="/create/details" icon={Plus} active={active === 'create'}>
          New Campaign
        </NavLink>
        <NavLink href="/ai-assistant" icon={Sparkles} active={active === 'ai'} dot={aiNotify}>
          AI Assistant
        </NavLink>

        <NavLabel>Account</NavLabel>
        <NavLink href="/billing" icon={CreditCard} active={active === 'billing'}>
          Billing
        </NavLink>
      </nav>

      {/* User card at bottom */}
      <div className="mt-auto pt-4">
        <button
          onClick={() => router.push('/profile')}
          className={`w-full transition-colors rounded-2xl p-3 flex items-center gap-3 text-left ${
            active === 'profile' ? 'bg-indigo-50 ring-1 ring-primary/30' : 'bg-bg-muted hover:bg-[#e9eaee]'
          }`}
          title="Profile & settings"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
          >
            {initials.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-[11px] text-text-muted truncate">{company}</p>
          </div>
          <ChevronRight size={14} className="text-text-muted" />
        </button>
        <button
          onClick={signOut}
          className="w-full mt-2 text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1.5 px-3 py-1"
        >
          <LogOut size={11} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[.18em] uppercase text-text-muted px-3 pt-4 pb-2">
      {children}
    </div>
  );
}

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  active?: boolean;
  badge?: number;
  dot?: boolean;
}

function NavLink({ href, icon: Icon, children, active, badge, dot }: NavLinkProps) {
  return (
    <a
      href={href}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-primary text-white shadow-[0_4px_14px_-4px_rgba(79,70,229,.55)]'
          : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary'
      }`}
    >
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          active ? 'bg-white/20' : 'bg-transparent'
        }`}
      >
        <Icon size={15} className={active ? 'text-white' : 'text-text-muted'} />
      </span>
      <span className="flex-1">{children}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span
          className={`text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center ${
            active ? 'bg-white text-primary' : 'bg-primary text-white'
          }`}
        >
          {badge}
        </span>
      )}
      {dot && !badge && (
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
      )}
    </a>
  );
}

// Helpers — best-effort until we wire real profile.
function friendlyName(email: string): string {
  const local = email.split('@')[0] ?? 'You';
  const parts = local.replace(/[._]/g, ' ').split(' ');
  return parts.map(capitalise).join(' ');
}
function friendlyCompany(email: string): string {
  const domain = email.split('@')[1] ?? '';
  if (domain.includes('belleproperty')) return 'Belle Property — Bondi';
  if (domain.includes('droptrack')) return 'DropTrack';
  const root = domain.split('.')[0] ?? '';
  return root ? capitalise(root) : '';
}
function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
