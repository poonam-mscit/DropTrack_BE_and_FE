import { io, type Socket } from 'socket.io-client';

/** Drop event broadcast by the API. */
export interface RealtimeDrop {
  type: 'drop.created';
  jobId: string;
  assignmentId: string;
  dropId: string;
  dropperUserId: string;
  location: { lat: number; lng: number };
  insideZone: boolean;
  markedAt: string;
  dropsCompleted: number;
}

export interface RealtimeAssignment {
  type: 'assignment.status';
  jobId: string;
  assignmentId: string;
  status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
  dropperUserId: string;
  at: string;
}

export interface RealtimeJob {
  type: 'job.status';
  jobId: string;
  status: string;
  at: string;
}

export interface RealtimeFraudAlert {
  type: 'fraud.alert';
  jobId: string;
  assignmentId: string;
  dropperUserId: string;
  alertId: string;
  alertType: 'mock_location' | 'impossible_speed' | 'cluster_density' | 'stationary' | 'pace_spike';
  severity: 'low' | 'medium' | 'high';
  status: 'auto_cleared' | 'manual_review' | 'confirmed' | 'dismissed';
  evidence: Record<string, unknown>;
  at: string;
}

let socket: Socket | null = null;

/**
 * Singleton Socket.IO connection. Connects to the API origin (different port
 * in dev, same origin in prod once we run behind one ingress).
 */
export function getSocket(): Socket {
  if (socket) return socket;
  // In dev: Next on :3002, NestJS on :3001. Hit the API origin directly.
  const url =
    process.env.NEXT_PUBLIC_API_ORIGIN ??
    (typeof window !== 'undefined' && window.location.port === '3002'
      ? 'http://localhost:3001'
      : '');
  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1_000,
  });
  return socket;
}
