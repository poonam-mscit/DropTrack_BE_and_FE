import { Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/** Events the API broadcasts. */
export interface DropEvent {
  type: 'drop.created';
  jobId: string;
  assignmentId: string;
  dropId: string;
  dropperUserId: string;
  location: { lat: number; lng: number };
  insideZone: boolean;
  markedAt: string;
  /** running counter on the assignment after this insert */
  dropsCompleted: number;
}

export interface AssignmentEvent {
  type: 'assignment.status';
  jobId: string;
  assignmentId: string;
  status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
  dropperUserId: string;
  at: string;
}

export interface JobEvent {
  type: 'job.status';
  jobId: string;
  status: string;
  at: string;
}

export interface FraudAlertEvent {
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

export interface LocationEvent {
  type: 'dropper.location';
  jobId: string;
  assignmentId: string;
  dropperUserId: string;
  location: { lat: number; lng: number };
  speedMps: number | null;
  heading: number | null;
  at: string;
}

export type RealtimeEvent =
  | DropEvent
  | AssignmentEvent
  | JobEvent
  | FraudAlertEvent
  | LocationEvent;

/** Same origin policy as the HTTP API — driven by NODE_ENV + CORS_ORIGIN. */
function gatewayOrigins(): Array<string | RegExp> {
  const explicit = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;
  if (process.env.NODE_ENV === 'production') {
    return [
      'https://portal.droptrack.com.au',
      'https://droptrack.com.au',
      'https://www.droptrack.com.au',
    ];
  }
  return [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    /^http:\/\/192\.168\.\d+\.\d+:3002$/,
  ];
}

@WebSocketGateway({
  cors: { origin: gatewayOrigins() as never, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  onModuleInit() {
    this.logger.log('Realtime gateway initialised — clients connect at /socket.io');
  }

  handleConnection(client: Socket) {
    this.logger.log(`socket connected · ${client.id}`);
    client.on('join:job', (jobId: string) => {
      if (typeof jobId !== 'string') return;
      client.join(`job:${jobId}`);
      this.logger.log(`${client.id} → joined room job:${jobId}`);
    });
    client.on('leave:job', (jobId: string) => {
      if (typeof jobId !== 'string') return;
      client.leave(`job:${jobId}`);
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`socket disconnected · ${client.id}`);
  }

  /** Called from services after a successful state change. */
  emit(event: RealtimeEvent) {
    this.server.to(`job:${event.jobId}`).emit(event.type, event);
  }
}
