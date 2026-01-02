/**
 * Claude Agent UI - Flow Scheduler Service
 *
 * A simple scheduler service for automated flow execution using setInterval.
 * Designed for personal use - not production-grade.
 *
 * Features:
 * - Checks for scheduled flows every minute
 * - Supports schedule types: 'once', 'cron', 'interval'
 * - Basic cron expression parsing (minutes, hours, day of month, month, day of week)
 * - Interval-based scheduling (minutes, hours, days, weeks)
 * - One-time execution scheduling
 * - Automatic schedule updates after execution
 *
 * @see src/types/flow-types.ts for FlowSchedule type
 * @see src/services/flow-execution-service.ts for flow execution
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from './logger.js';
import { strapiClient } from './strapi-client.js';
import { flowExecutionService } from './flow-execution-service.js';
import type {
  Flow,
  FlowSchedule,
  FlowIntervalUnit,
} from '../types/flow-types.js';

// ============= CONFIGURATION =============

/** Check interval in milliseconds (1 minute) */
const CHECK_INTERVAL_MS = 60 * 1000;

/** Time tolerance for schedule matching (30 seconds before/after) */
const SCHEDULE_TOLERANCE_MS = 30 * 1000;

// ============= FLOW SCHEDULER SERVICE =============

/**
 * FlowSchedulerService - Singleton service for scheduled flow execution
 *
 * Uses setInterval to periodically check for flows that need to be executed
 * based on their schedule configuration.
 */
export class FlowSchedulerService extends EventEmitter {
  private logger: Logger;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastCheckTime: Date | null = null;
  private scheduledFlowIds: Set<string> = new Set();
  private executingFlowIds: Set<string> = new Set();

  constructor() {
    super();
    this.logger = createLogger('FlowSchedulerService');
  }

  /**
   * Start the scheduler service
   * Begins periodic checking for scheduled flows
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.logger.info('Starting flow scheduler service', {
      checkIntervalMs: CHECK_INTERVAL_MS,
    });

    this.isRunning = true;

    // Run initial check
    this.checkScheduledFlows().catch((error) => {
      this.logger.error('Initial schedule check failed', error);
    });

    // Set up periodic checking
    this.checkInterval = setInterval(() => {
      this.checkScheduledFlows().catch((error) => {
        this.logger.error('Scheduled check failed', error);
      });
    }, CHECK_INTERVAL_MS);

    this.emit('started');
    this.logger.info('Flow scheduler service started successfully');
  }

  /**
   * Stop the scheduler service
   * Clears the check interval and stops scheduling
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('Scheduler is not running');
      return;
    }

    this.logger.info('Stopping flow scheduler service');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    this.emit('stopped');
    this.logger.info('Flow scheduler service stopped');
  }

  /**
   * Check if the scheduler is currently running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the last time a schedule check was performed
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  /**
   * Get IDs of flows currently being tracked for scheduling
   */
  getScheduledFlowIds(): string[] {
    return Array.from(this.scheduledFlowIds);
  }

  /**
   * Get IDs of flows currently being executed by the scheduler
   */
  getExecutingFlowIds(): string[] {
    return Array.from(this.executingFlowIds);
  }

  /**
   * Force a schedule check immediately
   * Useful for testing or manual triggering
   */
  async forceCheck(): Promise<void> {
    this.logger.info('Forcing immediate schedule check');
    await this.checkScheduledFlows();
  }

  // ============= PRIVATE: SCHEDULE CHECKING =============

