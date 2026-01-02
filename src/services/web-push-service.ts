import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import webpush, { PushSubscription } from 'web-push';
import { createLogger, type Logger } from './logger.js';
import { ConfigService } from './config-service.js';

/**
 * Payload for Web Push notifications sent to browser clients
 *
 * @description
 * Represents a structured notification payload for native browser push notifications via the Web Push API.
 * The payload conforms to the Notification API structure and is sent to subscribed browser clients.
 *
 * @example
 * ```typescript
 * // Basic task completion notification
 * const payload: WebPushPayload = {
 *   title: 'Task Complete',
 *   message: 'Your AI agent finished processing the request'
 * };
 * await webPushService.broadcast(payload);
 * ```
 *
 * @example
 * ```typescript
 * // Notification with tag for grouping/replacing
 * const payload: WebPushPayload = {
 *   title: 'Build Status',
 *   message: 'Build #42 completed successfully',
 *   tag: 'build-status', // Replace previous build notifications
 *   data: { buildId: 42, status: 'success', duration: 120 }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Permission request notification with custom data
 * const payload: WebPushPayload = {
 *   title: 'Permission Required',
 *   message: 'EnterPlanMode tool requires approval',
 *   tag: 'permission-request',
 *   data: {
 *     requestId: 'perm-123',
 *     toolName: 'EnterPlanMode',
 *     sessionId: 'sess-abc123'
 *   }
 * };
 * ```
 */
export interface WebPushPayload {
  /** Notification title displayed prominently in browser notification UI */
  title: string;
  /** Notification message body with task details or summary */
  message: string;
  /** Optional tag for grouping/replacing notifications (same tag replaces previous notification) */
  tag?: string;
  /** Optional custom data object attached to notification (accessible in service worker) */
  data?: Record<string, unknown>;
}

/**
 * Database row representation for Web Push subscriptions
 *
 * @description
 * Internal interface representing a subscription row stored in the SQLite database.
 * Contains the Push API subscription keys and metadata for tracking subscription lifecycle.
 *
 * @private
 */
interface SubscriptionRow {
  /** Web Push endpoint URL (unique identifier for subscription) */
  endpoint: string;
  /** P256DH key for encryption (public key for message encryption) */
  p256dh: string;
  /** Auth secret for authentication (used with p256dh for message encryption) */
  auth: string;
  /** User agent string from browser (for debugging and analytics) */
  user_agent: string;
  /** ISO 8601 timestamp of subscription creation */
  created_at: string;
  /** ISO 8601 timestamp of last successful notification delivery */
  last_seen: string;
  /** Expired flag (0 = active, 1 = expired/removed by 410 Gone or 404 Not Found) */
  expired: number;
}

