import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createLogger, type Logger } from './logger.js';
import type { Task, CreateTaskRequest, TaskFilter, TaskStatus } from '../types/task-types.js';

/**
 * Service for managing persistent task storage using file-based JSON storage.
 *
 * @description
 * TaskStorageService provides a file-based storage system for agent task execution records.
 * Each task is stored as an individual JSON file in the logs directory, with a lightweight
 * index file for fast querying and filtering.
 *
 * ## Architecture
 *
 * **Storage Strategy:**
 * - Individual task files: `logs/{task-id}.json` - Contains full task data
 * - Index file: `logs/_index.json` - Contains lightweight task summaries for fast filtering
 * - Directory location: `logs/` in project root (configurable via constructor)
 *
 * **Index-Based Optimization:**
 * The service maintains a dual-layer storage approach:
 * 1. **Index layer** (`_index.json`): Lightweight summaries with essential fields (id, name, status, taskType, agentName, timestamps)
 * 2. **Task file layer** (`{task-id}.json`): Full task data with results, errors, execution logs, metadata
 *
 * This allows fast filtering/sorting without loading all task files into memory.
 *
 * **Task Lifecycle:**
 * 1. **Creation** (pending): Task created via createTask() with auto-generated UUID
 * 2. **Execution** (running): Status updated to 'running' via updateTaskStatus(), startedAt timestamp set
 * 3. **Completion** (completed/failed): Status updated, completedAt timestamp set, duration calculated
 * 4. **Deletion**: Task file and index entry removed via deleteTask()
 *
 * **File Structure:**
 * ```
 * logs/
 * ├── _index.json                    # Index file (lightweight summaries)
 * ├── 123e4567-e89b-12d3-a456-426614174000.json  # Task file
 * ├── 234e5678-e89b-12d3-a456-426614174001.json
 * └── ...
 * ```
 *
 * **Index File Format:**
 * ```json
 * [
 *   {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "name": "Implement user authentication",
 *     "status": "completed",
 *     "taskType": "agent",
 *     "agentName": "Backend Developer",
 *     "createdAt": "2026-01-02T08:00:00.000Z",
 *     "completedAt": "2026-01-02T08:05:30.000Z"
 *   }
 * ]
 * ```
 *
 * **Task File Format:**
 * Full Task object with all fields (result, error, executionLog, metadata, etc.)
 *
 * @example
 * // Basic usage - Create and track task lifecycle
 * const taskStorage = new TaskStorageService();
 * await taskStorage.initialize();
 *
 * // Create new task
 * const task = await taskStorage.createTask({
 *   name: 'Implement user authentication',
 *   description: 'Add JWT-based authentication to the API',
 *   agentId: 'agent_123',
 *   taskType: 'agent',
 *   userPrompt: 'Implement JWT authentication with refresh tokens',
 *   permissionMode: 'default',
 *   directory: '/home/user/projects/my-app'
 * }, 'Backend Developer');
 *
 * // Update task status to running
 * await taskStorage.updateTaskStatus(task.id, 'running');
 *
 * // Complete task with result
 * await taskStorage.updateTaskStatus(task.id, 'completed', {
 *   result: 'Successfully implemented JWT authentication with refresh token support',
 *   executionLog: [...]
 * });
 *
 * @example
 * // List tasks with filtering and pagination
 * const taskStorage = new TaskStorageService();
 *
 * // Get all pending tasks
 * const pendingTasks = await taskStorage.getTasks({ status: 'pending' });
 *
 * // Get all tasks for a specific agent with pagination
 * const agentTasks = await taskStorage.getTasks({
 *   agentId: 'agent_123',
 *   limit: 20,
 *   offset: 0
 * });
 *
 * // Get task statistics
 * const stats = await taskStorage.getStats();
 * console.log(`Total: ${stats.total}, Pending: ${stats.pending}, Running: ${stats.running}`);
 *
 * @example
 * // Retrieve and display task details
 * const taskStorage = new TaskStorageService();
 *
 * const task = await taskStorage.getTask('123e4567-e89b-12d3-a456-426614174000');
 * if (task) {
 *   console.log(`Task: ${task.name}`);
 *   console.log(`Status: ${task.status}`);
 *   console.log(`Duration: ${task.duration}ms`);
 *   if (task.result) console.log(`Result: ${task.result}`);
 *   if (task.error) console.error(`Error: ${task.error}`);
 * }
 *
 * @example
 * // Custom logs directory for testing
 * const taskStorage = new TaskStorageService('/tmp/test-tasks');
 * await taskStorage.initialize();
 * // Tasks stored in /tmp/test-tasks/*.json
 *
 * @example
 * // Index recovery after corruption or migration
 * const taskStorage = new TaskStorageService();
 * await taskStorage.initialize();
 *
 * // Rebuild index from all task files
 * await taskStorage.rebuildIndex();
 * // Index file regenerated from all .json task files
 *
 * @see {@link Task} for full task data structure
 * @see {@link CreateTaskRequest} for task creation parameters
 * @see {@link TaskFilter} for filtering options
 */
export class TaskStorageService {
  /** Logger instance for task storage operations */
  private logger: Logger;

  /** Directory path for task JSON files (default: logs/ in project root) */
  private logsDir: string;

  /** Path to index file for fast task querying */
  private indexFilePath: string;

  /** Initialization flag to ensure directory/index setup runs once */
  private initialized = false;

  constructor(logsDir?: string) {
    this.logger = createLogger('TaskStorageService');

    // Use logs directory in project root
    this.logsDir = logsDir || path.join(process.cwd(), 'logs');
    this.indexFilePath = path.join(this.logsDir, '_index.json');
  }

