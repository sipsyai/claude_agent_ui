import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import type { SessionInfo } from '@/types/index.js';
import { createLogger } from './logger.js';
import { type Logger } from './logger.js';

/**
 * Internal database row representation for sessions table
 *
 * @description
 * SQLite stores booleans as integers (0 or 1), so this type represents the raw database row
 * format before transformation to the SessionInfo domain model. The service uses mapRow() to
 * convert between SessionRow (database format) and SessionInfo (application format).
 *
 * @property {string} custom_name - User-defined custom name for the session
 * @property {string} created_at - ISO 8601 timestamp when session was first created
 * @property {string} updated_at - ISO 8601 timestamp of last update
 * @property {number} version - Schema version number (currently 3)
 * @property {number | boolean} pinned - Whether session is pinned (1/true or 0/false)
 * @property {number | boolean} archived - Whether session is archived (1/true or 0/false)
 * @property {string} continuation_session_id - Session ID this session continues from (for conversation resumption)
 * @property {string} initial_commit_head - Git commit hash when session was created
 * @property {string} permission_mode - Permission mode for the session ('default', 'bypass', 'auto', 'plan')
 *
 * @example
 * ```typescript
 * // Raw database row (SQLite format)
 * const row: SessionRow = {
 *   custom_name: 'Code Review Session',
 *   created_at: '2024-01-15T10:30:00.000Z',
 *   updated_at: '2024-01-15T11:45:00.000Z',
 *   version: 3,
 *   pinned: 1,        // SQLite integer
 *   archived: 0,      // SQLite integer
 *   continuation_session_id: '',
 *   initial_commit_head: 'abc123def',
 *   permission_mode: 'default'
 * };
 * ```
 *
 * @example
 * ```typescript
 * // mapRow() converts to SessionInfo (application format)
 * const sessionInfo: SessionInfo = {
 *   custom_name: 'Code Review Session',
 *   created_at: '2024-01-15T10:30:00.000Z',
 *   updated_at: '2024-01-15T11:45:00.000Z',
 *   version: 3,
 *   pinned: true,     // Boolean
 *   archived: false,  // Boolean
 *   continuation_session_id: '',
 *   initial_commit_head: 'abc123def',
 *   permission_mode: 'default'
 * };
 * ```
 */
type SessionRow = {
  custom_name: string;
  created_at: string;
  updated_at: string;
  version: number;
  pinned: number | boolean;
  archived: number | boolean;
  continuation_session_id: string;
  initial_commit_head: string;
  permission_mode: string;
};

