'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Plus,
  Shield,
  ShieldOff,
  X,
} from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

type Role = 'client' | 'dropper' | 'admin';
type Status = 'active' | 'suspended';

interface UserRow {
  id: string;
  email: string;
  role: Role;
  status: Status;
  cognitoSub: string;
  createdAt: string;
}

interface CreateResult {
  id: string;
  email: string;
  role: Role;
  tempPassword: string;
  cognitoExisted: boolean;
  message: string;
}

const ROLE_LABEL: Record<Role, string> = { client: 'Agent', dropper: 'Dropper', admin: 'Admin' };
const ROLE_TONE: Record<Role, string> = {
  admin: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  client: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  dropper: 'bg-sky-50 text-sky-700 border-sky-100',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createdToast, setCreatedToast] = useState<CreateResult | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    if (s.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    void load();
  }, [router]);

  async function load() {
    try {
      const data = await api.get<UserRow[]>('/api/admin/users');
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function setRole(id: string, role: Role) {
    try {
      await api.patch(`/api/admin/users/${id}/role`, { role });
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function setStatus(id: string, status: Status) {
    try {
      await api.patch(`/api/admin/users/${id}/status`, { status });
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen pl-[252px]">
      <AdminSidebar active="users" />

      <main className="p-8 max-w-[1100px]">
        <header className="flex justify-between items-start mb-7">
          <div>
            <p className="text-[11px] uppercase tracking-[.18em] text-text-muted font-bold mb-1">
              Identity & Access
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Users &amp; access</h1>
            <p className="mt-1.5 text-sm text-text-muted">
              Provision Cognito accounts, set roles, suspend or reactivate. Every change syncs to AWS
              Cognito automatically.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={14} /> New user
          </button>
        </header>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {createdToast && (
          <CreatedBanner result={createdToast} onClose={() => setCreatedToast(null)} />
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          {rows === null ? (
            <div className="p-10 text-center text-sm text-text-muted">
              <Loader2 size={16} className="inline-block animate-spin mr-2" />
              Loading users…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <KeyRound size={20} className="text-text-muted mx-auto mb-3" />
              <p className="text-sm font-semibold">No users yet</p>
              <p className="text-xs text-text-muted mt-1">
                Click "New user" to provision the first Cognito account.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-muted/50 text-[11px] uppercase tracking-wider text-text-muted font-semibold">
                <tr>
                  <th className="text-left px-5 py-3">Email</th>
                  <th className="text-left px-3 py-3">Role</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Cognito linked</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const linked = !u.cognitoSub.startsWith('pending-') && !u.cognitoSub.startsWith('local-');
                  return (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{u.email}</td>
                      <td className="px-3 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => setRole(u.id, e.target.value as Role)}
                          className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border cursor-pointer ${ROLE_TONE[u.role]}`}
                        >
                          {(['client', 'dropper', 'admin'] as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        {u.status === 'active' ? (
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                            <Pause size={10} /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {linked ? (
                          <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                            <Shield size={11} /> Verified
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted inline-flex items-center gap-1">
                            <ShieldOff size={11} /> Pending first login
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {u.status === 'active' ? (
                          <button
                            onClick={() => setStatus(u.id, 'suspended')}
                            className="btn-ghost text-xs"
                            title="Suspend — blocks Cognito sign-in"
                          >
                            <Pause size={12} /> Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(u.id, 'active')}
                            className="btn-ghost text-xs"
                          >
                            <Play size={12} /> Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {showCreate && (
          <CreateUserModal
            onClose={() => setShowCreate(false)}
            onCreated={(r) => {
              setCreatedToast(r);
              setShowCreate(false);
              void load();
            }}
          />
        )}
      </main>
    </div>
  );
}

function CreatedBanner({ result, onClose }: { result: CreateResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="mb-5 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-900 mb-1">
            User created · {result.email}
          </p>
          <p className="text-xs text-indigo-800 mb-3">{result.message}</p>
          {result.tempPassword && (
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm bg-white px-3 py-2 rounded-lg border border-indigo-200 text-indigo-900 select-all">
                {result.tempPassword}
              </code>
              <button onClick={copy} className="btn-ghost text-xs">
                {copied ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: CreateResult) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('client');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const result = await api.post<CreateResult>('/api/admin/users', { email, name, role });
      onCreated(result);
    } catch (e) {
      const body = (e as { body?: { message?: unknown } }).body?.message;
      setErr(typeof body === 'string' ? body : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold">Create new user</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {err && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {err}
            </div>
          )}
          <label className="block text-xs font-semibold text-text-secondary">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              placeholder="agent@agency.com.au"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-semibold text-text-secondary">
            Name <span className="text-text-muted font-normal">(optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="Sarah Nguyen"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-semibold text-text-secondary">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="input mt-1"
            >
              <option value="client">Agent (client)</option>
              <option value="dropper">Dropper</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <p className="text-[11px] text-text-muted leading-relaxed">
            A temp password will be generated and shown once. The user must change it on first
            login (Cognito NEW_PASSWORD_REQUIRED).
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-xs">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Create user
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
