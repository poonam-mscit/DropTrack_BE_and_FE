/**
 * DropTrack — database schema (Drizzle ORM, PostgreSQL 16 + PostGIS)
 *
 * Run order in migrations:
 *   1. CREATE EXTENSION IF NOT EXISTS postgis;
 *   2. CREATE EXTENSION IF NOT EXISTS citext;
 *   3. Then this schema.
 *
 * All money columns are INTEGER cents. All locations are geography(*, 4326)
 * (WGS84) so PostGIS returns metres for distance/area natively.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  smallint,
  bigserial,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/* ------------------------------------------------------------------ */
/*                       custom types (PostGIS + citext)              */
/* ------------------------------------------------------------------ */

const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/** WGS84 point — returns metres for distance/area. */
const geographyPoint = customType<{ data: { lat: number; lng: number }; driverData: string }>({
  dataType: () => 'geography(Point, 4326)',
  toDriver: (v) => sql`ST_SetSRID(ST_MakePoint(${v.lng}, ${v.lat}), 4326)::geography`,
});

/** Minimal GeoJSON Polygon shape (avoids @types/geojson dep). */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

/** WGS84 polygon. Pass GeoJSON; we feed it through ST_GeomFromGeoJSON. */
const geographyPolygon = customType<{ data: GeoJsonPolygon; driverData: string }>({
  dataType: () => 'geography(Polygon, 4326)',
  toDriver: (v) => sql`ST_GeomFromGeoJSON(${JSON.stringify(v)})::geography`,
});

/* ------------------------------------------------------------------ */
/*                              enums                                 */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum('user_role', ['client', 'dropper', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);

export const industryEnum = pgEnum('industry', [
  'real_estate',
  'medical',
  'political',
  'food',
  'retail',
  'education',
  'government',
  'other',
]);
export const businessSizeEnum = pgEnum('business_size', ['solo', '2_10', '11_50', '50_plus']);

export const onboardingStatusEnum = pgEnum('onboarding_status', ['partial', 'complete']);
export const employmentTypeEnum = pgEnum('employment_type', ['casual', 'part_time', 'full_time']);
export const transportModeEnum = pgEnum('transport_mode', ['walking', 'bicycle', 'e_scooter']);

export const jobStatusEnum = pgEnum('job_status', [
  'draft',
  'paid_unassigned',
  'assigned',
  'upcoming',
  'active',
  'completed',
  'cancelled',
]);
export const leafletSizeEnum = pgEnum('leaflet_size', ['dl', 'a5', 'a4']);
export const campaignTypeEnum = pgEnum('campaign_type', [
  'real_estate',
  'medical',
  'political',
  'food',
  'retail',
  'education',
  'government',
  'other',
]);

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'pending',
  'started',
  'paused',
  'completed',
  'abandoned',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'partial_refund',
]);

export const fraudAlertTypeEnum = pgEnum('fraud_alert_type', [
  'mock_location',
  'impossible_speed',
  'cluster_density',
  'stationary',
  'pace_spike',
]);
export const fraudSeverityEnum = pgEnum('fraud_severity', ['low', 'medium', 'high']);
export const fraudStatusEnum = pgEnum('fraud_status', [
  'auto_cleared',
  'manual_review',
  'confirmed',
  'dismissed',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'campaign_milestone',
  'ai_report_ready',
  'payment_received',
  'fraud_alert',
  'assignment',
  'system',
]);

export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant', 'system']);

export const eventSubjectEnum = pgEnum('event_subject', ['job', 'assignment', 'dropper', 'payment']);

export const auStateEnum = pgEnum('au_state', [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
]);

/* ------------------------------------------------------------------ */
/*                         1. identity & profiles                     */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cognitoSub: text('cognito_sub').notNull(),
    email: citext('email').notNull(),
    mobile: text('mobile'),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => ({
    cognitoIdx: uniqueIndex('users_cognito_sub_idx').on(t.cognitoSub),
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
  }),
);

