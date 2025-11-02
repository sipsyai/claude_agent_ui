/**
 * Manager Routes - Strapi CRUD Proxy
 *
 * Provides CRUD operations for Agents, Skills, MCP Servers, and Tasks
 * by proxying requests to the Strapi API through the strapiClient service.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { strapiClient } from '../services/strapi-client.js';
import { asyncHandler, AppError } from '../middleware/error-handler.js';
import { createLogger } from '../services/logger.js';
import { MCPService } from '../services/mcp-service.js';

// Import validation schemas
import {
  createAgentSchema,
  updateAgentSchema,
  agentQuerySchema,
  agentIdSchema
} from '../validators/agent.validators.js';

import {
  createSkillSchema,
  updateSkillSchema,
  skillQuerySchema,
  skillIdSchema
} from '../validators/skill.validators.js';

import {
  createMCPServerSchema,
  updateMCPServerSchema,
  mcpServerQuerySchema,
  mcpServerIdSchema
} from '../validators/mcp-server.validators.js';

import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskIdSchema
} from '../validators/task.validators.js';

/**
 * Transform backend Agent to frontend format
 * No transformation needed - frontend now uses Strapi component-based structure directly
 * @param agent - Agent data from Strapi
 * @param skillIdToNameMap - Optional map (not used, kept for compatibility)
 */
function transformAgentForFrontend(agent: any, skillIdToNameMap?: Map<string, string>) {
  // Frontend now uses component-based fields directly (toolConfig, modelConfig, etc.)
  // No transformation needed
  return agent;
}

