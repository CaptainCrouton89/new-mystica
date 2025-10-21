/**
 * AnalyticsService - Event tracking and analytics
 *
 * Simple wrapper around AnalyticsRepository for event logging.
 * Used by other services to track important user actions.
 */

import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';

export class AnalyticsService {
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.analyticsRepository = new AnalyticsRepository();
  }

  /**
   * Track an analytics event
   *
   * @param userId - User ID (null for system events)
   * @param eventName - Event identifier
   * @param properties - Additional event data
   */
  async trackEvent(userId: string | null, eventName: string, properties: any = null): Promise<void> {
    await this.analyticsRepository.logEvent(userId, eventName, properties);
  }
}

export const analyticsService = new AnalyticsService();