/**
 * WebPushService - Native browser push notification delivery via Web Push API
 *
 * @description
 * The WebPushService manages native browser push notifications using the Web Push API standard.
 * It handles subscription management, VAPID key configuration, and notification broadcasting to
 * subscribed browser clients. Uses SQLite for persistent subscription storage.
 *
 * **Key Responsibilities:**
 * - Manage Web Push subscriptions (subscribe, unsubscribe)
 * - Auto-generate VAPID keys on first run (if notifications enabled)
 * - Store subscriptions in SQLite database with WAL mode for performance
 * - Broadcast notifications to all active subscriptions
 * - Track subscription lifecycle (creation, last_seen, expiration)
 * - Handle expired subscriptions (410 Gone, 404 Not Found)
 * - Integrate with ConfigService for VAPID key persistence
 *
 * **Architecture:**
 * - **SQLite Backend**: Persistent subscription storage in `~/.cui/web-push.db`
 * - **WAL Mode**: Write-Ahead Logging for better concurrency
 * - **Singleton Pattern**: Ensures single database connection across application
 * - **Prepared Statements**: Performance optimization for frequent queries
 * - **VAPID Keys**: Auto-generated on first run, persisted to config
 * - **Subscription Lifecycle**: Active (expired=0) vs Expired (expired=1)
 *
 * **Database Schema:**
 * ```sql
 * CREATE TABLE subscriptions (
 *   endpoint TEXT PRIMARY KEY,           -- Web Push endpoint URL (unique)
 *   p256dh TEXT NOT NULL,                -- P256DH encryption key
 *   auth TEXT NOT NULL,                  -- Auth secret
 *   user_agent TEXT NOT NULL DEFAULT '', -- Browser user agent
 *   created_at TEXT NOT NULL,            -- ISO 8601 timestamp
 *   last_seen TEXT NOT NULL,             -- Last successful delivery
 *   expired INTEGER NOT NULL DEFAULT 0   -- 0 = active, 1 = expired
 * );
 * ```
 *
 * **VAPID Key Management:**
 * VAPID (Voluntary Application Server Identification) keys authenticate push notifications.
 * The service auto-generates keys on first run if notifications are enabled:
 *
 * 1. **First Run**: If `config.interface.notifications.enabled = true` and keys missing
 *    - Generate VAPID key pair using `webpush.generateVAPIDKeys()`
 *    - Persist keys to `~/.cui/config.json`
 *    - Expire all existing subscriptions (keys changed, re-subscribe required)
 * 2. **Subsequent Runs**: Load VAPID keys from config
 * 3. **Public Key Sharing**: `getPublicKey()` returns VAPID public key for client subscription
 *
 * **Subscription Lifecycle:**
 * 1. **Subscribe**: Browser calls `addOrUpdateSubscription()` with PushSubscription
 * 2. **Active**: Subscription stored with `expired=0`
 * 3. **Notification**: `broadcast()` sends notifications, updates `last_seen`
 * 4. **Expiration**: 410 Gone or 404 Not Found marks subscription as `expired=1`
 * 5. **Unsubscribe**: Browser calls `removeSubscriptionByEndpoint()`
 *
 * **Use Cases:**
 * - Task completion notifications for browser clients
 * - Permission request alerts in web UI
 * - Real-time status updates to subscribed browsers
 * - Multi-device notification delivery (each browser = separate subscription)
 *
 * @example
 * ```typescript
 * // Basic usage - initialize and broadcast notification
 * import { WebPushService } from './web-push-service';
 *
 * const webPushService = WebPushService.getInstance();
 * await webPushService.initialize();
 *
 * const payload = {
 *   title: 'Task Complete',
 *   message: 'Your AI agent finished the request'
 * };
 * const { sent, failed } = await webPushService.broadcast(payload);
 * console.log(`Sent to ${sent} subscribers, ${failed} failures`);
 * ```
 *
 * @example
 * ```typescript
 * // Client-side subscription workflow
 * // 1. Get VAPID public key from server
 * const publicKey = webPushService.getPublicKey();
 * if (!publicKey) {
 *   console.error('Web Push not configured');
 *   return;
 * }
 *
 * // 2. Subscribe in browser (client-side code)
 * const registration = await navigator.serviceWorker.ready;
 * const subscription = await registration.pushManager.subscribe({
 *   userVisibleOnly: true,
 *   applicationServerKey: urlBase64ToUint8Array(publicKey)
 * });
 *
 * // 3. Send subscription to server
 * await fetch('/api/web-push/subscribe', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(subscription)
 * });
 *
 * // Server-side: Store subscription
 * webPushService.addOrUpdateSubscription(subscription, req.headers['user-agent']);
 * ```
 *
 * @example
 * ```typescript
 * // Monitor subscription count
 * const count = webPushService.getSubscriptionCount();
 * console.log(`Active subscriptions: ${count}`);
 *
 * const subscriptions = webPushService.listSubscriptions();
 * subscriptions.forEach(sub => {
 *   console.log(`Endpoint: ${sub.endpoint}`);
 *   console.log(`Created: ${sub.created_at}`);
 *   console.log(`Last seen: ${sub.last_seen}`);
 *   console.log(`User agent: ${sub.user_agent}`);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Unsubscribe workflow
 * // 1. Client-side: Unsubscribe from push manager
 * const subscription = await registration.pushManager.getSubscription();
 * if (subscription) {
 *   await subscription.unsubscribe();
 *
 *   // 2. Notify server to remove subscription
 *   await fetch('/api/web-push/unsubscribe', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ endpoint: subscription.endpoint })
 *   });
 * }
 *
 * // Server-side: Remove subscription
 * webPushService.removeSubscriptionByEndpoint(endpoint);
 * ```
 *
 * @example
 * ```typescript
 * // Check if Web Push is enabled
 * if (webPushService.getEnabled()) {
 *   console.log('Web Push notifications are enabled');
 *   const publicKey = webPushService.getPublicKey();
 *   console.log(`VAPID public key: ${publicKey}`);
 * } else {
 *   console.log('Web Push disabled in config');
 * }
 * ```
 *
 * @see {@link https://web.dev/push-notifications-overview/ | Web Push Notifications Overview}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Push_API | Push API - MDN}
 * @see {@link https://github.com/web-push-libs/web-push | web-push library}
 */
