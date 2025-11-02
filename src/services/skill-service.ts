import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { Skill, Agent, TrainingRecord, InputField } from './claude-structure-parser';
import { ClaudeStructureParser } from './claude-structure-parser.js';

export interface CreateSkillRequest {
  name: string;
  description: string;
  allowedTools?: string[];
  mcpTools?: Record<string, string[]>; // { serverId: [toolName1, toolName2, ...] }
  inputFields?: InputField[]; // Input parameters for skill execution
  content: string;
}

export interface UpdateSkillRequest {
  description: string;
  allowedTools?: string[];
  mcpTools?: Record<string, string[]>; // { serverId: [toolName1, toolName2, ...] }
  inputFields?: InputField[]; // Input parameters for skill execution
  content: string;
}

export interface CreateSkillResponse {
  success: boolean;
  skill?: Skill;
  path?: string;
  error?: string;
}

/**
 * Validates skill name format
 */
function validateSkillName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Skill name is required';
  }

  if (name.length > 64) {
    return 'Skill name must be 64 characters or less';
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Skill name must contain only lowercase letters, numbers, and hyphens';
  }

  return null;
}

/**
 * Validates skill description
 */
function validateSkillDescription(description: string): string | null {
  if (!description || description.trim().length === 0) {
    return 'Skill description is required';
  }

  if (description.length > 1024) {
    return 'Skill description must be 1024 characters or less';
  }

  if (!description.toLowerCase().includes('use when')) {
    return 'Skill description should include "Use when..." to describe when to use this skill';
  }

  return null;
}

/**
 * Creates YAML frontmatter for SKILL.md
 */
function createSkillFrontmatter(request: CreateSkillRequest): string {
  const frontmatter = ['---', `name: ${request.name}`, `description: ${request.description}`];

  if (request.allowedTools && request.allowedTools.length > 0) {
    frontmatter.push(`allowed-tools: ${request.allowedTools.join(', ')}`);
  }

  // Add MCP tools if present
  if (request.mcpTools && Object.keys(request.mcpTools).length > 0) {
    frontmatter.push('mcp_tools:');
    Object.entries(request.mcpTools).forEach(([serverId, tools]) => {
      if (Array.isArray(tools) && tools.length > 0) {
        frontmatter.push(`  ${serverId}:`);
        tools.forEach((toolName: string) => {
          frontmatter.push(`    - ${toolName}`);
        });
      }
    });
  }

  frontmatter.push('---');

  return frontmatter.join('\n');
}

/**
 * Creates a new skill in the .claude/skills/ directory
 */
