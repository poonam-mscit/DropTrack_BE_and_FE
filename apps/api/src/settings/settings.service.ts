/**
 * Runtime-tunable settings.
 *
 *   await settings.get('pricing.basePerLeafletCents', 20)
 *   await settings.setMany({ 'pricing.basePerLeafletCents': 22 }, adminUserId)
 *
 * Reads are served from an in-process LRU cache (TTL 30s) to avoid hammering the
 * DB on hot paths (every quote, every report). Writes flush the cache so the new
 * value takes effect on the next read across the cluster within 30s.
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { appSettings } from '@droptrack/db';
import { DB } from '../db/db.module.js';

/** Settings catalogue — anything an admin can tune at runtime. */
export const SETTING_KEYS = {
  pricingBasePerLeafletCents: 'pricing.basePerLeafletCents',
  pricingPlatformFeePct: 'pricing.platformFeePct',
  pricingGstPct: 'pricing.gstPct',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(@Inject(DB) private readonly db: Database) {}

  /** Read a single setting with a fallback. Caches for CACHE_TTL_MS. */
  async get<T>(key: SettingKey | string, fallback: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return (cached.value as T) ?? fallback;
    }
    const [row] = await this.db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    const value = row ? (row.value as T) : fallback;
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /** Read many settings in one query. Returns object keyed by setting key. */
  async getMany(keys: Array<SettingKey | string>): Promise<Record<string, unknown>> {
    const rows = await this.db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, keys));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Upsert one setting + invalidate cache. Returns the new row. */
  async set<T>(
    key: SettingKey | string,
    value: T,
    updatedByUserId: string | null = null,
    description?: string,
  ) {
    const [row] = await this.db
      .insert(appSettings)
      .values({ key, value: value as unknown, updatedByUserId, description })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: value as unknown,
          updatedByUserId,
          ...(description !== undefined ? { description } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    this.cache.delete(key);
    return row;
  }

  /** Bulk upsert + cache flush. */
  async setMany(
    patch: Record<string, unknown>,
    updatedByUserId: string | null = null,
  ) {
    const out: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of Object.entries(patch)) {
      const row = await this.set(key, value, updatedByUserId);
      out.push({ key: row.key, value: row.value });
    }
    return out;
  }

  /** Force flush — useful for tests. */
  invalidate(): void {
    this.cache.clear();
  }
}
