import { z } from 'zod';
import { polygonSchema } from '../jobs/jobs.dto.js';

/** Each row in the assignment payload. */
const assignmentEntrySchema = z.object({
  dropperUserId: z.string().uuid(),
  label: z.string().max(40).optional(), // e.g. "Zone A"
  /** Optional sub-zone polygon. If absent, this dropper covers the whole job zone. */
  polygon: polygonSchema.optional(),
  targetLeaflets: z.number().int().min(50).max(50_000),
});

/** POST /api/jobs/:id/assignments */
export const createAssignmentsSchema = z.object({
  assignments: z.array(assignmentEntrySchema).min(1).max(20),
});
export type CreateAssignmentsInput = z.infer<typeof createAssignmentsSchema>;

/** POST /api/me/drops — dropper marks a drop. */
export const markDropSchema = z.object({
  assignmentId: z.string().uuid(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  accuracyM: z.number().int().min(0).max(500).optional(),
});
export type MarkDropInput = z.infer<typeof markDropSchema>;

/** POST /api/me/locations — dropper pings their GPS position (every ~5 s). */
export const markLocationSchema = z.object({
  assignmentId: z.string().uuid(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  accuracyM: z.number().int().min(0).max(500).optional(),
  speedMps: z.number().min(0).max(50).optional(),
  heading: z.number().int().min(0).max(359).optional(),
  recordedAt: z.string().datetime().optional(),
});
export type MarkLocationInput = z.infer<typeof markLocationSchema>;