  /**
   * Check all flows for scheduled executions
   * This is the main loop that runs periodically
   */
  private async checkScheduledFlows(): Promise<void> {
    const checkTime = new Date();
    this.lastCheckTime = checkTime;

    this.logger.debug('Checking for scheduled flows', {
      checkTime: checkTime.toISOString(),
    });

    try {
      // Get all active flows with schedules
      const flows = await this.getScheduledFlows();
      this.scheduledFlowIds = new Set(flows.map((f) => f.id));

      this.logger.debug('Found flows with active schedules', {
        count: flows.length,
        flowIds: flows.map((f) => f.id),
      });

      // Check each flow's schedule
      for (const flow of flows) {
        try {
          await this.processFlowSchedule(flow, checkTime);
        } catch (error) {
          this.logger.error('Failed to process flow schedule', error as Error, {
            flowId: flow.id,
            flowName: flow.name,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to check scheduled flows', error as Error);
    }
  }

  /**
   * Get all flows that have active, enabled schedules
   */
  private async getScheduledFlows(): Promise<Flow[]> {
    try {
      // Get all active flows
      const flows = await strapiClient.getActiveFlows();

      // Filter to only flows with enabled schedules
      return flows.filter((flow) => {
        if (!flow.schedule) return false;
        if (!flow.schedule.isEnabled) return false;
        if (!flow.isActive) return false;

        // Check if within date range
        const now = new Date();
        if (flow.schedule.startDate && new Date(flow.schedule.startDate) > now) {
          return false;
        }
        if (flow.schedule.endDate && new Date(flow.schedule.endDate) < now) {
          return false;
        }

        // Check if max runs reached
        if (
          flow.schedule.maxRuns &&
          flow.schedule.runCount >= flow.schedule.maxRuns
        ) {
          return false;
        }

        return true;
      });
    } catch (error) {
      this.logger.error('Failed to get scheduled flows', error as Error);
      return [];
    }
  }

  /**
   * Process a single flow's schedule
   * Determines if the flow should be executed now
   */
  private async processFlowSchedule(flow: Flow, checkTime: Date): Promise<void> {
    const schedule = flow.schedule!;

    // Skip if flow is already being executed
    if (this.executingFlowIds.has(flow.id)) {
      this.logger.debug('Flow is already being executed, skipping', {
        flowId: flow.id,
      });
      return;
    }

    // Calculate if we should run now
    const shouldRun = this.shouldRunNow(schedule, checkTime);

    if (shouldRun) {
      this.logger.info('Executing scheduled flow', {
        flowId: flow.id,
        flowName: flow.name,
        scheduleType: schedule.scheduleType,
      });

      await this.executeScheduledFlow(flow);
    }
  }

  /**
   * Determine if a flow should run based on its schedule
   */
  private shouldRunNow(schedule: FlowSchedule, checkTime: Date): boolean {
    // If nextRunAt is set, check if we're past it
    if (schedule.nextRunAt) {
      const nextRun = new Date(schedule.nextRunAt);
      const timeDiff = checkTime.getTime() - nextRun.getTime();

      // Run if we're within tolerance window after next run time
      if (timeDiff >= -SCHEDULE_TOLERANCE_MS && timeDiff <= CHECK_INTERVAL_MS) {
        return true;
      }
      return false;
    }

    // Otherwise, calculate based on schedule type
    switch (schedule.scheduleType) {
      case 'once':
        // For 'once', we should have a nextRunAt - if not set, don't run
        return false;

      case 'interval':
        return this.shouldRunInterval(schedule, checkTime);

      case 'cron':
        return this.shouldRunCron(schedule, checkTime);

      default:
        return false;
    }
  }

  /**
   * Check if an interval-based schedule should run
   */
  private shouldRunInterval(schedule: FlowSchedule, checkTime: Date): boolean {
    // If never run before, run now
    if (!schedule.lastRunAt) {
      return true;
    }

    const lastRun = new Date(schedule.lastRunAt);
    const intervalMs = this.getIntervalMs(
      schedule.intervalValue,
      schedule.intervalUnit
    );

    // Check if enough time has passed since last run
    const timeSinceLastRun = checkTime.getTime() - lastRun.getTime();
    return timeSinceLastRun >= intervalMs - SCHEDULE_TOLERANCE_MS;
  }

  /**
   * Check if a cron-based schedule should run
   */
  private shouldRunCron(schedule: FlowSchedule, checkTime: Date): boolean {
    if (!schedule.cronExpression) {
      return false;
    }

    try {
      return this.matchesCronExpression(schedule.cronExpression, checkTime);
    } catch (error) {
      this.logger.warn('Invalid cron expression', {
        cronExpression: schedule.cronExpression,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // ============= PRIVATE: FLOW EXECUTION =============

  /**
   * Execute a flow as a scheduled run
   */
  private async executeScheduledFlow(flow: Flow): Promise<void> {
    const schedule = flow.schedule!;

    // Mark as executing to prevent duplicate runs
    this.executingFlowIds.add(flow.id);

    try {
      // Get default input from schedule
      const input = schedule.defaultInput || {};

      this.emit('flow-executing', {
        flowId: flow.id,
        flowName: flow.name,
        scheduleType: schedule.scheduleType,
      });

      // Execute the flow
      const result = await flowExecutionService.startExecution({
        flowId: flow.id,
        input,
        triggeredBy: 'schedule',
        triggerData: {
          scheduleType: schedule.scheduleType,
          scheduledAt: new Date().toISOString(),
        },
      });

      this.logger.info('Scheduled flow execution completed', {
        flowId: flow.id,
        executionId: result.executionId,
        success: result.success,
        status: result.status,
      });

      // Update schedule after execution
      await this.updateScheduleAfterExecution(flow, result.success);

      this.emit('flow-executed', {
        flowId: flow.id,
        executionId: result.executionId,
        success: result.success,
      });
    } catch (error) {
      this.logger.error('Scheduled flow execution failed', error as Error, {
        flowId: flow.id,
      });

      // Update schedule even on failure
      await this.updateScheduleAfterExecution(flow, false);

      this.emit('flow-failed', {
        flowId: flow.id,
        error: (error as Error).message,
      });
    } finally {
      // Remove from executing set
      this.executingFlowIds.delete(flow.id);
    }
  }

  /**
   * Update schedule fields after an execution
   */
  private async updateScheduleAfterExecution(
    flow: Flow,
    success: boolean
  ): Promise<void> {
    const schedule = flow.schedule!;
    const now = new Date();

    try {
      // Calculate next run time
      const nextRunAt = this.calculateNextRunTime(schedule, now);

      // Build updated schedule
      const updatedSchedule: Partial<FlowSchedule> = {
        ...schedule,
        lastRunAt: now,
        runCount: (schedule.runCount || 0) + 1,
        nextRunAt: nextRunAt || undefined,
      };

      // For 'once' schedules, disable after running
      if (schedule.scheduleType === 'once') {
        updatedSchedule.isEnabled = false;
      }

      // Check if max runs reached
      if (schedule.maxRuns && updatedSchedule.runCount! >= schedule.maxRuns) {
        updatedSchedule.isEnabled = false;
        this.logger.info('Max runs reached, disabling schedule', {
          flowId: flow.id,
          runCount: updatedSchedule.runCount,
          maxRuns: schedule.maxRuns,
        });
      }

      // Update the flow in Strapi
      await strapiClient.updateFlow(flow.id, {
        schedule: updatedSchedule as FlowSchedule,
      });

      this.logger.debug('Schedule updated after execution', {
        flowId: flow.id,
        lastRunAt: now.toISOString(),
        nextRunAt: nextRunAt?.toISOString(),
        runCount: updatedSchedule.runCount,
      });
    } catch (error) {
      this.logger.error('Failed to update schedule after execution', error as Error, {
        flowId: flow.id,
      });
    }
  }

  // ============= PRIVATE: SCHEDULE CALCULATIONS =============

  /**
   * Calculate the next run time based on schedule configuration
   */
  private calculateNextRunTime(
    schedule: FlowSchedule,
    fromTime: Date
  ): Date | null {
    switch (schedule.scheduleType) {
      case 'once':
        // One-time schedules don't have a next run
        return null;

      case 'interval':
        return this.calculateNextIntervalRun(schedule, fromTime);

      case 'cron':
        return this.calculateNextCronRun(schedule, fromTime);

      default:
        return null;
    }
  }

  /**
   * Calculate next run time for interval-based schedule
   */
  private calculateNextIntervalRun(
    schedule: FlowSchedule,
    fromTime: Date
  ): Date {
    const intervalMs = this.getIntervalMs(
      schedule.intervalValue,
      schedule.intervalUnit
    );

    return new Date(fromTime.getTime() + intervalMs);
  }

  /**
   * Calculate next run time for cron-based schedule
   * Simplified implementation for common patterns
   */
  private calculateNextCronRun(schedule: FlowSchedule, fromTime: Date): Date {
    if (!schedule.cronExpression) {
      // Default to 1 hour if no cron expression
      return new Date(fromTime.getTime() + 60 * 60 * 1000);
    }

    // Parse the cron expression to find next matching time
    // For simplicity, we'll calculate the next minute that matches
    const next = new Date(fromTime);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Try up to 24*60 times (1 day worth of minutes)
    for (let i = 0; i < 24 * 60; i++) {
      next.setMinutes(next.getMinutes() + 1);
      if (this.matchesCronExpression(schedule.cronExpression, next)) {
        return next;
      }
    }

    // Fallback to 1 day if no match found
    return new Date(fromTime.getTime() + 24 * 60 * 60 * 1000);
  }

  /**
   * Convert interval value and unit to milliseconds
   */
  private getIntervalMs(value: number, unit: FlowIntervalUnit): number {
    const multipliers: Record<FlowIntervalUnit, number> = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || multipliers.hours);
  }

  /**
   * Check if a given time matches a cron expression
   *
   * Cron format: minute hour day-of-month month day-of-week
   * Examples:
   * - "0 9 * * 1-5" - 9am on weekdays
   * - "0,15,30,45 * * * *" - Every 15 minutes (using list instead of step)
   * - "0 0 1 * *" - First of every month at midnight
   */
  private matchesCronExpression(cronExpr: string, time: Date): boolean {
    const parts = cronExpr.trim().split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cronExpr}`);
    }

    const [minuteExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;

    const minute = time.getMinutes();
    const hour = time.getHours();
    const day = time.getDate();
    const month = time.getMonth() + 1; // JavaScript months are 0-indexed
    const weekday = time.getDay(); // 0 = Sunday

    return (
      this.matchesCronField(minuteExpr, minute, 0, 59) &&
      this.matchesCronField(hourExpr, hour, 0, 23) &&
      this.matchesCronField(dayExpr, day, 1, 31) &&
      this.matchesCronField(monthExpr, month, 1, 12) &&
      this.matchesCronField(weekdayExpr, weekday, 0, 6)
    );
  }

  /**
   * Match a single cron field against a value
   * Supports: wildcard (*), specific values, ranges (1-5), steps, lists (1,3,5)
   */
  private matchesCronField(
    expr: string,
    value: number,
    min: number,
    max: number
  ): boolean {
    // Handle wildcard
    if (expr === '*') {
      return true;
    }

    // Handle step values (*/n)
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2), 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid step in cron field: ${expr}`);
      }
      return value % step === 0;
    }

    // Handle range with step (1-30/5)
    if (expr.includes('/')) {
      const [rangeOrStar, stepStr] = expr.split('/');
      const step = parseInt(stepStr, 10);

      if (rangeOrStar === '*') {
        return value % step === 0;
      }

      if (rangeOrStar.includes('-')) {
        const [startStr, endStr] = rangeOrStar.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        return value >= start && value <= end && (value - start) % step === 0;
      }
    }

    // Handle list (1,3,5)
    if (expr.includes(',')) {
      const values = expr.split(',').map((v) => {
        // Handle ranges within lists
        if (v.includes('-')) {
          const [start, end] = v.split('-').map((n) => parseInt(n, 10));
          const rangeValues: number[] = [];
          for (let i = start; i <= end; i++) {
            rangeValues.push(i);
          }
          return rangeValues;
        }
        return [parseInt(v, 10)];
      }).flat();

      return values.includes(value);
    }

    // Handle range (1-5)
    if (expr.includes('-')) {
      const [start, end] = expr.split('-').map((v) => parseInt(v, 10));
      return value >= start && value <= end;
    }

    // Handle specific value
    const specificValue = parseInt(expr, 10);
    if (isNaN(specificValue)) {
      throw new Error(`Invalid cron field value: ${expr}`);
    }
    return value === specificValue;
  }
}

// ============= SINGLETON EXPORT =============

/**
 * Singleton instance of FlowSchedulerService
 * Use this throughout the application for flow scheduling
 */
export const flowSchedulerService = new FlowSchedulerService();