export function createStrapiManagerRoutes(): Router {
  const router = Router();
  const logger = createLogger('StrapiManagerRoutes');

  // ============= AGENTS =============

  /**
   * GET /api/strapi/agents
   * List all agents with optional filtering, sorting, and pagination
   */
  router.get('/agents', asyncHandler(async (req: Request, res: Response) => {
    const query = agentQuerySchema.parse(req.query);

    logger.debug('Fetching agents from Strapi', { query });

    const filters: any = {};

    if (query.enabled !== undefined) {
      filters.enabled = query.enabled;
    }

    if (query.search) {
      filters.$or = [
        { name: { $containsi: query.search } },
        { description: { $containsi: query.search } }
      ];
    }

    const agents = await strapiClient.getAllAgents({
      populate: ['skillSelection', 'mcpConfig', 'toolConfig', 'modelConfig', 'analytics'],
      filters,
      sort: [query.sort],
      pagination: {
        page: query.page,
        pageSize: query.pageSize
      }
    });

    // Get all skills to create ID->name mapping for transformation
    const allSkills = await strapiClient.getAllSkills();
    const skillIdToName = new Map(allSkills.map(s => [s.id, s.name]));

    res.json({
      data: agents.map(agent => transformAgentForFrontend(agent, skillIdToName)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: agents.length
      }
    });
  }));

  /**
   * GET /api/strapi/agents/:id
   * Get a single agent by ID
   */
  router.get('/agents/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = agentIdSchema.parse(req.params);

    logger.debug('Fetching agent from Strapi', { id });

    const agent = await strapiClient.getAgent(id);

    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    // Get all skills to create ID->name mapping for transformation
    const allSkills = await strapiClient.getAllSkills();
    const skillIdToName = new Map(allSkills.map(s => [s.id, s.name]));

    res.json(transformAgentForFrontend(agent, skillIdToName));
  }));

  /**
   * POST /api/strapi/agents
   * Create a new agent
   */
  router.post('/agents', asyncHandler(async (req: Request, res: Response) => {
    // Frontend sends { directory, agent }, extract agent data
    const agentData = req.body.agent || req.body;

    // Transform mcpTools to mcpServers if present (frontend uses mcpTools, backend expects mcpServers)
    if (agentData.mcpTools && !agentData.mcpServers) {
      agentData.mcpServers = Object.keys(agentData.mcpTools);
      // Also preserve mcpTools in metadata for frontend
      if (!agentData.metadata) agentData.metadata = {};
      agentData.metadata.mcpTools = agentData.mcpTools;
    }

    // Transform skill names to skill IDs (Strapi expects skill documentIds, not names)
    if (agentData.skills && Array.isArray(agentData.skills) && agentData.skills.length > 0) {
      try {
        const allSkills = await strapiClient.getAllSkills();
        const skillNameToId = new Map(allSkills.map(s => [s.name, s.id]));

        // Save original skill names to metadata BEFORE transforming to IDs
        if (!agentData.metadata) agentData.metadata = {};
        agentData.metadata.skills = [...agentData.skills]; // Preserve skill names for frontend

        agentData.skills = agentData.skills
          .map((skillName: string) => skillNameToId.get(skillName))
          .filter((id: string | undefined) => id !== undefined);
      } catch (err) {
        logger.error('Failed to transform skill names to IDs during create', { error: err });
      }
    }

    const validated = createAgentSchema.parse(agentData);

    logger.info('Creating agent in Strapi', { name: validated.name });

    const agent = await strapiClient.createAgent(validated);

    res.status(201).json({
      success: true,
      agentId: agent.id,
      filePath: `strapi://${agent.id}`,
      message: `Agent "${agent.name}" created successfully in Strapi`
    });
  }));

  /**
   * PUT /api/strapi/agents/:id
   * Update an existing agent
   */
  router.put('/agents/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = agentIdSchema.parse(req.params);
    // Frontend sends { directory, agent }, extract agent data
    const agentData = req.body.agent || req.body;

    // Transform mcpTools to mcpServers if present (frontend uses mcpTools, backend expects mcpServers)
    if (agentData.mcpTools && !agentData.mcpServers) {
      agentData.mcpServers = Object.keys(agentData.mcpTools);
      // Also preserve mcpTools in metadata for frontend
      if (!agentData.metadata) agentData.metadata = {};
      agentData.metadata.mcpTools = agentData.mcpTools;
    }

    // Transform skill names to skill IDs (Strapi expects skill documentIds, not names)
    if (agentData.skills && Array.isArray(agentData.skills) && agentData.skills.length > 0) {
      try {
        const allSkills = await strapiClient.getAllSkills();
        const skillNameToId = new Map(allSkills.map(s => [s.name, s.id]));

        // Save original skill names to metadata BEFORE transforming to IDs
        if (!agentData.metadata) agentData.metadata = {};
        agentData.metadata.skills = [...agentData.skills]; // Preserve skill names for frontend

        agentData.skills = agentData.skills
          .map((skillName: string) => skillNameToId.get(skillName))
          .filter((id: string | undefined) => id !== undefined);

        logger.info('Transformed skill names to IDs', { transformedIds: agentData.skills });
      } catch (err) {
        logger.error('Failed to transform skill names to IDs', { error: err });
      }
    }

    const validated = updateAgentSchema.parse(agentData);

    logger.info('Updating agent in Strapi', { id, updates: Object.keys(validated) });

    const agent = await strapiClient.updateAgent(id, validated);

    res.json({
      success: true,
      agentId: agent.id,
      filePath: `strapi://${agent.id}`,
      message: `Agent "${agent.name}" updated successfully in Strapi`
    });
  }));

  /**
   * DELETE /api/strapi/agents/:id
   * Delete an agent
   */
  router.delete('/agents/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = agentIdSchema.parse(req.params);

    logger.info('Deleting agent from Strapi', { id });

    await strapiClient.deleteAgent(id);

    res.status(204).send();
  }));

  // ============= SKILLS =============

  /**
   * GET /api/strapi/skills
   * List all skills with optional filtering
   */
  router.get('/skills', asyncHandler(async (req: Request, res: Response) => {
    const query = skillQuerySchema.parse(req.query);

    logger.debug('Fetching skills from Strapi', { query });

    const filters: any = {};

    if (query.search) {
      filters.$or = [
        { name: { $containsi: query.search } },
        { description: { $containsi: query.search } }
      ];
    }

    const skills = await strapiClient.getAllSkills({
      filters
    });

    res.json({
      data: skills,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: skills.length
      }
    });
  }));

  /**
   * GET /api/strapi/skills/:id
   * Get a single skill by ID
   */
  router.get('/skills/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = skillIdSchema.parse(req.params);

    logger.debug('Fetching skill from Strapi', { id });

    const skill = await strapiClient.getSkill(id);

    if (!skill) {
      throw new AppError(404, 'Skill not found');
    }

    res.json(skill);
  }));

  /**
   * POST /api/strapi/skills
   * Create a new skill
   */
  router.post('/skills', asyncHandler(async (req: Request, res: Response) => {
    const validated = createSkillSchema.parse(req.body);

    logger.info('Creating skill in Strapi', { name: validated.name, body: JSON.stringify(validated, null, 2) });

    // Transform CreateSkillDTO to Skill format for Strapi
    const skillData: any = {
      name: validated.name,
      displayName: validated.displayName,
      description: validated.description,
      skillmd: validated.skillmd,
      experienceScore: validated.experienceScore,
      // Phase 1: New metadata fields
      category: validated.category || 'custom',
      isPublic: validated.isPublic !== undefined ? validated.isPublic : true,
      version: validated.version || '1.0.0',
      license: validated.license || undefined,
    };

    // Transform allowedTools and disallowedTools to toolConfig component
    if ((validated.allowedTools && validated.allowedTools.length > 0) ||
        (validated.disallowedTools && validated.disallowedTools.length > 0)) {
      skillData.toolConfig = {
        allowedTools: validated.allowedTools || [],
        disallowedTools: validated.disallowedTools || [],
      };
    }

    // Transform mcpTools (Record<serverId, toolNames[]>) to mcpConfig component
    if (validated.mcpTools && Object.keys(validated.mcpTools).length > 0) {
      const mcpConfig = [];

      // Get all MCP servers and tools for mapping
      const allMCPServers = await strapiClient.getAllMCPServers({ populate: true });

      for (const [serverId, toolNames] of Object.entries(validated.mcpTools)) {
        // Find server by ID (frontend sends documentId as serverId)
        logger.info(`Looking for MCP server`, {
          serverId,
          serverIds: allMCPServers.map(s => ({ id: s.id, name: s.name }))
        });
        const server = allMCPServers.find(s => s.id === serverId);
        if (!server) {
          logger.warn(`MCP Server not found: ${serverId}`);
          continue;
        }

        // Map tool names to tool IDs
        const selectedTools = [];
        for (const toolName of toolNames) {
          const tool = server.mcpTools?.find(t =>
            (typeof t === 'string' ? t : t.name) === toolName
          );
          if (tool) {
            const toolId = typeof tool === 'string' ? tool : tool.id;
            selectedTools.push({ mcpTool: toolId });
          } else {
            logger.warn(`MCP Tool not found: ${toolName} in server ${server.name}`);
          }
        }

        if (selectedTools.length > 0) {
          mcpConfig.push({
            mcpServer: server.id,
            selectedTools
          });
        }
      }

      if (mcpConfig.length > 0) {
        skillData.mcpConfig = mcpConfig;
      }
    }

    // Transform inputFields to component array
    if (validated.inputFields && validated.inputFields.length > 0) {
      skillData.inputFields = validated.inputFields;
    }

    // Phase 2: Model configuration
    if (validated.modelConfig) {
      skillData.modelConfig = validated.modelConfig;
    }

    // Phase 3: Additional files
    if (validated.additionalFiles && validated.additionalFiles.length > 0) {
      skillData.additionalFiles = validated.additionalFiles.map(f => ({
        file: f.fileId,
        fileType: f.fileType,
        description: f.description,
        displayOrder: f.displayOrder
      }));
    }

    const skill = await strapiClient.createSkill(skillData);

    res.status(201).json({
      success: true,
      skill,
      message: 'Skill created successfully'
    });
  }));

  /**
   * PUT /api/strapi/skills/:id
   * Update an existing skill
   */
  router.put('/skills/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = skillIdSchema.parse(req.params);

    // DEBUG: Log raw request body
    logger.info('[DEBUG] Raw req.body before validation', {
      id,
      hasAdditionalFiles: 'additionalFiles' in req.body,
      additionalFilesType: typeof req.body.additionalFiles,
      additionalFilesLength: Array.isArray(req.body.additionalFiles) ? req.body.additionalFiles.length : 'not an array',
      bodyKeys: Object.keys(req.body)
    });

    const validated = updateSkillSchema.parse(req.body);

    // DEBUG: Log validated object
    logger.info('[DEBUG] Validated object after parsing', {
      id,
      hasAdditionalFiles: 'additionalFiles' in validated,
      additionalFilesLength: Array.isArray(validated.additionalFiles) ? validated.additionalFiles.length : 'not an array',
      validatedKeys: Object.keys(validated)
    });

    logger.info('Updating skill in Strapi', { id, updates: Object.keys(validated) });

    // Transform UpdateSkillDTO to Skill format for Strapi
    const skillData: any = {
      description: validated.description,
      skillmd: validated.skillmd,
    };

    // Phase 1: Update metadata fields if provided
    if (validated.category !== undefined) {
      skillData.category = validated.category;
    }
    if (validated.isPublic !== undefined) {
      skillData.isPublic = validated.isPublic;
    }
    if (validated.version !== undefined) {
      skillData.version = validated.version;
    }
    if (validated.license !== undefined) {
      skillData.license = validated.license;
    }

    // Transform allowedTools and disallowedTools to toolConfig component
    if (validated.allowedTools !== undefined || validated.disallowedTools !== undefined) {
      const hasAllowedTools = validated.allowedTools && validated.allowedTools.length > 0;
      const hasDisallowedTools = validated.disallowedTools && validated.disallowedTools.length > 0;

      if (hasAllowedTools || hasDisallowedTools) {
        skillData.toolConfig = {
          allowedTools: validated.allowedTools || [],
          disallowedTools: validated.disallowedTools || [],
        };
      } else {
        skillData.toolConfig = null; // Clear if both empty
      }
    }

    // Transform mcpTools (Record<serverId, toolNames[]>) to mcpConfig component
    if (validated.mcpTools !== undefined) {
      if (validated.mcpTools && Object.keys(validated.mcpTools).length > 0) {
        const mcpConfig = [];

        // Get all MCP servers and tools for mapping
        const allMCPServers = await strapiClient.getAllMCPServers({ populate: true });

        for (const [serverId, toolNames] of Object.entries(validated.mcpTools)) {
          // Find server by ID (frontend sends documentId as serverId)
          logger.info(`[UPDATE] Looking for MCP server`, {
            serverId,
            serverIds: allMCPServers.map(s => ({ id: s.id, name: s.name }))
          });
          const server = allMCPServers.find(s => s.id === serverId);
          if (!server) {
            logger.warn(`MCP Server not found: ${serverId}`);
            continue;
          }

          // Map tool names to tool IDs
          const selectedTools = [];
          for (const toolName of toolNames) {
            const tool = server.mcpTools?.find(t =>
              (typeof t === 'string' ? t : t.name) === toolName
            );
            if (tool) {
              const toolId = typeof tool === 'string' ? tool : tool.id;
              selectedTools.push({ mcpTool: toolId });
            } else {
              logger.warn(`MCP Tool not found: ${toolName} in server ${server.name}`);
            }
          }

          if (selectedTools.length > 0) {
            mcpConfig.push({
              mcpServer: server.id,
              selectedTools
            });
          }
        }

        skillData.mcpConfig = mcpConfig.length > 0 ? mcpConfig : null;
      } else {
        skillData.mcpConfig = null; // Clear if empty
      }
    }

    // Transform inputFields to component array
    if (validated.inputFields !== undefined) {
      if (validated.inputFields && validated.inputFields.length > 0) {
        skillData.inputFields = validated.inputFields;
      } else {
        skillData.inputFields = null; // Clear if empty
      }
    }

    // Phase 2: Model configuration
    if (validated.modelConfig !== undefined) {
      skillData.modelConfig = validated.modelConfig || null;
    }

    // Phase 3: Additional files
    if (validated.additionalFiles !== undefined) {
      if (validated.additionalFiles && validated.additionalFiles.length > 0) {
        skillData.additionalFiles = validated.additionalFiles.map(f => ({
          file: f.fileId,
          fileType: f.fileType,
          description: f.description,
          displayOrder: f.displayOrder
        }));
      } else {
        skillData.additionalFiles = null; // Clear if empty
      }
    }

    const skill = await strapiClient.updateSkill(id, skillData);

    res.json({
      success: true,
      skill,
      message: 'Skill updated successfully'
    });
  }));

  /**
   * DELETE /api/strapi/skills/:id
   * Delete a skill
   */
  router.delete('/skills/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = skillIdSchema.parse(req.params);

    logger.info('Deleting skill from Strapi', { id });

    await strapiClient.deleteSkill(id);

    res.status(204).send();
  }));

  /**
   * POST /api/strapi/skills/:id/train/message
   * Interactive conversational training endpoint for Strapi skills
   * Stream skill training conversation with Training Agent
   */
  router.post('/skills/:id/train/message', asyncHandler(async (req: Request, res: Response) => {
    const { id: skillId } = skillIdSchema.parse(req.params);
    const { directory, conversationHistory } = req.body;
    const projectPath = (directory as string) || process.cwd();

    logger.info('Interactive training message (Strapi)', {
      skillId,
      directory: projectPath,
      historyLength: conversationHistory?.length || 0
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get skill from Strapi
    const skill = await strapiClient.getSkill(skillId);

    if (!skill) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Skill not found in database'
      })}\n\n`);
      res.end();
      return;
    }

    // Import ClaudeStructureParser to get training agent from local filesystem
    const { ClaudeStructureParser } = await import('@/services/claude-structure-parser.js');
    const parser = new ClaudeStructureParser();

    // Get training agent from local filesystem
    const agents = await parser.parseAgents(projectPath);
    const trainingAgent = agents.find(a => a.id === 'training-agent');

    if (!trainingAgent) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Training agent not found. Please ensure training-agent.md exists in .claude/agents/'
      })}\n\n`);
      res.end();
      return;
    }

    // Send initial status
    res.write(`data: ${JSON.stringify({
      type: 'status',
      status: 'processing',
      message: 'Processing training message...'
    })}\n\n`);

    // Import SDK service
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    try {
      // Get conversation history and build comprehensive prompt
      const history = conversationHistory || [];

      // Build prompt with conversation context
      let fullPrompt = '';

      if (history.length === 0) {
        // First message - start training
        fullPrompt = `Train the skill: ${skill.name}

Skill ID (Strapi): ${skill.id}
Current Experience Score: ${skill.experienceScore || 0}%

Please begin the training process. You can now interact with the user if you need input.`;
      } else if (history.length === 1 && history[0].role === 'user' && history[0].content === '__START_TRAINING__') {
        // Auto-start message from client
        fullPrompt = `Train the skill: ${skill.name}

Skill ID (Strapi): ${skill.id}
Current Experience Score: ${skill.experienceScore || 0}%

Please begin the training process. You can now interact with the user if you need input.`;
      } else {
        // Subsequent messages - include conversation history
        fullPrompt = 'Previous conversation:\n\n';
        for (let i = 0; i < history.length - 1; i++) {
          const msg = history[i];
          fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
        }
        fullPrompt += '---\n\n';

        // Add current user message
        const lastMessage = history[history.length - 1];
        fullPrompt += lastMessage?.content || 'Continue training.';
      }

      // Parse tools from training agent
      let allowedTools = trainingAgent.metadata?.tools || trainingAgent.metadata?.allowedTools;

      if (allowedTools && typeof allowedTools === 'string') {
        allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
      }

      logger.info('Training agent tools', { allowedTools });

      // Load MCP configuration helper (from manager.routes.ts)
      async function loadMcpConfig(projectPath: string): Promise<Record<string, any> | undefined> {
        try {
          const path = await import('path');
          const fs = await import('fs/promises');
          const mcpConfigPath = path.join(projectPath, '.mcp.json');
          const content = await fs.readFile(mcpConfigPath, 'utf-8');
          const config = JSON.parse(content);

          if (config.mcpServers && typeof config.mcpServers === 'object') {
            return config.mcpServers;
          }

          return undefined;
        } catch (error) {
          logger.debug('No MCP config found', { projectPath, error: (error as Error).message });
          return undefined;
        }
      }

      // Load MCP configuration
      let mcpServers = await loadMcpConfig(projectPath);

      // Filter MCP servers if training agent specifies them
      if (trainingAgent.metadata?.mcpTools && mcpServers) {
        const allowedServerNames = Object.keys(trainingAgent.metadata.mcpTools);
        const filteredServers: Record<string, any> = {};

        for (const serverName of allowedServerNames) {
          if (mcpServers[serverName]) {
            filteredServers[serverName] = mcpServers[serverName];
          }
        }

        mcpServers = filteredServers;
      }

      // Disallow tools not in training agent's allowed list
      let disallowedTools: string[] | undefined;
      const allBuiltInTools = [
        'WebFetch', 'WebSearch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
        'Task', 'TodoWrite', 'ExitPlanMode', 'NotebookEdit', 'BashOutput',
        'KillShell', 'AskUserQuestion', 'Skill', 'SlashCommand'
      ];

      if (allowedTools && Array.isArray(allowedTools) && allowedTools.length > 0) {
        disallowedTools = allBuiltInTools.filter(tool => !allowedTools.includes(tool));
      }

      const queryInstance = query({
        prompt: fullPrompt,
        options: {
          systemPrompt: trainingAgent.content,
          model: 'claude-sonnet-4-5',
          cwd: projectPath,
          disallowedTools,
          mcpServers: mcpServers as any,
          permissionMode: 'bypassPermissions' as any,
          stderr: (data: string) => {
            logger.debug('Training agent stderr', { stderr: data });
          },
        }
      });

      // Stream responses
      for await (const message of queryInstance) {
        logger.debug('Training message', { type: message.type });

        // Send message to client
        res.write(`data: ${JSON.stringify({
          type: 'message',
          messageType: message.type,
          content: message
        })}\n\n`);
      }

      // Send completion
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        message: 'Training message completed'
      })}\n\n`);

      logger.info('Training message completed (Strapi)', { skillId });

    } catch (execError) {
      logger.error('Training message execution error (Strapi)', execError);

      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: execError instanceof Error ? execError.message : 'Unknown error during training'
      })}\n\n`);
    }

    res.end();
  }));

  // ============= MCP SERVERS =============

  /**
   * GET /api/strapi/mcp-servers
   * List all MCP servers with optional filtering
   */
  router.get('/mcp-servers', asyncHandler(async (req: Request, res: Response) => {
    const query = mcpServerQuerySchema.parse(req.query);

    logger.debug('Fetching MCP servers from Strapi', { query });

    const filters: any = {};

    if (query.disabled !== undefined) {
      filters.disabled = query.disabled;
    }

    if (query.transport) {
      filters.transport = query.transport;
    }

    if (query.search) {
      filters.$or = [
        { name: { $containsi: query.search } }
      ];
    }

    const mcpServers = await strapiClient.getAllMCPServers({
      filters,
      populate: true // Populate mcpTools relation
    });

    res.json({
      data: mcpServers,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: mcpServers.length
      }
    });
  }));

  /**
   * GET /api/strapi/mcp-servers/:id
   * Get a single MCP server by ID
   */
  router.get('/mcp-servers/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = mcpServerIdSchema.parse(req.params);

    logger.debug('Fetching MCP server from Strapi', { id });

    const mcpServer = await strapiClient.getMCPServer(id);

    if (!mcpServer) {
      throw new AppError(404, 'MCP Server not found');
    }

    res.json(mcpServer);
  }));

  /**
   * POST /api/strapi/mcp-servers
   * Create a new MCP server
   */
  router.post('/mcp-servers', asyncHandler(async (req: Request, res: Response) => {
    // Frontend sends { name, config, directory }
    // Extract and flatten the config object
    const { name, config, directory } = req.body;
    const projectPath = (directory as string) || process.cwd();

    const mcpData = {
      name,
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      disabled: config.disabled || false,
      transport: config.type || 'stdio' // Map config.type to transport
    };

    const validated = createMCPServerSchema.parse(mcpData);

    logger.info('Creating MCP server in Strapi', { name: validated.name });

    const mcpServer = await strapiClient.createMCPServer(validated);

    // Auto-fetch tools after creation (non-blocking)
    const mcpService = new MCPService();
    mcpService.listMCPServerTools(mcpServer.name, projectPath)
      .then(result => {
        if (result.success && result.tools.length > 0) {
          logger.info('Auto-fetched tools for new MCP server', {
            id: mcpServer.id,
            toolsCount: result.tools.length
          });
          return strapiClient.bulkSyncMCPTools(mcpServer.id, result.tools);
        }
      })
      .catch(error => {
        logger.warn('Failed to auto-fetch tools for new MCP server', {
          id: mcpServer.id,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    // Sync to .mcp.json (non-blocking)
    const allServers = await strapiClient.getAllMCPServers({});
    mcpService.syncToMcpJson(allServers, projectPath)
      .catch(error => {
        logger.warn('Failed to sync MCP servers to .mcp.json', { error });
      });

    res.status(201).json(mcpServer);
  }));

  /**
   * PUT /api/strapi/mcp-servers/:id
   * Update an existing MCP server
   */
  router.put('/mcp-servers/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = mcpServerIdSchema.parse(req.params);

    // Frontend sends { config, directory }
    // Extract and flatten the config object
    const { config } = req.body;

    const mcpData: any = {};

    if (config.command !== undefined) mcpData.command = config.command;
    if (config.args !== undefined) mcpData.args = config.args;
    if (config.env !== undefined) mcpData.env = config.env;
    if (config.disabled !== undefined) mcpData.disabled = config.disabled;
    if (config.type !== undefined) mcpData.transport = config.type; // Map config.type to transport

    const validated = updateMCPServerSchema.parse(mcpData);

    logger.info('Updating MCP server in Strapi', { id, updates: Object.keys(validated) });

    const mcpServer = await strapiClient.updateMCPServer(id, validated);

    res.json(mcpServer);
  }));

  /**
   * DELETE /api/strapi/mcp-servers/:id
   * Delete an MCP server
   */
  router.delete('/mcp-servers/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = mcpServerIdSchema.parse(req.params);

    logger.info('Deleting MCP server from Strapi', { id });

    await strapiClient.deleteMCPServer(id);

    res.status(204).send();
  }));

  /**
   * GET /api/strapi/mcp-servers/:id/tools
   * List tools provided by an MCP server
   */
  router.get('/mcp-servers/:id/tools', asyncHandler(async (req: Request, res: Response) => {
    const { id } = mcpServerIdSchema.parse(req.params);
    const { directory } = req.query;
    const projectPath = (directory as string) || process.cwd();

    logger.info('Fetching MCP server tools', { id, projectPath });

    // Get MCP server from Strapi
    const mcpServer = await strapiClient.getMCPServer(id);

    if (!mcpServer) {
      throw new AppError(404, 'MCP Server not found');
    }

    // Use MCP service to fetch tools
    const mcpService = new MCPService();

    // Convert Strapi format to MCP service format
    const serverConfig = {
      type: mcpServer.transport || 'stdio',
      command: mcpServer.command,
      args: mcpServer.args || [],
      env: mcpServer.env || {},
      disabled: mcpServer.disabled || false
    };

    // Fetch tools based on server type
    const result = await mcpService.listMCPServerTools(mcpServer.name, projectPath);

    logger.info('MCP server tools fetched', {
      id,
      toolsCount: result.tools.length,
      success: result.success
    });

    res.json(result);
  }));

  /**
   * POST /api/strapi/mcp-servers/:id/refresh-tools
   * Refresh tools for an MCP server
   */
  router.post('/mcp-servers/:id/refresh-tools', asyncHandler(async (req: Request, res: Response) => {
    const { id } = mcpServerIdSchema.parse(req.params);
    const { directory } = req.body;
    const projectPath = (directory as string) || process.cwd();

    try {
      logger.info('Refreshing MCP server tools', { id, projectPath });

      // Get MCP server from Strapi
      const mcpServer = await strapiClient.getMCPServer(id);

      if (!mcpServer) {
        throw new AppError(404, 'MCP Server not found');
      }

      logger.info('Fetching tools from MCP server', { serverName: mcpServer.name });

      // Use MCP service to fetch tools
      const mcpService = new MCPService();
      const result = await mcpService.listMCPServerTools(mcpServer.name, projectPath);

      logger.info('MCP service returned', { success: result.success, toolsCount: result.tools?.length || 0 });

      if (result.success && result.tools.length > 0) {
        logger.info('Syncing tools to Strapi', { toolsCount: result.tools.length });

        // Sync tools to Strapi (create/update/delete as relational entities)
        const updatedServer = await strapiClient.bulkSyncMCPTools(id, result.tools);

        logger.info('MCP server tools refreshed and synced to Strapi', {
          id,
          toolsCount: updatedServer.mcpTools?.length || 0
        });

        res.json({
          success: true,
          toolsCount: updatedServer.mcpTools?.length || 0,
          tools: updatedServer.mcpTools || []
        });
      } else {
        res.json({
          success: false,
          error: result.error || 'No tools found',
          toolsCount: 0,
          tools: []
        });
      }
    } catch (error) {
      logger.error('Failed to refresh MCP server tools', {
        id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }));

  // ============= TASKS =============

  /**
   * GET /api/strapi/tasks
   * List all tasks with optional filtering
   */
  router.get('/tasks', asyncHandler(async (req: Request, res: Response) => {
    const query = taskQuerySchema.parse(req.query);

    logger.debug('Fetching tasks from Strapi', { query });

    const filters: any = {};

    if (query.status) {
      filters.status = query.status;
    }

    if (query.agentId) {
      filters.agentId = query.agentId;
    }

    if (query.search) {
      filters.$or = [
        { title: { $containsi: query.search } },
        { description: { $containsi: query.search } }
      ];
    }

    const tasks = await strapiClient.getAllTasks({
      filters,
      sort: [query.sort],
      pagination: {
        page: query.page,
        pageSize: query.pageSize
      }
    });

    res.json({
      data: tasks,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: tasks.length
      }
    });
  }));

  /**
   * GET /api/strapi/tasks/:id
   * Get a single task by ID
   */
  router.get('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = taskIdSchema.parse(req.params);

    logger.debug('Fetching task from Strapi', { id });

    const task = await strapiClient.getTask(id);

    if (!task) {
      throw new AppError(404, 'Task not found');
    }

    res.json(task);
  }));

  /**
   * POST /api/strapi/tasks
   * Create a new task
   */
  router.post('/tasks', asyncHandler(async (req: Request, res: Response) => {
    // Frontend sends { name, description, agentId, userPrompt, taskType, permissionMode, inputValues, directory }
    // Backend expects { agentId, message, metadata }
    const { name, description, agentId, userPrompt, taskType, permissionMode, inputValues, directory, ...rest } = req.body;

    const taskData = {
      agentId: agentId,
      message: userPrompt || name, // Use userPrompt as message, fallback to name
      metadata: {
        name,
        description,
        taskType,
        permissionMode,
        inputValues,
        directory,
        ...rest
      }
    };

    const validated = createTaskSchema.parse(taskData);

    logger.info('Creating task in Strapi', { agentId: validated.agentId, message: validated.message });

    const task = await strapiClient.createTask(validated);

    res.status(201).json(task);
  }));

  /**
   * PUT /api/strapi/tasks/:id
   * Update an existing task
   */
  router.put('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = taskIdSchema.parse(req.params);
    const validated = updateTaskSchema.parse(req.body);

    logger.info('Updating task in Strapi', { id, updates: Object.keys(validated) });

    const task = await strapiClient.updateTask(id, validated);

    res.json(task);
  }));

  /**
   * DELETE /api/strapi/tasks/:id
   * Delete a task
   */
  router.delete('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = taskIdSchema.parse(req.params);

    logger.info('Deleting task from Strapi', { id });

    await strapiClient.deleteTask(id);

    res.status(204).send();
  }));

  // ============= FILE UPLOAD =============

  // Configure multer for memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });

  /**
   * POST /api/strapi/upload
   * Upload a file to Strapi Media Library
   */
  router.post('/upload', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, 'No file provided');
    }

    logger.info('Uploading file to Strapi', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const uploadedFile = await strapiClient.uploadFile(
      req.file.buffer,
      req.file.originalname
    );

    logger.info('File uploaded successfully', {
      fileId: uploadedFile.documentId,
      filename: uploadedFile.name
    });

    res.json(uploadedFile);
  }));

  /**
   * DELETE /api/strapi/upload/:fileId
   * Delete a file from Strapi Media Library
   */
  router.delete('/upload/:fileId', asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;

    if (!fileId) {
      throw new AppError(400, 'File ID is required');
    }

    logger.info('Deleting file from Strapi', { fileId });

    await strapiClient.deleteFile(fileId);

    res.status(204).send();
  }));

  // ============= HEALTH CHECK =============

  /**
   * GET /api/strapi/health
   * Check Strapi connection health
   */
  router.get('/health', asyncHandler(async (req: Request, res: Response) => {
    const isHealthy = await strapiClient.healthCheck();

    if (isHealthy) {
      res.json({
        status: 'healthy',
        message: 'Strapi connection is active',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new AppError(503, 'Strapi connection failed');
    }
  }));

  return router;
}