/**
 * SessionInfoService - Persistent SQLite-backed storage for session metadata
 *
 * @description
 * The SessionInfoService manages session metadata using a SQLite database stored in the user's
 * home directory at `~/.cui/session-info.db`. It provides fast lookups and updates for session-specific
 * data including custom names, pinned status, archived status, permission modes, and conversation
 * continuation tracking. The service implements a singleton pattern with prepared statements for
 * optimal performance.
 *
 * **Key Responsibilities:**
 * - Persist session metadata (custom names, pinned status, archived status, permission modes)
 * - Track conversation continuation chains via continuation_session_id
 * - Store Git commit hashes for session versioning and reproducibility
 * - Provide fast session lookups and bulk operations
 * - Manage database schema migrations and metadata
 * - Support both production (~/.cui/) and test (:memory:) database modes
 *
 * **Architecture:**
 * - **SQLite Backend**: Embedded database with WAL mode for concurrent reads/sequential writes
 * - **Singleton Pattern**: Single shared instance accessed via getInstance()
 * - **Prepared Statements**: Pre-compiled SQL statements for optimal performance
 * - **Auto-Creation**: Automatically creates default session records on first access
 * - **Schema Versioning**: Metadata table tracks schema version for future migrations
 * - **Graceful Degradation**: Returns default values on errors (logged but don't throw)
 *
 * **Database Schema:**
 * ```sql
 * -- sessions table (primary data)
 * CREATE TABLE sessions (
 *   session_id TEXT PRIMARY KEY,
 *   custom_name TEXT NOT NULL DEFAULT '',
 *   created_at TEXT NOT NULL,
 *   updated_at TEXT NOT NULL,
 *   version INTEGER NOT NULL,
 *   pinned INTEGER NOT NULL DEFAULT 0,
 *   archived INTEGER NOT NULL DEFAULT 0,
 *   continuation_session_id TEXT NOT NULL DEFAULT '',
 *   initial_commit_head TEXT NOT NULL DEFAULT '',
 *   permission_mode TEXT NOT NULL DEFAULT 'default'
 * );
 *
 * -- metadata table (schema version, timestamps)
 * CREATE TABLE metadata (
 *   key TEXT PRIMARY KEY,
 *   value TEXT NOT NULL
 * );
 * ```
 *
 * **Session Lifecycle:**
 * 1. **First Access**: getSessionInfo() auto-creates default session if not exists
 * 2. **Updates**: updateSessionInfo() merges partial updates with existing data
 * 3. **Archival**: Session status changed to archived=1 (soft delete, data preserved)
 * 4. **Deletion**: deleteSession() permanently removes session record from database
 * 5. **Sync**: syncMissingSessions() bulk-creates default records for discovered sessions
 *
 * **Use Cases:**
 * - Storing user-defined session names for UI display
 * - Pinning important conversations to top of session list
 * - Archiving completed or inactive sessions (soft delete)
 * - Tracking conversation continuation chains (resume workflows)
 * - Recording Git state for session reproducibility
 * - Managing permission modes (default, bypass, auto, plan)
 *
 * @example
 * ```typescript
 * // Initialize service and database (singleton pattern)
 * import { SessionInfoService } from './session-info-service';
 *
 * const service = SessionInfoService.getInstance();
 * await service.initialize();
 *
 * // Service is now ready with:
 * // - Database created at ~/.cui/session-info.db
 * // - WAL mode enabled for concurrent access
 * // - Prepared statements compiled
 * // - Schema version metadata initialized
 * ```
 *
 * @example
 * ```typescript
 * // Get session info (auto-creates if not exists)
 * import { SessionInfoService } from './session-info-service';
 *
 * const service = SessionInfoService.getInstance();
 * await service.initialize();
 *
 * const sessionInfo = await service.getSessionInfo('session-abc-123');
 * // First access returns default values:
 * // {
 * //   custom_name: '',
 * //   created_at: '2024-01-15T10:30:00.000Z',
 * //   updated_at: '2024-01-15T10:30:00.000Z',
 * //   version: 3,
 * //   pinned: false,
 * //   archived: false,
 * //   continuation_session_id: '',
 * //   initial_commit_head: '',
 * //   permission_mode: 'default'
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Update session metadata (partial updates)
 * import { SessionInfoService } from './session-info-service';
 *
 * const service = SessionInfoService.getInstance();
 * await service.initialize();
 *
 * // Set custom name and pin session
 * const updated = await service.updateSessionInfo('session-abc-123', {
 *   custom_name: 'Code Review Session',
 *   pinned: true
 * });
 * // Returns: { custom_name: 'Code Review Session', pinned: true, ... }
 *
 * // Archive session (soft delete)
 * await service.updateSessionInfo('session-abc-123', { archived: true });
 * ```
 *
 * @example
 * ```typescript
 * // Track conversation continuation chains
 * import { SessionInfoService } from './session-info-service';
 *
 * const service = SessionInfoService.getInstance();
 * await service.initialize();
 *
 * // Create new session that continues from previous session
 * const newSession = await service.updateSessionInfo('session-new-456', {
 *   continuation_session_id: 'session-abc-123',
 *   initial_commit_head: 'def456abc'
 * });
 *
 * // Retrieve continuation chain
 * const originalSession = await service.getSessionInfo('session-abc-123');
 * const continuedSession = await service.getSessionInfo(
 *   originalSession.continuation_session_id || 'session-new-456'
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Bulk operations and statistics
 * import { SessionInfoService } from './session-info-service';
 *
 * const service = SessionInfoService.getInstance();
 * await service.initialize();
 *
 * // Get all sessions
 * const allSessions = await service.getAllSessionInfo();
 * // Returns: Record<string, SessionInfo> with session IDs as keys
 *
 * // Archive all sessions at once
 * const archivedCount = await service.archiveAllSessions();
 * console.log(`Archived ${archivedCount} sessions`);
 *
 * // Get database statistics
 * const stats = await service.getStats();
 * // Returns: { sessionCount: 42, dbSize: 16384, lastUpdated: '...' }
 * ```
 *
 * @example
 * ```typescript
 * // Test mode with in-memory database
 * import { SessionInfoService } from './session-info-service';
 *
 * // Create test instance with in-memory database
 * const testService = new SessionInfoService(':memory:');
 * await testService.initialize();
 *
 * // Use for testing (no filesystem I/O)
 * await testService.updateSessionInfo('test-session', {
 *   custom_name: 'Test Session'
 * });
 *
 * // Reset for clean state
 * SessionInfoService.resetInstance();
 * ```
 *
 * @see {@link https://github.com/WiseLibs/better-sqlite3 | better-sqlite3 Documentation}
 * @see {@link SessionInfo} - Domain model interface for session metadata
 */