export async function createSkill(
  request: CreateSkillRequest,
  projectRoot: string
): Promise<CreateSkillResponse> {
  try {
    // Validate name
    const nameError = validateSkillName(request.name);
    if (nameError) {
      return { success: false, error: nameError };
    }

    // Validate description
    const descError = validateSkillDescription(request.description);
    if (descError) {
      return { success: false, error: descError };
    }

    // Validate content
    if (!request.content || request.content.trim().length === 0) {
      return { success: false, error: 'Skill content/instructions are required' };
    }

    // Determine skill directory path
    const skillsDir = path.join(projectRoot, '.claude', 'skills');
    const skillDir = path.join(skillsDir, request.name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    // Check if skill already exists
    if (existsSync(skillDir)) {
      return {
        success: false,
        error: `Skill "${request.name}" already exists at ${skillDir}`,
      };
    }

    // Create skills directory if it doesn't exist
    await fs.mkdir(skillDir, { recursive: true });

    // Create SKILL.md content
    const frontmatter = createSkillFrontmatter(request);
    const skillContent = `${frontmatter}\n\n${request.content}`;

    // Write SKILL.md file
    await fs.writeFile(skillMdPath, skillContent, 'utf-8');

    // Write skill.config.json if inputFields are provided
    if (request.inputFields && request.inputFields.length > 0) {
      const configPath = path.join(skillDir, 'skill.config.json');
      const configData = {
        inputs: request.inputFields,
      };
      await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8');
    }

    // Parse and return the created skill
    const skill: Skill = {
      id: request.name,
      name: request.name,
      description: request.description,
      path: skillDir,
      skillMdPath,
      content: request.content,
      metadata: (request.allowedTools || request.mcpTools || request.inputFields)
        ? {
            ...(request.allowedTools ? { allowedTools: request.allowedTools } : {}),
            ...(request.mcpTools ? { mcpTools: request.mcpTools } : {}),
            ...(request.inputFields ? { inputFields: request.inputFields } : {}),
          }
        : undefined,
    };

    return {
      success: true,
      skill,
      path: skillMdPath,
    };
  } catch (error) {
    console.error('Error creating skill:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Creates YAML frontmatter for SKILL.md during update
 */
function updateSkillFrontmatter(name: string, request: UpdateSkillRequest): string {
  const frontmatter = ['---', `name: ${name}`, `description: ${request.description}`];

  if (request.allowedTools && request.allowedTools.length > 0) {
    frontmatter.push(`allowed-tools: ${request.allowedTools.join(', ')}`);
  }

  // Add MCP tools if present
  if (request.mcpTools && Object.keys(request.mcpTools).length > 0) {
    frontmatter.push('mcp_tools:');
    Object.entries(request.mcpTools).forEach(([serverId, tools]) => {
      if (Array.isArray(tools) && tools.length > 0) {
        frontmatter.push(`  ${serverId}:`);
        tools.forEach((toolName: string) => {
          frontmatter.push(`    - ${toolName}`);
        });
      }
    });
  }

  frontmatter.push('---');

  return frontmatter.join('\n');
}

/**
 * Updates an existing skill in the .claude/skills/ directory
 */
export async function updateSkill(
  skillId: string,
  request: UpdateSkillRequest,
  projectRoot: string
): Promise<CreateSkillResponse> {
  try {
    // Validate description
    const descError = validateSkillDescription(request.description);
    if (descError) {
      return { success: false, error: descError };
    }

    // Validate content
    if (!request.content || request.content.trim().length === 0) {
      return { success: false, error: 'Skill content/instructions are required' };
    }

    // Determine skill directory path
    const skillsDir = path.join(projectRoot, '.claude', 'skills');
    const skillDir = path.join(skillsDir, skillId);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    // Check if skill exists
    if (!existsSync(skillDir)) {
      return {
        success: false,
        error: `Skill "${skillId}" does not exist`,
      };
    }

    // Create SKILL.md content with updated frontmatter
    const frontmatter = updateSkillFrontmatter(skillId, request);
    const skillContent = `${frontmatter}\n\n${request.content}`;

    // Write updated SKILL.md file
    await fs.writeFile(skillMdPath, skillContent, 'utf-8');

    // Update or remove skill.config.json
    const configPath = path.join(skillDir, 'skill.config.json');
    if (request.inputFields && request.inputFields.length > 0) {
      // Write/update config file
      const configData = {
        inputs: request.inputFields,
      };
      await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8');
    } else if (existsSync(configPath)) {
      // Remove config file if no input fields
      await fs.unlink(configPath);
    }

    // Parse and return the updated skill
    const skill: Skill = {
      id: skillId,
      name: skillId,
      description: request.description,
      path: skillDir,
      skillMdPath,
      content: request.content,
      metadata: (request.allowedTools || request.mcpTools || request.inputFields)
        ? {
            ...(request.allowedTools ? { allowedTools: request.allowedTools } : {}),
            ...(request.mcpTools ? { mcpTools: request.mcpTools } : {}),
            ...(request.inputFields ? { inputFields: request.inputFields } : {}),
          }
        : undefined,
    };

    return {
      success: true,
      skill,
      path: skillMdPath,
    };
  } catch (error) {
    console.error('Error updating skill:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Checks if a skill exists
 */
export async function skillExists(name: string, projectRoot: string): Promise<boolean> {
  const skillDir = path.join(projectRoot, '.claude', 'skills', name);
  return existsSync(skillDir);
}

/**
 * Deletes a skill
 */
export async function deleteSkill(name: string, projectRoot: string): Promise<CreateSkillResponse> {
  try {
    const skillDir = path.join(projectRoot, '.claude', 'skills', name);

    if (!existsSync(skillDir)) {
      return {
        success: false,
        error: `Skill "${name}" does not exist`,
      };
    }

    await fs.rm(skillDir, { recursive: true, force: true });

    return {
      success: true,
      path: skillDir,
    };
  } catch (error) {
    console.error('Error deleting skill:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validates that skill references exist
 * Returns array of invalid skill names, empty array if all valid
 */
export async function validateSkillReferences(
  skillNames: string[],
  projectRoot: string
): Promise<{ valid: boolean; invalidSkills: string[] }> {
  if (!skillNames || skillNames.length === 0) {
    return { valid: true, invalidSkills: [] };
  }

  const invalidSkills: string[] = [];

  for (const skillName of skillNames) {
    const exists = await skillExists(skillName, projectRoot);
    if (!exists) {
      invalidSkills.push(skillName);
    }
  }

  return {
    valid: invalidSkills.length === 0,
    invalidSkills,
  };
}

/**
 * Gets usage information for a specific skill
 * Returns list of agent IDs that use this skill
 */
export async function getSkillUsage(
  skillName: string,
  projectRoot: string
): Promise<{ agentIds: string[]; count: number }> {
  const parser = new ClaudeStructureParser();
  const agents = await parser.parseAgents(projectRoot);

  const agentIds = agents
    .filter((agent) => agent.metadata?.skills?.includes(skillName))
    .map((agent) => agent.id);

  return {
    agentIds,
    count: agentIds.length,
  };
}

/**
 * Gets all skills with usage information
 * Returns skills array with usedInAgents and usageCount populated
 */
export async function getSkillsWithUsageInfo(projectRoot: string): Promise<Skill[]> {
  const parser = new ClaudeStructureParser();
  const [skills, agents] = await Promise.all([
    parser.parseSkills(projectRoot),
    parser.parseAgents(projectRoot),
  ]);

  // Build a map of skill usage
  const usageMap = new Map<string, string[]>();

  agents.forEach((agent) => {
    if (agent.metadata?.skills) {
      agent.metadata.skills.forEach((skillId) => {
        if (!usageMap.has(skillId)) {
          usageMap.set(skillId, []);
        }
        usageMap.get(skillId)!.push(agent.id);
      });
    }
  });

  // Enhance skills with usage info
  return skills.map((skill) => ({
    ...skill,
    usedInAgents: usageMap.get(skill.id) || [],
    usageCount: usageMap.get(skill.id)?.length || 0,
  }));
}

/**
 * Updates skill experience score and training history
 */
export async function updateSkillExperience(
  skillId: string,
  newScore: number,
  trainingRecord: TrainingRecord,
  projectRoot: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const skillMdPath = path.join(projectRoot, '.claude', 'skills', skillId, 'SKILL.md');

    if (!existsSync(skillMdPath)) {
      return { success: false, error: `Skill "${skillId}" does not exist` };
    }

    // Read current SKILL.md
    const content = await fs.readFile(skillMdPath, 'utf-8');

    // Split frontmatter and body
    const lines = content.split('\n');
    let frontmatterEndIndex = -1;
    let frontmatterStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (frontmatterStartIndex === -1) {
          frontmatterStartIndex = i;
        } else {
          frontmatterEndIndex = i;
          break;
        }
      }
    }

    if (frontmatterStartIndex === -1 || frontmatterEndIndex === -1) {
      return { success: false, error: 'Invalid SKILL.md format: missing frontmatter' };
    }

    // Parse frontmatter
    const frontmatterText = lines.slice(frontmatterStartIndex + 1, frontmatterEndIndex).join('\n');
    const frontmatterData = yaml.load(frontmatterText) as any;

    // Update experience score
    frontmatterData.experience_score = Math.round(newScore);

    // Update training history (keep last 10 records)
    if (!frontmatterData.training_history) {
      frontmatterData.training_history = [];
    }
    frontmatterData.training_history.unshift(trainingRecord);
    if (frontmatterData.training_history.length > 10) {
      frontmatterData.training_history = frontmatterData.training_history.slice(0, 10);
    }

    // Rebuild frontmatter
    const newFrontmatter = yaml.dump(frontmatterData, { indent: 2 });

    // Reconstruct file content
    const body = lines.slice(frontmatterEndIndex + 1).join('\n');
    const newContent = `---\n${newFrontmatter}---${body}`;

    // Write updated file
    await fs.writeFile(skillMdPath, newContent, 'utf-8');

    return { success: true };
  } catch (error) {
    console.error('Error updating skill experience:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Gets training history for a skill
 */
export async function getSkillTrainingHistory(
  skillId: string,
  projectRoot: string
): Promise<{ success: boolean; history?: TrainingRecord[]; error?: string }> {
  try {
    const parser = new ClaudeStructureParser();
    const skills = await parser.parseSkills(projectRoot);
    const skill = skills.find((s) => s.id === skillId);

    if (!skill) {
      return { success: false, error: `Skill "${skillId}" not found` };
    }

    return {
      success: true,
      history: skill.trainingHistory || [],
    };
  } catch (error) {
    console.error('Error getting skill training history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
