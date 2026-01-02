import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { createLogger, type Logger } from './logger.js';

/**
 * Represents a parsed slash command from .claude/commands/
 */
export interface SlashCommand {
  id: string;
  name: string;
  description?: string;
  path: string;
  relativePath: string;
  content: string;
  metadata?: {
    allowedTools?: string[];
    argumentHint?: string;
    model?: string;
    disableModelInvocation?: boolean;
  };
  category?: string; // Extracted from subdirectory structure
}

/**
 * Training record for skill execution analysis
 *
 * @description
 * Represents a single training session record in a skill's training history.
 * Each record captures the performance metrics before and after a training execution,
 * along with issues identified and whether corrections were successfully applied.
 *
 * **Used in:**
 * - Skill interface's `trainingHistory` array field
 * - SKILL.md YAML frontmatter `training_history` field
 * - Skill performance tracking and improvement workflows
 *
 * @example
 * // Example training record from SKILL.md frontmatter
 * const trainingRecord: TrainingRecord = {
 *   date: '2024-01-15T10:30:00Z',
 *   scoreBefore: 75,
 *   scoreAfter: 85,
 *   issuesFound: [
 *     'Missing error handling in validation step',
 *     'Inconsistent file path handling'
 *   ],
 *   correctionsMade: true,
 *   executionSuccess: true
 * };
 *
 * @example
 * // Failed training session
 * const failedTraining: TrainingRecord = {
 *   date: '2024-01-16T14:20:00Z',
 *   scoreBefore: 85,
 *   scoreAfter: 85, // No improvement due to failure
 *   issuesFound: [
 *     'Timeout during skill execution',
 *     'MCP server connection failed'
 *   ],
 *   correctionsMade: false,
 *   executionSuccess: false
 * };
 */
export interface TrainingRecord {
  /** ISO 8601 timestamp of training session (e.g., '2024-01-15T10:30:00Z') */
  date: string;
  /** Skill experience score before training (0-100) */
  scoreBefore: number;
  /** Skill experience score after training (0-100) */
  scoreAfter: number;
  /** List of issues identified during training execution */
  issuesFound: string[];
  /** Whether corrections were successfully applied to the skill */
  correctionsMade: boolean;
  /** Whether the training execution completed successfully */
  executionSuccess: boolean;
}

/**
 * Represents a parsed skill from .claude/skills/
 *
 * @description
 * Represents a skill parsed from the `.claude/skills/` directory structure.
 * Each skill is a specialized capability that can be invoked by Claude agents during task execution.
 * Skills are discovered by the Claude Agent SDK via the `settingSources: ['project']` configuration.
 *
 * **Directory Structure:**
 * ```
 * .claude/skills/
 * └── {skill-name}/
 *     ├── SKILL.md              # Required: Skill definition with YAML frontmatter
 *     ├── skill.config.json     # Optional: Input field definitions
 *     ├── reference.md          # Optional: Reference documentation
 *     ├── examples.md           # Optional: Usage examples
 *     ├── scripts/              # Optional: Helper scripts
 *     └── templates/            # Optional: Template files
 * ```
 *
 * **SKILL.md YAML Frontmatter Format:**
 * ```yaml
 * ---
 * name: skill-name
 * description: "Use when you need to..."
 * allowed-tools:
 *   - Tool1
 *   - Tool2
 * mcp_tools:
 *   server-id:
 *     - tool1
 *     - tool2
 * experience_score: 85
 * training_history:
 *   - date: '2024-01-15T10:30:00Z'
 *     scoreBefore: 75
 *     scoreAfter: 85
 *     issuesFound: ['Missing error handling']
 *     correctionsMade: true
 *     executionSuccess: true
 * ---
 *
 * # Skill Content (Markdown)
 * Detailed skill instructions and usage guidelines...
 * ```
 *
 * @example
 * // Parse all skills from project
 * const parser = new ClaudeStructureParser();
 * const skills = await parser.parseSkills('/path/to/project');
 *
 * console.log(`Found ${skills.length} skills`);
 * skills.forEach(skill => {
 *   console.log(`- ${skill.name}: ${skill.description}`);
 *   console.log(`  Allowed Tools: ${skill.metadata?.allowedTools?.join(', ') || 'none'}`);
 *   console.log(`  Experience: ${skill.experienceScore || 0}/100`);
 * });
 *
 * @example
 * // Access skill metadata and supporting files
 * const skill = skills.find(s => s.id === 'data-analysis');
 * if (skill) {
 *   // Check tool configuration
 *   console.log('Allowed Tools:', skill.metadata?.allowedTools);
 *   console.log('MCP Tools:', skill.metadata?.mcpTools);
 *
 *   // Access supporting files
 *   if (skill.supportingFiles?.reference) {
 *     console.log('Reference Documentation:', skill.supportingFiles.reference);
 *   }
 *
 *   // Check input field requirements
 *   if (skill.metadata?.inputFields) {
 *     console.log('Input Fields:', skill.metadata.inputFields.map(f => f.name));
 *   }
 * }
 *
 * @example
 * // Check skill usage and training history
 * const popularSkills = skills
 *   .filter(s => (s.usageCount || 0) > 0)
 *   .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
 *
 * popularSkills.forEach(skill => {
 *   console.log(`${skill.name} (used by ${skill.usageCount} agents)`);
 *   console.log(`  Experience: ${skill.experienceScore}/100`);
 *   console.log(`  Training Sessions: ${skill.trainingHistory?.length || 0}`);
 * });
 *
 * @see ClaudeStructureParser.parseSkills - Parses all skills from .claude/skills/
 * @see ClaudeStructureParser.parseSkill - Parses a single skill directory
 * @see InputField - Input field definitions from skill.config.json
 * @see TrainingRecord - Training history records from YAML frontmatter
 */