export class SessionInfoService {
  /** Singleton instance shared across the application */
  private static instance: SessionInfoService;

  /** Logger instance for service operations */
  private logger: Logger;

  /** Absolute path to SQLite database file (~/.cui/session-info.db or :memory:) */
  private dbPath!: string;

  /** Absolute path to configuration directory (~/.cui/) */
  private configDir!: string;

  /** Flag indicating whether database and statements are initialized */
  private isInitialized = false;

  /** better-sqlite3 database instance */
  private db!: Database.Database;

  /** Prepared statement for SELECT by session_id (fast lookups) */
  private getSessionStmt!: Database.Statement;

  /** Prepared statement for INSERT new session records */
  private insertSessionStmt!: Database.Statement;

  /** Prepared statement for UPDATE session records */
  private updateSessionStmt!: Database.Statement;

  /** Prepared statement for DELETE session by session_id */
  private deleteSessionStmt!: Database.Statement;

  /** Prepared statement for SELECT all sessions */
  private getAllStmt!: Database.Statement;

  /** Prepared statement for COUNT(*) sessions */
  private countStmt!: Database.Statement;

  /** Prepared statement for bulk archive all sessions */
  private archiveAllStmt!: Database.Statement;

  /** Prepared statement for upsert metadata key-value pairs */
  private setMetadataStmt!: Database.Statement;

  /** Prepared statement for SELECT metadata value by key */
  private getMetadataStmt!: Database.Statement;

  constructor(customConfigDir?: string) {
    this.logger = createLogger('SessionInfoService');
    this.initializePaths(customConfigDir);
  }

  static getInstance(): SessionInfoService {
    if (!SessionInfoService.instance) {
      SessionInfoService.instance = new SessionInfoService();
    }
    return SessionInfoService.instance;
  }

  static resetInstance(): void {
    if (SessionInfoService.instance) {
      SessionInfoService.instance.isInitialized = false;
    }
    SessionInfoService.instance = null as unknown as SessionInfoService;
  }

  private initializePaths(customConfigDir?: string): void {
    if (customConfigDir) {
      if (customConfigDir === ':memory:') {
        this.configDir = ':memory:';
        this.dbPath = ':memory:';
        return;
      }
      this.configDir = path.join(customConfigDir, '.cui');
    } else {
      this.configDir = path.join(os.homedir(), '.cui');
    }
    this.dbPath = path.join(this.configDir, 'session-info.db');

    this.logger.debug('Initializing paths', {
      homedir: os.homedir(),
      configDir: this.configDir,
      dbPath: this.dbPath
    });
  }