export class WebPushService {
  /** Singleton instance */
  private static instance: WebPushService;
  /** Logger instance for WebPushService */
  private logger: Logger;
  /** SQLite database connection */
  private db!: Database.Database;
  /** Path to web-push.db SQLite database file */
  private dbPath!: string;
  /** Base configuration directory (~/.cui) */
  private configDir!: string;
  /** Initialization state flag */
  private isInitialized = false;
  /** ConfigService instance for VAPID key persistence */
  private configService: ConfigService;

  /** Prepared statement for inserting/updating subscriptions */
  private insertStmt!: Database.Statement;
  /** Prepared statement for deleting subscriptions by endpoint */
  private deleteStmt!: Database.Statement;
  /** Prepared statement for updating last_seen and expired status */
  private upsertSeenStmt!: Database.Statement;
  /** Prepared statement for listing active subscriptions */
  private listStmt!: Database.Statement;
  /** Prepared statement for counting active subscriptions */
  private countStmt!: Database.Statement;

  private constructor(customConfigDir?: string) {
    this.logger = createLogger('WebPushService');
    this.configService = ConfigService.getInstance();
    this.initializePaths(customConfigDir);
  }

  /**
   * Get singleton instance of WebPushService
   *
   * @description
   * Returns the singleton instance of WebPushService, creating it if necessary.
   * Ensures single database connection across the application.
   *
   * @returns WebPushService singleton instance
   *
   * @example
   * ```typescript
   * // Get singleton instance
   * const webPushService = WebPushService.getInstance();
   * await webPushService.initialize();
   * ```
   */
  static getInstance(): WebPushService {
    if (!WebPushService.instance) {
      WebPushService.instance = new WebPushService();
    }
    return WebPushService.instance;
  }

  private initializePaths(customConfigDir?: string): void {
    const baseConfigDir = customConfigDir || path.join(os.homedir(), '.cui');
    this.configDir = baseConfigDir;
    this.dbPath = path.join(baseConfigDir, 'web-push.db');
    this.logger.debug('Initialized web push database paths', {
      dir: this.configDir,
      dbPath: this.dbPath,
    });
  }