export interface Skill {
  /** Unique identifier (skill directory name, e.g., 'data-analysis') */
  id: string;
  /** Human-readable skill name from YAML frontmatter */
  name: string;
  /** Skill description explaining when to use this skill (must include "Use when") */
  description: string;
  /** Absolute path to skill directory (e.g., '/project/.claude/skills/data-analysis') */
  path: string;
  /** Absolute path to SKILL.md file */
  skillMdPath: string;
  /** Markdown content from SKILL.md body (excluding YAML frontmatter) */
  content: string;
  /** Skill configuration from YAML frontmatter */
  metadata?: {
    /** List of allowed tool names (e.g., ['Read', 'Write', 'Bash']) */
    allowedTools?: string[];
    /** MCP server tools organized by server ID (e.g., { 'github': ['create_issue', 'search_repos'] }) */
    mcpTools?: Record<string, string[]>;
    /** Input field definitions from skill.config.json inputs array */
    inputFields?: InputField[];
  };
  /** Supporting files found in skill directory */
  supportingFiles?: {
    /** Content of reference.md file */
    reference?: string;
    /** Content of examples.md file */
    examples?: string;
    /** List of script filenames in scripts/ directory */
    scripts?: string[];
    /** List of template filenames in templates/ directory */
    templates?: string[];
  };
  /** List of agent IDs that reference this skill (populated by external analysis) */
  usedInAgents?: string[];
  /** Number of agents using this skill (populated by external analysis) */
  usageCount?: number;
  /** Skill proficiency score (0-100) from YAML frontmatter experience_score */
  experienceScore?: number;
  /** Training session history from YAML frontmatter training_history */
  trainingHistory?: TrainingRecord[];
}

/**
 * Input field definition for agent and skill execution
 *
 * @description
 * Defines a single input parameter that users can configure when executing an agent or skill.
 * Input fields are displayed in the UI as form controls, allowing users to provide custom
 * values that are injected into the agent/skill prompt or configuration before execution.
 *
 * **Supported Field Types:**
 * - `text`: Single-line text input
 * - `textarea`: Multi-line text input
 * - `dropdown`: Single-select dropdown menu (requires `options` array)
 * - `multiselect`: Multi-select checkbox list (requires `options` array)
 * - `checkbox`: Boolean toggle (true/false)
 * - `number`: Numeric input with validation
 * - `filepath`: File path input with file picker integration
 *
 * **Used in:**
 * - Agent interface's `metadata.inputFields` array (from YAML frontmatter `input_fields` or `input-fields`)
 * - Skill interface's `metadata.inputFields` array (from skill.config.json `inputs` array)
 * - UI form rendering for parameterized agent/skill execution
 * - Template parameter injection (e.g., {{param_name}} syntax)
 *
 * @example
 * // Basic text input field
 * const textField: InputField = {
 *   name: 'project_name',
 *   type: 'text',
 *   label: 'Project Name',
 *   description: 'The name of your project',
 *   placeholder: 'my-awesome-project',
 *   required: true
 * };
 *
 * @example
 * // Dropdown field with options
 * const dropdownField: InputField = {
 *   name: 'environment',
 *   type: 'dropdown',
 *   label: 'Environment',
 *   description: 'Target deployment environment',
 *   required: true,
 *   options: ['development', 'staging', 'production'],
 *   default: 'development'
 * };
 *
 * @example
 * // Multiselect field for features
 * const multiselectField: InputField = {
 *   name: 'features',
 *   type: 'multiselect',
 *   label: 'Features',
 *   description: 'Select features to enable',
 *   options: ['authentication', 'database', 'api', 'logging'],
 *   default: ['authentication', 'logging']
 * };
 *
 * @example
 * // Checkbox for boolean toggle
 * const checkboxField: InputField = {
 *   name: 'include_tests',
 *   type: 'checkbox',
 *   label: 'Include Tests',
 *   description: 'Generate test files for the project',
 *   default: true
 * };
 *
 * @example
 * // Number field with validation
 * const numberField: InputField = {
 *   name: 'max_retries',
 *   type: 'number',
 *   label: 'Max Retries',
 *   description: 'Maximum number of retry attempts',
 *   placeholder: '3',
 *   required: false,
 *   default: 3
 * };
 *
 * @example
 * // Filepath field for file selection
 * const filepathField: InputField = {
 *   name: 'config_file',
 *   type: 'filepath',
 *   label: 'Config File',
 *   description: 'Path to configuration file',
 *   placeholder: '/path/to/config.json',
 *   required: true
 * };
 *
 * @see Skill - Uses inputFields for skill.config.json inputs
 * @see Agent - Uses inputFields for agent YAML frontmatter input_fields
 */
export interface InputField {
  /** Unique identifier for the field (used in template injection as {{name}}) */
  name: string;
  /** Input field type determining UI rendering and validation */
  type: 'text' | 'textarea' | 'dropdown' | 'multiselect' | 'checkbox' | 'number' | 'filepath';
  /** Human-readable label displayed in UI form */
  label: string;
  /** Optional help text explaining the field's purpose */
  description?: string;
  /** Placeholder text shown in empty input fields */
  placeholder?: string;
  /** Whether the field must be filled before execution */
  required?: boolean;
  /** Available options for dropdown and multiselect types */
  options?: string[];
  /** Default value used if user doesn't provide input */
  default?: any;
}