export const businessProfiles = pgTable('business_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  industry: industryEnum('industry').notNull(),
  businessSize: businessSizeEnum('business_size'),
  abn: text('abn'),
  gstRegistered: boolean('gst_registered').notNull().default(false),
  logoS3Key: text('logo_s3_key'),
  addressLine1: text('address_line1'),
  suburb: text('suburb'),
  state: auStateEnum('state'),
  postcode: text('postcode'),
  stripeCustomerId: text('stripe_customer_id'),
  /** Mobile number captured at signup. Stored locally for the profile page;
   * Cognito mirrors phone_number on the user pool too. */
  mobile: text('mobile'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dropperProfiles = pgTable(
  'dropper_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    employeeId: text('employee_id').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dob: date('dob'),
    photoS3Key: text('photo_s3_key'),
    addressLine1: text('address_line1'),
    suburb: text('suburb'),
    state: auStateEnum('state'),
    postcode: text('postcode'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),

    // Encrypted at the application layer (AWS KMS) before insert.
    tfnEncrypted: text('tfn_encrypted'),
    superFundName: text('super_fund_name'),
    superMemberNumber: text('super_member_number'),
    bankBsb: text('bank_bsb'),
    bankAccountLast4: text('bank_account_number_last4'),
    bankAccountEncrypted: text('bank_account_encrypted'),

    wwccNumber: text('wwcc_number'),
    wwccExpiresAt: date('wwcc_expires_at'),
    wwccS3Key: text('wwcc_s3_key'),

    contractSignedAt: timestamp('contract_signed_at', { withTimezone: true }),
    contractS3Key: text('contract_s3_key'),

    primaryZone: text('primary_zone'),
    onboardingStatus: onboardingStatusEnum('onboarding_status').notNull().default('partial'),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    employmentType: employmentTypeEnum('employment_type').notNull().default('casual'),
    /** What the dropper uses to cover their zone. Drives Fraud Shield speed
     *  thresholds, Smart Zones time estimates, and AI Route Planner profile. */
    preferredTransport: transportModeEnum('preferred_transport').notNull().default('walking'),
    startDate: date('start_date'),

    // Denormalised counters (kept up-to-date by triggers / app code).
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).default('0'),
    jobsDone: integer('jobs_done').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employeeIdIdx: uniqueIndex('dropper_employee_id_idx').on(t.employeeId),
    onboardingIdx: index('dropper_onboarding_idx').on(t.onboardingStatus),
    zoneIdx: index('dropper_primary_zone_idx').on(t.primaryZone),
  }),
);

export const adminProfiles = pgTable('admin_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  permissions: jsonb('permissions').$type<Record<string, boolean>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: citext('email').notNull(),
    token: text('token').notNull(),
    role: userRoleEnum('role').notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id),
    prefill: jsonb('prefill').$type<{
      firstName?: string;
      lastName?: string;
      primaryZone?: string;
      employmentType?: 'casual' | 'part_time' | 'full_time';
      startDate?: string;
      wwccRequired?: boolean;
    }>(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedUserId: uuid('accepted_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('invites_token_idx').on(t.token),
    emailIdx: index('invites_email_idx').on(t.email),
  }),
);

/* ------------------------------------------------------------------ */
/*                          2. jobs & zones                           */
/* ------------------------------------------------------------------ */

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobCode: text('job_code').notNull(),
    clientUserId: uuid('client_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    campaignType: campaignTypeEnum('campaign_type').notNull(),
    leafletCount: integer('leaflet_count').notNull(),
    leafletSize: leafletSizeEnum('leaflet_size').notNull().default('dl'),
    leafletS3Key: text('leaflet_s3_key'),
    status: jobStatusEnum('status').notNull().default('draft'),

    startDate: date('start_date'),
    deadline: date('deadline'),
    actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
    actualCompletedAt: timestamp('actual_completed_at', { withTimezone: true }),

    skipNoJunkMail: boolean('skip_no_junk_mail').notNull().default(true),
    skipApartments: boolean('skip_apartments').notNull().default(false),
    specialInstructions: text('special_instructions'),

    cancellationWindowEndAt: timestamp('cancellation_window_end_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (t) => ({
    jobCodeIdx: uniqueIndex('jobs_job_code_idx').on(t.jobCode),
    statusIdx: index('jobs_status_idx').on(t.status, t.deadline),
    clientIdx: index('jobs_client_idx').on(t.clientUserId),
  }),
);