  /**
   * Initialize Web Push service and database
   *
   * @description
   * Initializes the Web Push service by creating the SQLite database, setting up WAL mode,
   * creating the subscriptions table, preparing statements, and configuring VAPID keys.
   * Idempotent - safe to call multiple times.
   *
   * **Initialization Workflow:**
   * 1. Check if already initialized (early return if true)
   * 2. Create config directory if needed (~/.cui)
   * 3. Open SQLite database with WAL mode for concurrency
   * 4. Create subscriptions table if not exists
   * 5. Prepare SQL statements for performance
   * 6. Configure VAPID keys (auto-generate on first run if enabled)
   * 7. Set initialized flag
   *
   * **VAPID Key Auto-Generation:**
   * If notifications are enabled and VAPID keys are missing, the service will:
   * - Generate a new VAPID key pair
   * - Persist keys to `~/.cui/config.json`
   * - Expire all existing subscriptions (keys changed, clients must re-subscribe)
   *
   * @throws {Error} If database initialization fails (permissions, corruption, etc.)
   *
   * @example
   * ```typescript
   * // Basic initialization
   * const webPushService = WebPushService.getInstance();
   * await webPushService.initialize();
   * console.log('Web Push service ready');
   * ```
   *
   * @example
   * ```typescript
   * // Server startup initialization with error handling
   * try {
   *   const webPushService = WebPushService.getInstance();
   *   await webPushService.initialize();
   *   if (webPushService.getEnabled()) {
   *     console.log('Web Push enabled');
   *     console.log(`VAPID public key: ${webPushService.getPublicKey()}`);
   *   } else {
   *     console.log('Web Push disabled in config');
   *   }
   * } catch (error) {
   *   console.error('Failed to initialize Web Push:', error);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent initialization (safe to call multiple times)
   * await webPushService.initialize(); // First call: creates DB
   * await webPushService.initialize(); // Second call: returns immediately
   * await webPushService.initialize(); // Third call: returns immediately
   * ```
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      if (this.dbPath !== ':memory:' && !fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          endpoint TEXT PRIMARY KEY,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          last_seen TEXT NOT NULL,
          expired INTEGER NOT NULL DEFAULT 0
        );
      `);

      this.prepareStatements();
      this.configureVapid();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize web push database', error);
      throw new Error(`WebPush database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private prepareStatements(): void {
    this.insertStmt = this.db.prepare(
      'INSERT OR REPLACE INTO subscriptions (endpoint, p256dh, auth, user_agent, created_at, last_seen, expired) VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM subscriptions WHERE endpoint = ?), ?), ?, 0)'
    );
    this.deleteStmt = this.db.prepare('DELETE FROM subscriptions WHERE endpoint = ?');
    this.upsertSeenStmt = this.db.prepare('UPDATE subscriptions SET last_seen = ?, expired = ? WHERE endpoint = ?');
    this.listStmt = this.db.prepare('SELECT * FROM subscriptions WHERE expired = 0');
    this.countStmt = this.db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE expired = 0');
  }

  private configureVapid(): void {
    const config = this.configService.getConfig();
    let subject = config.interface.notifications?.webPush?.subject || 'mailto:admin@example.com';
    let publicKey = config.interface.notifications?.webPush?.vapidPublicKey;
    let privateKey = config.interface.notifications?.webPush?.vapidPrivateKey;

    // Auto-generate VAPID keys if missing and notifications enabled
    let generated = false;
    if (this.getEnabled() && (!publicKey || !privateKey)) {
      try {
        const keys = webpush.generateVAPIDKeys();
        publicKey = keys.publicKey;
        privateKey = keys.privateKey;
        // Persist into config (partial update preserves other interface fields)
        void this.configService.updateConfig({
          interface: {
            ...config.interface,
            notifications: {
              ...(config.interface.notifications || { enabled: true }),
              webPush: {
                subject,
                vapidPublicKey: publicKey,
                vapidPrivateKey: privateKey,
              },
            },
          },
        }).catch((_err: unknown) => {
          this.logger.warn('Failed to persist generated VAPID keys to config');
        });
        this.logger.info('Generated and applied VAPID keys');
        generated = true;
      } catch (_e) {
        this.logger.error('Failed to generate VAPID keys');
      }
    }

    if (!publicKey || !privateKey) {
      this.logger.warn('Web Push VAPID keys are not configured. Native push will be disabled until set in config');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    // If keys were generated just now, expire existing subscriptions to force re-register
    if (generated) {
      try {
        this.db.prepare('UPDATE subscriptions SET expired = 1').run();
        this.logger.info('Expired all existing web push subscriptions due to VAPID key generation');
      } catch (_e) {
        this.logger.warn('Failed to expire existing subscriptions after VAPID key generation');
      }
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   *
   * @description
   * Returns the VAPID public key required for browser clients to subscribe to push notifications.
   * The public key is stored in `~/.cui/config.json` and auto-generated on first run if notifications
   * are enabled. Clients use this key with the Push API `subscribe()` method.
   *
   * @returns VAPID public key string, or null if not configured
   *
   * @example
   * ```typescript
   * // API endpoint to share public key with client
   * app.get('/api/web-push/public-key', (req, res) => {
   *   const publicKey = webPushService.getPublicKey();
   *   if (!publicKey) {
   *     return res.status(503).json({ error: 'Web Push not configured' });
   *   }
   *   res.json({ publicKey });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Client-side: Fetch public key and subscribe
   * const response = await fetch('/api/web-push/public-key');
   * const { publicKey } = await response.json();
   *
   * const registration = await navigator.serviceWorker.ready;
   * const subscription = await registration.pushManager.subscribe({
   *   userVisibleOnly: true,
   *   applicationServerKey: urlBase64ToUint8Array(publicKey)
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Check if VAPID keys are configured
   * const publicKey = webPushService.getPublicKey();
   * if (!publicKey) {
   *   console.error('VAPID keys not configured. Set notifications.enabled=true in config');
   * } else {
   *   console.log(`VAPID public key: ${publicKey.substring(0, 20)}...`);
   * }
   * ```
   */
  getPublicKey(): string | null {
    const publicKey = this.configService.getConfig().interface.notifications?.webPush?.vapidPublicKey || null;
    return publicKey || null;
  }

