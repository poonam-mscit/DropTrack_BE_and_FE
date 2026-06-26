'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { loadDraftFromServer } from '@/lib/draft';
import { getSession } from '@/lib/auth';

/**
 * Distinct edit-entry URL — loads the draft from the server into localStorage,
 * then hands off to the shared wizard at /create/details. Keeping the wizard
 * routes shared avoids duplicating three pages of UI just for the URL prefix.
 */
export default function EditCampaignEntry() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    if (!id) return;
    (async () => {
      try {
        await loadDraftFromServer(id);
        router.replace(`/campaigns/${id}/edit/details`);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [id, router]);

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="campaigns" />
      <main className="p-10">
        {error ? (
          <div className="max-w-md p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            <p className="font-semibold mb-1">Can&rsquo;t edit this campaign</p>
            <p>{error}</p>
            <a href="/campaigns" className="btn-ghost mt-3">← Back to Campaigns</a>
          </div>
        ) : (
          <div className="text-text-muted text-sm inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading campaign…
          </div>
        )}
      </main>
    </div>
  );
}
