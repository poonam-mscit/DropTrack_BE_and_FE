import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { CampaignReportController } from './campaign-report.controller.js';
import { CampaignReportService } from './campaign-report.service.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { InsightService } from './insight.service.js';
import { JobCreatorService } from './job-creator.service.js';
import { RerunRecommenderService } from './rerun-recommender.service.js';

@Global()
@Module({
  controllers: [AiController, CampaignReportController, ChatController],
  providers: [
    CampaignReportService,
    JobCreatorService,
    InsightService,
    RerunRecommenderService,
    ChatService,
  ],
  exports: [
    CampaignReportService,
    JobCreatorService,
    InsightService,
    RerunRecommenderService,
    ChatService,
  ],
})
export class AiModule {}
