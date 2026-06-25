import { z } from 'zod';

/** WGS84 lat/lng ranges. */
const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);

/** GeoJSON Polygon — a single ring, first == last point. */
export const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(z.tuple([lng, lat])).min(4))
    .min(1)
    .refine(
      (rings) =>
        rings.every((ring) => {
          const first = ring[0];
          const last = ring[ring.length - 1];
          return first[0] === last[0] && first[1] === last[1];
        }),
      { message: 'Each ring must start and end at the same point' },
    ),
});

export const campaignTypeSchema = z.enum([
  'real_estate',
  'medical',
  'political',
  'food',
  'retail',
  'education',
  'government',
  'other',
]);
export const leafletSizeSchema = z.enum(['dl', 'a5', 'a4']);

/** POST /api/jobs body */
export const createJobSchema = z.object({
  clientUserId: z.string().uuid(),
  title: z.string().min(3).max(120),
  campaignType: campaignTypeSchema,
  leafletCount: z.number().int().min(50).max(50_000),
  leafletSize: leafletSizeSchema.default('dl'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skipNoJunkMail: z.boolean().default(true),
  skipApartments: z.boolean().default(false),
  specialInstructions: z.string().max(2000).optional(),
  zone: polygonSchema,
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

/**
 * PATCH /api/jobs/:id — partial update. Only allowed when status='draft'.
 * Every field is optional; zone updates replace the existing zone row.
 */
export const updateJobSchema = createJobSchema
  .omit({ clientUserId: true })
  .partial();
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/** POST /api/zones/estimate body (Smart Zones preview, no DB writes) */
export const estimateZoneSchema = z.object({
  polygon: polygonSchema,
  leafletCount: z.number().int().min(50).max(50_000).optional(),
});
export type EstimateZoneInput = z.infer<typeof estimateZoneSchema>;