  /**
   * Check if Web Push notifications are enabled
   *
   * @description
   * Returns whether Web Push notifications are enabled via configuration.
   * Controlled by `config.interface.notifications.enabled` in `~/.cui/config.json`.
   *
   * @returns true if notifications enabled, false otherwise
   *
   * @example
   * ```typescript
   * // Conditional notification delivery
   * if (webPushService.getEnabled()) {
   *   await webPushService.broadcast({
   *     title: 'Task Complete',
   *     message: 'Your request finished successfully'
   *   });
   * } else {
   *   console.log('Web Push disabled, skipping notification');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // API endpoint to check availability
   * app.get('/api/web-push/available', (req, res) => {
   *   res.json({ available: webPushService.getEnabled() });
   * });
   * ```
   */
  getEnabled(): boolean {
    const enabled = this.configService.getConfig().interface.notifications?.enabled ?? false;
    return enabled;
  }

  /**
   * Get count of active Web Push subscriptions
   *
   * @description
   * Returns the number of active subscriptions (expired=0).
   * Useful for monitoring, analytics, and debugging.
   *
   * @returns Number of active subscriptions
   *
   * @example
   * ```typescript
   * // Monitor subscription count
   * const count = webPushService.getSubscriptionCount();
   * console.log(`Active Web Push subscribers: ${count}`);
   * ```
   *
   * @example
   * ```typescript
   * // API endpoint for admin dashboard
   * app.get('/api/web-push/stats', (req, res) => {
   *   res.json({
   *     enabled: webPushService.getEnabled(),
   *     subscriptions: webPushService.getSubscriptionCount()
   *   });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Skip broadcast if no subscribers
   * if (webPushService.getSubscriptionCount() === 0) {
   *   console.log('No Web Push subscribers, skipping broadcast');
   *   return;
   * }
   * await webPushService.broadcast(payload);
   * ```
   */
  getSubscriptionCount(): number {
    const row = this.countStmt.get() as { count: number };
    return row?.count || 0;
  }