/**
 * Represents a parsed agent from .claude/agents/
 *
 * @description
 * Represents an agent parsed from the `.claude/agents/` directory.
 * Each agent is a specialized AI assistant with a custom system prompt, tool access,
 * and skill capabilities. Agents are discovered by the Claude Agent SDK and can be
 * selected by users for conversation sessions.
 *
 * **File Structure:**
 * ```
 * .claude/agents/
 * └── {agent-name}.md
 * ```
 *
 * **Agent YAML Frontmatter Format:**
 * ```yaml
 * ---
 * name: Code Assistant
 * description: Helps with coding tasks
 * model: sonnet
 * tools:
 *   - Read
 *   - Write
 *   - Bash
 * allowed-tools:
 *   - Read
 *   - Write
 * mcp-tools:
 *   github:
 *     - create_issue
 *     - search_repos
 * skills:
 *   - data-analysis
 *   - code-review
 * input-fields:
 *   - name: project_type
 *     type: dropdown
 *     label: Project Type
 *     options:
 *       - web
 *       - mobile
 *       - backend
 *     required: true
 * output-schema:
 *   type: object
 *   properties:
 *     summary: { type: string }
 *     recommendations: { type: array, items: { type: string } }
 * ---
 *
 * # Agent System Prompt (Markdown)
 * You are a helpful coding assistant...
 * ```
 *
 * @example
 * // Parse all agents from project
 * const parser = new ClaudeStructureParser();
 * const agents = await parser.parseAgents('/path/to/project');
 *
 * console.log(`Found ${agents.length} agents`);
 * agents.forEach(agent => {
 *   console.log(`- ${agent.name}: ${agent.description}`);
 *   console.log(`  Model: ${agent.metadata?.model || 'default'}`);
 *   console.log(`  Skills: ${agent.metadata?.skills?.join(', ') || 'none'}`);
 * });
 *
 * @example
 * // Access agent metadata and configuration
 * const agent = agents.find(a => a.id === 'code-assistant');
 * if (agent) {
 *   // Check tool configuration
 *   console.log('Allowed Tools:', agent.metadata?.allowedTools);
 *   console.log('MCP Tools:', agent.metadata?.mcpTools);
 *
 *   // Check model preference
 *   console.log('Model:', agent.metadata?.model); // 'sonnet', 'opus', 'haiku'
 *
 *   // Check input field requirements
 *   if (agent.metadata?.inputFields) {
 *     console.log('Input Fields:', agent.metadata.inputFields.map(f => f.name));
 *   }
 *
 *   // Check output schema
 *   if (agent.metadata?.outputSchema) {
 *     console.log('Output Schema:', agent.metadata.outputSchema);
 *   }
 *
 *   // Check skill assignments
 *   if (agent.metadata?.skills) {
 *     console.log('Assigned Skills:', agent.metadata.skills);
 *   }
 * }
 *
 * @example
 * // Filter agents by capabilities
 * const agentsWithSkills = agents.filter(a =>
 *   a.metadata?.skills && a.metadata.skills.length > 0
 * );
 *
 * const mcpEnabledAgents = agents.filter(a =>
 *   a.metadata?.mcpTools && Object.keys(a.metadata.mcpTools).length > 0
 * );
 *
 * console.log(`Agents with skills: ${agentsWithSkills.length}`);
 * console.log(`MCP-enabled agents: ${mcpEnabledAgents.length}`);
 *
 * @see ClaudeStructureParser.parseAgents - Parses all agents from .claude/agents/
 * @see ClaudeStructureParser.parseAgent - Parses a single agent file
 * @see InputField - Input field definitions from YAML frontmatter input_fields
 * @see Skill - Skills that agents can reference via metadata.skills
 */
export interface Agent {
  /** Unique identifier (filename without .md extension, e.g., 'code-assistant') */
  id: string;
  /** Human-readable agent name from YAML frontmatter */
  name: string;
  /** Agent description explaining the agent's purpose and capabilities */
  description: string;
  /** Absolute path to agent markdown file (e.g., '/project/.claude/agents/code-assistant.md') */
  path: string;
  /** Markdown content (system prompt) from agent file body (excluding YAML frontmatter) */
  content: string;
  /** Agent configuration from YAML frontmatter */
  metadata?: {
    /** List of tool names the agent can use (e.g., ['Read', 'Write', 'Bash']) */
    tools?: string[];
    /** List of allowed tool names (restricts tools further, subset of tools) */
    allowedTools?: string[];
    /** Preferred Claude model ('sonnet', 'opus', 'haiku') */
    model?: string;
    /** Input field definitions from YAML frontmatter input_fields or input-fields */
    inputFields?: InputField[];
    /** Output schema for structured responses (JSON Schema as object or JSON string) */
    outputSchema?: string | object;
    /** MCP server tools organized by server ID (e.g., { 'github': ['create_issue'] }) */
    mcpTools?: Record<string, string[]>;
    /** List of skill IDs that this agent can invoke (e.g., ['data-analysis', 'code-review']) */
    skills?: string[];
  };
}