  /**
   * Initialize task storage by creating logs directory and index file if needed.
   *
   * @description
   * Prepares the task storage system for use by ensuring the logs directory exists
   * and creating an empty index file if one doesn't exist. This method is idempotent
   * and safe to call multiple times.
   *
   * **Initialization Workflow:**
   * 1. Check if already initialized (skip if true)
   * 2. Create logs directory if it doesn't exist (recursive creation)
   * 3. Check for existing index file
   * 4. Create empty index file if it doesn't exist
   * 5. Mark as initialized
   *
   * **Automatic Initialization:**
   * All public methods automatically call initialize() before executing, so manual
   * initialization is typically not required. However, it can be useful for:
   * - Pre-warming storage during application startup
   * - Testing directory permissions before use
   * - Explicit setup in initialization scripts
   *
   * **File Creation:**
   * - Directory: `logs/` (or custom path from constructor)
   * - Index file: `logs/_index.json` (empty array `[]`)
   *
   * **Idempotent Behavior:**
   * - Safe to call multiple times (no-op if already initialized)
   * - Does not overwrite existing index file
   * - Creates directory with `{ recursive: true }` (safe if already exists)
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if directory creation fails (permissions, disk full, etc.)
   *
   * @example
   * // Manual initialization during application startup
   * const taskStorage = new TaskStorageService();
   * await taskStorage.initialize();
   * console.log('Task storage initialized');
   *
   * @example
   * // Test directory permissions before use
   * const taskStorage = new TaskStorageService();
   *
   * try {
   *   await taskStorage.initialize();
   *   console.log('Storage is ready');
   * } catch (error) {
   *   console.error('Failed to initialize storage:', error.message);
   *   // Handle permission errors, disk full, etc.
   * }
   *
   * @example
   * // Automatic initialization (typical usage)
   * const taskStorage = new TaskStorageService();
   * // No need to call initialize() - it's called automatically
   * const task = await taskStorage.createTask({...}, 'Agent Name');
   *
   * @example
   * // Custom logs directory
   * const taskStorage = new TaskStorageService('/var/app/task-logs');
   * await taskStorage.initialize();
   * // Creates /var/app/task-logs/ and /var/app/task-logs/_index.json
   *
   * @example
   * // Idempotent behavior
   * const taskStorage = new TaskStorageService();
   * await taskStorage.initialize(); // Creates directory and index
   * await taskStorage.initialize(); // No-op (already initialized)
   * await taskStorage.initialize(); // No-op (already initialized)
   *
   * @see {@link createTask} for creating tasks (auto-initializes)
   * @see {@link getTasks} for retrieving tasks (auto-initializes)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure logs directory exists
      await fs.mkdir(this.logsDir, { recursive: true });

      // Try to load index file, create if doesn't exist
      try {
        await fs.access(this.indexFilePath);
        this.logger.info('Logs directory initialized', { path: this.logsDir });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Create empty index file
          await this.saveIndex([]);
          this.logger.info('Created new index file', { path: this.indexFilePath });
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize task storage', error);
      throw error;
    }
  }

  /**
   * Get task file path
   */
  private getTaskFilePath(taskId: string): string {
    return path.join(this.logsDir, `${taskId}.json`);
  }

  /**
   * Save task to individual file
   */
  private async saveTask(task: Task): Promise<void> {
    try {
      const filePath = this.getTaskFilePath(task.id);
      await fs.writeFile(filePath, JSON.stringify(task, null, 2), 'utf-8');
      this.logger.debug('Task file saved', { taskId: task.id, path: filePath });
    } catch (error) {
      this.logger.error('Failed to save task file', error, { taskId: task.id });
      throw error;
    }
  }

