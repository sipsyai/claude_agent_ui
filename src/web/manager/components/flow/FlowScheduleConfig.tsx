import React from 'react';
import type {
  FlowSchedule,
  FlowScheduleType,
  FlowIntervalUnit,
} from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

// Schedule type options
const SCHEDULE_TYPE_OPTIONS: { value: FlowScheduleType; label: string; description: string }[] = [
  { value: 'once', label: 'One Time', description: 'Execute once at a specific date/time' },
  { value: 'cron', label: 'Cron Expression', description: 'Advanced scheduling with cron syntax' },
  { value: 'interval', label: 'Interval', description: 'Execute repeatedly at fixed intervals' },
];

// Interval unit options
const INTERVAL_UNIT_OPTIONS: { value: FlowIntervalUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

// Common timezone options
const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (GMT+3)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1)' },
  { value: 'America/New_York', label: 'America/New York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT)' },
];

// Common cron presets
const CRON_PRESETS: { value: string; label: string; description: string }[] = [
  { value: '0 * * * *', label: 'Every Hour', description: 'At minute 0 of every hour' },
  { value: '0 9 * * *', label: 'Daily at 9 AM', description: 'Every day at 09:00' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9 AM', description: 'Mon-Fri at 09:00' },
  { value: '0 0 * * 0', label: 'Weekly (Sunday)', description: 'Every Sunday at midnight' },
  { value: '0 0 1 * *', label: 'Monthly', description: 'First day of each month at midnight' },
  { value: '', label: 'Custom', description: 'Enter a custom cron expression' },
];

/**
 * Default schedule configuration
 */
export const createDefaultSchedule = (): FlowSchedule => ({
  isEnabled: false,
  scheduleType: 'interval',
  intervalValue: 1,
  intervalUnit: 'hours',
  timezone: 'UTC',
  runCount: 0,
  defaultInput: {},
  retryOnFailure: false,
  maxRetries: 3,
  retryDelayMinutes: 5,
});

export interface FlowScheduleConfigProps {
  schedule: FlowSchedule | undefined;
  onChange: (schedule: FlowSchedule) => void;
  className?: string;
}

/**
 * Configuration panel for Flow scheduling in the flow editor.
 * Allows users to configure automated execution schedules.
 */
const FlowScheduleConfig: React.FC<FlowScheduleConfigProps> = ({
  schedule,
  onChange,
  className = '',
}) => {
  // Initialize schedule if undefined
  const currentSchedule = schedule || createDefaultSchedule();

  // Update handler that ensures we always have a complete schedule object
  const handleChange = (updates: Partial<FlowSchedule>) => {
    onChange({ ...currentSchedule, ...updates });
  };

  // Format date for datetime-local input
  const formatDateForInput = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  // Parse date from datetime-local input
  const parseDateFromInput = (value: string): string | undefined => {
    if (!value) return undefined;
    return new Date(value).toISOString();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable Schedule Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
        <div>
          <label className="block font-medium">Enable Scheduled Execution</label>
          <p className="text-sm text-muted-foreground">
            Automatically run this flow on a schedule
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={currentSchedule.isEnabled}
            onChange={(e) => handleChange({ isEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Schedule Configuration (only show if enabled) */}
      {currentSchedule.isEnabled && (
        <>
          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Schedule Type</label>
            <Select
              value={currentSchedule.scheduleType}
              onChange={(e) => handleChange({ scheduleType: e.target.value as FlowScheduleType })}
            >
              {SCHEDULE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {SCHEDULE_TYPE_OPTIONS.find((o) => o.value === currentSchedule.scheduleType)?.description}
            </p>
          </div>

          {/* One-Time Execution Settings */}
          {currentSchedule.scheduleType === 'once' && (
            <OneTimeScheduleSettings
              startDate={currentSchedule.startDate}
              timezone={currentSchedule.timezone}
              onChange={handleChange}
              formatDateForInput={formatDateForInput}
              parseDateFromInput={parseDateFromInput}
            />
          )}

          {/* Cron Expression Settings */}
          {currentSchedule.scheduleType === 'cron' && (
            <CronScheduleSettings
              cronExpression={currentSchedule.cronExpression}
              timezone={currentSchedule.timezone}
              onChange={handleChange}
            />
          )}

          {/* Interval Settings */}
          {currentSchedule.scheduleType === 'interval' && (
            <IntervalScheduleSettings
              intervalValue={currentSchedule.intervalValue}
              intervalUnit={currentSchedule.intervalUnit}
              timezone={currentSchedule.timezone}
              onChange={handleChange}
            />
          )}

          {/* Date Range (for cron and interval) */}
          {currentSchedule.scheduleType !== 'once' && (
            <DateRangeSettings
              startDate={currentSchedule.startDate}
              endDate={currentSchedule.endDate}
              maxRuns={currentSchedule.maxRuns}
              onChange={handleChange}
              formatDateForInput={formatDateForInput}
              parseDateFromInput={parseDateFromInput}
            />
          )}

          {/* Retry Settings */}
          <RetrySettings
            retryOnFailure={currentSchedule.retryOnFailure}
            maxRetries={currentSchedule.maxRetries}
            retryDelayMinutes={currentSchedule.retryDelayMinutes}
            onChange={handleChange}
          />

          {/* Default Input Values */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Default Input Values (JSON)
              <span className="text-muted-foreground font-normal ml-1">- Optional</span>
            </label>
            <Textarea
              value={
                Object.keys(currentSchedule.defaultInput || {}).length > 0
                  ? JSON.stringify(currentSchedule.defaultInput, null, 2)
                  : ''
              }
              onChange={(e) => {
                try {
                  const input = e.target.value ? JSON.parse(e.target.value) : {};
                  handleChange({ defaultInput: input });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"field1": "default value", "field2": 123}'
              className="min-h-[80px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Input values to use when the schedule triggers execution
            </p>
          </div>

          {/* Schedule Info (read-only) */}
          {(currentSchedule.nextRunAt || currentSchedule.lastRunAt || currentSchedule.runCount > 0) && (
            <ScheduleInfoDisplay schedule={currentSchedule} />
          )}
        </>
      )}
    </div>
  );
};

/**
 * One-time schedule settings
 */
interface OneTimeScheduleSettingsProps {
  startDate?: string;
  timezone: string;
  onChange: (updates: Partial<FlowSchedule>) => void;
  formatDateForInput: (dateStr?: string) => string;
  parseDateFromInput: (value: string) => string | undefined;
}

const OneTimeScheduleSettings: React.FC<OneTimeScheduleSettingsProps> = ({
  startDate,
  timezone,
  onChange,
  formatDateForInput,
  parseDateFromInput,
}) => (
  <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
    <h5 className="font-medium text-sm">One-Time Execution</h5>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium mb-1">Execute At</label>
        <Input
          type="datetime-local"
          value={formatDateForInput(startDate)}
          onChange={(e) => onChange({ startDate: parseDateFromInput(e.target.value) })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Timezone</label>
        <Select
          value={timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  </div>
);

/**
 * Cron expression schedule settings
 */
interface CronScheduleSettingsProps {
  cronExpression?: string;
  timezone: string;
  onChange: (updates: Partial<FlowSchedule>) => void;
}

const CronScheduleSettings: React.FC<CronScheduleSettingsProps> = ({
  cronExpression,
  timezone,
  onChange,
}) => {
  // Check if current expression matches a preset
  const currentPreset = CRON_PRESETS.find((p) => p.value === cronExpression)?.value || '';

  return (
    <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
      <h5 className="font-medium text-sm">Cron Schedule</h5>

      {/* Preset Selection */}
      <div>
        <label className="block text-xs font-medium mb-1">Preset</label>
        <Select
          value={currentPreset}
          onChange={(e) => {
            if (e.target.value) {
              onChange({ cronExpression: e.target.value });
            }
          }}
        >
          {CRON_PRESETS.map((preset) => (
            <option key={preset.value || 'custom'} value={preset.value}>
              {preset.label} - {preset.description}
            </option>
          ))}
        </Select>
      </div>

      {/* Cron Expression Input */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Cron Expression</label>
          <Input
            value={cronExpression || ''}
            onChange={(e) => onChange({ cronExpression: e.target.value })}
            placeholder="0 9 * * 1-5"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Format: minute hour day month weekday
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Timezone</label>
          <Select
            value={timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Cron Help */}
      <div className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
        <strong>Cron fields:</strong> minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, 0=Sun)
        <br />
        <strong>Special chars:</strong> * (any), , (list), - (range), / (step)
        <br />
        <strong>Example:</strong> <code>0 9 * * 1-5</code> = Weekdays at 9:00 AM
      </div>
    </div>
  );
};

/**
 * Interval-based schedule settings
 */
interface IntervalScheduleSettingsProps {
  intervalValue: number;
  intervalUnit: FlowIntervalUnit;
  timezone: string;
  onChange: (updates: Partial<FlowSchedule>) => void;
}

const IntervalScheduleSettings: React.FC<IntervalScheduleSettingsProps> = ({
  intervalValue,
  intervalUnit,
  timezone,
  onChange,
}) => (
  <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
    <h5 className="font-medium text-sm">Interval Schedule</h5>
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-medium mb-1">Every</label>
        <Input
          type="number"
          min={1}
          value={intervalValue}
          onChange={(e) =>
            onChange({ intervalValue: Math.max(1, parseInt(e.target.value) || 1) })
          }
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Unit</label>
        <Select
          value={intervalUnit}
          onChange={(e) => onChange({ intervalUnit: e.target.value as FlowIntervalUnit })}
        >
          {INTERVAL_UNIT_OPTIONS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Timezone</label>
        <Select
          value={timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      Execute every {intervalValue} {intervalUnit.toLowerCase()}
    </p>
  </div>
);

/**
 * Date range settings for recurring schedules
 */
interface DateRangeSettingsProps {
  startDate?: string;
  endDate?: string;
  maxRuns?: number;
  onChange: (updates: Partial<FlowSchedule>) => void;
  formatDateForInput: (dateStr?: string) => string;
  parseDateFromInput: (value: string) => string | undefined;
}

const DateRangeSettings: React.FC<DateRangeSettingsProps> = ({
  startDate,
  endDate,
  maxRuns,
  onChange,
  formatDateForInput,
  parseDateFromInput,
}) => (
  <div className="grid grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium mb-1">
        Start Date
        <span className="text-muted-foreground font-normal ml-1">- Optional</span>
      </label>
      <Input
        type="datetime-local"
        value={formatDateForInput(startDate)}
        onChange={(e) => onChange({ startDate: parseDateFromInput(e.target.value) })}
      />
      <p className="text-xs text-muted-foreground mt-1">
        When to start the schedule
      </p>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">
        End Date
        <span className="text-muted-foreground font-normal ml-1">- Optional</span>
      </label>
      <Input
        type="datetime-local"
        value={formatDateForInput(endDate)}
        onChange={(e) => onChange({ endDate: parseDateFromInput(e.target.value) })}
      />
      <p className="text-xs text-muted-foreground mt-1">
        When to stop the schedule
      </p>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">
        Max Runs
        <span className="text-muted-foreground font-normal ml-1">- Optional</span>
      </label>
      <Input
        type="number"
        min={0}
        value={maxRuns ?? ''}
        onChange={(e) =>
          onChange({ maxRuns: e.target.value ? parseInt(e.target.value) : undefined })
        }
        placeholder="Unlimited"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Maximum number of executions
      </p>
    </div>
  </div>
);

/**
 * Retry settings for failed executions
 */
interface RetrySettingsProps {
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelayMinutes: number;
  onChange: (updates: Partial<FlowSchedule>) => void;
}

const RetrySettings: React.FC<RetrySettingsProps> = ({
  retryOnFailure,
  maxRetries,
  retryDelayMinutes,
  onChange,
}) => (
  <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="retryOnFailure"
        checked={retryOnFailure}
        onChange={(e) => onChange({ retryOnFailure: e.target.checked })}
        className="w-4 h-4 rounded"
      />
      <label htmlFor="retryOnFailure" className="font-medium text-sm cursor-pointer">
        Retry on Failure
      </label>
    </div>

    {retryOnFailure && (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Max Retries</label>
          <Input
            type="number"
            min={1}
            max={10}
            value={maxRetries}
            onChange={(e) =>
              onChange({ maxRetries: Math.min(10, Math.max(1, parseInt(e.target.value) || 3)) })
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Retry Delay (minutes)</label>
          <Input
            type="number"
            min={1}
            max={60}
            value={retryDelayMinutes}
            onChange={(e) =>
              onChange({
                retryDelayMinutes: Math.min(60, Math.max(1, parseInt(e.target.value) || 5)),
              })
            }
          />
        </div>
      </div>
    )}
  </div>
);

/**
 * Display read-only schedule info
 */
interface ScheduleInfoDisplayProps {
  schedule: FlowSchedule;
}

const ScheduleInfoDisplay: React.FC<ScheduleInfoDisplayProps> = ({ schedule }) => {
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
      <h5 className="font-medium text-sm text-blue-800">Schedule Status</h5>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-blue-600">Next Run:</span>{' '}
          <span className="font-medium">{formatDate(schedule.nextRunAt)}</span>
        </div>
        <div>
          <span className="text-blue-600">Last Run:</span>{' '}
          <span className="font-medium">{formatDate(schedule.lastRunAt)}</span>
        </div>
        <div>
          <span className="text-blue-600">Run Count:</span>{' '}
          <span className="font-medium">
            {schedule.runCount}
            {schedule.maxRuns ? ` / ${schedule.maxRuns}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FlowScheduleConfig;
