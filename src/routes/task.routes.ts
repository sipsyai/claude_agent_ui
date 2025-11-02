import { Router, type Request, type Response } from 'express';
import { createLogger } from '../services/logger.js';
import { TaskStorageService } from '../services/task-storage-service.js';
import { ClaudeStructureParser } from '../services/claude-structure-parser.js';
import type { CreateTaskRequest, Task, SkillExecutionMetadata } from '../types/task-types.js';
import type { Skill } from '../services/claude-structure-parser.js';
import { strapiClient } from '../services/strapi-client.js';
import type { Skill as StrapiSkill } from '../types/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';

const logger = createLogger('TaskRoutes');
const router = Router();

// Initialize services
const taskStorage = new TaskStorageService();
const parser = new ClaudeStructureParser();

/**
 * Helper function to execute skill tasks
 */
async function executeSkillTask(
  task: Task,
  skill: Skill,
  projectPath: string,
  res: Response,
  executionLog: any[],
  taskStorage: TaskStorageService
): Promise<void> {
  let stderrOutput = '';

  try {
    // Import SDK
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    // 📊 SKILL EXECUTION METADATA: Add detailed execution context
    const skillExecutionMetadata: SkillExecutionMetadata = {
      selectedSkillId: skill.id,
      selectedSkillName: skill.name,
      source: 'strapi', // Will be 'strapi' or 'filesystem' depending on source
      isolationLevel: 'full' as const, // Only this skill is loaded
      systemPromptSource: 'skill.content' as const,
      otherSkillsAccessible: false, // Explicit isolation
    };

    // Add to task metadata
    if (!task.metadata) {
      task.metadata = {};
    }
    task.metadata.skillExecution = skillExecutionMetadata;
    task.executionMode = 'forced'; // Mark as forced execution
    task.taskType = 'skill';

    logger.info('Starting skill task execution', {
      taskId: task.id,
      skillId: skill.id,
      skillName: skill.name,
      executionMode: 'forced',
      isolationLevel: 'full',
      hasInputFields: !!skill.metadata?.inputFields,
      parameters: task.inputValues,
      skillExecutionMetadata
    });

    // Inject parameters into skill content
    let processedContent = skill.content;
    const parameters = task.inputValues || {};

    if (Object.keys(parameters).length > 0) {
      Object.entries(parameters).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        processedContent = processedContent.replace(regex, String(value));
      });
    }

    // 🔒 EXPLICIT SKILL LOCK: Build system prompt with forced execution warning
    // This ensures Claude knows it should ONLY use this skill

    // Get skillConfig from skill (if available from Strapi)
    const defaultSkillConfig = `# ⚠️ FORCED SKILL EXECUTION MODE

You are executing ONLY the "{skillName}" skill.
- Do NOT attempt to use any other skills or commands.
- Do NOT look for other skills in the filesystem.
- Follow ONLY the instructions defined in this skill.
- Use ONLY the tools specified in this skill's configuration.

---

`;

    // Use skill's skillConfig if available, otherwise use default
    let skillConfigText = (skill as any).skillConfig || defaultSkillConfig;

    // Replace {skillName} placeholder with actual skill name
    skillConfigText = skillConfigText.replace(/\{skillName\}/g, skill.name);

    // Build system prompt: skillConfig at top, then skillmd (processedContent) below
    let systemPrompt = skillConfigText + processedContent;

    if (Object.keys(parameters).length > 0) {
      const paramContext = Object.entries(parameters)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');
      systemPrompt = skillConfigText + `# Skill Parameters\n${paramContext}\n\n${processedContent}`;
    }

    // Parse tools from toolConfig component (Strapi 5)
    let allowedTools = (skill as any).toolConfig?.allowedTools;
    let disallowedTools = (skill as any).toolConfig?.disallowedTools;

    // Legacy fallback for old format
    if (!allowedTools && (skill as any).metadata?.allowedTools) {
      allowedTools = (skill as any).metadata.allowedTools;
    }
    if (!allowedTools && (skill as any).metadata?.mcpTools) {
      allowedTools = Object.values((skill as any).metadata.mcpTools).flat();
    }
    if (allowedTools && typeof allowedTools === 'string') {
      allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
    }

    // Build MCP servers from skill's mcpConfig component (Strapi 5)
    // Falls back to loading all servers from .mcp.json if no mcpConfig
    let mcpServers = await buildMcpServersFromSkillConfig(skill as any, projectPath);

    // Fallback: Load all MCP servers from .mcp.json if skill has no mcpConfig
    if (!mcpServers) {
      mcpServers = await loadMcpConfig(projectPath);
    }
	// ✅ Collect MCP tool names from skill's mcpConfig and add to allowedTools
	const mcpConfig = (skill as any).mcpConfig;
	if (mcpConfig && Array.isArray(mcpConfig) && mcpConfig.length > 0) {
		const mcpToolNames: string[] = [];

		for (const config of mcpConfig) {
		  const serverName = typeof config.mcpServer === 'string'
			? config.mcpServer
			: config.mcpServer?.name;

		  if (serverName && config.selectedTools && Array.isArray(config.selectedTools))
		{
			for (const toolSel of config.selectedTools) {
			  const toolName = typeof toolSel.mcpTool === 'string'
				? toolSel.mcpTool
				: toolSel.mcpTool?.name;

			  if (toolName) {
				// MCP tools are prefixed with "mcp__<server-name>__<tool-name>"
				const mcpToolFullName = `mcp__${serverName}__${toolName}`;
				mcpToolNames.push(mcpToolFullName);
			  }
			}
		  }
		}

		// Add MCP tool names to allowedTools
		if (mcpToolNames.length > 0) {
		  if (!allowedTools) {
			allowedTools = [];
		  } else if (!Array.isArray(allowedTools)) {
			allowedTools = [allowedTools as any];
		  }
		  allowedTools = [...allowedTools, ...mcpToolNames];
		  logger.debug('Added MCP tool names to allowedTools', {
			mcpToolNames,
			totalAllowedTools: allowedTools.length
		  });
		}
		}

    // Execute skill
    // Map UI permission modes to CLI permission modes
    const cliPermissionMode = task.permissionMode === 'bypass' ? 'bypassPermissions' : task.permissionMode;

    logger.info('Executing skill with SDK', {
        skillId: skill.id,
        prompt: task.userPrompt,
        hasSystemPrompt: !!systemPrompt,
        allowedTools,
        disallowedTools,
        hasMcpServers: !!mcpServers,
        mcpServers: mcpServers ? Object.keys(mcpServers)
   : [],
        permissionMode: cliPermissionMode
      });

      // Build SDK payload
      const sdkPayload = {
        prompt: task.userPrompt,
        options: {
          systemPrompt: systemPrompt,
          model: 'claude-sonnet-4-5',
          cwd: projectPath,
          allowedTools: allowedTools &&
  Array.isArray(allowedTools) ? allowedTools :
  undefined,
          disallowedTools: disallowedTools &&
  Array.isArray(disallowedTools) ? disallowedTools :
  undefined,
          mcpServers: mcpServers as any,
          permissionMode: (cliPermissionMode ||
  'default') as any,
        },
      };

      // Save SDK payload to logs folder
      try {
        const logsDir = path.join(projectPath, 'logs');
        await fs.mkdir(logsDir, { recursive: true });
        const payloadPath = path.join(logsDir,
  `${task.id}-sdk-payload.json`);
        await fs.writeFile(payloadPath,
  JSON.stringify(sdkPayload, null, 2), 'utf-8');
        logger.info('SDK payload saved', { taskId:
  task.id, payloadPath });
      } catch (payloadError) {
        logger.warn('Failed to save SDK payload', {
  taskId: task.id, error: payloadError });
      }

      const queryInstance = query({
        prompt: task.userPrompt,
        options: {
          systemPrompt: systemPrompt,
          model: 'claude-sonnet-4-5',
          cwd: projectPath,
          allowedTools: allowedTools &&
  Array.isArray(allowedTools) ? allowedTools :
  undefined,
          disallowedTools: disallowedTools &&
  Array.isArray(disallowedTools) ? disallowedTools :
  undefined,
          mcpServers: mcpServers as any,
          permissionMode: (cliPermissionMode ||
  'default') as any,
          stderr: (data: string) => {
            stderrOutput += data;
            logger.error('Skill execution stderr', {
  skillId: skill.id, stderr: data });
          },
        },
      });

    // Stream responses
    for await (const message of queryInstance) {
      const eventData = {
        type: 'message',
        messageType: message.type,
        content: message
      };
      executionLog.push(eventData);
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    }

    // Task completed
    const completedEvent = { type: 'status', status: 'completed', message: 'Skill execution completed' };
    executionLog.push(completedEvent);
    res.write(`data: ${JSON.stringify(completedEvent)}\n\n`);

    await taskStorage.updateTaskStatus(task.id, 'completed', { executionLog });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('Skill task execution error', error, {
      taskId: task.id,
      skillId: skill.id,
      stderr: stderrOutput
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorEvent = {
      type: 'error',
      error: errorMessage,
      stderr: stderrOutput ? `\n\nStderr output:\n${stderrOutput}` : ''
    };
    executionLog.push(errorEvent);

    await taskStorage.updateTaskStatus(task.id, 'failed', {
      error: `${errorMessage}${errorEvent.stderr}`,
      executionLog
    });

    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
}

/**
 * Load MCP configuration from .mcp.json
 */
async function loadMcpConfig(projectPath: string): Promise<Record<string, any> | undefined> {
  try {
    const mcpConfigPath = path.join(projectPath, '.mcp.json');
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const config = JSON.parse(content);

    if (config.mcpServers && typeof config.mcpServers === 'object') {
      return config.mcpServers;
    }

    return undefined;
  } catch (error) {
    // .mcp.json not found or invalid - this is okay
    logger.debug('No MCP config found', { projectPath, error: (error as Error).message });
    return undefined;
  }
}

/**
 * Build MCP servers configuration from skill's mcpConfig component
 * Combines Strapi mcpConfig (which servers/tools to use) with .mcp.json (command/args)
 */
async function buildMcpServersFromSkillConfig(
  skill: any,
  projectPath: string
): Promise<Record<string, any> | undefined> {
  const mcpConfig = skill.mcpConfig;

  if (!mcpConfig || !Array.isArray(mcpConfig) || mcpConfig.length === 0) {
    logger.debug('No mcpConfig found in skill', { skillId: skill.id });
    return undefined;
  }

  // Load base MCP configuration from .mcp.json
  const baseMcpConfig = await loadMcpConfig(projectPath);

  if (!baseMcpConfig) {
    logger.warn('No .mcp.json found, cannot build MCP servers from skill config');
    return undefined;
  }

  const mcpServers: Record<string, any> = {};

  for (const config of mcpConfig) {
    // Extract server name from relation
    const serverName = typeof config.mcpServer === 'string'
      ? config.mcpServer
      : config.mcpServer?.name;

    if (!serverName) {
      logger.warn('MCP config entry missing server name', { config });
      continue;
    }

    // Get command/args from .mcp.json
    if (baseMcpConfig[serverName]) {
      mcpServers[serverName] = baseMcpConfig[serverName];
      logger.debug('Added MCP server from skill config', {
        serverName,
        selectedTools: config.selectedTools?.map((t: any) =>
          typeof t.mcpTool === 'string' ? t.mcpTool : t.mcpTool?.name
        ) || []
      });
    } else {
      logger.warn(`MCP server "${serverName}" not found in .mcp.json`, {
        skillId: skill.id,
        availableServers: Object.keys(baseMcpConfig)
      });
    }
  }

  return Object.keys(mcpServers).length > 0 ? mcpServers : undefined;
}

/**
 * Get all tasks with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, agentId, limit, offset } = req.query;

    const tasks = await taskStorage.getTasks({
      status: status as any,
      agentId: agentId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ tasks });
  } catch (error) {
    logger.error('Get tasks error', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

/**
 * Get task statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await taskStorage.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get task stats error', error);
    res.status(500).json({ error: 'Failed to get task statistics' });
  }
});

/**
 * Get task by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await taskStorage.getTask(id);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ task });
  } catch (error) {
    logger.error('Get task error', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * Create a new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateTaskRequest = req.body;

    // Validate required fields
    if (!request.name || !request.agentId || !request.userPrompt) {
      res.status(400).json({ error: 'Missing required fields: name, agentId, userPrompt' });
      return;
    }

    // Determine task type (default to 'agent' for backward compatibility)
    const taskType = request.taskType || 'agent';
    const projectPath = request.directory || process.cwd();

    let entityName: string;

    if (taskType === 'skill') {
      // 🔒 SKILL ISOLATION: Parse ONLY the selected skill, not all skills
      // This prevents Claude from seeing or accessing other skills
      let skill = await parser.parseSpecificSkill(projectPath, request.agentId);
      let strapiSkill: StrapiSkill | null = null;

      // If not found in filesystem, try Strapi
      if (!skill) {
        try {
          logger.info('Skill not found in filesystem, trying Strapi', { skillId: request.agentId });
          strapiSkill = await strapiClient.getSkill(request.agentId);
          if (strapiSkill) {
            logger.info('Skill found in Strapi', { skillId: strapiSkill.id, skillName: strapiSkill.name });
          }
        } catch (strapiError) {
          logger.warn('Skill not found in Strapi', { skillId: request.agentId, error: (strapiError as Error).message });
        }
      }

      // Skill must exist in either filesystem or Strapi
      if (!skill && !strapiSkill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      // Set entity name from whichever source we found
      entityName = skill ? skill.name : strapiSkill!.name;
    } else {
      // Get agent details
      const agents = await parser.parseAgents(projectPath);
      const agent = agents.find(a => a.id === request.agentId);

      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      entityName = agent.name;
    }

    // Create task
    const task = await taskStorage.createTask(request, entityName);

    logger.info('Task created', { taskId: task.id, taskName: task.name, taskType });
    res.status(201).json({ task });
  } catch (error) {
    logger.error('Create task error', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * Execute a task
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await taskStorage.getTask(id);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Update task status to running
    await taskStorage.updateTaskStatus(id, 'running');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Initialize execution log
    const executionLog: any[] = [];

    // Send initial status
    const initialStatus = {
      type: 'status',
      status: 'starting',
      message: `Executing task: ${task.name}`
    };
    executionLog.push(initialStatus);
    res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

    const projectPath = task.directory || process.cwd();
    const taskType = task.taskType || 'agent';

    // Handle skill execution
    if (taskType === 'skill') {
      let skill: any = null;

      // ALWAYS fetch from Strapi first (single source of truth)
      try {
        logger.info('[SkillExecution] Fetching skill from Strapi', {
          taskId: id,
          skillId: task.agentId
        });

        const strapiSkill = await strapiClient.getSkill(task.agentId);

        // Sync to filesystem before execution
        const { skillSyncService } = await import('../services/skill-sync-service.js');
        const inputValues = task.inputValues || {};

        await skillSyncService.syncSkillToFilesystem(strapiSkill, inputValues);

        logger.info('[SkillExecution] Synced skill from Strapi to filesystem', {
          taskId: id,
          skillId: strapiSkill.id,
          skillName: strapiSkill.name,
          hasInputValues: Object.keys(inputValues).length > 0
        });

        
        // ✅ FIX: Use Strapi skill directly to preserve metadata (toolConfig, mcpConfig)
		const sanitizedName = strapiSkill.name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();

		// Parse only to get the content from synced file
		const parsedSkill = await parser.parseSpecificSkill(projectPath, sanitizedName);
		if (parsedSkill) {
			// Use Strapi skill but with parsed content
			skill = { ...strapiSkill, content: parsedSkill.content };
		} else {
			// Try with task.agentId
			const fallbackSkill = await parser.parseSpecificSkill(projectPath, task.agentId);
			skill = fallbackSkill ? { ...strapiSkill, content: fallbackSkill.content } : strapiSkill;
		}

		logger.info('[SkillExecution] Using skill from Strapi with metadata preserved', {
			taskId: id,
			skillId: skill.id,
			skillName: skill.name,
			hasToolConfig: !!(skill as any).toolConfig,
			hasMcpConfig: !!(skill as any).mcpConfig
		}); 
      } catch (strapiError) {
        // Fallback to filesystem if Strapi fails
        logger.warn('[SkillExecution] Failed to fetch from Strapi, trying filesystem fallback', {
          taskId: id,
          skillId: task.agentId,
          error: (strapiError as Error).message
        });

        // Parse only the specific skill for isolation
        skill = await parser.parseSpecificSkill(projectPath, task.agentId);

        if (skill) {
          logger.info('[SkillExecution] Using skill from filesystem (fallback)', {
            taskId: id,
            skillId: skill.id,
            skillName: skill.name
          });
        }
      }

      if (!skill) {
        const errorEvent = { type: 'error', error: 'Skill not found in Strapi or filesystem' };
        executionLog.push(errorEvent);

        await taskStorage.updateTaskStatus(id, 'failed', {
          error: 'Skill not found in Strapi or filesystem',
          executionLog,
        });

        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        res.end();
        return;
      }

      // Execute skill
      await executeSkillTask(task, skill, projectPath, res, executionLog, taskStorage);
      return;
    }

    // Get agent details (for agent execution)
    const agents = await parser.parseAgents(projectPath);
    const agent = agents.find(a => a.id === task.agentId);

    if (!agent) {
      const errorEvent = { type: 'error', error: 'Agent not found' };
      executionLog.push(errorEvent);

      await taskStorage.updateTaskStatus(id, 'failed', {
        error: 'Agent not found',
        executionLog,
      });

      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      res.end();
      return;
    }

    // Import SDK service dynamically
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    try {
      // Parse tools from toolConfig component (Strapi 5)
      let allowedTools = (agent as any).toolConfig?.allowedTools;
      let disallowedTools = (agent as any).toolConfig?.disallowedTools;

      // Legacy fallback for old format
      if (!allowedTools && (agent as any).metadata?.tools) {
        allowedTools = (agent as any).metadata.tools;
      }
      if (!allowedTools && (agent as any).metadata?.allowedTools) {
        allowedTools = (agent as any).metadata.allowedTools;
      }
      if (!allowedTools && (agent as any).metadata?.mcpTools) {
        allowedTools = Object.values((agent as any).metadata.mcpTools).flat();
      }

      if (allowedTools && typeof allowedTools === 'string') {
        allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
      }

      // Load and merge skills
      let enhancedSystemPrompt = agent.content;
      if (agent.metadata?.skills && agent.metadata.skills.length > 0) {
        const allSkills = await parser.parseSkills(projectPath);

        for (const skillId of agent.metadata.skills) {
          const skill = allSkills.find(s => s.id === skillId);
          if (skill) {
            logger.info('Loading skill for agent', { agentId: agent.id, skillId, skillName: skill.name });

            // Merge skill tools with agent tools (toolConfig component)
            const skillToolConfig = (skill as any).toolConfig;
            if (skillToolConfig?.allowedTools && Array.isArray(skillToolConfig.allowedTools)) {
              if (!allowedTools) allowedTools = [];
              else if (!Array.isArray(allowedTools)) allowedTools = [allowedTools as any];
              allowedTools = [...new Set([...allowedTools, ...skillToolConfig.allowedTools])];
            }

            // Legacy fallback
            if (!skillToolConfig && (skill as any).metadata?.allowedTools) {
              const skillTools = (skill as any).metadata.allowedTools;
              if (Array.isArray(skillTools)) {
                if (!allowedTools) allowedTools = [];
                else if (!Array.isArray(allowedTools)) allowedTools = [allowedTools as any];
                allowedTools = [...new Set([...allowedTools, ...skillTools])];
              }
            }

            // Note: MCP merging is handled via agent's mcpConfig - no skill MCP merging needed

            // Append skill content to system prompt
            enhancedSystemPrompt += `\n\n# Skill: ${skill.name}\n${skill.content}`;
          }
        }
      }

      // Build MCP servers from agent's mcpConfig component (Strapi 5)
      let mcpServers = await buildMcpServersFromSkillConfig(agent as any, projectPath);

      // Fallback: Load all MCP servers from .mcp.json if agent has no mcpConfig
      if (!mcpServers) {
        mcpServers = await loadMcpConfig(projectPath);
      }

      // Legacy: Filter by metadata.mcpTools if present
      if (!mcpServers && (agent as any).metadata?.mcpTools) {
        const baseMcpConfig = await loadMcpConfig(projectPath);
        if (baseMcpConfig) {
          const allowedServerNames = Object.keys((agent as any).metadata.mcpTools);
          const filteredServers: Record<string, any> = {};

          for (const serverName of allowedServerNames) {
            if (baseMcpConfig[serverName]) {
              filteredServers[serverName] = baseMcpConfig[serverName];
            }
          }

          mcpServers = filteredServers;
          logger.info('Filtered MCP servers using legacy metadata.mcpTools', {
            allowedServers: allowedServerNames,
            loadedServers: Object.keys(filteredServers)
          });
        }
      }

      // Enforce strict tool usage: combine explicit disallowedTools with auto-calculated ones
      const allBuiltInTools = [
        'WebFetch', 'WebSearch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
        'Task', 'TodoWrite', 'ExitPlanMode', 'NotebookEdit', 'BashOutput',
        'KillShell', 'AskUserQuestion', 'Skill', 'SlashCommand'
      ];

      // Start with explicit disallowedTools from toolConfig
      let autoDisallowedTools: string[] = [];

      if (allowedTools && Array.isArray(allowedTools) && allowedTools.length > 0) {
        // Agent has explicit allowed tools - block all other built-in tools
        autoDisallowedTools = allBuiltInTools.filter(tool => !allowedTools.includes(tool));
        logger.info('Enforcing strict tool allowlist, blocking non-allowed built-in tools', {
          allowedTools,
          autoDisallowedTools
        });
      } else if (mcpServers && Object.keys(mcpServers).length > 0 && !allowedTools) {
        // Agent uses ONLY MCP tools - block all built-in tools
        autoDisallowedTools = allBuiltInTools;
        logger.info('Agent uses only MCP tools, blocking all built-in tools', {
          allowedTools,
          autoDisallowedTools
        });
      }

      // Merge with explicit disallowedTools from toolConfig
      const finalDisallowedTools = disallowedTools && Array.isArray(disallowedTools)
        ? [...new Set([...autoDisallowedTools, ...disallowedTools])]
        : autoDisallowedTools.length > 0 ? autoDisallowedTools : undefined;

      // Map UI permission modes to CLI permission modes
      const cliPermissionMode = task.permissionMode === 'bypass' ? 'bypassPermissions' : task.permissionMode;

      logger.info('Executing agent with SDK', {
        agentId: agent.id,
        prompt: task.userPrompt,
        hasSystemPrompt: !!enhancedSystemPrompt,
        allowedTools,
        disallowedTools: finalDisallowedTools,
        hasMcpServers: !!mcpServers,
        mcpServers: mcpServers ? Object.keys(mcpServers) : [],
        permissionMode: cliPermissionMode
      });

      const queryInstance = query({
        prompt: task.userPrompt,
        options: {
          systemPrompt: enhancedSystemPrompt,
          model: 'claude-sonnet-4-5',
          cwd: projectPath,
          allowedTools: allowedTools as string[] | undefined,
          disallowedTools: finalDisallowedTools,
          mcpServers: mcpServers as any,
          permissionMode: (cliPermissionMode || 'default') as any,
          stderr: (data: string) => {
            const debugEvent = { type: 'debug', message: `STDERR: ${data}` };
            executionLog.push(debugEvent);
            res.write(`data: ${JSON.stringify(debugEvent)}\n\n`);
          },
        },
      });

      // Stream responses
      for await (const event of queryInstance) {
        // Wrap event in the same format as sent to client
        const wrappedEvent = { type: 'message', content: event };
        executionLog.push(wrappedEvent);

        // Send to client
        res.write(`data: ${JSON.stringify(wrappedEvent)}\n\n`);

        // Check for final result
        if (event.type === 'result') {
          const result = event.is_error ? 'Failed' : 'Completed';
          const status = event.is_error ? 'failed' : 'completed';

          const finalStatus = {
            type: 'status',
            status: status === 'completed' ? '✅ Task completed successfully' : '❌ Task failed'
          };
          executionLog.push(finalStatus);

          await taskStorage.updateTaskStatus(id, status, {
            result: result,
            error: event.is_error ? 'Task execution failed' : undefined,
            executionLog,
          });

          res.write(`data: ${JSON.stringify(finalStatus)}\n\n`);
        }
      }

      res.end();
      logger.info('Task execution completed', { taskId: id });
    } catch (error: any) {
      logger.error('Task execution error', error, { taskId: id });
      const errorEvent = { type: 'error', error: error.message };
      executionLog.push(errorEvent);

      await taskStorage.updateTaskStatus(id, 'failed', {
        error: error.message || 'Execution failed',
        executionLog,
      });

      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Execute task error', error);
    res.status(500).json({ error: 'Failed to execute task' });
  }
});

/**
 * Delete a task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await taskStorage.deleteTask(id);

    if (!deleted) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    logger.error('Delete task error', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