  /**
   * Initialize the SQLite database and prepare statements
   *
   * @description
   * Initializes the SQLite database at ~/.cui/session-info.db (or :memory: for tests), creates
   * database tables if they don't exist, enables WAL mode for concurrent access, prepares SQL
   * statements for optimal performance, and initializes metadata. This method is idempotent -
   * calling it multiple times has no effect after the first successful initialization.
   *
   * **Initialization Workflow:**
   * 1. Check if already initialized (skip if true)
   * 2. Create ~/.cui/ directory if doesn't exist (production mode)
   * 3. Open SQLite database connection
   * 4. Enable WAL mode (Write-Ahead Logging) for concurrent reads
   * 5. Create sessions and metadata tables (if not exist)
   * 6. Prepare all SQL statements for performance
   * 7. Initialize metadata (schema_version, created_at, last_updated)
   * 8. Mark service as initialized
   *
   * **Database Configuration:**
   * - **WAL Mode**: Enables concurrent reads while writes are happening
   * - **Prepared Statements**: All SQL is pre-compiled for fast execution
   * - **Schema Version**: Tracked in metadata for future migrations
   * - **Idempotent**: Safe to call multiple times (no-op after first call)
   *
   * @returns {Promise<void>} Resolves when initialization is complete
   * @throws {Error} Throws if database initialization fails
   *
   * @example
   * ```typescript
   * // Initialize on app startup (singleton pattern)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * // Service is now ready - database created and configured:
   * // - Database file: ~/.cui/session-info.db
   * // - WAL mode enabled
   * // - Tables created (sessions, metadata)
   * // - Prepared statements compiled
   * // - Schema version: 3
   * ```
   *
   * @example
   * ```typescript
   * // Initialize with error handling
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * try {
   *   await service.initialize();
   *   console.log('Database initialized successfully');
   * } catch (error) {
   *   console.error('Failed to initialize database:', error.message);
   *   // Handle initialization failure (e.g., permissions issue, disk full)
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent behavior (safe to call multiple times)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize(); // Initializes database
   * await service.initialize(); // No-op (already initialized)
   * await service.initialize(); // No-op (already initialized)
   * ```
   *
   * @example
   * ```typescript
   * // Test mode with in-memory database
   * import { SessionInfoService } from './session-info-service';
   *
   * const testService = new SessionInfoService(':memory:');
   * await testService.initialize();
   *
   * // In-memory database (no filesystem I/O)
   * // - Fast for testing
   * // - Isolated from production database
   * // - Destroyed when process exits
   * ```
   *
   * @see {@link getInstance} - Get singleton instance
   * @see {@link resetInstance} - Reset for testing
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.dbPath !== ':memory:' && !fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        this.logger.debug('Created config directory', { dir: this.configDir });
      }

      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          custom_name TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          continuation_session_id TEXT NOT NULL DEFAULT '',
          initial_commit_head TEXT NOT NULL DEFAULT '',
          permission_mode TEXT NOT NULL DEFAULT 'default'
        );
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      this.prepareStatements();
      this.ensureMetadata();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize session info database', error);
      throw new Error(`Session info database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private prepareStatements(): void {
    this.getSessionStmt = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?');
    this.insertSessionStmt = this.db.prepare(`
      INSERT INTO sessions (
        session_id,
        custom_name,
        created_at,
        updated_at,
        version,
        pinned,
        archived,
        continuation_session_id,
        initial_commit_head,
        permission_mode
      ) VALUES (
        @session_id,
        @custom_name,
        @created_at,
        @updated_at,
        @version,
        @pinned,
        @archived,
        @continuation_session_id,
        @initial_commit_head,
        @permission_mode
      )
    `);
    this.updateSessionStmt = this.db.prepare(`
      UPDATE sessions SET
        custom_name=@custom_name,
        updated_at=@updated_at,
        pinned=@pinned,
        archived=@archived,
        continuation_session_id=@continuation_session_id,
        initial_commit_head=@initial_commit_head,
        permission_mode=@permission_mode,
        version=@version
      WHERE session_id=@session_id
    `);
    this.deleteSessionStmt = this.db.prepare('DELETE FROM sessions WHERE session_id = ?');
    this.getAllStmt = this.db.prepare('SELECT * FROM sessions');
    this.countStmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions');
    this.archiveAllStmt = this.db.prepare('UPDATE sessions SET archived=1, updated_at=@updated_at WHERE archived=0');
    this.setMetadataStmt = this.db.prepare('INSERT INTO metadata (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    this.getMetadataStmt = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
  }

  private ensureMetadata(): void {
    const now = new Date().toISOString();
    const schema = this.getMetadataStmt.get('schema_version') as { value?: string } | undefined;
    if (!schema) {
      this.setMetadataStmt.run({ key: 'schema_version', value: '3' });
      this.setMetadataStmt.run({ key: 'created_at', value: now });
      this.setMetadataStmt.run({ key: 'last_updated', value: now });
    }
  }

  private mapRow(row: SessionRow): SessionInfo {
    return {
      custom_name: row.custom_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      version: row.version,
      pinned: !!row.pinned,
      archived: !!row.archived,
      continuation_session_id: row.continuation_session_id,
      initial_commit_head: row.initial_commit_head,
      permission_mode: row.permission_mode
    };
  }

  /**
   * Retrieve session metadata by session ID (auto-creates default if not exists)
   *
   * @description
   * Retrieves session metadata from the SQLite database. If the session doesn't exist, it automatically
   * creates a new database record with default values and returns it. This auto-creation pattern ensures
   * every session has metadata without requiring explicit initialization.
   *
   * **Auto-Creation Behavior:**
   * - First access to a session ID automatically creates a database record
   * - Default values: empty custom_name, current timestamp, unpinned, not archived
   * - Metadata table updated with last_updated timestamp
   * - Idempotent: subsequent calls return the same record
   *
   * **Graceful Degradation:**
   * - On database errors, returns default values without throwing
   * - Error is logged but doesn't break application flow
   * - Ensures UI always receives valid SessionInfo data
   *
   * @param {string} sessionId - Unique session identifier (Claude SDK session ID)
   * @returns {Promise<SessionInfo>} Session metadata (auto-created if not exists)
   *
   * @example
   * ```typescript
   * // First access auto-creates session with defaults
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const sessionInfo = await service.getSessionInfo('session-abc-123');
   * console.log(sessionInfo);
   * // {
   * //   custom_name: '',
   * //   created_at: '2024-01-15T10:30:00.000Z',
   * //   updated_at: '2024-01-15T10:30:00.000Z',
   * //   version: 3,
   * //   pinned: false,
   * //   archived: false,
   * //   continuation_session_id: '',
   * //   initial_commit_head: '',
   * //   permission_mode: 'default'
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Subsequent access returns existing record
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * // Update session
   * await service.updateSessionInfo('session-abc-123', {
   *   custom_name: 'Code Review Session'
   * });
   *
   * // Retrieve updated record
   * const sessionInfo = await service.getSessionInfo('session-abc-123');
   * console.log(sessionInfo.custom_name); // 'Code Review Session'
   * ```
   *
   * @example
   * ```typescript
   * // Use in session list display
   * import { SessionInfoService } from './session-info-service';
   * import { ClaudeHistoryReader } from './claude-history-reader';
   *
   * const service = SessionInfoService.getInstance();
   * const historyReader = new ClaudeHistoryReader();
   *
   * await service.initialize();
   * const conversations = await historyReader.getConversationList();
   *
   * // Enrich conversations with metadata
   * const enriched = await Promise.all(
   *   conversations.map(async (conv) => {
   *     const metadata = await service.getSessionInfo(conv.sessionId);
   *     return {
   *       ...conv,
   *       customName: metadata.custom_name || conv.title,
   *       pinned: metadata.pinned,
   *       archived: metadata.archived
   *     };
   *   })
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Filter archived sessions
   * import { SessionInfoService } from './session-info-service';
   * import { ClaudeHistoryReader } from './claude-history-reader';
   *
   * const service = SessionInfoService.getInstance();
   * const historyReader = new ClaudeHistoryReader();
   *
   * await service.initialize();
   * const conversations = await historyReader.getConversationList();
   *
   * // Filter out archived sessions
   * const activeConversations = [];
   * for (const conv of conversations) {
   *   const metadata = await service.getSessionInfo(conv.sessionId);
   *   if (!metadata.archived) {
   *     activeConversations.push(conv);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Graceful error handling (always returns valid data)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * // Note: initialize() not called (database not ready)
   *
   * // Still returns default values (doesn't throw)
   * const sessionInfo = await service.getSessionInfo('session-abc-123');
   * console.log(sessionInfo.custom_name); // ''
   * // Error logged but application continues
   * ```
   *
   * @see {@link updateSessionInfo} - Update session metadata
   * @see {@link getAllSessionInfo} - Retrieve all sessions
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    try {
      const row = this.getSessionStmt.get(sessionId) as SessionRow | undefined;
      if (row) {
        return this.mapRow(row);
      }

      const now = new Date().toISOString();
      const defaultSession: SessionInfo = {
        custom_name: '',
        created_at: now,
        updated_at: now,
        version: 3,
        pinned: false,
        archived: false,
        continuation_session_id: '',
        initial_commit_head: '',
        permission_mode: 'default'
      };
      this.insertSessionStmt.run({
        session_id: sessionId,
        custom_name: '',
        created_at: now,
        updated_at: now,
        version: 3,
        pinned: 0,
        archived: 0,
        continuation_session_id: '',
        initial_commit_head: '',
        permission_mode: 'default'
      });
      this.setMetadataStmt.run({ key: 'last_updated', value: now });
      return defaultSession;
    } catch (error) {
      this.logger.error('Failed to get session info', { sessionId, error });
      const now = new Date().toISOString();
      return {
        custom_name: '',
        created_at: now,
        updated_at: now,
        version: 3,
        pinned: false,
        archived: false,
        continuation_session_id: '',
        initial_commit_head: '',
        permission_mode: 'default'
      };
    }
  }

  /**
   * Update session metadata with partial updates (creates session if not exists)
   *
   * @description
   * Updates session metadata in the SQLite database using partial update semantics. If the session
   * doesn't exist, it creates a new record with defaults merged with the provided updates. This method
   * supports both update and create operations in a single interface (upsert pattern).
   *
   * **Update Semantics:**
   * - **Partial Updates**: Only provided fields are updated, existing fields are preserved
   * - **Auto-Creation**: Creates new session if doesn't exist (insert with defaults + updates)
   * - **Timestamp Management**: updated_at automatically set to current timestamp
   * - **Boolean Conversion**: Converts boolean values to SQLite integers (1/0) automatically
   * - **Metadata Update**: Updates database last_updated timestamp after successful operation
   *
   * **Common Use Cases:**
   * - Set custom session names for UI display
   * - Pin/unpin sessions for priority sorting
   * - Archive sessions (soft delete)
   * - Track conversation continuation chains
   * - Record Git commit hashes for reproducibility
   * - Update permission modes
   *
   * @param {string} sessionId - Unique session identifier (Claude SDK session ID)
   * @param {Partial<SessionInfo>} updates - Partial session metadata to update/create
   * @returns {Promise<SessionInfo>} Updated session metadata (full SessionInfo object)
   * @throws {Error} Throws if database update fails
   *
   * @example
   * ```typescript
   * // Update custom name (partial update)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const updated = await service.updateSessionInfo('session-abc-123', {
   *   custom_name: 'Code Review Session'
   * });
   * console.log(updated.custom_name); // 'Code Review Session'
   * console.log(updated.pinned);      // false (unchanged)
   * console.log(updated.archived);    // false (unchanged)
   * ```
   *
   * @example
   * ```typescript
   * // Pin session to top of list
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * await service.updateSessionInfo('session-abc-123', { pinned: true });
   *
   * // Later, unpin session
   * await service.updateSessionInfo('session-abc-123', { pinned: false });
   * ```
   *
   * @example
   * ```typescript
   * // Archive session (soft delete)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * await service.updateSessionInfo('session-abc-123', { archived: true });
   *
   * // Later, restore from archive
   * await service.updateSessionInfo('session-abc-123', { archived: false });
   * ```
   *
   * @example
   * ```typescript
   * // Create session with continuation tracking
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * // Create new session that continues from previous session
   * const newSession = await service.updateSessionInfo('session-new-456', {
   *   custom_name: 'Continued: Code Review',
   *   continuation_session_id: 'session-abc-123',
   *   initial_commit_head: 'def456abc',
   *   permission_mode: 'auto'
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Multiple field update
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const updated = await service.updateSessionInfo('session-abc-123', {
   *   custom_name: 'Important Session',
   *   pinned: true,
   *   permission_mode: 'bypass'
   * });
   * // All three fields updated atomically
   * ```
   *
   * @example
   * ```typescript
   * // Auto-creation on first update (session doesn't exist)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * // Session doesn't exist yet - creates with defaults + updates
   * const created = await service.updateSessionInfo('session-new-789', {
   *   custom_name: 'New Session',
   *   pinned: true
   * });
   * console.log(created);
   * // {
   * //   custom_name: 'New Session',
   * //   created_at: '2024-01-15T10:30:00.000Z',
   * //   updated_at: '2024-01-15T10:30:00.000Z',
   * //   version: 3,
   * //   pinned: true,          // From updates
   * //   archived: false,       // Default
   * //   continuation_session_id: '', // Default
   * //   initial_commit_head: '',     // Default
   * //   permission_mode: 'default'   // Default
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // UI integration: rename session dialog
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * async function handleRenameSession(sessionId: string, newName: string) {
   *   try {
   *     const updated = await service.updateSessionInfo(sessionId, {
   *       custom_name: newName
   *     });
   *     console.log(`Session renamed to: ${updated.custom_name}`);
   *     return updated;
   *   } catch (error) {
   *     console.error('Failed to rename session:', error);
   *     throw error;
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling (throws on database errors)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * // Note: initialize() not called (database not ready)
   *
   * try {
   *   await service.updateSessionInfo('session-abc-123', {
   *     custom_name: 'Test'
   *   });
   * } catch (error) {
   *   console.error('Update failed:', error.message);
   *   // Error: Failed to update session info: ...
   * }
   * ```
   *
   * @see {@link getSessionInfo} - Retrieve session metadata
   * @see {@link updateCustomName} - Convenience method for updating custom name only
   */
  async updateSessionInfo(sessionId: string, updates: Partial<SessionInfo>): Promise<SessionInfo> {
    try {
      const existingRow = this.getSessionStmt.get(sessionId) as SessionRow | undefined;
      const now = new Date().toISOString();
      if (existingRow) {
        const updatedSession: SessionInfo = {
          ...this.mapRow(existingRow),
          ...updates,
          updated_at: now
        };
        this.updateSessionStmt.run({
          session_id: sessionId,
          custom_name: updatedSession.custom_name,
          updated_at: updatedSession.updated_at,
          pinned: updatedSession.pinned ? 1 : 0,
          archived: updatedSession.archived ? 1 : 0,
          continuation_session_id: updatedSession.continuation_session_id,
          initial_commit_head: updatedSession.initial_commit_head,
          permission_mode: updatedSession.permission_mode,
          version: updatedSession.version
        });
        this.setMetadataStmt.run({ key: 'last_updated', value: now });
        return updatedSession;
      } else {
        const newSession: SessionInfo = {
          custom_name: '',
          created_at: now,
          updated_at: now,
          version: 3,
          pinned: false,
          archived: false,
          continuation_session_id: '',
          initial_commit_head: '',
          permission_mode: 'default',
          ...updates
        };
        this.insertSessionStmt.run({
          session_id: sessionId,
          custom_name: newSession.custom_name,
          created_at: newSession.created_at,
          updated_at: newSession.updated_at,
          version: newSession.version,
          pinned: newSession.pinned ? 1 : 0,
          archived: newSession.archived ? 1 : 0,
          continuation_session_id: newSession.continuation_session_id,
          initial_commit_head: newSession.initial_commit_head,
          permission_mode: newSession.permission_mode
        });
        this.setMetadataStmt.run({ key: 'last_updated', value: now });
        return newSession;
      }
    } catch (error) {
      this.logger.error('Failed to update session info', { sessionId, updates, error });
      throw new Error(`Failed to update session info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateCustomName(sessionId: string, customName: string): Promise<void> {
    await this.updateSessionInfo(sessionId, { custom_name: customName });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.logger.info('Deleting session info', { sessionId });
    try {
      const result = this.deleteSessionStmt.run(sessionId);
      if (result.changes > 0) {
        const now = new Date().toISOString();
        this.setMetadataStmt.run({ key: 'last_updated', value: now });
        this.logger.info('Session info deleted successfully', { sessionId });
      } else {
        this.logger.debug('Session info not found for deletion', { sessionId });
      }
    } catch (error) {
      this.logger.error('Failed to delete session info', { sessionId, error });
      throw new Error(`Failed to delete session info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve all session metadata as a dictionary keyed by session ID
   *
   * @description
   * Retrieves all session records from the SQLite database and returns them as a dictionary
   * with session IDs as keys and SessionInfo objects as values. This method is useful for
   * bulk operations, analytics, and enriching conversation lists with metadata.
   *
   * **Graceful Degradation:**
   * - On database errors, returns empty object {} without throwing
   * - Error is logged but doesn't break application flow
   * - Ensures UI always receives valid data structure
   *
   * **Use Cases:**
   * - Enrich conversation list with custom names, pinned status, archived status
   * - Filter conversations by metadata (archived, pinned, permission mode)
   * - Export session metadata for analytics or backup
   * - Display session statistics (total sessions, archived count, pinned count)
   * - Bulk operations (archive all, sync metadata)
   *
   * @returns {Promise<Record<string, SessionInfo>>} Dictionary of session metadata keyed by session ID
   *
   * @example
   * ```typescript
   * // Basic usage - get all sessions
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const allSessions = await service.getAllSessionInfo();
   * console.log(Object.keys(allSessions).length); // Total session count
   *
   * // Example output:
   * // {
   * //   'session-abc-123': { custom_name: 'Code Review', pinned: true, ... },
   * //   'session-def-456': { custom_name: '', pinned: false, archived: true, ... },
   * //   ...
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Filter archived vs active sessions
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const allSessions = await service.getAllSessionInfo();
   * const activeSessions = Object.entries(allSessions)
   *   .filter(([_, info]) => !info.archived)
   *   .reduce((acc, [id, info]) => ({ ...acc, [id]: info }), {});
   *
   * const archivedSessions = Object.entries(allSessions)
   *   .filter(([_, info]) => info.archived)
   *   .reduce((acc, [id, info]) => ({ ...acc, [id]: info }), {});
   *
   * console.log(`Active: ${Object.keys(activeSessions).length}`);
   * console.log(`Archived: ${Object.keys(archivedSessions).length}`);
   * ```
   *
   * @example
   * ```typescript
   * // Get all pinned sessions
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const allSessions = await service.getAllSessionInfo();
   * const pinnedSessionIds = Object.entries(allSessions)
   *   .filter(([_, info]) => info.pinned)
   *   .map(([id, _]) => id);
   *
   * console.log('Pinned sessions:', pinnedSessionIds);
   * ```
   *
   * @example
   * ```typescript
   * // Enrich conversation list with metadata
   * import { SessionInfoService } from './session-info-service';
   * import { ClaudeHistoryReader } from './claude-history-reader';
   *
   * const service = SessionInfoService.getInstance();
   * const historyReader = new ClaudeHistoryReader();
   *
   * await service.initialize();
   * const conversations = await historyReader.getConversationList();
   * const allSessions = await service.getAllSessionInfo();
   *
   * const enriched = conversations.map(conv => ({
   *   ...conv,
   *   customName: allSessions[conv.sessionId]?.custom_name || conv.title,
   *   pinned: allSessions[conv.sessionId]?.pinned || false,
   *   archived: allSessions[conv.sessionId]?.archived || false
   * }));
   * ```
   *
   * @example
   * ```typescript
   * // Session statistics dashboard
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const allSessions = await service.getAllSessionInfo();
   * const stats = {
   *   total: Object.keys(allSessions).length,
   *   active: Object.values(allSessions).filter(s => !s.archived).length,
   *   archived: Object.values(allSessions).filter(s => s.archived).length,
   *   pinned: Object.values(allSessions).filter(s => s.pinned).length,
   *   withCustomNames: Object.values(allSessions).filter(s => s.custom_name).length
   * };
   * console.log('Session Statistics:', stats);
   * ```
   *
   * @example
   * ```typescript
   * // Export session metadata to JSON
   * import { SessionInfoService } from './session-info-service';
   * import fs from 'fs/promises';
   *
   * const service = SessionInfoService.getInstance();
   * await service.initialize();
   *
   * const allSessions = await service.getAllSessionInfo();
   * await fs.writeFile(
   *   'session-metadata-backup.json',
   *   JSON.stringify(allSessions, null, 2)
   * );
   * console.log('Exported metadata for', Object.keys(allSessions).length, 'sessions');
   * ```
   *
   * @example
   * ```typescript
   * // Graceful error handling (returns empty object)
   * import { SessionInfoService } from './session-info-service';
   *
   * const service = SessionInfoService.getInstance();
   * // Note: initialize() not called (database not ready)
   *
   * const allSessions = await service.getAllSessionInfo();
   * console.log(allSessions); // {} (empty object, not undefined)
   * // Error logged but application continues
   * ```
   *
   * @see {@link getSessionInfo} - Retrieve single session metadata
   * @see {@link getStats} - Get database statistics
   */
  async getAllSessionInfo(): Promise<Record<string, SessionInfo>> {
    this.logger.debug('Getting all session info');
    try {
      const rows = this.getAllStmt.all() as Array<SessionRow & { session_id: string }>;
      const result: Record<string, SessionInfo> = {};
      for (const row of rows) {
        result[row.session_id] = this.mapRow(row);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to get all session info', error);
      return {};
    }
  }

  async getStats(): Promise<{ sessionCount: number; dbSize: number; lastUpdated: string }> {
    try {
      const countRow = this.countStmt.get() as { count: number };
      let dbSize = 0;
      if (this.dbPath !== ':memory:') {
        try {
          const stats = fs.statSync(this.dbPath);
          dbSize = stats.size;
        } catch {
          dbSize = 0;
        }
      }
      const lastUpdatedRow = this.getMetadataStmt.get('last_updated') as { value?: string } | undefined;
      return {
        sessionCount: countRow.count,
        dbSize,
        lastUpdated: lastUpdatedRow?.value || new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return {
        sessionCount: 0,
        dbSize: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  reinitializePaths(customConfigDir?: string): void {
    this.initializePaths(customConfigDir);
  }

  getDbPath(): string {
    return this.dbPath;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  async archiveAllSessions(): Promise<number> {
    this.logger.info('Archiving all sessions');
    try {
      const now = new Date().toISOString();
      const transaction = this.db.transaction(() => {
        const info = this.archiveAllStmt.run({ updated_at: now });
        if (info.changes > 0) {
          this.setMetadataStmt.run({ key: 'last_updated', value: now });
        }
        return info.changes;
      });
      const archivedCount = transaction();
      this.logger.info('Sessions archived successfully', { archivedCount });
      return archivedCount;
    } catch (error) {
      this.logger.error('Failed to archive all sessions', error);
      throw new Error(`Failed to archive all sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async syncMissingSessions(sessionIds: string[]): Promise<number> {
    try {
      const now = new Date().toISOString();
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO sessions (
          session_id,
          custom_name,
          created_at,
          updated_at,
          version,
          pinned,
          archived,
          continuation_session_id,
          initial_commit_head,
          permission_mode
        ) VALUES (
          @session_id,
          '',
          @now,
          @now,
          3,
          0,
          0,
          '',
          '',
          'default'
        )
      `);
      const transaction = this.db.transaction((ids: string[]) => {
        let inserted = 0;
        for (const id of ids) {
          const info = insert.run({ session_id: id, now });
          if (info.changes > 0) inserted++;
        }
        if (inserted > 0) {
          this.setMetadataStmt.run({ key: 'last_updated', value: now });
        }
        return inserted;
      });
      return transaction(sessionIds);
    } catch (error) {
      this.logger.error('Failed to sync missing sessions', error);
      throw new Error(`Failed to sync missing sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