  /**
   * Load task from individual file
   */
  private async loadTask(taskId: string): Promise<Task | null> {
    try {
      const filePath = this.getTaskFilePath(taskId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      this.logger.error('Failed to load task file', error, { taskId });
      throw error;
    }
  }

  /**
   * Load index file (lightweight task summaries)
   */
  private async loadIndex(): Promise<Array<{
    id: string;
    name: string;
    status: TaskStatus;
    taskType: string;
    agentName: string;
    createdAt: string;
    completedAt?: string;
  }>> {
    try {
      const data = await fs.readFile(this.indexFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save index file
   */
  private async saveIndex(index: Array<any>): Promise<void> {
    try {
      await fs.writeFile(this.indexFilePath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save index file', error);
      throw error;
    }
  }

  /**
   * Update index with task summary
   */
  private async updateIndex(task: Task): Promise<void> {
    const index = await this.loadIndex();

    // Remove existing entry if present
    const existingIndex = index.findIndex(t => t.id === task.id);
    if (existingIndex !== -1) {
      index.splice(existingIndex, 1);
    }

    // Add updated entry at the beginning
    index.unshift({
      id: task.id,
      name: task.name,
      status: task.status,
      taskType: task.taskType,
      agentName: task.agentName,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    });

    await this.saveIndex(index);
  }

  /**
   * Create a new task and persist to storage.
   *
   * @description
   * Creates a new task record with auto-generated UUID, initializes task lifecycle fields,
   * saves task to individual JSON file, and updates index for fast querying.
   *
   * **Task Initialization:**
   * - Auto-generates UUID for task.id
   * - Sets status to 'pending'
   * - Sets createdAt timestamp (ISO 8601 format)
   * - Defaults taskType to 'agent' if not provided
   * - Defaults permissionMode to 'default' if not provided
   *
   * **Storage Operations:**
   * 1. Initialize storage if not already initialized
   * 2. Create Task object with auto-generated fields
   * 3. Save task to `logs/{task-id}.json`
   * 4. Update index file with task summary
   * 5. Log task creation with metadata
   *
   * **File Creation:**
   * - Task file: `logs/{uuid}.json` - Full task data
   * - Index entry: Added to `logs/_index.json` - Lightweight summary
   *
   * @param request - Task creation parameters (name, description, agentId, userPrompt, etc.)
   * @param agentName - Human-readable agent/skill name for display and filtering
   * @returns Promise resolving to created Task object with auto-generated id and timestamps
   *
   * @example
   * // Create agent task
   * const taskStorage = new TaskStorageService();
   *
   * const task = await taskStorage.createTask({
   *   name: 'Implement user authentication',
   *   description: 'Add JWT-based authentication to the API',
   *   agentId: 'agent_123',
   *   taskType: 'agent',
   *   userPrompt: 'Implement JWT authentication with refresh tokens and role-based access control',
   *   permissionMode: 'default',
   *   directory: '/home/user/projects/my-app'
   * }, 'Backend Developer');
   *
   * console.log(task.id); // '123e4567-e89b-12d3-a456-426614174000' (auto-generated UUID)
   * console.log(task.status); // 'pending'
   * console.log(task.createdAt); // '2026-01-02T08:00:00.000Z'
   *
   * @example
   * // Create skill task with input values
   * const taskStorage = new TaskStorageService();
   *
   * const task = await taskStorage.createTask({
   *   name: 'Generate API documentation',
   *   description: 'Generate OpenAPI documentation for REST API',
   *   agentId: 'skill_api-docs',
   *   taskType: 'skill',
   *   userPrompt: 'Generate complete OpenAPI 3.0 documentation',
   *   inputValues: {
   *     apiPath: '/home/user/projects/my-app/src/api',
   *     outputFormat: 'yaml',
   *     includeExamples: true
   *   },
   *   permissionMode: 'default'
   * }, 'API Documentation Generator');
   *
   * console.log(task.inputValues); // { apiPath: '...', outputFormat: 'yaml', ... }
   *
   * @example
   * // Create task with bypass permission mode
   * const task = await taskStorage.createTask({
   *   name: 'Deploy to production',
   *   agentId: 'agent_devops',
   *   taskType: 'agent',
   *   userPrompt: 'Deploy latest build to production environment',
   *   permissionMode: 'bypass', // Auto-approve all tool use
   *   directory: '/home/user/projects/my-app'
   * }, 'DevOps Engineer');
   *
   * @example
   * // Create task with metadata for skill execution
   * const task = await taskStorage.createTask({
   *   name: 'Run code linter',
   *   agentId: 'skill_linter',
   *   taskType: 'skill',
   *   userPrompt: 'Lint all TypeScript files',
   *   directory: '/home/user/projects/my-app'
   * }, 'Code Linter');
   * // Metadata can be added later via updateTaskStatus
   *
   * @example
   * // Verify task file creation
   * const taskStorage = new TaskStorageService();
   * const task = await taskStorage.createTask({
   *   name: 'Test task',
   *   agentId: 'agent_test',
   *   userPrompt: 'Test prompt',
   *   permissionMode: 'default'
   * }, 'Test Agent');
   *
   * const fs = require('fs/promises');
   * const taskFile = `logs/${task.id}.json`;
   * const fileContent = await fs.readFile(taskFile, 'utf-8');
   * const savedTask = JSON.parse(fileContent);
   * console.log(savedTask.id === task.id); // true
   *
   * @see {@link CreateTaskRequest} for request parameters
   * @see {@link Task} for full task data structure
   * @see {@link updateTaskStatus} for updating task status and adding results
   */
  async createTask(request: CreateTaskRequest, agentName: string): Promise<Task> {
    await this.initialize();

    const task: Task = {
      id: randomUUID(),
      name: request.name,
      description: request.description,
      agentId: request.agentId,
      agentName,
      taskType: request.taskType || 'agent',
      status: 'pending',
      userPrompt: request.userPrompt,
      inputValues: request.inputValues,
      permissionMode: request.permissionMode || 'default',
      createdAt: new Date().toISOString(),
      directory: request.directory,
    };

    // Save task to individual file
    await this.saveTask(task);

    // Update index
    await this.updateIndex(task);

    this.logger.info('Task created', {
      taskId: task.id,
      taskName: task.name,
      taskType: task.taskType,
      logFile: this.getTaskFilePath(task.id)
    });

    return task;
  }

  /**
   * Retrieve all tasks with optional filtering, sorting, and pagination.
   *
   * @description
   * Retrieves tasks from storage using the index file for fast filtering, then loads
   * full task data only for the filtered results. Supports filtering by status and agentId,
   * with built-in pagination support.
   *
   * **Query Strategy:**
   * 1. Load lightweight index file (`_index.json`)
   * 2. Apply status filter to index (if provided)
   * 3. Apply pagination to filtered index (limit/offset)
   * 4. Load full task data only for paginated results
   * 5. Apply agentId filter to full task data (requires full task object)
   *
   * This two-phase approach minimizes file I/O by filtering at the index level first.
   *
   * **Default Behavior:**
   * - Returns all tasks if no filter provided
   * - Default limit: 100 tasks
   * - Default offset: 0
   * - Sorted by creation date (newest first) via index ordering
   *
   * **Performance:**
   * - Fast for status filtering (uses index)
   * - Slower for agentId filtering (requires loading full task files)
   * - Pagination reduces memory usage for large task lists
   *
   * @param filter - Optional filter criteria (status, agentId, limit, offset)
   * @returns Promise resolving to array of Task objects matching filter criteria
   *
   * @example
   * // Get all tasks (up to default limit of 100)
   * const taskStorage = new TaskStorageService();
   * const allTasks = await taskStorage.getTasks();
   * console.log(`Total tasks: ${allTasks.length}`);
   *
   * @example
   * // Get all pending tasks
   * const taskStorage = new TaskStorageService();
   * const pendingTasks = await taskStorage.getTasks({ status: 'pending' });
   * console.log(`Pending tasks: ${pendingTasks.length}`);
   * pendingTasks.forEach(task => {
   *   console.log(`- ${task.name} (${task.agentName})`);
   * });
   *
   * @example
   * // Get all running tasks
   * const runningTasks = await taskStorage.getTasks({ status: 'running' });
   * runningTasks.forEach(task => {
   *   const elapsed = Date.now() - new Date(task.startedAt!).getTime();
   *   console.log(`${task.name}: Running for ${elapsed}ms`);
   * });
   *
   * @example
   * // Get all completed tasks
   * const completedTasks = await taskStorage.getTasks({ status: 'completed' });
   * const avgDuration = completedTasks.reduce((sum, t) => sum + (t.duration || 0), 0) / completedTasks.length;
   * console.log(`Average completion time: ${avgDuration}ms`);
   *
   * @example
   * // Get all tasks for a specific agent
   * const agentTasks = await taskStorage.getTasks({ agentId: 'agent_123' });
   * console.log(`Agent 'agent_123' has ${agentTasks.length} tasks`);
   *
   * @example
   * // Pagination for task list UI
   * const taskStorage = new TaskStorageService();
   * const page = 2;
   * const pageSize = 20;
   *
   * const tasks = await taskStorage.getTasks({
   *   limit: pageSize,
   *   offset: (page - 1) * pageSize
   * });
   *
   * console.log(`Page ${page}: Showing ${tasks.length} tasks`);
   * tasks.forEach(task => {
   *   console.log(`${task.name} - ${task.status}`);
   * });
   *
   * @example
   * // Combined filtering - Pending tasks for specific agent
   * const agentPendingTasks = await taskStorage.getTasks({
   *   status: 'pending',
   *   agentId: 'agent_backend',
   *   limit: 10
   * });
   * console.log(`Agent has ${agentPendingTasks.length} pending tasks`);
   *
   * @example
   * // Task queue management
   * const taskStorage = new TaskStorageService();
   *
   * // Get next pending task to execute
   * const pendingTasks = await taskStorage.getTasks({
   *   status: 'pending',
   *   limit: 1
   * });
   *
   * if (pendingTasks.length > 0) {
   *   const nextTask = pendingTasks[0];
   *   console.log(`Next task: ${nextTask.name}`);
   *   await taskStorage.updateTaskStatus(nextTask.id, 'running');
   * }
   *
   * @example
   * // Empty result handling
   * const failedTasks = await taskStorage.getTasks({ status: 'failed' });
   * if (failedTasks.length === 0) {
   *   console.log('No failed tasks found');
   * } else {
   *   console.log(`Found ${failedTasks.length} failed tasks`);
   *   failedTasks.forEach(task => {
   *     console.error(`${task.name}: ${task.error}`);
   *   });
   * }
   *
   * @see {@link TaskFilter} for available filter options
   * @see {@link Task} for task data structure
   * @see {@link getStats} for task statistics without loading full data
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    await this.initialize();

    // Load index for fast filtering
    const index = await this.loadIndex();

    // Apply filters to index
    let filtered = [...index];

    if (filter?.status) {
      filtered = filtered.filter(t => t.status === filter.status);
    }
    // Apply pagination to index
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;
    const paginatedIndex = filtered.slice(offset, offset + limit);

    // Load full task data for paginated results
    const tasks = await Promise.all(
      paginatedIndex.map(t => this.loadTask(t.id))
    );

    const validTasks = tasks.filter((t): t is Task => t !== null);

    // Apply agentId filter if needed (requires full task data)
    if (filter?.agentId) {
      return validTasks.filter(t => t.agentId === filter.agentId);
    }

    return validTasks;
  }

  /**
   * Retrieve a single task by its unique identifier.
   *
   * @description
   * Loads full task data from individual task file. Returns null if task file
   * does not exist (task not found or deleted).
   *
   * **File Lookup:**
   * - Reads task file: `logs/{taskId}.json`
   * - Returns null if file not found (ENOENT error)
   * - Throws error for other read failures (permissions, corrupted file, etc.)
   *
   * **Use Cases:**
   * - Retrieve task details for display
   * - Check task status before updating
   * - Load task data for execution
   * - Verify task existence
   *
   * @param taskId - Unique task identifier (UUID)
   * @returns Promise resolving to Task object if found, null if not found
   *
   * @example
   * // Basic task retrieval
   * const taskStorage = new TaskStorageService();
   * const task = await taskStorage.getTask('123e4567-e89b-12d3-a456-426614174000');
   *
   * if (task) {
   *   console.log(`Task: ${task.name}`);
   *   console.log(`Status: ${task.status}`);
   *   console.log(`Agent: ${task.agentName}`);
   * } else {
   *   console.log('Task not found');
   * }
   *
   * @example
   * // Display task details
   * const task = await taskStorage.getTask(taskId);
   * if (task) {
   *   console.log(`Name: ${task.name}`);
   *   console.log(`Description: ${task.description}`);
   *   console.log(`Status: ${task.status}`);
   *   console.log(`Created: ${new Date(task.createdAt).toLocaleString()}`);
   *
   *   if (task.startedAt) {
   *     console.log(`Started: ${new Date(task.startedAt).toLocaleString()}`);
   *   }
   *
   *   if (task.completedAt) {
   *     console.log(`Completed: ${new Date(task.completedAt).toLocaleString()}`);
   *     console.log(`Duration: ${task.duration}ms`);
   *   }
   *
   *   if (task.result) {
   *     console.log(`Result: ${task.result}`);
   *   }
   *
   *   if (task.error) {
   *     console.error(`Error: ${task.error}`);
   *   }
   * }
   *
   * @example
   * // Check task status before execution
   * const task = await taskStorage.getTask(taskId);
   * if (!task) {
   *   throw new Error('Task not found');
   * }
   *
   * if (task.status !== 'pending') {
   *   throw new Error(`Task is already ${task.status}`);
   * }
   *
   * // Proceed with execution
   * await taskStorage.updateTaskStatus(taskId, 'running');
   *
   * @example
   * // Load task for result display
   * const task = await taskStorage.getTask(taskId);
   * if (task && task.status === 'completed') {
   *   console.log('=== Task Results ===');
   *   console.log(`Task: ${task.name}`);
   *   console.log(`Duration: ${task.duration}ms`);
   *   console.log(`Result:\n${task.result}`);
   *
   *   if (task.executionLog) {
   *     console.log('\n=== Execution Log ===');
   *     task.executionLog.forEach(entry => console.log(entry));
   *   }
   * }
   *
   * @example
   * // Verify task existence
   * const taskExists = await taskStorage.getTask(taskId) !== null;
   * if (taskExists) {
   *   console.log('Task exists');
   * } else {
   *   console.log('Task does not exist or was deleted');
   * }
   *
   * @example
   * // Load task with metadata
   * const task = await taskStorage.getTask(taskId);
   * if (task && task.metadata?.skillExecution) {
   *   const skillMeta = task.metadata.skillExecution;
   *   console.log(`Skill: ${skillMeta.selectedSkillName}`);
   *   console.log(`Isolation: ${skillMeta.isolationLevel}`);
   *   console.log(`System Prompt Source: ${skillMeta.systemPromptSource}`);
   * }
   *
   * @see {@link Task} for task data structure
   * @see {@link getTasks} for retrieving multiple tasks with filtering
   * @see {@link updateTaskStatus} for updating task status
   */
  async getTask(taskId: string): Promise<Task | null> {
    await this.initialize();
    return await this.loadTask(taskId);
  }

  /**
   * Update task status and optionally merge additional task data.
   *
   * @description
   * Updates task status with automatic timestamp management and lifecycle tracking.
   * Also supports merging additional task data (result, error, executionLog, metadata).
   *
   * **Automatic Timestamp Management:**
   * - **Running**: Sets `startedAt` timestamp on first transition to 'running' status
   * - **Completed/Failed**: Sets `completedAt` timestamp and calculates `duration` (ms)
   *
   * **Duration Calculation:**
   * - `duration = completedAt - startedAt` (in milliseconds)
   * - Only calculated if both timestamps exist
   *
   * **Task Lifecycle Workflow:**
   * 1. Load existing task from file
   * 2. Update status
   * 3. Set automatic timestamps based on new status
   * 4. Merge additional data (if provided)
   * 5. Save updated task to file
   * 6. Update index with new status and timestamps
   * 7. Log status change
   *
   * **Data Merge Behavior:**
   * - Uses Object.assign() for shallow merge
   * - Additional data overwrites existing fields
   * - Useful for adding result, error, executionLog, metadata
   *
   * @param taskId - Unique task identifier (UUID)
   * @param status - New task status ('pending' | 'running' | 'completed' | 'failed')
   * @param data - Optional additional task data to merge (result, error, executionLog, metadata, etc.)
   * @returns Promise resolving to updated Task object, or null if task not found
   *
   * @example
   * // Start task execution (pending → running)
   * const taskStorage = new TaskStorageService();
   *
   * const task = await taskStorage.updateTaskStatus(taskId, 'running');
   * console.log(task.status); // 'running'
   * console.log(task.startedAt); // '2026-01-02T08:00:00.000Z' (auto-set)
   *
   * @example
   * // Complete task with result (running → completed)
   * const taskStorage = new TaskStorageService();
   *
   * const task = await taskStorage.updateTaskStatus(taskId, 'completed', {
   *   result: 'Successfully implemented user authentication with JWT tokens and role-based access control',
   *   executionLog: [
   *     { timestamp: '2026-01-02T08:00:00.000Z', message: 'Started task execution' },
   *     { timestamp: '2026-01-02T08:02:30.000Z', message: 'Generated JWT secret key' },
   *     { timestamp: '2026-01-02T08:05:00.000Z', message: 'Implemented token refresh logic' },
   *     { timestamp: '2026-01-02T08:05:30.000Z', message: 'Task completed successfully' }
   *   ]
   * });
   *
   * console.log(task.status); // 'completed'
   * console.log(task.completedAt); // '2026-01-02T08:05:30.000Z' (auto-set)
   * console.log(task.duration); // 330000 (5 minutes 30 seconds in ms)
   * console.log(task.result); // 'Successfully implemented...'
   *
   * @example
   * // Fail task with error (running → failed)
   * const task = await taskStorage.updateTaskStatus(taskId, 'failed', {
   *   error: 'Failed to connect to database: ECONNREFUSED',
   *   executionLog: [
   *     { timestamp: '2026-01-02T08:00:00.000Z', message: 'Started task execution' },
   *     { timestamp: '2026-01-02T08:01:00.000Z', message: 'Attempting database connection' },
   *     { timestamp: '2026-01-02T08:01:30.000Z', message: 'Connection failed: ECONNREFUSED' }
   *   ]
   * });
   *
   * console.log(task.status); // 'failed'
   * console.log(task.error); // 'Failed to connect to database: ECONNREFUSED'
   * console.log(task.duration); // 90000 (1 minute 30 seconds in ms)
   *
   * @example
   * // Update task with metadata
   * const task = await taskStorage.updateTaskStatus(taskId, 'running', {
   *   metadata: {
   *     skillExecution: {
   *       selectedSkillId: 'skill_123',
   *       selectedSkillName: 'Code Linter',
   *       source: 'strapi',
   *       isolationLevel: 'full',
   *       systemPromptSource: 'skill.content',
   *       otherSkillsAccessible: false
   *     }
   *   }
   * });
   *
   * @example
   * // Update task with input values result
   * const task = await taskStorage.updateTaskStatus(taskId, 'completed', {
   *   result: 'Generated API documentation successfully',
   *   metadata: {
   *     outputFile: '/home/user/projects/my-app/docs/api.yaml',
   *     linesGenerated: 1200,
   *     endpointsDocumented: 45
   *   }
   * });
   *
   * @example
   * // Handle task not found
   * const task = await taskStorage.updateTaskStatus('invalid-task-id', 'completed');
   * if (!task) {
   *   console.error('Task not found');
   * }
   *
   * @example
   * // Task execution wrapper
   * async function executeTask(taskId: string, executeFn: () => Promise<string>) {
   *   const taskStorage = new TaskStorageService();
   *
   *   try {
   *     // Start execution
   *     await taskStorage.updateTaskStatus(taskId, 'running');
   *
   *     // Execute task
   *     const result = await executeFn();
   *
   *     // Mark as completed
   *     await taskStorage.updateTaskStatus(taskId, 'completed', { result });
   *   } catch (error) {
   *     // Mark as failed
   *     await taskStorage.updateTaskStatus(taskId, 'failed', {
   *       error: error.message
   *     });
   *   }
   * }
   *
   * @example
   * // Incremental status updates
   * const taskStorage = new TaskStorageService();
   *
   * // Start execution
   * await taskStorage.updateTaskStatus(taskId, 'running');
   *
   * // Add execution log entry during execution
   * await taskStorage.updateTaskStatus(taskId, 'running', {
   *   executionLog: [
   *     { timestamp: new Date().toISOString(), message: 'Checkpoint: 50% complete' }
   *   ]
   * });
   *
   * // Complete with final result
   * await taskStorage.updateTaskStatus(taskId, 'completed', {
   *   result: 'Task completed successfully',
   *   executionLog: [
   *     { timestamp: new Date().toISOString(), message: 'Checkpoint: 100% complete' }
   *   ]
   * });
   *
   * @see {@link Task} for task data structure
   * @see {@link TaskStatus} for available status values
   * @see {@link getTask} for retrieving task details
   */
  async updateTaskStatus(taskId: string, status: TaskStatus, data?: Partial<Task>): Promise<Task | null> {
    await this.initialize();

    const task = await this.loadTask(taskId);
    if (!task) return null;

    task.status = status;

    // Update timestamps
    if (status === 'running' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }
    if ((status === 'completed' || status === 'failed') && !task.completedAt) {
      task.completedAt = new Date().toISOString();
      if (task.startedAt) {
        task.duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      }
    }

    // Apply additional data
    if (data) {
      Object.assign(task, data);
    }

    // Save updated task to file
    await this.saveTask(task);

    // Update index
    await this.updateIndex(task);

    this.logger.info('Task status updated', {
      taskId,
      status,
      logFile: this.getTaskFilePath(taskId)
    });

    return task;
  }

  /**
   * Permanently delete task from storage.
   *
   * @description
   * Removes task file and index entry. This operation is irreversible - once deleted,
   * the task cannot be recovered.
   *
   * **Deletion Workflow:**
   * 1. Initialize storage if not already initialized
   * 2. Load task to verify existence
   * 3. Delete task file from `logs/{taskId}.json`
   * 4. Remove task entry from index file
   * 5. Save updated index
   * 6. Log deletion
   *
   * **File Operations:**
   * - Deletes: `logs/{taskId}.json`
   * - Updates: `logs/_index.json` (removes entry)
   *
   * **Error Handling:**
   * - Returns false if task not found (no task file exists)
   * - Gracefully handles ENOENT errors (file already deleted)
   * - Throws error for other file system failures (permissions, etc.)
   *
   * **Important Notes:**
   * - **IRREVERSIBLE**: Deleted tasks cannot be recovered
   * - Consider archiving instead of deleting for audit trail
   * - Use with caution in production environments
   *
   * @param taskId - Unique task identifier (UUID) of task to delete
   * @returns Promise resolving to true if task was deleted, false if task not found
   *
   * @example
   * // Basic task deletion
   * const taskStorage = new TaskStorageService();
   *
   * const deleted = await taskStorage.deleteTask('123e4567-e89b-12d3-a456-426614174000');
   * if (deleted) {
   *   console.log('Task deleted successfully');
   * } else {
   *   console.log('Task not found');
   * }
   *
   * @example
   * // Safe deletion with confirmation
   * const taskStorage = new TaskStorageService();
   *
   * // Load task first to show details
   * const task = await taskStorage.getTask(taskId);
   * if (!task) {
   *   console.error('Task not found');
   *   return;
   * }
   *
   * // Confirm deletion
   * console.log(`About to delete task: ${task.name}`);
   * const confirmed = await getUserConfirmation('Are you sure? This cannot be undone.');
   *
   * if (confirmed) {
   *   await taskStorage.deleteTask(taskId);
   *   console.log('Task deleted successfully');
   * }
   *
   * @example
   * // Clean up completed tasks older than 30 days
   * const taskStorage = new TaskStorageService();
   *
   * const completedTasks = await taskStorage.getTasks({ status: 'completed' });
   * const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
   *
   * for (const task of completedTasks) {
   *   const completedDate = new Date(task.completedAt!).getTime();
   *   if (completedDate < thirtyDaysAgo) {
   *     await taskStorage.deleteTask(task.id);
   *     console.log(`Deleted old task: ${task.name}`);
   *   }
   * }
   *
   * @example
   * // Delete failed tasks with cleanup logging
   * const taskStorage = new TaskStorageService();
   *
   * const failedTasks = await taskStorage.getTasks({ status: 'failed' });
   * console.log(`Found ${failedTasks.length} failed tasks to delete`);
   *
   * for (const task of failedTasks) {
   *   const deleted = await taskStorage.deleteTask(task.id);
   *   if (deleted) {
   *     console.log(`Deleted: ${task.name} (Error: ${task.error})`);
   *   }
   * }
   *
   * @example
   * // Bulk delete with error handling
   * async function bulkDeleteTasks(taskIds: string[]) {
   *   const taskStorage = new TaskStorageService();
   *   const results = { deleted: 0, notFound: 0, errors: 0 };
   *
   *   for (const taskId of taskIds) {
   *     try {
   *       const deleted = await taskStorage.deleteTask(taskId);
   *       if (deleted) {
   *         results.deleted++;
   *       } else {
   *         results.notFound++;
   *       }
   *     } catch (error) {
   *       results.errors++;
   *       console.error(`Error deleting task ${taskId}:`, error);
   *     }
   *   }
   *
   *   return results;
   * }
   *
   * @example
   * // Alternative: Archive instead of delete (preserves audit trail)
   * // Note: TaskStorageService doesn't have archive functionality,
   * // but you could implement it by adding an 'archived' field
   * const task = await taskStorage.getTask(taskId);
   * if (task) {
   *   // Instead of deleting, mark as archived
   *   await taskStorage.updateTaskStatus(taskId, task.status, {
   *     metadata: {
   *       ...task.metadata,
   *       archived: true,
   *       archivedAt: new Date().toISOString()
   *     }
   *   });
   * }
   * // Then filter out archived tasks in getTasks() results
   *
   * @example
   * // Handle deletion errors
   * const taskStorage = new TaskStorageService();
   *
   * try {
   *   const deleted = await taskStorage.deleteTask(taskId);
   *   if (deleted) {
   *     console.log('Task deleted successfully');
   *   } else {
   *     console.log('Task not found or already deleted');
   *   }
   * } catch (error) {
   *   console.error('Failed to delete task:', error.message);
   *   // Handle permission errors, disk full, etc.
   * }
   *
   * @see {@link Task} for task data structure
   * @see {@link getTask} for retrieving task before deletion
   * @see {@link getTasks} for bulk operations
   */
  async deleteTask(taskId: string): Promise<boolean> {
    await this.initialize();

    const task = await this.loadTask(taskId);
    if (!task) return false;

    // Delete task file
    try {
      const filePath = this.getTaskFilePath(taskId);
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Update index
    const index = await this.loadIndex();
    const filteredIndex = index.filter(t => t.id !== taskId);
    await this.saveIndex(filteredIndex);

    this.logger.info('Task deleted', { taskId });
    return true;
  }

  /**
   * Retrieve task statistics without loading full task data.
   *
   * @description
   * Returns task counts by status using the lightweight index file for fast aggregation.
   * Does not load full task files, making it efficient for large task lists.
   *
   * **Performance:**
   * - Fast: Only reads index file (lightweight summaries)
   * - No full task file loading
   * - O(n) where n = number of tasks in index
   *
   * **Use Cases:**
   * - Dashboard statistics display
   * - Task queue monitoring
   * - System health checks
   * - Task management UI badges
   *
   * @returns Promise resolving to statistics object with counts by status
   *
   * @example
   * // Basic statistics
   * const taskStorage = new TaskStorageService();
   * const stats = await taskStorage.getStats();
   *
   * console.log(`Total: ${stats.total}`);
   * console.log(`Pending: ${stats.pending}`);
   * console.log(`Running: ${stats.running}`);
   * console.log(`Completed: ${stats.completed}`);
   * console.log(`Failed: ${stats.failed}`);
   *
   * @example
   * // Dashboard statistics display
   * const taskStorage = new TaskStorageService();
   * const stats = await taskStorage.getStats();
   *
   * console.log('=== Task Statistics ===');
   * console.log(`Total Tasks: ${stats.total}`);
   * console.log(`Pending: ${stats.pending} (${(stats.pending / stats.total * 100).toFixed(1)}%)`);
   * console.log(`Running: ${stats.running} (${(stats.running / stats.total * 100).toFixed(1)}%)`);
   * console.log(`Completed: ${stats.completed} (${(stats.completed / stats.total * 100).toFixed(1)}%)`);
   * console.log(`Failed: ${stats.failed} (${(stats.failed / stats.total * 100).toFixed(1)}%)`);
   *
   * @example
   * // Task queue monitoring
   * const taskStorage = new TaskStorageService();
   *
   * setInterval(async () => {
   *   const stats = await taskStorage.getStats();
   *   console.log(`Queue: ${stats.pending} pending, ${stats.running} running`);
   *
   *   if (stats.running > 10) {
   *     console.warn('High number of running tasks detected');
   *   }
   * }, 5000); // Check every 5 seconds
   *
   * @example
   * // System health check
   * async function checkTaskHealth() {
   *   const taskStorage = new TaskStorageService();
   *   const stats = await taskStorage.getStats();
   *
   *   const healthStatus = {
   *     healthy: true,
   *     warnings: [] as string[]
   *   };
   *
   *   if (stats.failed > stats.completed * 0.1) {
   *     healthStatus.healthy = false;
   *     healthStatus.warnings.push('High failure rate (>10%)');
   *   }
   *
   *   if (stats.pending > 100) {
   *     healthStatus.warnings.push('Large pending queue (>100 tasks)');
   *   }
   *
   *   return healthStatus;
   * }
   *
   * @example
   * // Task management UI badges
   * const stats = await taskStorage.getStats();
   *
   * // Display badges in UI
   * const badges = [
   *   { label: 'Pending', count: stats.pending, color: 'blue' },
   *   { label: 'Running', count: stats.running, color: 'yellow' },
   *   { label: 'Completed', count: stats.completed, color: 'green' },
   *   { label: 'Failed', count: stats.failed, color: 'red' }
   * ];
   *
   * @example
   * // Empty storage handling
   * const stats = await taskStorage.getStats();
   * if (stats.total === 0) {
   *   console.log('No tasks in storage');
   * }
   *
   * @see {@link getTasks} for retrieving full task data with filtering
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    await this.initialize();

    const index = await this.loadIndex();

    return {
      total: index.length,
      pending: index.filter(t => t.status === 'pending').length,
      running: index.filter(t => t.status === 'running').length,
      completed: index.filter(t => t.status === 'completed').length,
      failed: index.filter(t => t.status === 'failed').length,
    };
  }

  /**
   * Rebuild index file from all task files in storage directory.
   *
   * @description
   * Scans logs directory for all task JSON files, loads them, and regenerates the index file.
   * Useful for recovering from index corruption, migrating data, or fixing inconsistencies
   * between task files and index.
   *
   * **Rebuild Workflow:**
   * 1. Initialize storage if not already initialized
   * 2. Read all .json files from logs directory (excluding _index.json)
   * 3. Load full task data from each task file
   * 4. Sort tasks by creation date (newest first)
   * 5. Build new index with task summaries
   * 6. Save new index file (overwrites existing index)
   * 7. Log rebuild completion with task count
   *
   * **When to Use:**
   * - Index file corrupted or deleted
   * - Inconsistency between task files and index
   * - After manual file operations (copying, restoring from backup)
   * - Data migration from another system
   * - Development/testing cleanup
   *
   * **Performance:**
   * - Reads all task files in directory (can be slow for large task lists)
   * - Time complexity: O(n log n) where n = number of task files (due to sorting)
   * - Safe operation: Only rebuilds index, does not modify task files
   *
   * **Important Notes:**
   * - **Overwrites existing index**: Current index file is replaced
   * - **Safe operation**: Does not modify task files, only regenerates index
   * - **Idempotent**: Can be run multiple times safely
   * - Automatically filters out invalid/corrupted task files
   *
   * @returns Promise that resolves when index rebuild is complete
   *
   * @example
   * // Basic index rebuild
   * const taskStorage = new TaskStorageService();
   * await taskStorage.rebuildIndex();
   * console.log('Index rebuilt successfully');
   *
   * @example
   * // Recover from corrupted index
   * const taskStorage = new TaskStorageService();
   *
   * try {
   *   // Try to load tasks (might fail if index is corrupted)
   *   await taskStorage.getTasks();
   * } catch (error) {
   *   console.error('Index corrupted, rebuilding...');
   *   await taskStorage.rebuildIndex();
   *   console.log('Index rebuilt successfully');
   *
   *   // Retry loading tasks
   *   const tasks = await taskStorage.getTasks();
   *   console.log(`Loaded ${tasks.length} tasks`);
   * }
   *
   * @example
   * // Migration workflow
   * const taskStorage = new TaskStorageService();
   *
   * console.log('Starting data migration...');
   *
   * // 1. Copy task files from old location
   * // (external script copies files to logs/)
   *
   * // 2. Rebuild index from copied files
   * await taskStorage.rebuildIndex();
   *
   * // 3. Verify migration
   * const stats = await taskStorage.getStats();
   * console.log(`Migration complete: ${stats.total} tasks imported`);
   *
   * @example
   * // Fix inconsistency between task files and index
   * const taskStorage = new TaskStorageService();
   *
   * // Rebuild index to match actual task files
   * console.log('Checking for inconsistencies...');
   * await taskStorage.rebuildIndex();
   *
   * // Verify consistency
   * const stats = await taskStorage.getStats();
   * const tasks = await taskStorage.getTasks();
   * console.log(`Index: ${stats.total} tasks, Files: ${tasks.length} tasks`);
   *
   * @example
   * // Development/testing cleanup
   * const taskStorage = new TaskStorageService();
   *
   * // After manual file manipulation in logs/ directory
   * await taskStorage.rebuildIndex();
   * console.log('Index synchronized with task files');
   *
   * @example
   * // Scheduled maintenance job
   * async function scheduledIndexMaintenance() {
   *   const taskStorage = new TaskStorageService();
   *
   *   console.log('Running scheduled index rebuild...');
   *   const startTime = Date.now();
   *
   *   await taskStorage.rebuildIndex();
   *
   *   const duration = Date.now() - startTime;
   *   const stats = await taskStorage.getStats();
   *   console.log(`Index rebuilt in ${duration}ms (${stats.total} tasks)`);
   * }
   *
   * // Run daily at 3 AM
   * cron.schedule('0 3 * * *', scheduledIndexMaintenance);
   *
   * @example
   * // Backup restoration workflow
   * const taskStorage = new TaskStorageService();
   *
   * // 1. Restore task files from backup
   * console.log('Restoring task files from backup...');
   * // (external script restores files)
   *
   * // 2. Rebuild index from restored files
   * console.log('Rebuilding index from restored files...');
   * await taskStorage.rebuildIndex();
   *
   * // 3. Verify restoration
   * const stats = await taskStorage.getStats();
   * console.log(`Restoration complete: ${stats.total} tasks restored`);
   *
   * @see {@link initialize} for initial index creation
   * @see {@link getStats} for verifying index consistency
   */
  async rebuildIndex(): Promise<void> {
    await this.initialize();

    this.logger.info('Rebuilding index from task files...');

    // Get all .json files except _index.json
    const files = await fs.readdir(this.logsDir);
    const taskFiles = files.filter(f => f.endsWith('.json') && f !== '_index.json');

    // Load all tasks
    const tasks: Task[] = [];
    for (const file of taskFiles) {
      const taskId = file.replace('.json', '');
      const task = await this.loadTask(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    // Sort by creation date (newest first)
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Build new index
    const newIndex = tasks.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      taskType: t.taskType,
      agentName: t.agentName,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    }));

    await this.saveIndex(newIndex);

    this.logger.info('Index rebuilt successfully', { taskCount: newIndex.length });
  }
}