export const zones = pgTable(
  'zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    polygon: geographyPolygon('polygon').notNull(),
    areaSqm: numeric('area_sqm', { precision: 14, scale: 2 }),
    estimatedLetterboxes: integer('estimated_letterboxes'),
    estimatedHouses: integer('estimated_houses'),
    estimatedApartments: integer('estimated_apartments'),
    estimatedDistanceKm: numeric('estimated_distance_km', { precision: 8, scale: 2 }),
    estimatedMinutes: integer('estimated_minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // GIST index defined in migration SQL (Drizzle has no native GIST builder)
    jobIdx: uniqueIndex('zones_job_idx').on(t.jobId),
  }),
);

export const subZones = pgTable(
  'sub_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    polygon: geographyPolygon('polygon').notNull(),
    targetLeaflets: integer('target_leaflets').notNull(),
    dropperUserId: uuid('dropper_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index('sub_zones_job_idx').on(t.jobId),
    dropperIdx: index('sub_zones_dropper_idx').on(t.dropperUserId),
  }),
);

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    subZoneId: uuid('sub_zone_id').references(() => subZones.id, { onDelete: 'cascade' }),
    dropperUserId: uuid('dropper_user_id')
      .notNull()
      .references(() => users.id),
    assignedByUserId: uuid('assigned_by_user_id')
      .notNull()
      .references(() => users.id),
    status: assignmentStatusEnum('status').notNull().default('pending'),

    startedAt: timestamp('started_at', { withTimezone: true }),
    pausedTotalSeconds: integer('paused_total_seconds').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    dropsCompleted: integer('drops_completed').notNull().default(0),
    distanceWalkedM: integer('distance_walked_m').notNull().default(0),
    payrollCostCents: integer('payroll_cost_cents').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index('assignments_job_idx').on(t.jobId),
    dropperIdx: index('assignments_dropper_idx').on(t.dropperUserId, t.status),
    statusIdx: index('assignments_status_idx').on(t.status),
  }),
);

/* ------------------------------------------------------------------ */
/*                       3. live tracking (volume)                    */
/* ------------------------------------------------------------------ */

export const drops = pgTable(
  'drops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    dropperUserId: uuid('dropper_user_id')
      .notNull()
      .references(() => users.id),
    location: geographyPoint('location').notNull(),
    accuracyM: smallint('accuracy_m'),
    insideZone: boolean('inside_zone').notNull().default(true),
    flaggedAnomaly: boolean('flagged_anomaly').notNull().default(false),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // GIST index on `location` added via raw SQL migration
    assignmentIdx: index('drops_assignment_idx').on(t.assignmentId, t.markedAt),
    dropperIdx: index('drops_dropper_idx').on(t.dropperUserId, t.markedAt),
  }),
);

/**
 * High-volume live GPS pings. Partition by month in production and archive
 * partitions >90 days old to S3 then DROP.
 */
