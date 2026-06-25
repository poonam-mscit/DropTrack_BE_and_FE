/**
 * Local-dev seed. Creates one admin, one client, two droppers and a sample
 * paid-unassigned job. Idempotent — safe to run multiple times.
 *
 *   pnpm db:seed
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  adminProfiles,
  businessProfiles,
  db,
  dropperProfiles,
  jobs,
  payments,
  users,
  zones,
} from './index.js';

async function main() {
  console.log('Seeding DropTrack dev data…');

  // ---- Admin ----
  const adminEmail = 'ops@droptrack.au';
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });
  if (existingAdmin) {
    console.log('Already seeded. Skipping.');
    return;
  }

  const adminId = randomUUID();
  await db.insert(users).values({
    id: adminId,
    cognitoSub: 'local-admin',
    email: adminEmail,
    role: 'admin',
  });
  await db.insert(adminProfiles).values({
    userId: adminId,
    displayName: 'Ops Console',
  });

  // ---- Client / Agent ----
  const clientId = randomUUID();
  await db.insert(users).values({
    id: clientId,
    cognitoSub: 'local-client',
    email: 'sarah@belleproperty.com.au',
    role: 'client',
  });
  await db.insert(businessProfiles).values({
    userId: clientId,
    businessName: 'Belle Property — Bondi',
    industry: 'real_estate',
    businessSize: 'solo',
    gstRegistered: true,
    state: 'NSW',
    suburb: 'Bondi Junction',
    postcode: '2022',
  });

  // ---- Droppers ----
  const jamesId = randomUUID();
  const mayaId = randomUUID();
  await db.insert(users).values([
    { id: jamesId, cognitoSub: 'local-james', email: 'james@droptrack.au', role: 'dropper' },
    { id: mayaId, cognitoSub: 'local-maya', email: 'maya@droptrack.au', role: 'dropper' },
  ]);
  await db.insert(dropperProfiles).values([
    {
      userId: jamesId,
      employeeId: 'EMP-0124',
      firstName: 'James',
      lastName: 'Kowalski',
      primaryZone: 'Bondi/Eastern Suburbs',
      onboardingStatus: 'complete',
      onboardingCompletedAt: new Date(),
      ratingAvg: '4.9',
      jobsDone: 124,
    },
    {
      userId: mayaId,
      employeeId: 'EMP-0098',
      firstName: 'Maya',
      lastName: 'Reddy',
      primaryZone: 'Paddington',
      onboardingStatus: 'complete',
      onboardingCompletedAt: new Date(),
      ratingAvg: '4.8',
      jobsDone: 89,
    },
  ]);

  // ---- Sample job (paid, unassigned) ----
  const jobId = randomUUID();
  await db.insert(jobs).values({
    id: jobId,
    jobCode: 'JOB-2841',
    clientUserId: clientId,
    title: 'Spring Listings — Bondi',
    campaignType: 'real_estate',
    leafletCount: 2500,
    leafletSize: 'dl',
    status: 'paid_unassigned',
    startDate: '2026-05-20',
    deadline: '2026-05-23',
    paidAt: new Date(),
  });

  await db.insert(zones).values({
    jobId,
    // Tiny demo polygon around Bondi Junction. Real polygons come from Mapbox Draw.
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [151.247, -33.89],
          [151.258, -33.89],
          [151.258, -33.9],
          [151.247, -33.9],
          [151.247, -33.89],
        ],
      ],
    },
    areaSqm: '950000',
    estimatedLetterboxes: 2512,
    estimatedHouses: 1840,
    estimatedApartments: 672,
    estimatedDistanceKm: '14.2',
    estimatedMinutes: 540,
  });

  await db.insert(payments).values({
    jobId,
    clientUserId: clientId,
    stripePaymentIntentId: 'pi_local_seed',
    stripeCheckoutSessionId: 'cs_local_seed',
    amountNetCents: 51364,
    gstCents: 5136,
    platformFeeCents: 1364,
    amountTotalCents: 56500,
    status: 'succeeded',
    cardBrand: 'visa',
    cardLast4: '4242',
  });

  console.log('Done. Sample data:');
  console.log('  admin  ops@droptrack.au');
  console.log('  client sarah@belleproperty.com.au');
  console.log('  drops  james@droptrack.au, maya@droptrack.au');
  console.log('  job    JOB-2841 (paid_unassigned)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
