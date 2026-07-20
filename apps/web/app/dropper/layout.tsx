'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, LayoutList, User } from 'lucide-react';
import { getSession, clearSession } from '@/lib/auth';
import { LogoMark } from '@/components/Logo';

export default function DropperLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    if (s.role !== 'dropper' && s.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [router]);

  const activeIsProfile = pathname.startsWith('/dropper/profile');
  const activeIsAll =
    pathname === '/dropper/jobs' ||
    pathname.startsWith('/dropper/jobs/') ||
    pathname.startsWith('/dropper/recap/');
  const activeIsDashboard = !activeIsProfile && !activeIsAll;

  return (
    <div className="min-h-screen bg-[#0F1029] text-white flex flex-col">
      <header className="sticky top-0 z-30 bg-[#0F1029]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dropper" className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-lg font-extrabold tracking-tight">DropTrack</span>
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300 bg-emerald-400/10 rounded px-1.5 py-0.5 ml-1">
              Dropper
            </span>
          </Link>
          <button
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
            className="text-xs text-white/60 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0F1029]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex">
          <Link
            href="/dropper"
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
              activeIsDashboard ? 'text-white' : 'text-white/50'
            }`}
          >
            <Briefcase size={20} />
            Today
          </Link>
          <Link
            href="/dropper/jobs"
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
              activeIsAll ? 'text-white' : 'text-white/50'
            }`}
          >
            <LayoutList size={20} />
            All jobs
          </Link>
          <Link
            href="/dropper/profile"
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
              activeIsProfile ? 'text-white' : 'text-white/50'
            }`}
          >
            <User size={20} />
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
}