export const dropperLocations = pgTable(
  'dropper_locations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    dropperUserId: uuid('dropper_user_id')
      .notNull()
      .references(() => users.id),
    location: geographyPoint('location').notNull(),
    accuracyM: smallint('accuracy_m'),
    speedMps: numeric('speed_mps', { precision: 5, scale: 2 }),
    heading: smallint('heading'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    assignmentIdx: index('dropper_locations_assignment_idx').on(t.assignmentId, t.recordedAt),
    dropperIdx: index('dropper_locations_dropper_idx').on(t.dropperUserId, t.recordedAt),
    // GIST on location + BRIN on recordedAt — added in raw SQL migration
  }),
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    subjectType: eventSubjectEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    eventType: text('event_type').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subjectIdx: index('events_subject_idx').on(t.subjectType, t.subjectId, t.createdAt),
    actorIdx: index('events_actor_idx').on(t.actorUserId, t.createdAt),
  }),
);

/* ------------------------------------------------------------------ */
/*                              4. money                              */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    clientUserId: uuid('client_user_id')
      .notNull()
      .references(() => users.id),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),

    amountNetCents: integer('amount_net_cents').notNull(),
    gstCents: integer('gst_cents').notNull(),
    platformFeeCents: integer('platform_fee_cents').notNull().default(0),
    amountTotalCents: integer('amount_total_cents').notNull(),

    currency: text('currency').notNull().default('aud'),
    status: paymentStatusEnum('status').notNull().default('pending'),

    refundAmountCents: integer('refund_amount_cents').default(0),
    refundReason: text('refund_reason'),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),

    cardBrand: text('card_brand'),
    cardLast4: text('card_last4'),

    /** Stripe-hosted receipt URL (charge.receipt_url). Click-through opens
     * Stripe's branded tax-invoice page — no PDF generation on our side. */
    receiptUrl: text('receipt_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    intentIdx: uniqueIndex('payments_intent_idx')
      .on(t.stripePaymentIntentId)
      .where(sql`${t.stripePaymentIntentId} IS NOT NULL`),
    sessionIdx: uniqueIndex('payments_session_idx')
      .on(t.stripeCheckoutSessionId)
      .where(sql`${t.stripeCheckoutSessionId} IS NOT NULL`),
    jobIdx: index('payments_job_idx').on(t.jobId),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    pdfS3Key: text('pdf_s3_key').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    numberIdx: uniqueIndex('invoices_number_idx').on(t.invoiceNumber),
    paymentIdx: index('invoices_payment_idx').on(t.paymentId),
  }),
);

/* ------------------------------------------------------------------ */
/*                       5. AI & notifications                        */
/* ------------------------------------------------------------------ */

export const aiReports = pgTable(
  'ai_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    narrative: text('narrative').notNull(),
    pdfS3Key: text('pdf_s3_key'),
    tokensInput: integer('tokens_input').notNull().default(0),
    tokensOutput: integer('tokens_output').notNull().default(0),
    modelName: text('model_name').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: uniqueIndex('ai_reports_job_idx').on(t.jobId),
  }),
);

export const fraudAlerts = pgTable(
  'fraud_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    dropperUserId: uuid('dropper_user_id')
      .notNull()
      .references(() => users.id),
    alertType: fraudAlertTypeEnum('alert_type').notNull(),
    severity: fraudSeverityEnum('severity').notNull().default('low'),
    status: fraudStatusEnum('status').notNull().default('manual_review'),
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
  },
  (t) => ({
    assignmentIdx: index('fraud_alerts_assignment_idx').on(t.assignmentId, t.createdAt),
    statusIdx: index('fraud_alerts_status_idx').on(t.status, t.createdAt),
  }),
);

export const chatThreads = pgTable(
  'chat_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('chat_threads_user_idx').on(t.userId, t.lastMessageAt),
  }),
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    tokensInput: integer('tokens_input').default(0),
    tokensOutput: integer('tokens_output').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index('chat_messages_thread_idx').on(t.threadId, t.createdAt),
  }),
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    linkUrl: text('link_url'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId, t.createdAt),
    unreadIdx: index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`${t.readAt} IS NULL`),
  }),
);

/* ------------------------------------------------------------------ */
/*                          6. operational                            */
/* ------------------------------------------------------------------ */

