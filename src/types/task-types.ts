/**
 * Task execution status
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Task execution type
 * - 'skill': Single skill execution (forced) - user pre-selects specific skill
 * - 'agent': Multi-skill agent (autonomous) - Claude chooses best skill
 */
export type TaskType = 'agent' | 'skill';

/**
 * Execution mode enumeration
 * - 'forced': Execute ONLY the pre-selected skill (no other skills visible)
 * - 'autonomous': Claude scans available skills and chooses the best one
 */
export type ExecutionMode = 'forced' | 'autonomous';

/**
 * Skill execution metadata for forced execution mode
 */
export interface SkillExecutionMetadata {
  /** Selected skill ID */
  selectedSkillId: string;

  /** Selected skill name */
  selectedSkillName: string;

  /** Source of skill (strapi, filesystem, etc.) */
  source: string;

  /** Isolation level */
  isolationLevel: 'full' | 'partial' | 'none';

  /** System prompt source */
  systemPromptSource: 'skill.content' | 'agent.systemPrompt';

  /** Whether other skills are accessible */
  otherSkillsAccessible: boolean;
}

/**
 * Task execution record
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  agentId: string; // Can be agent ID or skill ID
  agentName: string; // Can be agent name or skill name
  taskType: TaskType; // Type of task (agent or skill)
  executionMode?: ExecutionMode; // Execution mode (forced or autonomous)
  status: TaskStatus;
  userPrompt: string;
  inputValues?: Record<string, any>; // For agent input fields or skill parameters
  permissionMode: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // milliseconds
  result?: string;
  error?: string;
  executionLog?: any[];
  directory?: string;
  metadata?: {
    skillExecution?: SkillExecutionMetadata;
    [key: string]: any;
  };
}

/**
 * Task creation request
 */
export interface CreateTaskRequest {
  name: string;
  description?: string;
  agentId: string; // Can be agent ID or skill ID
  taskType?: TaskType; // Type of task (defaults to 'agent' for backward compatibility)
  userPrompt: string;
  inputValues?: Record<string, any>; // For agent input fields or skill parameters
  permissionMode?: string;
  directory?: string;
}

/**
 * Task filter options
 */
export interface TaskFilter {
  status?: TaskStatus;
  agentId?: string;
  limit?: number;
  offset?: number;
}
