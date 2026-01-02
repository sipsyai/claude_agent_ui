import { PermissionRequest } from '@/types/index.js';
import { createLogger, type Logger } from './logger.js';
import { ConfigService } from './config-service.js';
import { WebPushService } from './web-push-service.js';

/**
 * Notification payload for ntfy.sh push notifications
 *
 * @description
 * Represents a structured notification payload for the ntfy.sh push notification service.
 * Notifications are sent via HTTP POST to ntfy.sh topics with custom headers for metadata.
 *
 * @example
 * ```typescript
 * // Permission request notification
 * const notification: Notification = {
 *   title: 'CUI Permission Request',
 *   message: 'EnterPlanMode tool requires approval',
 *   priority: 'default',
 *   tags: ['cui-permission'],
 *   sessionId: 'sess-abc123',
 *   streamingId: 'stream-xyz789',
 *   permissionRequestId: 'perm-123'
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Task completion notification
 * const notification: Notification = {
 *   title: 'Task Finished',
 *   message: 'Created 5 new unit tests for UserService',
 *   priority: 'default',
 *   tags: ['cui-complete'],
 *   sessionId: 'sess-abc123',
 *   streamingId: 'stream-xyz789'
 * };
 * ```
 */
export interface Notification {
  /** Notification title displayed prominently in push notification UI */
  title: string;
  /** Notification message body with task details or summary */
  message: string;
  /** Priority level affecting notification delivery and display (min=silent, urgent=bypass DND) */
  priority: 'min' | 'low' | 'default' | 'high' | 'urgent';
  /** Tags for categorizing and filtering notifications (e.g., ['cui-permission'], ['cui-complete']) */
  tags: string[];
  /** Session ID for tracking which chat session triggered the notification */
  sessionId: string;
  /** Streaming ID for tracking the specific message stream that triggered the notification */
  streamingId: string;
  /** Optional permission request ID for linking notification to specific approval workflow */
  permissionRequestId?: string;
}

