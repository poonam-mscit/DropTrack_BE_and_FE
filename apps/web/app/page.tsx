'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
    } else if (session.role === 'admin') {
      router.replace('/admin/jobs');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-text-muted">Loading…</div>
  );
}