/**
 * ClaudeStructureParser - Service for parsing Claude Code's .claude folder structure
 *
 * @description
 * Parses the `.claude` directory structure to extract slash commands, skills, and agents
 * from a Claude Code project. This service enables discovery and analysis of project-level
 * Claude configurations, including agent definitions, skill libraries, and custom commands.
 *
 * **Parsed Directory Structure:**
 * ```
 * .claude/
 * ├── commands/           # Slash commands (*.md files with YAML frontmatter)
 * │   ├── command1.md
 * │   └── subdir/
 * │       └── command2.md
 * ├── skills/             # Skills (directories with SKILL.md files)
 * │   ├── skill-name/
 * │   │   ├── SKILL.md
 * │   │   ├── skill.config.json
 * │   │   ├── reference.md
 * │   │   └── examples.md
 * │   └── another-skill/
 * │       └── SKILL.md
 * └── agents/             # Agents (*.md files with YAML frontmatter)
 *     ├── agent1.md
 *     └── agent2.md
 * ```
 *
 * **Key Features:**
 * - YAML frontmatter parsing using js-yaml library
 * - Recursive directory scanning for commands and skills
 * - Input field extraction from skill.config.json files
 * - Supporting file discovery (reference.md, examples.md, scripts/, templates/)
 * - Training history and experience score parsing from SKILL.md
 * - MCP tools configuration parsing for agents and skills
 * - Tool configuration parsing (allowed-tools, tools, mcp-tools)
 * - Flexible tool field format support (array or comma-separated string)
 * - Graceful handling of missing or malformed files
 *
 * **YAML Frontmatter Formats Supported:**
 * - Skills: name, description, allowed-tools, mcp_tools, experience_score, training_history
 * - Agents: name, description, model, tools, allowed-tools, mcp-tools, skills, input-fields, output-schema
 * - Commands: description, allowed-tools, argument-hint, model, disable-model-invocation
 *
 * @example
 * // Parse entire .claude directory structure
 * const parser = new ClaudeStructureParser();
 * const analysis = await parser.analyzeProject('/path/to/project');
 *
 * console.log(`Found ${analysis.skills.length} skills`);
 * console.log(`Found ${analysis.agents.length} agents`);
 * console.log(`Found ${analysis.commands.length} commands`);
 * console.log(`Has .claude folder: ${analysis.hasClaudeFolder}`);
 *
 * @example
 * // Parse only skills
 * const parser = new ClaudeStructureParser();
 * const skills = await parser.parseSkills('/path/to/project');
 *
 * skills.forEach(skill => {
 *   console.log(`${skill.name}: ${skill.description}`);
 *   console.log(`  Experience: ${skill.experienceScore || 0}/100`);
 *   console.log(`  Training Sessions: ${skill.trainingHistory?.length || 0}`);
 * });
 *
 * @example
 * // Parse only agents
 * const parser = new ClaudeStructureParser();
 * const agents = await parser.parseAgents('/path/to/project');
 *
 * agents.forEach(agent => {
 *   console.log(`${agent.name}: ${agent.description}`);
 *   console.log(`  Model: ${agent.metadata?.model || 'default'}`);
 *   console.log(`  Skills: ${agent.metadata?.skills?.join(', ') || 'none'}`);
 * });
 *
 * @example
 * // Parse a specific skill by name
 * const parser = new ClaudeStructureParser();
 * const skill = await parser.parseSpecificSkill('/path/to/project', 'data-analysis');
 *
 * if (skill) {
 *   console.log(`Skill: ${skill.name}`);
 *   console.log(`Description: ${skill.description}`);
 *   console.log(`Content:\n${skill.content}`);
 * } else {
 *   console.log('Skill not found');
 * }
 *
 * @example
 * // Check for input fields in skills
 * const parser = new ClaudeStructureParser();
 * const skills = await parser.parseSkills('/path/to/project');
 *
 * const skillsWithInputs = skills.filter(s =>
 *   s.metadata?.inputFields && s.metadata.inputFields.length > 0
 * );
 *
 * skillsWithInputs.forEach(skill => {
 *   console.log(`${skill.name} requires inputs:`);
 *   skill.metadata!.inputFields!.forEach(field => {
 *     console.log(`  - ${field.name} (${field.type}): ${field.label}`);
 *   });
 * });
 *
 * @see Skill - Skill interface returned by parseSkills
 * @see Agent - Agent interface returned by parseAgents
 * @see InputField - Input field definition for parameterized execution
 * @see TrainingRecord - Training history record for skill performance tracking
 */
export class ClaudeStructureParser {
  /** Logger instance for debugging and error tracking */
  private logger: Logger;

  constructor() {
    this.logger = createLogger('ClaudeStructureParser');
  }

  /**
   * Parse all slash commands from .claude/commands/
   */
  async parseSlashCommands(projectPath: string): Promise<SlashCommand[]> {
    const commandsDir = path.join(projectPath, '.claude', 'commands');

    try {
      await fs.access(commandsDir);
    } catch {
      this.logger.debug('No .claude/commands directory found', { projectPath });
      return [];
    }

    const commands: SlashCommand[] = [];
    await this.scanCommandsRecursive(commandsDir, commandsDir, commands);

    this.logger.info('Parsed slash commands', {
      projectPath,
      count: commands.length,
      commands: commands.map(c => c.name)
    });

    return commands;
  }