/**
 * NotificationService - Push notification delivery via ntfy.sh and native Web Push
 *
 * @description
 * The NotificationService handles push notification delivery for CUI application events such as
 * permission requests and task completions. It supports dual delivery channels: ntfy.sh HTTP
 * push notifications (for mobile/desktop apps) and native browser Web Push API (for web clients).
 *
 * **Key Responsibilities:**
 * - Send permission request notifications when tools require user approval
 * - Send task completion notifications when conversations end
 * - Dual-channel delivery: ntfy.sh (primary) + Web Push (best-effort)
 * - Configuration-based enable/disable via ConfigService
 * - Machine ID-based topic routing for privacy and multi-instance support
 * - Custom metadata headers (X-CUI-SessionId, X-CUI-StreamingId, X-CUI-PermissionRequestId)
 *
 * **Architecture:**
 * - **ntfy.sh Integration**: HTTP POST to `${ntfyUrl}/${topic}` with custom headers
 * - **Web Push Integration**: Best-effort native browser push via WebPushService
 * - **Topic Naming**: `cui-${machineId}` ensures notifications route to correct machine
 * - **Configuration**: Controlled by `config.interface.notifications.enabled` and `ntfyUrl`
 * - **Graceful Degradation**: Web Push failures are logged but don't block ntfy.sh delivery
 * - **Machine ID**: Retrieved from ConfigService, ensures privacy across machines
 *
 * **Notification Types:**
 * 1. **Permission Requests** (`sendPermissionNotification`)
 *    - Triggered when tools require user approval (e.g., EnterPlanMode, file writes)
 *    - Priority: 'default'
 *    - Tags: ['cui-permission']
 *    - Includes: tool name, request summary, permission request ID
 *    - Use case: Mobile notification for approval when away from computer
 *
 * 2. **Task Completions** (`sendConversationEndNotification`)
 *    - Triggered when AI conversation/task completes
 *    - Priority: 'default'
 *    - Tags: ['cui-complete']
 *    - Includes: task summary, session ID, streaming ID
 *    - Use case: Know when long-running tasks finish
 *
 * **Configuration:**
 * Notifications are controlled via `~/.cui/config.json`:
 * ```json
 * {
 *   "interface": {
 *     "notifications": {
 *       "enabled": false,           // Enable notifications
 *       "ntfyUrl": "https://ntfy.sh" // ntfy.sh server URL
 *     }
 *   }
 * }
 * ```
 *
 * **ntfy.sh Protocol:**
 * - **HTTP POST**: Send message body as plain text
 * - **Custom Headers**:
 *   - `Title`: Notification title
 *   - `Priority`: min | low | default | high | urgent
 *   - `Tags`: Comma-separated tags for filtering
 *   - `X-CUI-SessionId`: Session ID for tracking
 *   - `X-CUI-StreamingId`: Streaming ID for message correlation
 *   - `X-CUI-PermissionRequestId`: Permission request ID (if applicable)
 * - **Topic Subscription**: Users subscribe to `cui-${machineId}` on mobile/desktop apps
 *
 * **Use Cases:**
 * - Permission approval: Get notified on phone when AI needs approval
 * - Task monitoring: Know when long-running tasks complete
 * - Multi-instance: Different machines use different topics (cui-machine1, cui-machine2)
 * - Remote work: Work from anywhere, get notified when tasks need attention
 *
 * @example
 * ```typescript
 * // Basic usage - send permission notification
 * import { NotificationService } from './notification-service';
 * import { PermissionRequest } from '@/types';
 *
 * const notificationService = new NotificationService();
 *
 * const request: PermissionRequest = {
 *   id: 'perm-123',
 *   toolName: 'EnterPlanMode',
 *   toolInput: { task: 'Implement user authentication' },
 *   streamingId: 'stream-xyz789'
 * };
 *
 * await notificationService.sendPermissionNotification(
 *   request,
 *   'sess-abc123',
 *   'Planning implementation for user authentication'
 * );
 * // Sends notification to ntfy.sh topic: cui-a1b2c3d4e5f6g7h8
 * // Title: CUI Permission Request
 * // Message: Planning implementation for user authentication - EnterPlanMode
 * ```
 *
 * @example
 * ```typescript
 * // Task completion notification
 * import { NotificationService } from './notification-service';
 *
 * const notificationService = new NotificationService();
 *
 * await notificationService.sendConversationEndNotification(
 *   'stream-xyz789',
 *   'sess-abc123',
 *   'Created 5 unit tests for UserService with 100% coverage'
 * );
 * // Sends notification to ntfy.sh topic: cui-a1b2c3d4e5f6g7h8
 * // Title: Task Finished
 * // Message: Created 5 unit tests for UserService with 100% coverage
 * ```
 *
 * @example
 * ```typescript
 * // Mobile app subscription workflow
 * // 1. User installs ntfy.sh mobile app on phone
 * // 2. Subscribe to topic: cui-a1b2c3d4e5f6g7h8 (machine ID from ~/.cui/config.json)
 * // 3. Enable notifications in CUI config:
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.updateConfig({
 *   interface: {
 *     notifications: {
 *       enabled: true,
 *       ntfyUrl: 'https://ntfy.sh' // or self-hosted ntfy.sh server
 *     }
 *   }
 * });
 *
 * // 4. Start working - notifications now arrive on phone automatically
 * ```
 *
 * @example
 * ```typescript
 * // Disabled notifications (default behavior)
 * import { NotificationService } from './notification-service';
 *
 * // When notifications disabled in config, methods return early (no-op)
 * const notificationService = new NotificationService();
 *
 * await notificationService.sendPermissionNotification(request);
 * // No notification sent (logged as debug: "Notifications disabled, skipping")
 * ```
 *
 * @example
 * ```typescript
 * // Self-hosted ntfy.sh server for privacy
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.updateConfig({
 *   interface: {
 *     notifications: {
 *       enabled: true,
 *       ntfyUrl: 'https://ntfy.example.com' // Private server
 *     }
 *   }
 * });
 *
 * // Notifications now route to self-hosted server
 * // Subscribe in mobile app: https://ntfy.example.com/cui-a1b2c3d4e5f6g7h8
 * ```
 *
 * @see {@link ConfigService} for notification configuration
 * @see {@link WebPushService} for native browser push notifications
 * @see https://docs.ntfy.sh/ for ntfy.sh documentation
 */
export class NotificationService {
  /** Logger instance for NotificationService component */
  private logger: Logger;
  /** ConfigService singleton for reading notification configuration */
  private configService: ConfigService;
  /** Cached machine ID from config (null until first access) */
  private machineId: string | null = null;
  /** WebPushService singleton for native browser push notifications */
  private webPushService: WebPushService;

