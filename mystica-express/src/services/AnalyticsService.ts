import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';

export class AnalyticsService {
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.analyticsRepository = new AnalyticsRepository();
  }

  async trackEvent(userId: string | null, eventName: string, properties?: Record<string, unknown>): Promise<void> {
    await this.analyticsRepository.logEvent(userId, eventName, properties);
  }
}

export const analyticsService = new AnalyticsService();