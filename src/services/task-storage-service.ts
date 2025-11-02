import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createLogger, type Logger } from './logger.js';
import type { Task, CreateTaskRequest, TaskFilter, TaskStatus } from '../types/task-types.js';

/**
 * Service for managing task storage
 * Each task is stored as a separate JSON file in logs/{task-id}.json
 * Also maintains an index file for fast listing
 */
export class TaskStorageService {
  private logger: Logger;
  private logsDir: string;
  private indexFilePath: string;
  private initialized = false;

  constructor(logsDir?: string) {
    this.logger = createLogger('TaskStorageService');

    // Use logs directory in project root
    this.logsDir = logsDir || path.join(process.cwd(), 'logs');
    this.indexFilePath = path.join(this.logsDir, '_index.json');
  }

  /**
   * Initialize storage (create logs directory if needed)
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
   * Create a new task
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
   * Get all tasks with optional filtering
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
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    await this.initialize();
    return await this.loadTask(taskId);
  }

  /**
   * Update task status
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
   * Delete task
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
   * Get task statistics
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
   * Rebuild index from all task files
   * Useful for recovery or migration
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