  /**
   * Recursively scan commands directory
   */
  private async scanCommandsRecursive(
    currentDir: string,
    rootDir: string,
    commands: SlashCommand[]
  ): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        await this.scanCommandsRecursive(fullPath, rootDir, commands);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const command = await this.parseCommandFile(fullPath, rootDir);
        if (command) {
          commands.push(command);
        }
      }
    }
  }

  /**
   * Parse a single slash command file
   */
  private async parseCommandFile(
    filePath: string,
    rootDir: string
  ): Promise<SlashCommand | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(rootDir, filePath);
      const commandName = path.basename(filePath, '.md');

      // Extract category from subdirectory (if any)
      const dirPath = path.dirname(relativePath);
      const category = dirPath === '.' ? undefined : dirPath;

      // Parse frontmatter
      const { metadata, bodyContent } = this.parseFrontmatter(content);

      // Parse allowed-tools (handle both array and comma-separated string formats)
      const parseToolsField = (toolsValue: unknown): string[] | undefined => {
        if (!toolsValue) return undefined;
        if (Array.isArray(toolsValue)) return toolsValue;
        if (typeof toolsValue === 'string') {
          return toolsValue.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }
        return undefined;
      };

      return {
        id: relativePath.replace(/\\/g, '/').replace('.md', ''),
        name: commandName,
        description: metadata.description as string | undefined,
        path: filePath,
        relativePath: relativePath.replace(/\\/g, '/'),
        content: bodyContent,
        metadata: {
          allowedTools: parseToolsField(metadata['allowed-tools']),
          argumentHint: metadata['argument-hint'] as string | undefined,
          model: metadata.model as string | undefined,
          disableModelInvocation: metadata['disable-model-invocation'] as boolean | undefined,
        },
        category,
      };
    } catch (error) {
      this.logger.error('Failed to parse command file', error, { filePath });
      return null;
    }
  }

  /**
   * Parse all skills from .claude/skills/
   *
   * @description
   * Scans the `.claude/skills/` directory and parses all skill subdirectories.
   * Each subdirectory must contain a `SKILL.md` file with YAML frontmatter to be considered a valid skill.
   * Optionally parses `skill.config.json` for input field definitions and supporting files
   * (reference.md, examples.md, scripts/, templates/).
   *
   * **Parsing Workflow:**
   * 1. Check if `.claude/skills/` directory exists (returns empty array if not found)
   * 2. Read all entries in the skills directory
   * 3. For each subdirectory, call `parseSkill()` to extract skill data
   * 4. Filter out null results (failed parses or missing SKILL.md)
   * 5. Log parsed skill names and count
   * 6. Return array of successfully parsed skills
   *
   * **Skill Discovery:**
   * - Only directory entries are processed (ignores loose files)
   * - Each skill directory must contain `SKILL.md` with YAML frontmatter
   * - Missing or malformed skills are logged as warnings and skipped
   * - Skills are discovered by Claude Agent SDK via `settingSources: ['project']`
   *
   * @param projectPath - Absolute path to project root directory
   * @returns Promise resolving to array of parsed Skill objects (empty array if no skills found)
   *
   * @example
   * // Parse all skills from project
   * const parser = new ClaudeStructureParser();
   * const skills = await parser.parseSkills('/path/to/project');
   *
   * console.log(`Found ${skills.length} skills`);
   * skills.forEach(skill => {
   *   console.log(`- ${skill.name}: ${skill.description}`);
   *   console.log(`  Tools: ${skill.metadata?.allowedTools?.join(', ') || 'none'}`);
   *   console.log(`  Experience: ${skill.experienceScore || 0}/100`);
   * });
   *
   * @example
   * // Filter skills by experience level
   * const parser = new ClaudeStructureParser();
   * const skills = await parser.parseSkills('/path/to/project');
   *
   * const expertSkills = skills.filter(s => (s.experienceScore || 0) >= 80);
   * const beginnerSkills = skills.filter(s => (s.experienceScore || 0) < 50);
   *
   * console.log(`Expert skills (80+): ${expertSkills.length}`);
   * console.log(`Beginner skills (<50): ${beginnerSkills.length}`);
   *
   * @example
   * // Check for skills with MCP tools configured
   * const parser = new ClaudeStructureParser();
   * const skills = await parser.parseSkills('/path/to/project');
   *
   * const mcpSkills = skills.filter(s =>
   *   s.metadata?.mcpTools && Object.keys(s.metadata.mcpTools).length > 0
   * );
   *
   * mcpSkills.forEach(skill => {
   *   console.log(`${skill.name} uses MCP servers:`);
   *   Object.entries(skill.metadata!.mcpTools!).forEach(([serverId, tools]) => {
   *     console.log(`  - ${serverId}: ${tools.join(', ')}`);
   *   });
   * });
   *
   * @example
   * // Check for skills with input fields
   * const parser = new ClaudeStructureParser();
   * const skills = await parser.parseSkills('/path/to/project');
   *
   * const parameterizedSkills = skills.filter(s =>
   *   s.metadata?.inputFields && s.metadata.inputFields.length > 0
   * );
   *
   * parameterizedSkills.forEach(skill => {
   *   console.log(`${skill.name} requires inputs:`);
   *   skill.metadata!.inputFields!.forEach(field => {
   *     const req = field.required ? '(required)' : '(optional)';
   *     console.log(`  - ${field.name}: ${field.label} ${req}`);
   *   });
   * });
   *
   * @example
   * // Check for skills with supporting files
   * const parser = new ClaudeStructureParser();
   * const skills = await parser.parseSkills('/path/to/project');
   *
   * skills.forEach(skill => {
   *   if (skill.supportingFiles?.reference) {
   *     console.log(`${skill.name} has reference documentation`);
   *   }
   *   if (skill.supportingFiles?.examples) {
   *     console.log(`${skill.name} has usage examples`);
   *   }
   *   if (skill.supportingFiles?.scripts && skill.supportingFiles.scripts.length > 0) {
   *     console.log(`${skill.name} has ${skill.supportingFiles.scripts.length} helper scripts`);
   *   }
   * });
   *
   * @example
   * // Analyze training history
   * const parser = new ClaudeStructureParser();
   * const skills = await parser.parseSkills('/path/to/project');
   *
   * skills.forEach(skill => {
   *   if (skill.trainingHistory && skill.trainingHistory.length > 0) {
   *     const successfulTrainings = skill.trainingHistory.filter(t => t.executionSuccess);
   *     const avgImprovement = skill.trainingHistory.reduce((sum, t) =>
   *       sum + (t.scoreAfter - t.scoreBefore), 0
   *     ) / skill.trainingHistory.length;
   *
   *     console.log(`${skill.name}:`);
   *     console.log(`  Training Sessions: ${skill.trainingHistory.length}`);
   *     console.log(`  Successful: ${successfulTrainings.length}`);
   *     console.log(`  Avg Improvement: ${avgImprovement.toFixed(1)} points`);
   *   }
   * });
   *
   * @see parseSkill - Parses a single skill directory
   * @see parseSpecificSkill - Parses a specific skill by name
   * @see Skill - Returned skill interface
   */
  async parseSkills(projectPath: string): Promise<Skill[]> {
    const skillsDir = path.join(projectPath, '.claude', 'skills');

    try {
      await fs.access(skillsDir);
    } catch {
      this.logger.debug('No .claude/skills directory found', { projectPath });
      return [];
    }

    const skills: Skill[] = [];
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name);
        const skill = await this.parseSkill(skillPath, entry.name);
        if (skill) {
          skills.push(skill);
        }
      }
    }

    this.logger.info('Parsed skills', {
      projectPath,
      count: skills.length,
      skills: skills.map(s => s.name)
    });

    return skills;
  }

  /**
   * Parse a specific skill directory by name (for forced execution)
   * Use this when you want to load ONLY one skill, not all skills.
   *
   * @param projectPath - Project root directory
   * @param skillName - Name of the skill to parse
   * @returns Parsed skill or null if not found
   */
  async parseSpecificSkill(projectPath: string, skillName: string): Promise<Skill | null> {
    const skillPath = path.join(projectPath, '.claude', 'skills', skillName);

    try {
      await fs.access(skillPath);
    } catch {
      this.logger.warn('Skill directory not found', { skillPath, skillName });
      return null;
    }

    const skill = await this.parseSkill(skillPath, skillName);

    if (skill) {
      this.logger.info('Parsed specific skill', {
        projectPath,
        skillName,
        skillId: skill.id
      });
    }

    return skill;
  }

  /**
   * Parse a single skill directory
   *
   * @description
   * Parses a single skill directory containing SKILL.md with YAML frontmatter.
   * Extracts skill metadata, content, input fields from skill.config.json, and supporting files
   * (reference.md, examples.md, scripts/, templates/). This is a private helper method called by
   * `parseSkills()` and `parseSpecificSkill()`.
   *
   * **Required Files:**
   * - SKILL.md with YAML frontmatter (required)
   *
   * **Optional Files:**
   * - skill.config.json with inputs array (for input field definitions)
   * - reference.md (reference documentation)
   * - examples.md (usage examples)
   * - scripts/ directory (helper scripts)
   * - templates/ directory (template files)
   *
   * **Parsing Workflow:**
   * 1. Check if SKILL.md exists (returns null if not found)
   * 2. Read and parse SKILL.md YAML frontmatter
   * 3. Extract metadata (name, description, allowed-tools, mcp_tools, experience_score, training_history)
   * 4. Parse skill.config.json if present (for input field definitions)
   * 5. Scan for supporting files (reference.md, examples.md, scripts/, templates/)
   * 6. Return Skill object with all parsed data
   *
   * **Error Handling:**
   * - Returns null if SKILL.md is missing
   * - Logs errors and returns null if parsing fails
   * - Gracefully handles missing optional files (skill.config.json, supporting files)
   *
   * @param skillPath - Absolute path to skill directory (e.g., '/project/.claude/skills/data-analysis')
   * @param skillName - Skill directory name (used as skill ID, e.g., 'data-analysis')
   * @returns Promise resolving to Skill object or null if parsing fails
   * @private
   *
   * @see parseSkills - Public method that calls this for all skills
   * @see parseSpecificSkill - Public method that calls this for a single skill
   * @see Skill - Returned skill interface
   */
  private async parseSkill(skillPath: string, skillName: string): Promise<Skill | null> {
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    try {
      await fs.access(skillMdPath);
    } catch {
      this.logger.warn('Skill directory missing SKILL.md', { skillPath });
      return null;
    }

    try {
      const content = await fs.readFile(skillMdPath, 'utf-8');
      const { metadata, bodyContent } = this.parseFrontmatter(content);

      // Parse allowed-tools (handle both array and comma-separated string formats)
      const parseToolsField = (toolsValue: unknown): string[] | undefined => {
        if (!toolsValue) return undefined;
        if (Array.isArray(toolsValue)) return toolsValue;
        if (typeof toolsValue === 'string') {
          return toolsValue.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }
        return undefined;
      };

      // Parse skill.config.json for input fields
      let inputFields: InputField[] | undefined;
      const configPath = path.join(skillPath, 'skill.config.json');
      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, 'utf-8');
        const configData = JSON.parse(configContent);

        if (configData.inputs && Array.isArray(configData.inputs)) {
          inputFields = configData.inputs.map((field: any) => ({
            name: field.name,
            type: field.type || 'text',
            label: field.label || field.name,
            description: field.description,
            placeholder: field.placeholder,
            required: field.required === true,
            options: field.options,
            default: field.default,
          }));
          if (inputFields && inputFields.length > 0) {
            this.logger.debug(`Parsed ${inputFields.length} input fields for skill ${skillName}`);
          }
        }
      } catch (error) {
        // skill.config.json is optional, so no error if it doesn't exist
        this.logger.debug('No skill.config.json found or failed to parse', { skillPath });
      }

      // Scan for supporting files
      const supportingFiles = await this.scanSupportingFiles(skillPath);

      // Parse experience score and training history
      const experienceScore = typeof metadata.experience_score === 'number'
        ? metadata.experience_score
        : 0;

      const trainingHistory = Array.isArray(metadata.training_history)
        ? (metadata.training_history as TrainingRecord[])
        : undefined;

      return {
        id: skillName,
        name: metadata.name as string || skillName,
        description: metadata.description as string || 'No description',
        path: skillPath,
        skillMdPath,
        content: bodyContent,
        metadata: {
          allowedTools: parseToolsField(metadata['allowed-tools']),
          mcpTools: metadata['mcp_tools'] as Record<string, string[]> | undefined,
          inputFields,
        },
        supportingFiles,
        experienceScore,
        trainingHistory,
      };
    } catch (error) {
      this.logger.error('Failed to parse skill', error, { skillPath });
      return null;
    }
  }

  /**
   * Scan for supporting files in skill directory
   */
  private async scanSupportingFiles(skillPath: string): Promise<Skill['supportingFiles']> {
    const supportingFiles: Skill['supportingFiles'] = {};

    // Check for reference.md
    const referencePath = path.join(skillPath, 'reference.md');
    try {
      await fs.access(referencePath);
      supportingFiles.reference = await fs.readFile(referencePath, 'utf-8');
    } catch {}

    // Check for examples.md
    const examplesPath = path.join(skillPath, 'examples.md');
    try {
      await fs.access(examplesPath);
      supportingFiles.examples = await fs.readFile(examplesPath, 'utf-8');
    } catch {}

    // Check for scripts directory
    const scriptsDir = path.join(skillPath, 'scripts');
    try {
      const scriptFiles = await fs.readdir(scriptsDir);
      supportingFiles.scripts = scriptFiles;
    } catch {}

    // Check for templates directory
    const templatesDir = path.join(skillPath, 'templates');
    try {
      const templateFiles = await fs.readdir(templatesDir);
      supportingFiles.templates = templateFiles;
    } catch {}

    return supportingFiles;
  }

  /**
   * Parse YAML frontmatter from markdown content
   * Returns metadata object and body content separately
   */
  private parseFrontmatter(content: string): {
    metadata: Record<string, unknown>;
    bodyContent: string;
  } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { metadata: {}, bodyContent: content };
    }

    const [, frontmatterText, bodyContent] = match;

    try {
      // Use js-yaml for proper YAML parsing (handles nested objects, arrays, etc.)
      const metadata = yaml.load(frontmatterText) as Record<string, unknown> || {};
      return { metadata, bodyContent: bodyContent.trim() };
    } catch (error) {
      this.logger.error('Failed to parse YAML frontmatter', error);
      return { metadata: {}, bodyContent: bodyContent.trim() };
    }
  }

  /**
   * Parse all agents from .claude/agents/
   *
   * @description
   * Scans the `.claude/agents/` directory and parses all agent markdown files.
   * Each `.md` file (except README.md) is parsed as an agent definition with YAML frontmatter
   * containing agent configuration (name, description, model, tools, skills, etc.).
   *
   * **Parsing Workflow:**
   * 1. Check if `.claude/agents/` directory exists (returns empty array if not found)
   * 2. Read all entries in the agents directory
   * 3. For each `.md` file (excluding README.md), call `parseAgent()` to extract agent data
   * 4. Parse YAML frontmatter for agent metadata (tools, skills, input fields, etc.)
   * 5. Filter out null results (failed parses or malformed files)
   * 6. Log parsed agent names and count
   * 7. Return array of successfully parsed agents
   *
   * **Agent Discovery:**
   * - Only `.md` files are processed (ignores non-markdown files and subdirectories)
   * - README.md is explicitly excluded to avoid parsing documentation as an agent
   * - Missing or malformed agents are logged as errors and skipped
   * - Agents are discovered by Claude Agent SDK and selectable in UI
   *
   * @param projectPath - Absolute path to project root directory
   * @returns Promise resolving to array of parsed Agent objects (empty array if no agents found)
   *
   * @example
   * // Parse all agents from project
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * console.log(`Found ${agents.length} agents`);
   * agents.forEach(agent => {
   *   console.log(`- ${agent.name}: ${agent.description}`);
   *   console.log(`  Model: ${agent.metadata?.model || 'default'}`);
   *   console.log(`  Skills: ${agent.metadata?.skills?.join(', ') || 'none'}`);
   * });
   *
   * @example
   * // Filter agents by model preference
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * const sonnetAgents = agents.filter(a => a.metadata?.model === 'sonnet');
   * const opusAgents = agents.filter(a => a.metadata?.model === 'opus');
   *
   * console.log(`Sonnet agents: ${sonnetAgents.length}`);
   * console.log(`Opus agents: ${opusAgents.length}`);
   *
   * @example
   * // Find agents with specific skills
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * const dataAnalysisAgents = agents.filter(a =>
   *   a.metadata?.skills?.includes('data-analysis')
   * );
   *
   * console.log('Agents with data-analysis skill:');
   * dataAnalysisAgents.forEach(agent => {
   *   console.log(`  - ${agent.name}`);
   * });
   *
   * @example
   * // Check agents with MCP tools configured
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * const mcpAgents = agents.filter(a =>
   *   a.metadata?.mcpTools && Object.keys(a.metadata.mcpTools).length > 0
   * );
   *
   * mcpAgents.forEach(agent => {
   *   console.log(`${agent.name} uses MCP servers:`);
   *   Object.entries(agent.metadata!.mcpTools!).forEach(([serverId, tools]) => {
   *     console.log(`  - ${serverId}: ${tools.join(', ')}`);
   *   });
   * });
   *
   * @example
   * // Find agents with input fields
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * const parameterizedAgents = agents.filter(a =>
   *   a.metadata?.inputFields && a.metadata.inputFields.length > 0
   * );
   *
   * parameterizedAgents.forEach(agent => {
   *   console.log(`${agent.name} requires inputs:`);
   *   agent.metadata!.inputFields!.forEach(field => {
   *     const req = field.required ? '(required)' : '(optional)';
   *     console.log(`  - ${field.name}: ${field.label} ${req}`);
   *   });
   * });
   *
   * @example
   * // Check agents with output schemas
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * const structuredAgents = agents.filter(a => a.metadata?.outputSchema);
   *
   * structuredAgents.forEach(agent => {
   *   console.log(`${agent.name} has structured output:`);
   *   console.log(JSON.stringify(agent.metadata!.outputSchema, null, 2));
   * });
   *
   * @example
   * // Analyze tool usage across agents
   * const parser = new ClaudeStructureParser();
   * const agents = await parser.parseAgents('/path/to/project');
   *
   * const toolUsage = new Map<string, number>();
   * agents.forEach(agent => {
   *   agent.metadata?.allowedTools?.forEach(tool => {
   *     toolUsage.set(tool, (toolUsage.get(tool) || 0) + 1);
   *   });
   * });
   *
   * console.log('Tool usage across agents:');
   * Array.from(toolUsage.entries())
   *   .sort((a, b) => b[1] - a[1])
   *   .forEach(([tool, count]) => {
   *     console.log(`  ${tool}: ${count} agents`);
   *   });
   *
   * @see parseAgent - Parses a single agent file
   * @see Agent - Returned agent interface
   */
  async parseAgents(projectPath: string): Promise<Agent[]> {
    const agentsDir = path.join(projectPath, '.claude', 'agents');

    try {
      await fs.access(agentsDir);
    } catch {
      this.logger.debug('No .claude/agents directory found', { projectPath });
      return [];
    }

    const agents: Agent[] = [];
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        const agentPath = path.join(agentsDir, entry.name);
        const agent = await this.parseAgent(agentPath, entry.name);
        if (agent) {
          agents.push(agent);
        }
      }
    }

    this.logger.info('Parsed agents', {
      projectPath,
      count: agents.length,
      agents: agents.map(a => a.name)
    });

    return agents;
  }

  /**
   * Parse a single agent file
   *
   * @description
   * Parses a single agent markdown file containing YAML frontmatter with agent configuration.
   * Extracts agent metadata (name, description, model, tools, skills, input fields, output schema),
   * and the system prompt content. This is a private helper method called by `parseAgents()`.
   *
   * **YAML Frontmatter Fields:**
   * - name: Agent name (string)
   * - description: Agent description (string)
   * - model: Preferred model ('sonnet', 'opus', 'haiku')
   * - tools: List of tool names (array or comma-separated string)
   * - allowed-tools: List of allowed tool names (array or comma-separated string)
   * - mcp-tools or mcp_tools: MCP server tools organized by server ID (object)
   * - skills: List of skill IDs (array or comma-separated string)
   * - input-fields or input_fields: Input field definitions (array)
   * - output-schema or output_schema: Output schema for structured responses (object or JSON string)
   *
   * **Parsing Workflow:**
   * 1. Read agent markdown file content
   * 2. Parse YAML frontmatter to extract metadata
   * 3. Extract body content (system prompt)
   * 4. Parse input fields from input-fields or input_fields
   * 5. Parse tools, allowed-tools, skills (supports array or comma-separated string formats)
   * 6. Parse MCP tools (nested object with server IDs as keys)
   * 7. Parse output schema (supports object or JSON string)
   * 8. Return Agent object with all parsed data
   *
   * **Error Handling:**
   * - Returns null if file read or parsing fails
   * - Logs errors with agent path context
   * - Gracefully handles missing or malformed metadata fields
   *
   * @param agentPath - Absolute path to agent markdown file (e.g., '/project/.claude/agents/code-assistant.md')
   * @param fileName - Agent filename (e.g., 'code-assistant.md')
   * @returns Promise resolving to Agent object or null if parsing fails
   * @private
   *
   * @see parseAgents - Public method that calls this for all agents
   * @see Agent - Returned agent interface
   */
  private async parseAgent(agentPath: string, fileName: string): Promise<Agent | null> {
    try {
      const content = await fs.readFile(agentPath, 'utf-8');
      const { metadata, bodyContent } = this.parseFrontmatter(content);

      const agentId = fileName.replace('.md', '');

      // Parse input fields
      let inputFields: InputField[] | undefined;
      const inputFieldsData = metadata.input_fields || metadata['input-fields'];

      if (inputFieldsData && Array.isArray(inputFieldsData)) {
        inputFields = inputFieldsData.map((field: any) => ({
          name: field.name,
          type: field.type || 'text',
          label: field.label || field.name,
          placeholder: field.placeholder,
          required: field.required === true,
          options: field.options,
          default: field.default,
        }));
        this.logger.debug(`Parsed ${inputFields.length} input fields for agent ${fileName}`);
      }

      // Parse tools (handle both array and comma-separated string formats)
      const parseToolsField = (toolsValue: unknown): string[] | undefined => {
        if (!toolsValue) return undefined;
        if (Array.isArray(toolsValue)) return toolsValue;
        if (typeof toolsValue === 'string') {
          // Handle comma-separated format: "Tool1,Tool2,Tool3"
          return toolsValue.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }
        return undefined;
      };

      const tools = parseToolsField(metadata.tools);
      const allowedTools = parseToolsField(metadata['allowed-tools']);

      // Parse MCP tools (nested object with server IDs as keys)
      let mcpTools: Record<string, string[]> | undefined;
      const mcpToolsData = metadata.mcp_tools || metadata['mcp-tools'];
      if (mcpToolsData && typeof mcpToolsData === 'object' && !Array.isArray(mcpToolsData)) {
        mcpTools = {};
        Object.entries(mcpToolsData).forEach(([serverId, toolsValue]) => {
          if (Array.isArray(toolsValue) && toolsValue.length > 0) {
            mcpTools![serverId] = toolsValue;
          }
        });
        // Only keep mcpTools if it has entries
        if (Object.keys(mcpTools).length === 0) {
          mcpTools = undefined;
        }
      }

      // Parse output schema
      let outputSchema: string | object | undefined = (metadata.output_schema || metadata['output-schema']) as string | object | undefined;

      if (typeof outputSchema === 'string') {
        try {
          outputSchema = JSON.parse(outputSchema);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      // Parse skills (handle both array and comma-separated string formats)
      const skills = parseToolsField(metadata.skills);

      return {
        id: agentId,
        name: metadata.name as string || agentId,
        description: metadata.description as string || 'No description',
        path: agentPath,
        content: bodyContent,
        metadata: {
          tools,
          allowedTools,
          model: metadata.model as string | undefined,
          inputFields,
          outputSchema,
          mcpTools,
          skills,
        },
      };
    } catch (error) {
      this.logger.error('Failed to parse agent', error, { agentPath });
      return null;
    }
  }

  /**
   * Get full structure analysis for a project
   */
  async analyzeProject(projectPath: string): Promise<{
    commands: SlashCommand[];
    skills: Skill[];
    agents: Agent[];
    hasClaudeFolder: boolean;
  }> {
    const claudePath = path.join(projectPath, '.claude');

    let hasClaudeFolder = false;
    try {
      await fs.access(claudePath);
      hasClaudeFolder = true;
    } catch {}

    const commands = await this.parseSlashCommands(projectPath);
    const skills = await this.parseSkills(projectPath);
    const agents = await this.parseAgents(projectPath);

    return {
      commands,
      skills,
      agents,
      hasClaudeFolder,
    };
  }
}
