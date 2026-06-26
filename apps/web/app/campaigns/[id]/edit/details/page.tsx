'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { loadDraftFromServer, loadDraft } from '@/lib/draft';
import { getSession } from '@/lib/auth';
import CreateDetails from '@/app/create/details/page';

/**
 * Edit-step-1 entry. Ensures the draft is loaded from the server (if we
 * arrived directly without going through /campaigns/[id]/edit), then renders
 * the shared wizard component. Same URL prefix → wizard nav stays under
 * /campaigns/[id]/edit on each step.
 */
export default function EditDetailsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    if (!id) return;
    (async () => {
      try {
        // If the draft in localStorage already matches this campaign, skip the
        // server round-trip (keeps Back-button feel snappy mid-wizard).
        const existing = loadDraft();
        if (existing.id !== id) await loadDraftFromServer(id);
        setReady(true);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [id, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
        <AppSidebar active="campaigns" />
        <main className="p-10">
          <div className="max-w-md p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            <p className="font-semibold mb-1">Can&rsquo;t edit this campaign</p>
            <p>{error}</p>
            <a href="/campaigns" className="btn-ghost mt-3">← Back to Campaigns</a>
          </div>
        </main>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
        <AppSidebar active="campaigns" />
        <main className="p-10 text-text-muted text-sm">
          <Loader2 size={14} className="inline animate-spin mr-2" /> Loading campaign…
        </main>
      </div>
    );
  }
  return <CreateDetails />;
}
