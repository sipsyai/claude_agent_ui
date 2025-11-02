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
 */
export interface TrainingRecord {
  date: string;
  scoreBefore: number;
  scoreAfter: number;
  issuesFound: string[];
  correctionsMade: boolean;
  executionSuccess: boolean;
}

/**
 * Represents a parsed skill from .claude/skills/
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  path: string;
  skillMdPath: string;
  content: string;
  metadata?: {
    allowedTools?: string[];
    mcpTools?: Record<string, string[]>; // { serverId: [toolName1, toolName2, ...] }
    inputFields?: InputField[]; // Input parameters for skill execution
  };
  supportingFiles?: {
    reference?: string;
    examples?: string;
    scripts?: string[];
    templates?: string[];
  };
  usedInAgents?: string[]; // List of agent IDs that use this skill
  usageCount?: number; // Number of agents using this skill
  experienceScore?: number; // 0-100 skill proficiency score
  trainingHistory?: TrainingRecord[]; // History of training sessions
}

/**
 * Input field definition for agent and skill execution
 */
export interface InputField {
  name: string;
  type: 'text' | 'textarea' | 'dropdown' | 'multiselect' | 'checkbox' | 'number' | 'filepath';
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For dropdown and multiselect
  default?: any;
}

/**
 * Represents a parsed agent from .claude/agents/
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  path: string;
  content: string;
  metadata?: {
    tools?: string[];
    allowedTools?: string[];
    model?: string;
    inputFields?: InputField[];
    outputSchema?: string | object;
    mcpTools?: Record<string, string[]>;
    skills?: string[]; // List of skill IDs that this agent can use
  };
}

/**
 * Service for parsing Claude Code's .claude folder structure
 * Extracts slash commands and skills from the project
 */
export class ClaudeStructureParser {
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
        console.log(`Parsed ${inputFields.length} input fields for agent ${fileName}:`, JSON.stringify(inputFields, null, 2));
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
