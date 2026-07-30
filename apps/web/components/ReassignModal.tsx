'use client';
import { useEffect, useState } from 'react';
import { ArrowLeftRight, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Dropper {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  primaryZone: string | null;
  state: 'active' | 'invited';
  accountState?: 'invited' | 'accepted' | 'onboarding' | 'complete';
  onboardingStatus?: 'partial' | 'complete';
  activeAssignments: number;
}

export interface ReassignInfo {
  assignmentId: string;
  jobTitle: string;
  jobCode: string;
  currentDropperUserId: string;
  currentDropperName: string;
  dropsInherited: number;
}

/**
 * Shared reassign modal. Fetches the droppers list on mount, filters to
 * onboarded actives excluding the current dropper, and PATCHes the
 * assignment on submit. Used from both /admin/droppers and /admin/track.
 * Prefetched droppers can be passed via `preloaded` to skip the network
 * call — useful on the droppers page where the list is already in memory.
 */
export function ReassignModal({
  info,
  preloaded,
  onCancel,
  onSuccess,
}: {
  info: ReassignInfo;
  preloaded?: Dropper[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [droppers, setDroppers] = useState<Dropper[] | null>(preloaded ?? null);
  const [loading, setLoading] = useState(!preloaded);
  const [pickedUserId, setPickedUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    api
      .get<{ data: Dropper[] }>('/api/droppers')
      .then((r) => {
        if (!cancelled) setDroppers(r.data);
      })
      .catch(() => {
        if (!cancelled) setDroppers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preloaded]);

  const isEligible = (d: Dropper) =>
    d.state === 'active' &&
    (d.accountState ? d.accountState === 'complete' : d.onboardingStatus === 'complete') &&
    d.userId !== info.currentDropperUserId;

  const eligible = (droppers ?? [])
    .filter(isEligible)
    .sort((a, b) => a.activeAssignments - b.activeAssignments);

  async function submit() {
    if (!pickedUserId) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/admin/assignments/${info.assignmentId}/reassign`, {
        dropperUserId: pickedUserId,
      });
      onSuccess();
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ArrowLeftRight size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold">Reassign job</h2>
            <p className="text-xs text-text-muted mt-1 truncate">
              {info.jobTitle} · {info.jobCode}
            </p>
          </div>
        </div>

        {info.dropsInherited > 0 && (
          <p className="mt-4 text-xs text-text-secondary leading-relaxed">
            <strong>{info.dropsInherited}</strong> drop{info.dropsInherited === 1 ? '' : 's'}{' '}
            already recorded by {info.currentDropperName} will stay attributed to them. The new
            dropper picks up from there.
          </p>
        )}

        <div className="mt-4 flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <p className="text-sm text-text-muted text-center py-6">
              <Loader2 size={14} className="inline animate-spin mr-2" /> Loading droppers…
            </p>
          ) : eligible.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              No other onboarded droppers available.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {eligible.map((d) => {
                const picked = pickedUserId === d.userId;
                return (
                  <li key={d.userId}>
                    <button
                      onClick={() => setPickedUserId(d.userId)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors flex items-center gap-3 ${
                        picked
                          ? 'border-primary bg-indigo-50'
                          : 'border-border hover:bg-bg-muted/60'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                      >
                        {(d.firstName[0] ?? d.email[0] ?? '?').toUpperCase()}
                        {(d.lastName[0] ?? '').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {d.firstName} {d.lastName}
                        </p>
                        <p className="text-[11px] text-text-muted truncate">
                          {d.primaryZone ?? d.email} · {d.activeAssignments} active
                        </p>
                      </div>
                      {picked && <Check size={16} className="text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} disabled={busy} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !pickedUserId}
            className="btn-primary disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}