  constructor() {
    this.logger = createLogger('NotificationService');
    this.configService = ConfigService.getInstance();
    this.webPushService = WebPushService.getInstance();
  }

  /**
   * Get machine ID from config with caching
   *
   * @description
   * Retrieves the unique machine ID from ConfigService with single-access caching.
   * The machine ID is used to construct the ntfy.sh topic name (`cui-${machineId}`),
   * ensuring notifications route to the correct machine in multi-instance setups.
   *
   * **Caching Strategy:**
   * - First call: Fetch from ConfigService, cache in memory
   * - Subsequent calls: Return cached value (avoids config reads)
   * - Error fallback: Returns 'unknown' if config read fails
   *
   * @private
   * @returns {string} Machine ID (e.g., 'a1b2c3d4e5f6g7h8') or 'unknown' on error
   *
   * @example
   * ```typescript
   * // Internal usage - construct ntfy.sh topic
   * const machineId = this.getMachineId(); // 'a1b2c3d4e5f6g7h8'
   * const topic = `cui-${machineId}`; // 'cui-a1b2c3d4e5f6g7h8'
   * ```
   *
   * @example
   * ```typescript
   * // Caching behavior
   * const id1 = this.getMachineId(); // Fetches from config
   * const id2 = this.getMachineId(); // Returns cached value
   * // id1 === id2 (same instance)
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - config read failure
   * // If config.machine_id throws error, returns 'unknown'
   * const machineId = this.getMachineId(); // 'unknown'
   * // Error logged but notification still attempts delivery
   * ```
   */
  private getMachineId(): string {
    if (!this.machineId) {
      try {
        const config = this.configService.getConfig();
        this.machineId = config.machine_id;
      } catch (error) {
        this.logger.error('Failed to get machine ID from config', error);
        this.machineId = 'unknown';
      }
    }
    return this.machineId;
  }

  /**
   * Check if notifications are enabled in configuration
   *
   * @description
   * Reads the notification enable flag from ConfigService. When disabled, notification
   * methods return early (no-op) to avoid unnecessary processing and API calls.
   *
   * **Configuration Path:**
   * `config.interface.notifications.enabled` (default: false)
   *
   * @private
   * @returns {Promise<boolean>} True if notifications enabled, false otherwise (default: false)
   *
   * @example
   * ```typescript
   * // Internal usage - early return when disabled
   * if (!(await this.isEnabled())) {
   *   this.logger.debug('Notifications disabled, skipping');
   *   return;
   * }
   * // Continue with notification delivery...
   * ```
   *
   * @example
   * ```typescript
   * // Configuration check
   * const enabled = await this.isEnabled(); // false (default)
   *
   * // Enable notifications in config
   * await configService.updateConfig({
   *   interface: {
   *     notifications: { enabled: true }
   *   }
   * });
   *
   * const enabledNow = await this.isEnabled(); // true
   * ```
   */
  private async isEnabled(): Promise<boolean> {
    const config = this.configService.getConfig();
    return config.interface.notifications?.enabled ?? false;
  }

  /**
   * Get the ntfy.sh server URL from configuration
   *
   * @description
   * Retrieves the ntfy.sh server URL from ConfigService with fallback to public ntfy.sh.
   * Supports self-hosted ntfy.sh servers for privacy and control.
   *
   * **Configuration Path:**
   * `config.interface.notifications.ntfyUrl` (default: 'https://ntfy.sh')
   *
   * **Use Cases:**
   * - Public server: Use default 'https://ntfy.sh' for quick setup
   * - Self-hosted: Use custom URL like 'https://ntfy.example.com' for privacy
   * - Corporate: Use internal server behind firewall
   *
   * @private
   * @returns {Promise<string>} ntfy.sh server URL (default: 'https://ntfy.sh')
   *
   * @example
   * ```typescript
   * // Internal usage - construct notification URL
   * const ntfyUrl = await this.getNtfyUrl(); // 'https://ntfy.sh'
   * const topic = `cui-${machineId}`; // 'cui-a1b2c3d4e5f6g7h8'
   * const url = `${ntfyUrl}/${topic}`; // 'https://ntfy.sh/cui-a1b2c3d4e5f6g7h8'
   * ```
   *
   * @example
   * ```typescript
   * // Default public server
   * const url = await this.getNtfyUrl(); // 'https://ntfy.sh'
   * ```
   *
   * @example
   * ```typescript
   * // Self-hosted server configuration
   * await configService.updateConfig({
   *   interface: {
   *     notifications: {
   *       enabled: true,
   *       ntfyUrl: 'https://ntfy.example.com'
   *     }
   *   }
   * });
   *
   * const url = await this.getNtfyUrl(); // 'https://ntfy.example.com'
   * ```
   */
  private async getNtfyUrl(): Promise<string> {
    const config = this.configService.getConfig();
    return config.interface.notifications?.ntfyUrl || 'https://ntfy.sh';
  }