  /**
   * Subscribe browser client to Web Push notifications
   *
   * @description
   * Stores a browser's PushSubscription in the database, enabling notification delivery.
   * If the subscription already exists (same endpoint), updates it with new keys and user agent.
   * Preserves the original `created_at` timestamp for existing subscriptions.
   *
   * **Subscription Workflow:**
   * 1. Extract endpoint, p256dh, and auth keys from PushSubscription object
   * 2. Validate required fields (endpoint, p256dh, auth)
   * 3. Insert or update subscription in database
   * 4. Set `expired=0` (active) and update `last_seen` to current time
   * 5. Preserve `created_at` for existing subscriptions, set to now for new ones
   *
   * **PushSubscription Format:**
   * ```typescript
   * {
   *   endpoint: 'https://fcm.googleapis.com/fcm/send/...',
   *   expirationTime: null,
   *   keys: {
   *     p256dh: 'BASE64_ENCODED_KEY',
   *     auth: 'BASE64_ENCODED_SECRET'
   *   }
   * }
   * ```
   *
   * @param subscription - PushSubscription object from browser's `pushManager.subscribe()`
   * @param userAgent - Optional user agent string from browser for debugging/analytics
   *
   * @throws {Error} If subscription payload is invalid (missing endpoint or keys)
   *
   * @example
   * ```typescript
   * // API endpoint to handle subscription from client
   * app.post('/api/web-push/subscribe', (req, res) => {
   *   try {
   *     const subscription = req.body; // PushSubscription from client
   *     const userAgent = req.headers['user-agent'] || '';
   *     webPushService.addOrUpdateSubscription(subscription, userAgent);
   *     res.json({ success: true });
   *   } catch (error) {
   *     res.status(400).json({ error: error.message });
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Client-side subscription workflow
   * const registration = await navigator.serviceWorker.ready;
   * const subscription = await registration.pushManager.subscribe({
   *   userVisibleOnly: true,
   *   applicationServerKey: urlBase64ToUint8Array(publicKey)
   * });
   *
   * // Send subscription to server
   * await fetch('/api/web-push/subscribe', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify(subscription)
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Update existing subscription (re-subscribe)
   * // If user already subscribed with same endpoint, updates keys and user agent
   * webPushService.addOrUpdateSubscription(newSubscription, 'Mozilla/5.0...');
   * console.log('Subscription updated successfully');
   * ```
   *
   * @example
   * ```typescript
   * // Handle invalid subscription
   * try {
   *   webPushService.addOrUpdateSubscription({ endpoint: '' } as any, '');
   * } catch (error) {
   *   console.error('Invalid subscription:', error.message);
   *   // Output: Invalid subscription payload: missing endpoint/keys
   * }
   * ```
   */
  addOrUpdateSubscription(subscription: PushSubscription, userAgent = ''): void {
    const now = new Date().toISOString();
    const { endpoint, keys } = subscription as unknown as { endpoint: string; keys: { p256dh: string; auth: string } };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('Invalid subscription payload: missing endpoint/keys');
    }