export const dropperRatings = pgTable(
  'dropper_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    dropperUserId: uuid('dropper_user_id')
      .notNull()
      .references(() => users.id),
    rating: smallint('rating').notNull(),
    notes: text('notes'),
    ratedByUserId: uuid('rated_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assignmentIdx: uniqueIndex('dropper_ratings_assignment_idx').on(t.assignmentId),
    dropperIdx: index('dropper_ratings_dropper_idx').on(t.dropperUserId, t.createdAt),
  }),
);

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(), // e.g. Stripe `evt_xxx`
  source: text('source').notNull().default('stripe'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  payload: jsonb('payload').notNull(),
});

/* ------------------------------------------------------------------ */
/*                  app-wide runtime settings (KV)                    */
/* ------------------------------------------------------------------ */

/**
 * Key/value store for runtime-tunable settings the ops team can change without
 * a deploy. e.g. `pricing.basePerLeafletCents`, `pricing.platformFeePct`.
 * Values are JSONB so a setting can be number, string, object, etc.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
});

/* ------------------------------------------------------------------ */
/*                            relations                               */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  businessProfile: one(businessProfiles, {
    fields: [users.id],
    references: [businessProfiles.userId],
  }),
  dropperProfile: one(dropperProfiles, {
    fields: [users.id],
    references: [dropperProfiles.userId],
  }),
  adminProfile: one(adminProfiles, {
    fields: [users.id],
    references: [adminProfiles.userId],
  }),
  jobsCreated: many(jobs),
  assignmentsAsDropper: many(assignments, { relationName: 'dropper_assignments' }),
  notifications: many(notifications),
  chatThreads: many(chatThreads),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(users, {
    fields: [jobs.clientUserId],
    references: [users.id],
  }),
  zone: one(zones, {
    fields: [jobs.id],
    references: [zones.jobId],
  }),
  subZones: many(subZones),
  assignments: many(assignments),
  payment: one(payments, {
    fields: [jobs.id],
    references: [payments.jobId],
  }),
  aiReport: one(aiReports, {
    fields: [jobs.id],
    references: [aiReports.jobId],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  job: one(jobs, {
    fields: [assignments.jobId],
    references: [jobs.id],
  }),
  subZone: one(subZones, {
    fields: [assignments.subZoneId],
    references: [subZones.id],
  }),
  dropper: one(users, {
    fields: [assignments.dropperUserId],
    references: [users.id],
    relationName: 'dropper_assignments',
  }),
  assignedBy: one(users, {
    fields: [assignments.assignedByUserId],
    references: [users.id],
  }),
  drops: many(drops),
  locations: many(dropperLocations),
  fraudAlerts: many(fraudAlerts),
  rating: one(dropperRatings, {
    fields: [assignments.id],
    references: [dropperRatings.assignmentId],
  }),
}));

export const dropsRelations = relations(drops, ({ one }) => ({
  assignment: one(assignments, {
    fields: [drops.assignmentId],
    references: [assignments.id],
  }),
  dropper: one(users, {
    fields: [drops.dropperUserId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  job: one(jobs, {
    fields: [payments.jobId],
    references: [jobs.id],
  }),
  invoices: many(invoices),
}));

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  user: one(users, {
    fields: [chatThreads.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

/* ------------------------------------------------------------------ */
/*                            TS types                                */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type DropperProfile = typeof dropperProfiles.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type Invite = typeof invites.$inferSelect;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Zone = typeof zones.$inferSelect;
export type SubZone = typeof subZones.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;

export type Drop = typeof drops.$inferSelect;
export type DropperLocation = typeof dropperLocations.$inferSelect;
export type Event = typeof events.$inferSelect;

export type Payment = typeof payments.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;

export type AiReport = typeof aiReports.$inferSelect;
export type FraudAlert = typeof fraudAlerts.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type DropperRating = typeof dropperRatings.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
