import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { eq, ilike, or, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { suburbPricing, suburbs } from '@droptrack/db';
import { Roles } from '../auth/auth.decorators.js';
import { DB } from '../db/db.module.js';
import type { OsmSuburbsProvider } from './osm-suburbs.provider.js';
import { OSM_SUBURBS_PROVIDER } from './osm-suburbs.provider.js';

const ImportSuburbSchema = z.object({
  osmId: z.string().min(1),
  osmType: z.string().default('relation'),
  name: z.string().min(1),
  state: z.string().min(1),
  postcode: z.string().default(''),
});
class ImportSuburbDto extends createZodDto(ImportSuburbSchema) {}

const CreateSuburbPricingSchema = z.object({
  suburbId: z.string().uuid(),
  ratePerLeafletCents: z.number().int().min(1).max(1000),
  isActive: z.boolean().optional().default(true),
});
class CreateSuburbPricingDto extends createZodDto(CreateSuburbPricingSchema) {}

const UpdateSuburbPricingSchema = z.object({
  ratePerLeafletCents: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});
class UpdateSuburbPricingDto extends createZodDto(UpdateSuburbPricingSchema) {}

@Roles('admin')
@Controller('admin')
export class SuburbPricingAdminController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(OSM_SUBURBS_PROVIDER) private readonly osmSuburbsProvider: OsmSuburbsProvider,
  ) {}

  /**
   * Search Australian suburbs.
   * LOCAL DATABASE FIRST: Queries local PostGIS suburbs table first, then merges
   * with results from provider abstraction (Nominatim API).
   */
  @Get('suburbs/search')
  async searchSuburbs(@Query('q') query?: string) {
    const q = query?.trim() ?? '';
    if (q.length < 3) return { data: [] };

    // 1. Local Database First
    const localMatches = await this.db
      .select({
        id: suburbs.id,
        name: suburbs.name,
        state: suburbs.state,
        postcode: suburbs.postcode,
        osmId: suburbs.osmId,
        osmType: suburbs.osmType,
      })
      .from(suburbs)
      .where(
        or(
          ilike(suburbs.name, `%${q}%`),
          ilike(suburbs.postcode, `%${q}%`),
        ),
      )
      .limit(10);

    const localFormatted = localMatches.map((s) => ({
      name: s.name,
      display_name: `${s.name}, ${s.state} ${s.postcode}, Australia (Stored in Database)`,
      postcode: s.postcode,
      state: s.state,
      osm_id: s.osmId || s.id,
      osm_type: s.osmType || 'relation',
    }));

    // 2. Fetch external candidates via provider abstraction
    let externalMatches: any[] = [];
    try {
      externalMatches = await this.osmSuburbsProvider.searchAustralianSuburbs(q);
    } catch (err) {
      // Fail-safe: Return local matches if external provider encounters an issue
      return { data: localFormatted };
    }

    // Merge results, giving priority to local DB records and avoiding duplicates
    const localKeySet = new Set(
      localMatches.map((m) => `${m.name.toLowerCase()}-${m.state.toLowerCase()}`),
    );

    const merged = [...localFormatted];
    for (const ext of externalMatches) {
      const key = `${ext.name.toLowerCase()}-${ext.state.toLowerCase()}`;
      if (!localKeySet.has(key)) {
        merged.push(ext);
      }
    }

    return { data: merged.slice(0, 10) };
  }

  /**
   * Import official suburb boundary via OpenStreetMap provider abstraction.
   * LOCAL DATABASE FIRST: Never downloads the same suburb twice.
   * TRANSACTION SAFE: Wraps database insert in a transaction to prevent partial state.
   */
  @Post('suburbs/import')
  async importSuburb(
    @Body(new ZodValidationPipe(ImportSuburbSchema)) body: ImportSuburbDto,
  ) {
    // 1. Local Database First — Check if suburb already exists by osmId or (name + state + postcode)
    const existing = await this.db
      .select({
        id: suburbs.id,
        name: suburbs.name,
        state: suburbs.state,
        postcode: suburbs.postcode,
        osmId: suburbs.osmId,
        osmType: suburbs.osmType,
      })
      .from(suburbs)
      .where(
        or(
          eq(suburbs.osmId, body.osmId),
          sql`LOWER(${suburbs.name}) = LOWER(${body.name}) AND LOWER(${suburbs.state}) = LOWER(${body.state}) AND ${suburbs.postcode} = ${body.postcode}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { data: existing[0] };
    }

    // 2. Retrieve official MultiPolygon boundary via provider abstraction
    let polygon;
    try {
      polygon = await this.osmSuburbsProvider.fetchSuburbBoundary(body.osmId, body.osmType);
    } catch (err: any) {
      throw new BadRequestException(
        err.message || `Failed to import official boundary for suburb ${body.name}`,
      );
    }

    // 3. Transaction-Safe Write: Store permanently in PostgreSQL/PostGIS
    try {
      const inserted = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(suburbs)
          .values({
            name: body.name,
            state: body.state.toUpperCase(),
            postcode: body.postcode,
            osmId: body.osmId,
            osmType: body.osmType,
            polygon,
          })
          .returning({
            id: suburbs.id,
            name: suburbs.name,
            state: suburbs.state,
            postcode: suburbs.postcode,
            osmId: suburbs.osmId,
            osmType: suburbs.osmType,
          });
        return row;
      });

      return { data: inserted };
    } catch (err: any) {
      throw new BadRequestException(
        `Database transaction failed while saving boundary for ${body.name}: ${err.message}`,
      );
    }
  }

  /** List all configured suburb pricing rules. */
  @Get('suburb-pricing')
  async listPricing() {
    const rows = await this.db.execute<{
      id: string;
      suburb_id: string;
      suburb_name: string;
      state: string;
      postcode: string;
      rate_per_leaflet_cents: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(sql`
      SELECT 
        sp.id,
        sp.suburb_id,
        s.name AS suburb_name,
        s.state,
        s.postcode,
        sp.rate_per_leaflet_cents,
        sp.is_active,
        sp.created_at,
        sp.updated_at
      FROM suburb_pricing sp
      JOIN suburbs s ON s.id = sp.suburb_id
      ORDER BY sp.updated_at DESC;
    `);

    return {
      data: rows.map((r) => ({
        id: r.id,
        suburbId: r.suburb_id,
        suburbName: r.suburb_name,
        state: r.state,
        postcode: r.postcode,
        ratePerLeafletCents: r.rate_per_leaflet_cents,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  }

  /** Add a new suburb pricing rule or update if already present. */
  @Post('suburb-pricing')
  async createPricing(
    @Body(new ZodValidationPipe(CreateSuburbPricingSchema)) body: CreateSuburbPricingDto,
  ) {
    const [sub] = await this.db
      .select()
      .from(suburbs)
      .where(eq(suburbs.id, body.suburbId))
      .limit(1);

    if (!sub) {
      throw new NotFoundException(`Suburb ${body.suburbId} not found`);
    }

    // Upsert pricing rule for suburb
    const [existing] = await this.db
      .select()
      .from(suburbPricing)
      .where(eq(suburbPricing.suburbId, body.suburbId))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(suburbPricing)
        .set({
          ratePerLeafletCents: body.ratePerLeafletCents,
          isActive: body.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(eq(suburbPricing.id, existing.id))
        .returning();
      return { data: updated };
    }

    const [row] = await this.db
      .insert(suburbPricing)
      .values({
        suburbId: body.suburbId,
        ratePerLeafletCents: body.ratePerLeafletCents,
        isActive: body.isActive ?? true,
      })
      .returning();

    return { data: row };
  }

  /** Patch an existing suburb pricing rule. */
  @Patch('suburb-pricing/:id')
  async updatePricing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSuburbPricingSchema)) body: UpdateSuburbPricingDto,
  ) {
    const [existing] = await this.db
      .select()
      .from(suburbPricing)
      .where(eq(suburbPricing.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Suburb pricing rule ${id} not found`);
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.ratePerLeafletCents !== undefined) patch.ratePerLeafletCents = body.ratePerLeafletCents;
    if (body.isActive !== undefined) patch.isActive = body.isActive;

    const [updated] = await this.db
      .update(suburbPricing)
      .set(patch)
      .where(eq(suburbPricing.id, id))
      .returning();

    return { data: updated };
  }

  /** Delete a suburb pricing rule. */
  @Delete('suburb-pricing/:id')
  async deletePricing(@Param('id') id: string) {
    const [existing] = await this.db
      .select()
      .from(suburbPricing)
      .where(eq(suburbPricing.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Suburb pricing rule ${id} not found`);
    }

    await this.db.delete(suburbPricing).where(eq(suburbPricing.id, id));
    return { deleted: true };
  }
}