  /**
   * Send notification for tool permission requests
   *
   * @description
   * Sends push notifications via ntfy.sh and native Web Push when tools require user approval.
   * This enables mobile/remote approval workflows where users can approve tool usage from their
   * phone while away from their computer.
   *
   * **Dual-Channel Delivery:**
   * 1. **ntfy.sh** (primary): HTTP POST with custom headers for metadata
   * 2. **Web Push** (best-effort): Native browser push via WebPushService
   *
   * **Notification Workflow:**
   * 1. Check if notifications enabled via `isEnabled()` (early return if disabled)
   * 2. Get machine ID and construct topic: `cui-${machineId}`
   * 3. Get ntfy.sh URL from config (default: 'https://ntfy.sh')
   * 4. Build notification payload with metadata
   * 5. Send to ntfy.sh via HTTP POST with custom headers
   * 6. Attempt Web Push broadcast (errors logged but non-blocking)
   * 7. Log success with request details
   *
   * **Notification Payload:**
   * - Title: 'CUI Permission Request'
   * - Message: `${summary} - ${toolName}` or truncated tool input
   * - Priority: 'default'
   * - Tags: ['cui-permission']
   * - Custom headers: X-CUI-SessionId, X-CUI-StreamingId, X-CUI-PermissionRequestId
   *
   * **Use Cases:**
   * - EnterPlanMode approval: Notify user that AI wants to plan implementation
   * - File write approval: Notify user about pending file modifications
   * - Dangerous tool approval: Alert about high-risk operations
   * - Remote work: Approve tools from phone while away from desk
   *
   * @param {PermissionRequest} request - Permission request object with tool details
   * @param {string} [sessionId] - Optional session ID for tracking (default: 'unknown')
   * @param {string} [summary] - Optional human-friendly summary of the request
   * @returns {Promise<void>} Resolves when notification sent (or disabled/failed)
   *
   * @example
   * ```typescript
   * // Basic permission notification with summary
   * import { NotificationService } from './notification-service';
   * import { PermissionRequest } from '@/types';
   *
   * const notificationService = new NotificationService();
   *
   * const request: PermissionRequest = {
   *   id: 'perm-123',
   *   toolName: 'EnterPlanMode',
   *   toolInput: { task: 'Implement authentication' },
   *   streamingId: 'stream-xyz789'
   * };
   *
   * await notificationService.sendPermissionNotification(
   *   request,
   *   'sess-abc123',
   *   'Planning implementation for user authentication feature'
   * );
   * // Sends notification:
   * // Title: CUI Permission Request
   * // Message: Planning implementation for user authentication feature - EnterPlanMode
   * // Topic: cui-a1b2c3d4e5f6g7h8
   * ```
   *
   * @example
   * ```typescript
   * // Permission notification without summary (uses truncated tool input)
   * const request: PermissionRequest = {
   *   id: 'perm-456',
   *   toolName: 'Write',
   *   toolInput: {
   *     file_path: '/src/auth/login.ts',
   *     content: 'export function login() { ... }'
   *   },
   *   streamingId: 'stream-abc123'
   * };
   *
   * await notificationService.sendPermissionNotification(request, 'sess-def456');
   * // Message: Write tool: {"file_path":"/src/auth/login.ts","content":"export function login() {...
   * // (truncated to 100 chars)
   * ```
   *
   * @example
   * ```typescript
   * // Notification includes custom metadata headers for client correlation
   * // HTTP POST to https://ntfy.sh/cui-a1b2c3d4e5f6g7h8
   * // Headers:
   * //   Title: CUI Permission Request
   * //   Priority: default
   * //   Tags: cui-permission
   * //   X-CUI-SessionId: sess-abc123
   * //   X-CUI-StreamingId: stream-xyz789
   * //   X-CUI-PermissionRequestId: perm-123
   * // Body: Planning implementation for user authentication feature - EnterPlanMode
   * ```
   *
   * @example
   * ```typescript
   * // Graceful handling when notifications disabled
   * // Config: { interface: { notifications: { enabled: false } } }
   *
   * await notificationService.sendPermissionNotification(request);
   * // Logs: "Notifications disabled, skipping permission notification"
   * // No API calls made, returns immediately
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - notification failure doesn't block execution
   * // If ntfy.sh is unreachable or returns 500, error is logged but promise resolves
   * await notificationService.sendPermissionNotification(request, 'sess-abc123');
   * // Logs: "Failed to send permission notification" with error details
   * // Execution continues normally (non-blocking)
   * ```
   *
   * @example
   * ```typescript
   * // Mobile app integration workflow
   * // 1. User receives notification on phone via ntfy.sh mobile app
   * // 2. Notification displays:
   * //    - Title: "CUI Permission Request"
   * //    - Message: "Planning implementation for user authentication - EnterPlanMode"
   * //    - Metadata: Session ID, Streaming ID, Permission Request ID
   * // 3. User taps notification, opens CUI web UI (deep link to permission approval)
   * // 4. User approves/denies request
   * // 5. AI continues execution based on approval
   * ```
   *
   * @example
   * ```typescript
   * // Web Push broadcast (best-effort, non-blocking)
   * // After ntfy.sh delivery, also broadcasts via native Web Push API
   * // If Web Push fails (no subscriptions, service worker offline, etc.):
   * //   - Error logged as debug (non-fatal)
   * //   - ntfy.sh notification still delivered successfully
   * //   - Promise resolves normally
   * ```
   *
   * @see {@link sendConversationEndNotification} for task completion notifications
   * @see {@link Notification} for notification payload structure
   */
  async sendPermissionNotification(
    request: PermissionRequest,
    sessionId?: string,
    summary?: string
  ): Promise<void> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Notifications disabled, skipping permission notification');
      return;
    }

    try {
      const machineId = this.getMachineId();
      const topic = `cui-${machineId}`;
      const ntfyUrl = await this.getNtfyUrl();

      const notification: Notification = {
        title: 'CUI Permission Request',
        message: summary 
          ? `${summary} - ${request.toolName}`
          : `${request.toolName} tool: ${JSON.stringify(request.toolInput).substring(0, 100)}...`,
        priority: 'default',
        tags: ['cui-permission'],
        sessionId: sessionId || 'unknown',
        streamingId: request.streamingId,
        permissionRequestId: request.id
      };

      // Send via ntfy
      await this.sendNotification(ntfyUrl, topic, notification);

      // Also broadcast via native web push (best-effort)
      try {
        await this.webPushService.initialize();
        if (this.webPushService.getEnabled()) {
          await this.webPushService.broadcast({
            title: notification.title,
            message: notification.message,
            tag: notification.tags[0],
            data: {
              sessionId: notification.sessionId,
              streamingId: notification.streamingId,
              permissionRequestId: notification.permissionRequestId,
              type: 'permission',
            },
          });
        }
      } catch (err) {
        this.logger.debug('Web push broadcast failed (non-fatal)', { error: (err as Error)?.message });
      }
      
      this.logger.info('Permission notification sent', {
        requestId: request.id,
        toolName: request.toolName,
        topic
      });
    } catch (error) {
      this.logger.error('Failed to send permission notification', error, {
        requestId: request.id
      });
    }
  }

  /**
   * Send notification when AI conversation/task completes
   *
   * @description
   * Sends push notifications via ntfy.sh and native Web Push when AI conversations finish.
   * This enables users to monitor long-running tasks and know when they can review results,
   * especially useful for tasks that take minutes or hours to complete.
   *
   * **Dual-Channel Delivery:**
   * 1. **ntfy.sh** (primary): HTTP POST with custom headers for metadata
   * 2. **Web Push** (best-effort): Native browser push via WebPushService
   *
   * **Notification Workflow:**
   * 1. Check if notifications enabled via `isEnabled()` (early return if disabled)
   * 2. Get machine ID and construct topic: `cui-${machineId}`
   * 3. Get ntfy.sh URL from config (default: 'https://ntfy.sh')
   * 4. Build notification payload with task summary
   * 5. Send to ntfy.sh via HTTP POST with custom headers
   * 6. Attempt Web Push broadcast (errors logged but non-blocking)
   * 7. Log success with session details
   *
   * **Notification Payload:**
   * - Title: 'Task Finished'
   * - Message: `${summary}` or 'Task completed' (default)
   * - Priority: 'default'
   * - Tags: ['cui-complete']
   * - Custom headers: X-CUI-SessionId, X-CUI-StreamingId
   *
   * **Use Cases:**
   * - Long-running tasks: Know when multi-hour refactoring completes
   * - Background work: Monitor tasks while working on other things
   * - Remote work: Get notified on phone when away from desk
   * - Batch operations: Track completion of large file processing jobs
   *
   * @param {string} streamingId - Streaming ID of the completed conversation
   * @param {string} sessionId - Session ID for tracking which chat session completed
   * @param {string} [summary] - Optional task summary describing what was accomplished (default: 'Task completed')
   * @returns {Promise<void>} Resolves when notification sent (or disabled/failed)
   *
   * @example
   * ```typescript
   * // Basic task completion notification with summary
   * import { NotificationService } from './notification-service';
   *
   * const notificationService = new NotificationService();
   *
   * await notificationService.sendConversationEndNotification(
   *   'stream-xyz789',
   *   'sess-abc123',
   *   'Created 5 unit tests for UserService with 100% coverage'
   * );
   * // Sends notification:
   * // Title: Task Finished
   * // Message: Created 5 unit tests for UserService with 100% coverage
   * // Topic: cui-a1b2c3d4e5f6g7h8
   * ```
   *
   * @example
   * ```typescript
   * // Task completion without summary (uses default message)
   * await notificationService.sendConversationEndNotification(
   *   'stream-abc123',
   *   'sess-def456'
   * );
   * // Message: Task completed
   * ```
   *
   * @example
   * ```typescript
   * // Long-running refactoring task notification
   * await notificationService.sendConversationEndNotification(
   *   'stream-refactor-001',
   *   'sess-refactor-session',
   *   'Refactored 47 files, moved 23 components to new architecture, all tests passing'
   * );
   * // Useful for monitoring tasks that take 30+ minutes
   * ```
   *
   * @example
   * ```typescript
   * // Notification includes custom metadata headers for client correlation
   * // HTTP POST to https://ntfy.sh/cui-a1b2c3d4e5f6g7h8
   * // Headers:
   * //   Title: Task Finished
   * //   Priority: default
   * //   Tags: cui-complete
   * //   X-CUI-SessionId: sess-abc123
   * //   X-CUI-StreamingId: stream-xyz789
   * // Body: Created 5 unit tests for UserService with 100% coverage
   * ```
   *
   * @example
   * ```typescript
   * // Graceful handling when notifications disabled
   * // Config: { interface: { notifications: { enabled: false } } }
   *
   * await notificationService.sendConversationEndNotification(
   *   'stream-xyz789',
   *   'sess-abc123',
   *   'Task completed'
   * );
   * // Logs: "Notifications disabled, skipping conversation end notification"
   * // No API calls made, returns immediately
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - notification failure doesn't block execution
   * // If ntfy.sh is unreachable or returns 500, error is logged but promise resolves
   * await notificationService.sendConversationEndNotification(
   *   'stream-xyz789',
   *   'sess-abc123'
   * );
   * // Logs: "Failed to send conversation end notification" with error details
   * // Execution continues normally (non-blocking)
   * ```
   *
   * @example
   * ```typescript
   * // Integration with ChatService - called when conversation completes
   * // ChatService.sendMessage() async generator workflow:
   * async function* sendMessage() {
   *   // ... AI conversation processing ...
   *
   *   // When done, send completion notification
   *   const summary = extractSummary(assistantMessage);
   *   await notificationService.sendConversationEndNotification(
   *     streamingId,
   *     sessionId,
   *     summary
   *   );
   *
   *   yield { type: 'done', cost, usage };
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Mobile app integration - user experience
   * // 1. User starts long-running task (e.g., "Refactor entire codebase")
   * // 2. User closes laptop, goes to lunch
   * // 3. 45 minutes later, task completes
   * // 4. User receives notification on phone:
   * //    - Title: "Task Finished"
   * //    - Message: "Refactored 47 files, moved 23 components to new architecture"
   * // 5. User returns to desk, reviews completed work
   * ```
   *
   * @example
   * ```typescript
   * // Web Push broadcast (best-effort, non-blocking)
   * // After ntfy.sh delivery, also broadcasts via native Web Push API
   * // If Web Push fails (no subscriptions, service worker offline, etc.):
   * //   - Error logged as debug (non-fatal)
   * //   - ntfy.sh notification still delivered successfully
   * //   - Promise resolves normally
   * ```
   *
   * @see {@link sendPermissionNotification} for permission request notifications
   * @see {@link Notification} for notification payload structure
   */
  async sendConversationEndNotification(
    streamingId: string,
    sessionId: string,
    summary?: string
  ): Promise<void> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Notifications disabled, skipping conversation end notification');
      return;
    }

    try {
      const machineId = this.getMachineId();
      const topic = `cui-${machineId}`;
      const ntfyUrl = await this.getNtfyUrl();

      const notification: Notification = {
        title: 'Task Finished',
        message: summary || 'Task completed',
        priority: 'default',
        tags: ['cui-complete'],
        sessionId,
        streamingId
      };

      // Send via ntfy
      await this.sendNotification(ntfyUrl, topic, notification);

      // Also broadcast via native web push (best-effort)
      try {
        await this.webPushService.initialize();
        if (this.webPushService.getEnabled()) {
          await this.webPushService.broadcast({
            title: notification.title,
            message: notification.message,
            tag: notification.tags[0],
            data: {
              sessionId: notification.sessionId,
              streamingId: notification.streamingId,
              type: 'conversation-end',
            },
          });
        }
      } catch (err) {
        this.logger.debug('Web push broadcast failed (non-fatal)', { error: (err as Error)?.message });
      }
      
      this.logger.info('Conversation end notification sent', {
        sessionId,
        streamingId,
        topic
      });
    } catch (error) {
      this.logger.error('Failed to send conversation end notification', error, {
        sessionId,
        streamingId
      });
    }
  }

  /**
   * Send notification to ntfy.sh via HTTP POST
   *
   * @description
   * Core method that sends HTTP POST request to ntfy.sh server with notification payload
   * and custom headers. This method implements the ntfy.sh HTTP protocol for push notifications.
   *
   * **ntfy.sh HTTP Protocol:**
   * - **Method**: POST
   * - **URL**: `${ntfyUrl}/${topic}` (e.g., 'https://ntfy.sh/cui-a1b2c3d4e5f6g7h8')
   * - **Headers**:
   *   - `Title`: Notification title
   *   - `Priority`: min | low | default | high | urgent
   *   - `Tags`: Comma-separated tags (e.g., 'cui-permission,urgent')
   *   - `X-CUI-SessionId`: Session ID for tracking
   *   - `X-CUI-StreamingId`: Streaming ID for message correlation
   *   - `X-CUI-PermissionRequestId`: Permission request ID (optional)
   * - **Body**: Plain text message content
   *
   * **Priority Levels:**
   * - `min`: No sound/vibration, background delivery only
   * - `low`: No sound/vibration, but visible notification
   * - `default`: Default notification sound and vibration
   * - `high`: Higher priority sound and vibration
   * - `urgent`: Bypass Do Not Disturb mode, maximum urgency
   *
   * **Custom Headers:**
   * Custom `X-CUI-*` headers enable client-side correlation and routing:
   * - X-CUI-SessionId: Link notification to specific chat session
   * - X-CUI-StreamingId: Link notification to specific message stream
   * - X-CUI-PermissionRequestId: Link notification to approval workflow
   *
   * **Error Handling:**
   * Throws error if:
   * - HTTP response status is not 2xx
   * - Network request fails (timeout, DNS error, etc.)
   *
   * @private
   * @param {string} ntfyUrl - ntfy.sh server URL (e.g., 'https://ntfy.sh')
   * @param {string} topic - Topic name for routing (e.g., 'cui-a1b2c3d4e5f6g7h8')
   * @param {Notification} notification - Notification payload with title, message, metadata
   * @returns {Promise<void>} Resolves when notification sent successfully
   * @throws {Error} If ntfy.sh returns non-2xx status or network request fails
   *
   * @example
   * ```typescript
   * // Internal usage - send permission notification
   * const notification: Notification = {
   *   title: 'CUI Permission Request',
   *   message: 'EnterPlanMode tool requires approval',
   *   priority: 'default',
   *   tags: ['cui-permission'],
   *   sessionId: 'sess-abc123',
   *   streamingId: 'stream-xyz789',
   *   permissionRequestId: 'perm-123'
   * };
   *
   * await this.sendNotification(
   *   'https://ntfy.sh',
   *   'cui-a1b2c3d4e5f6g7h8',
   *   notification
   * );
   * // HTTP POST to https://ntfy.sh/cui-a1b2c3d4e5f6g7h8
   * // Headers:
   * //   Title: CUI Permission Request
   * //   Priority: default
   * //   Tags: cui-permission
   * //   X-CUI-SessionId: sess-abc123
   * //   X-CUI-StreamingId: stream-xyz789
   * //   X-CUI-PermissionRequestId: perm-123
   * // Body: EnterPlanMode tool requires approval
   * ```
   *
   * @example
   * ```typescript
   * // Task completion notification (no permissionRequestId)
   * const notification: Notification = {
   *   title: 'Task Finished',
   *   message: 'Created 5 unit tests with 100% coverage',
   *   priority: 'default',
   *   tags: ['cui-complete'],
   *   sessionId: 'sess-def456',
   *   streamingId: 'stream-abc123'
   * };
   *
   * await this.sendNotification(
   *   'https://ntfy.sh',
   *   'cui-a1b2c3d4e5f6g7h8',
   *   notification
   * );
   * // No X-CUI-PermissionRequestId header (omitted when undefined)
   * ```
   *
   * @example
   * ```typescript
   * // Self-hosted ntfy.sh server
   * await this.sendNotification(
   *   'https://ntfy.example.com',
   *   'cui-a1b2c3d4e5f6g7h8',
   *   notification
   * );
   * // HTTP POST to https://ntfy.example.com/cui-a1b2c3d4e5f6g7h8
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - ntfy.sh server error
   * try {
   *   await this.sendNotification(
   *     'https://ntfy.sh',
   *     'cui-a1b2c3d4e5f6g7h8',
   *     notification
   *   );
   * } catch (error) {
   *   // Throws: "Ntfy returned 500: Internal Server Error"
   *   console.error('Notification delivery failed:', error);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Priority levels - urgent notification
   * const urgentNotification: Notification = {
   *   title: 'CRITICAL: Production Down',
   *   message: 'Production database connection lost',
   *   priority: 'urgent', // Bypass Do Not Disturb mode
   *   tags: ['cui-alert', 'production'],
   *   sessionId: 'sess-monitoring',
   *   streamingId: 'stream-alert-001'
   * };
   *
   * await this.sendNotification(
   *   'https://ntfy.sh',
   *   'cui-alerts',
   *   urgentNotification
   * );
   * // Notification bypasses DND, delivered immediately with maximum urgency
   * ```
   *
   * @example
   * ```typescript
   * // Multiple tags for filtering
   * const notification: Notification = {
   *   title: 'Build Failed',
   *   message: 'CI/CD pipeline failed on main branch',
   *   priority: 'high',
   *   tags: ['cui-ci', 'build-failure', 'main-branch'], // Multiple tags
   *   sessionId: 'sess-ci-001',
   *   streamingId: 'stream-build-123'
   * };
   *
   * await this.sendNotification(
   *   'https://ntfy.sh',
   *   'cui-ci-alerts',
   *   notification
   * );
   * // Headers: Tags: cui-ci,build-failure,main-branch
   * // Users can filter by specific tags in ntfy.sh mobile app
   * ```
   *
   * @see {@link Notification} for notification payload structure
   * @see https://docs.ntfy.sh/publish/ for ntfy.sh HTTP API documentation
   */
  private async sendNotification(
    ntfyUrl: string,
    topic: string,
    notification: Notification
  ): Promise<void> {
    const url = `${ntfyUrl}/${topic}`;
    
    const headers: Record<string, string> = {
      'Title': notification.title,
      'Priority': notification.priority,
      'Tags': notification.tags.join(',')
    };

    // Add custom headers for CUI metadata
    headers['X-CUI-SessionId'] = notification.sessionId;
    headers['X-CUI-StreamingId'] = notification.streamingId;
    if (notification.permissionRequestId) {
      headers['X-CUI-PermissionRequestId'] = notification.permissionRequestId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: notification.message
    });

    if (!response.ok) {
      throw new Error(`Ntfy returned ${response.status}: ${await response.text()}`);
    }
  }
}