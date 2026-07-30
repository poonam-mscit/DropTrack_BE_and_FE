import { Global, Module } from '@nestjs/common';
import { SettingsAdminController } from './settings-admin.controller.js';
import { SuburbPricingAdminController } from './suburb-pricing-admin.controller.js';
import { SettingsService } from './settings.service.js';
import { OsmSuburbsService } from './osm-suburbs.service.js';
import { OSM_SUBURBS_PROVIDER } from './osm-suburbs.provider.js';

@Global()
@Module({
  controllers: [SettingsAdminController, SuburbPricingAdminController],
  providers: [
    SettingsService,
    OsmSuburbsService,
    {
      provide: OSM_SUBURBS_PROVIDER,
      useClass: OsmSuburbsService,
    },
  ],
  exports: [SettingsService, OsmSuburbsService, OSM_SUBURBS_PROVIDER],
})
export class SettingsModule {}