    this.insertStmt.run(endpoint, keys.p256dh, keys.auth, userAgent || '', endpoint, now, now);
  }

  /**
   * Unsubscribe browser client from Web Push notifications
   *
   * @description
   * Permanently removes a subscription from the database by its endpoint URL.
   * Called when a browser client unsubscribes from push notifications.
   * Idempotent - safe to call with non-existent endpoints (no error thrown).
   *
   * @param endpoint - Web Push endpoint URL (unique identifier for subscription)
   *
   * @example
   * ```typescript
   * // API endpoint to handle unsubscribe from client
   * app.post('/api/web-push/unsubscribe', (req, res) => {
   *   const { endpoint } = req.body;
   *   webPushService.removeSubscriptionByEndpoint(endpoint);
   *   res.json({ success: true });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Client-side unsubscribe workflow
   * const registration = await navigator.serviceWorker.ready;
   * const subscription = await registration.pushManager.getSubscription();
   * if (subscription) {
   *   await subscription.unsubscribe();
   *
   *   // Notify server to remove subscription
   *   await fetch('/api/web-push/unsubscribe', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ endpoint: subscription.endpoint })
   *   });
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Remove specific subscription by endpoint
   * const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123...';
   * webPushService.removeSubscriptionByEndpoint(endpoint);
   * console.log('Subscription removed');
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent behavior - safe to call multiple times
   * webPushService.removeSubscriptionByEndpoint(endpoint); // Deletes subscription
   * webPushService.removeSubscriptionByEndpoint(endpoint); // No error, does nothing
   * ```
   */
  removeSubscriptionByEndpoint(endpoint: string): void {
    this.deleteStmt.run(endpoint);
  }

  /**
   * List all active Web Push subscriptions
   *
   * @description
   * Returns all active subscriptions (expired=0) from the database.
   * Useful for monitoring, debugging, and manual subscription management.
   * Each subscription includes endpoint, encryption keys, timestamps, and user agent.
   *
   * @returns Array of active subscription rows
   *
   * @example
   * ```typescript
   * // List all subscriptions
   * const subscriptions = webPushService.listSubscriptions();
   * console.log(`Total active subscriptions: ${subscriptions.length}`);
   * subscriptions.forEach(sub => {
   *   console.log(`Endpoint: ${sub.endpoint}`);
   *   console.log(`Created: ${sub.created_at}`);
   *   console.log(`Last seen: ${sub.last_seen}`);
   *   console.log(`User agent: ${sub.user_agent}`);
   * });
   * ```
   *
   * @example
   * ```typescript
   * // API endpoint for admin dashboard
   * app.get('/api/web-push/subscriptions', (req, res) => {
   *   const subscriptions = webPushService.listSubscriptions();
   *   res.json({
   *     count: subscriptions.length,
   *     subscriptions: subscriptions.map(sub => ({
   *       endpoint: sub.endpoint,
   *       createdAt: sub.created_at,
   *       lastSeen: sub.last_seen,
   *       userAgent: sub.user_agent
   *     }))
   *   });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Find stale subscriptions (not seen in 30 days)
   * const subscriptions = webPushService.listSubscriptions();
   * const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
   * const stale = subscriptions.filter(sub =>
   *   new Date(sub.last_seen) < thirtyDaysAgo
   * );
   * console.log(`Stale subscriptions: ${stale.length}`);
   * ```
   *
   * @example
   * ```typescript
   * // Group subscriptions by browser type
   * const subscriptions = webPushService.listSubscriptions();
   * const byBrowser = subscriptions.reduce((acc, sub) => {
   *   const browser = sub.user_agent.includes('Chrome') ? 'Chrome' :
   *                   sub.user_agent.includes('Firefox') ? 'Firefox' :
   *                   sub.user_agent.includes('Safari') ? 'Safari' : 'Other';
   *   acc[browser] = (acc[browser] || 0) + 1;
   *   return acc;
   * }, {} as Record<string, number>);
   * console.log('Subscriptions by browser:', byBrowser);
   * ```
   */
  listSubscriptions(): SubscriptionRow[] {
    return this.listStmt.all() as SubscriptionRow[];
  }

  /**
   * Broadcast push notification to all active subscriptions
   *
   * @description
   * Sends a push notification to all active browser subscriptions in parallel.
   * Automatically handles subscription expiration (410 Gone, 404 Not Found) by marking
   * subscriptions as expired. Updates `last_seen` timestamp on successful delivery.
   *
   * **Broadcast Workflow:**
   * 1. Ensure service is initialized (auto-initialize if needed)
   * 2. Retrieve all active subscriptions from database
   * 3. Send notifications in parallel using `Promise.all()`
   * 4. For each subscription:
   *    - Reconstruct PushSubscription object from database row
   *    - Send notification via web-push library (TTL: 60 seconds)
   *    - On success: Update `last_seen` timestamp, increment `sent` counter
   *    - On 410/404: Mark subscription as `expired=1`, increment `failed` counter
   *    - On other error: Log error, increment `failed` counter
   * 5. Return summary: `{ sent, failed }`
   *
   * **Error Handling:**
   * - **410 Gone**: Subscription no longer valid (user unsubscribed or endpoint expired)
   * - **404 Not Found**: Push service endpoint no longer exists
   * - Both 410/404 automatically expire the subscription (no manual cleanup needed)
   * - Other errors (network, timeout): Logged but subscription remains active
   *
   * **TTL (Time To Live):**
   * - Set to 60 seconds for all notifications
   * - If delivery fails within 60s, push service discards notification
   * - Prevents stale notifications from being delivered hours later
   *
   * @param payload - Notification payload with title, message, tag, and data
   * @returns Object with `sent` (successful) and `failed` (failed) counts
   *
   * @example
   * ```typescript
   * // Basic broadcast - task completion notification
   * const payload = {
   *   title: 'Task Complete',
   *   message: 'Your AI agent finished processing the request'
   * };
   * const { sent, failed } = await webPushService.broadcast(payload);
   * console.log(`Sent to ${sent} subscribers, ${failed} failures`);
   * ```
   *
   * @example
   * ```typescript
   * // Broadcast with tag for notification grouping/replacing
   * const payload = {
   *   title: 'Build Status',
   *   message: 'Build #42 completed successfully',
   *   tag: 'build-status', // Replace previous build notifications
   *   data: { buildId: 42, status: 'success' }
   * };
   * await webPushService.broadcast(payload);
   * ```
   *
   * @example
   * ```typescript
   * // Permission request notification
   * const payload = {
   *   title: 'Permission Required',
   *   message: 'EnterPlanMode tool requires approval',
   *   tag: 'permission-request',
   *   data: {
   *     requestId: 'perm-123',
   *     toolName: 'EnterPlanMode',
   *     sessionId: 'sess-abc123',
   *     streamingId: 'stream-xyz789'
   *   }
   * };
   * await webPushService.broadcast(payload);
   * ```
   *
   * @example
   * ```typescript
   * // Integration with NotificationService
   * import { NotificationService } from './notification-service';
   *
   * async function notifyTaskComplete(sessionId: string, summary: string) {
   *   // Send to ntfy.sh (primary channel)
   *   await notificationService.sendConversationEndNotification(sessionId, summary);
   *
   *   // Send to Web Push (best-effort, browser clients)
   *   const { sent, failed } = await webPushService.broadcast({
   *     title: 'Task Complete',
   *     message: summary,
   *     tag: 'task-complete',
   *     data: { sessionId }
   *   });
   *   console.log(`Web Push: ${sent} sent, ${failed} failed`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Skip broadcast if no subscriptions
   * if (webPushService.getSubscriptionCount() === 0) {
   *   console.log('No Web Push subscribers, skipping broadcast');
   *   return;
   * }
   *
   * const { sent, failed } = await webPushService.broadcast(payload);
   * if (sent === 0 && failed > 0) {
   *   console.log('All subscriptions failed, may need manual cleanup');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Monitor broadcast success rate
   * const { sent, failed } = await webPushService.broadcast(payload);
   * const total = sent + failed;
   * const successRate = total > 0 ? (sent / total) * 100 : 0;
   * console.log(`Broadcast success rate: ${successRate.toFixed(1)}%`);
   *
   * if (successRate < 80) {
   *   console.warn('Low success rate, check subscription health');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Conditional broadcast based on subscription count
   * const count = webPushService.getSubscriptionCount();
   * if (count > 0) {
   *   const result = await webPushService.broadcast({
   *     title: 'New Message',
   *     message: 'You have a new message from the AI agent'
   *   });
   *   console.log(`Notified ${result.sent}/${count} subscribers`);
   * }
   * ```
   */
  async broadcast(payload: WebPushPayload): Promise<{ sent: number; failed: number }>{
    await this.initialize();
    const subs = this.listSubscriptions();
    let sent = 0;
    let failed = 0;
    await Promise.all(
      subs.map(async (row) => {
        const sub: PushSubscription = {
          endpoint: row.endpoint,
          expirationTime: null,
          keys: { p256dh: row.p256dh, auth: row.auth },
        } as unknown as PushSubscription;
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 });
          this.upsertSeenStmt.run(new Date().toISOString(), 0, row.endpoint);
          sent += 1;
        } catch (_err: unknown) {
          failed += 1;
          // 410 Gone or 404 Not Found => expire subscription
          const status = undefined;
          if (status === 404 || status === 410) {
            this.upsertSeenStmt.run(new Date().toISOString(), 1, row.endpoint);
            this.logger.info('Expired web push subscription removed', { endpoint: row.endpoint, status });
          } else {
            this.logger.error('Failed sending web push notification', { endpoint: row.endpoint, statusCode: status });
          }
        }
      })
    );
    return { sent, failed };
  }
}


