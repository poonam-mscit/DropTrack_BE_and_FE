/**
 * Dev-only convenience: look up a user uuid by email, so the dev login picker
 * doesn't break when the seed re-randomises ids. Disabled in production.
 */
import { NextResponse } from 'next/server';
import { db, users } from '@droptrack/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') return new NextResponse('Not found', { status: 404 });
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ id: u.id, role: u.role });
}
