import { Router, Request, Response } from 'express';
import { createLogger } from '@/services/logger.js';
import { ClaudeStructureParser } from '@/services/claude-structure-parser.js';
import { MCPService } from '@/services/mcp-service.js';
import { createSkill, updateSkill, validateSkillReferences, getSkillsWithUsageInfo, updateSkillExperience, getSkillTrainingHistory } from '@/services/skill-service.js';
import { selectTrainingAgent } from '@/services/training-agent-selector.js';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export function createManagerRoutes(): Router {
  const router = Router();
  const logger = createLogger('ManagerRoutes');
  const parser = new ClaudeStructureParser();
  const mcpService = new MCPService();

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
   * Validate Claude setup (CLI, SDK, .claude folder)
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { directoryPath } = req.body;
      const projectPath = directoryPath || process.cwd();

      const results = {
        cli: { status: 'success', message: 'Claude CLI found' },
        sdk: { status: 'success', message: 'Claude SDK installed' },
        folder: { status: 'error', message: '.claude folder not found' },
        agents: { status: 'success', message: 'Agents parsed', count: 0 },
        commands: { status: 'success', message: 'Slash commands parsed', count: 0 },
        skills: { status: 'success', message: 'Skills parsed', count: 0 }
      };

      // Analyze project structure
      const analysis = await parser.analyzeProject(projectPath);

      if (analysis.hasClaudeFolder) {
        results.folder.status = 'success';
        results.folder.message = '.claude folder found';
      }

      results.agents.count = analysis.agents.length;
      results.agents.message = `Found ${analysis.agents.length} agents`;

      results.commands.count = analysis.commands.length;
      results.commands.message = `Found ${analysis.commands.length} slash commands`;

      results.skills.count = analysis.skills.length;
      results.skills.message = `Found ${analysis.skills.length} skills`;

      res.json(results);
    } catch (error) {
      logger.error('Validation error', error);
      res.status(500).json({ error: 'Validation failed' });
    }
  });

  /**
   * Get list of agents
   */
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const agents = await parser.parseAgents(projectPath);

      console.log(`List agents: found ${agents.length} agents`);
      agents.forEach(agent => {
        if (agent.metadata?.inputFields && agent.metadata.inputFields.length > 0) {
          console.log(`  - Agent ${agent.id} has ${agent.metadata.inputFields.length} input fields`);
        }
      });

      res.json({ agents });
    } catch (error) {
      logger.error('Get agents error', error);
      res.status(500).json({ error: 'Failed to get agents' });
    }
  });

  /**
   * Get list of slash commands
   */
  router.get('/commands', async (req: Request, res: Response) => {
    try {
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const commands = await parser.parseSlashCommands(projectPath);

      res.json({ commands });
    } catch (error) {
      logger.error('Get commands error', error);
      res.status(500).json({ error: 'Failed to get slash commands' });
    }
  });

  /**
   * Get list of skills
   */
  router.get('/skills', async (req: Request, res: Response) => {
    try {
      const { directory, includeUsage } = req.query;
      const projectPath = (directory as string) || process.cwd();

      // If includeUsage is requested, return skills with usage info
      if (includeUsage === 'true') {
        const skills = await getSkillsWithUsageInfo(projectPath);
        res.json({ skills });
      } else {
        const skills = await parser.parseSkills(projectPath);
        res.json({ skills });
      }
    } catch (error) {
      logger.error('Get skills error', error);
      res.status(500).json({ error: 'Failed to get skills' });
    }
  });

  /**
   * Get full project analysis (commands + skills)
   */
  router.get('/analyze', async (req: Request, res: Response) => {
    try {
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const analysis = await parser.analyzeProject(projectPath);

      res.json(analysis);
    } catch (error) {
      logger.error('Project analysis error', error);
      res.status(500).json({ error: 'Failed to analyze project' });
    }
  });

  /**
   * Get agent details by ID
   */
  router.get('/agents/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const agents = await parser.parseAgents(projectPath);
      const agent = agents.find(a => a.id === id);

      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      console.log(`Sending agent ${agent.id} to frontend:`, {
        hasInputFields: !!agent.metadata?.inputFields,
        inputFieldsCount: agent.metadata?.inputFields?.length || 0,
        inputFields: JSON.stringify(agent.metadata?.inputFields, null, 2)
      });

      res.json({ agent });
    } catch (error) {
      logger.error('Get agent error', error);
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  /**
   * Get command details by ID
   */
  router.get('/commands/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const commands = await parser.parseSlashCommands(projectPath);
      const command = commands.find(c => c.id === id);

      if (!command) {
        res.status(404).json({ error: 'Command not found' });
        return;
      }

      res.json({ command });
    } catch (error) {
      logger.error('Get command error', error);
      res.status(500).json({ error: 'Failed to get command' });
    }
  });

  /**
   * Get skill details by ID
   */
  router.get('/skills/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const skills = await parser.parseSkills(projectPath);
      const skill = skills.find(s => s.id === id);

      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json({ skill });
    } catch (error) {
      logger.error('Get skill error', error);
      res.status(500).json({ error: 'Failed to get skill' });
    }
  });

  /**
   * Get usage information for all skills or a specific skill
   */
  router.get('/skills-usage', async (req: Request, res: Response) => {
    try {
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      // Get all skills with usage info
      const skills = await getSkillsWithUsageInfo(projectPath);

      // Format response with just usage data
      const usageData = skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        usedInAgents: skill.usedInAgents || [],
        usageCount: skill.usageCount || 0,
      }));

      res.json({ skills: usageData });
    } catch (error) {
      logger.error('Get skills usage error', error);
      res.status(500).json({ error: 'Failed to get skills usage' });
    }
  });

  /**
   * Create a new skill manually
   */
  router.post('/skills', async (req: Request, res: Response) => {
    try {
      const { directory, name, description, allowedTools, mcpTools, content } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Manual skill creation requested', {
        directory: projectPath,
        skillName: name,
        hasAllowedTools: !!allowedTools,
        hasMcpTools: !!mcpTools,
      });

      // Validate required fields
      if (!name || !description || !content) {
        res.status(400).json({
          error: 'Missing required fields: name, description, content'
        });
        return;
      }

      // Create skill using skill-service
      const result = await createSkill(
        {
          name,
          description,
          allowedTools,
          mcpTools,
          content,
        },
        projectPath
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      logger.info('Skill created successfully', { name, path: result.path });

      res.json({
        success: true,
        skill: result.skill,
        path: result.path,
        message: `Skill "${name}" created successfully`,
      });
    } catch (error) {
      logger.error('Create skill error', error);
      res.status(500).json({ error: 'Failed to create skill' });
    }
  });

  /**
   * Update an existing skill
   */
  router.put('/skills/:id', async (req: Request, res: Response) => {
    try {
      const skillId = req.params.id;
      const { directory, description, allowedTools, mcpTools, content } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Manual skill update requested', {
        directory: projectPath,
        skillId,
        hasAllowedTools: !!allowedTools,
        hasMcpTools: !!mcpTools,
      });

      // Validate required fields
      if (!description || !content) {
        res.status(400).json({
          error: 'Missing required fields: description, content'
        });
        return;
      }

      // Update skill using skill-service
      const result = await updateSkill(
        skillId,
        {
          description,
          allowedTools,
          mcpTools,
          content,
        },
        projectPath
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      logger.info('Skill updated successfully', { skillId, path: result.path });

      res.json({
        success: true,
        skill: result.skill,
        path: result.path,
        message: `Skill "${skillId}" updated successfully`,
      });
    } catch (error) {
      logger.error('Update skill error', error);
      res.status(500).json({ error: 'Failed to update skill' });
    }
  });

  /**
   * Start training session for a skill (SSE endpoint)
   */
  router.post('/skills/:id/train', async (req: Request, res: Response) => {
    try {
      const { id: skillId } = req.params;
      const { directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Skill training requested', { skillId, directory: projectPath });

      // Get skill details
      const skills = await parser.parseSkills(projectPath);
      const skill = skills.find(s => s.id === skillId);

      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      // Select appropriate training agent (skill override -> global config -> local fallback)
      let trainingAgent;
      try {
        trainingAgent = await selectTrainingAgent(skillId, projectPath);
        logger.info('Training agent selected', {
          agentId: trainingAgent.id,
          agentName: trainingAgent.name
        });
      } catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : 'Failed to select training agent' });
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial status
      res.write(`data: ${JSON.stringify({
        type: 'status',
        status: 'starting',
        message: `Starting training for skill: ${skill.name}`,
        skillId: skillId,
        currentScore: skill.experienceScore || 0
      })}\n\n`);

      // Import SDK service dynamically
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Build training prompt with skill information
      const trainingPrompt = `Train the skill: ${skill.name}

Skill Path: ${skill.skillMdPath}
Current Experience Score: ${skill.experienceScore || 0}%

Please analyze this skill, execute it, evaluate the results, and update the experience score.`;

      logger.info('Starting skill training execution', {
        skillId,
        skillName: skill.name,
        currentScore: skill.experienceScore || 0
      });

      // Send prompt info
      res.write(`data: ${JSON.stringify({
        type: 'assistant',
        content: trainingPrompt
      })}\n\n`);

      try {
        // Parse tools from training agent
        let allowedTools = trainingAgent.metadata?.tools || trainingAgent.metadata?.allowedTools;

        if (allowedTools && typeof allowedTools === 'string') {
          allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
        }

        logger.info('Training agent tools', { allowedTools });

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

        // Map model name
        const modelName = trainingAgent.metadata?.model === 'opus'
          ? 'claude-opus-4'
          : trainingAgent.metadata?.model === 'haiku'
          ? 'claude-haiku-4'
          : 'claude-sonnet-4-5';

        // Execute training agent using SDK
        const queryInstance = query({
          prompt: trainingPrompt,
          options: {
            systemPrompt: trainingAgent.content,
            model: modelName,
            cwd: projectPath,
            permissionMode: 'bypassPermissions' as any,
            disallowedTools,
            mcpServers: mcpServers as any,
          }
        });

        // Stream responses
        for await (const message of queryInstance) {
          // Send message to client
          res.write(`data: ${JSON.stringify({
            type: 'message',
            messageType: message.type,
            content: message
          })}\n\n`);
        }

        // Training completed successfully
        res.write(`data: ${JSON.stringify({
          type: 'status',
          status: 'completed',
          message: 'Training session completed'
        })}\n\n`);

      } catch (error) {
        logger.error('Training execution error', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error during training'
        })}\n\n`);
      }

      res.end();

    } catch (error) {
      logger.error('Training session error', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start training session' });
      }
    }
  });

  /**
   * Execute a skill with parameters
   * POST /skills/:id/execute
   */
  router.post('/skills/:id/execute', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory, userPrompt, parameters, permissionMode } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Skill execution requested', { id, directory: projectPath, permissionMode, parameters });

      // Get skill details
      const skills = await parser.parseSkills(projectPath);
      const skill = skills.find(s => s.id === id);

      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      // Validate parameters if skill has input fields
      if (skill.metadata?.inputFields) {
        for (const field of skill.metadata.inputFields) {
          if (field.required && (!parameters || !parameters[field.name])) {
            res.status(400).json({ error: `Required parameter missing: ${field.name}` });
            return;
          }
        }
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial status
      res.write(`data: ${JSON.stringify({
        type: 'status',
        status: 'starting',
        message: `Executing skill: ${skill.name}`
      })}\n\n`);

      // Import SDK service dynamically
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Inject parameters into skill content using template variable replacement
      let processedContent = skill.content;
      if (parameters && Object.keys(parameters).length > 0) {
        Object.entries(parameters).forEach(([key, value]) => {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          processedContent = processedContent.replace(regex, String(value));
        });
        logger.info('Parameters injected into skill content', { parameters });
      }

      // Build final system prompt with parameter context
      let systemPrompt = processedContent;
      if (parameters && Object.keys(parameters).length > 0) {
        const paramContext = Object.entries(parameters)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n');
        systemPrompt = `# Skill Parameters\n${paramContext}\n\n${processedContent}`;
      }

      // Build prompt
      const prompt = userPrompt || 'Execute the skill task';

      logger.info('Starting skill execution', {
        skillId: id,
        skillName: skill.name,
        prompt: prompt,
        hasParameters: !!parameters,
        tools: skill.metadata?.allowedTools
      });

      // Capture stderr for debugging
      let stderrOutput = '';

      try {
        // Parse tools
        let allowedTools = skill.metadata?.allowedTools;

        if (!allowedTools && skill.metadata?.mcpTools) {
          allowedTools = Object.values(skill.metadata.mcpTools).flat();
        }

        if (allowedTools && typeof allowedTools === 'string') {
          allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
        }

        logger.info('Parsed tools', { allowedTools, type: typeof allowedTools });

        // Load MCP configuration from .mcp.json
        const mcpServers = await loadMcpConfig(projectPath);

        // Map UI permission modes to CLI permission modes
        const cliPermissionMode = permissionMode === 'bypass' ? 'bypassPermissions' : permissionMode;

        // Execute skill using SDK
        const queryInstance = query({
          prompt,
          options: {
            systemPrompt: systemPrompt,
            model: 'claude-sonnet-4-5',
            cwd: projectPath,
            allowedTools: allowedTools && Array.isArray(allowedTools) ? allowedTools : undefined,
            mcpServers: mcpServers as any,
            permissionMode: (cliPermissionMode || 'default') as any,
            stderr: (data: string) => {
              stderrOutput += data;
              logger.debug('Skill execution stderr', { stderr: data });
            },
          },
        });

        // Stream responses
        for await (const message of queryInstance) {
          logger.debug('Skill execution message', { type: message.type });

          res.write(`data: ${JSON.stringify({
            type: 'message',
            messageType: message.type,
            content: message
          })}\n\n`);
        }

        // Send completion status
        res.write(`data: ${JSON.stringify({
          type: 'status',
          status: 'completed',
          message: 'Skill execution completed successfully'
        })}\n\n`);

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();

      } catch (sdkError) {
        logger.error('SDK execution error', sdkError, { stderrOutput });

        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: sdkError instanceof Error ? sdkError.message : 'Unknown SDK error',
          stderr: stderrOutput
        })}\n\n`);

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    } catch (error) {
      logger.error('Skill execution error', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } else {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    }
  });

  /**
   * Get training history for a skill
   */
  router.get('/skills/:id/training-history', async (req: Request, res: Response) => {
    try {
      const skillId = req.params.id;
      const directory = req.query.directory as string;
      const projectPath = directory || process.cwd();

      logger.info('Training history requested', { skillId, directory: projectPath });

      const result = await getSkillTrainingHistory(skillId, projectPath);

      if (!result.success) {
        res.status(404).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        history: result.history || [],
      });
    } catch (error) {
      logger.error('Get training history error', error);
      res.status(500).json({ error: 'Failed to get training history' });
    }
  });

  /**
   * Interactive conversational training endpoint
   * POST /skills/:id/train/message
   * Stream skill training conversation with Training Agent
   */
  router.post('/skills/:id/train/message', async (req: Request, res: Response) => {
    try {
      const { id: skillId } = req.params;
      const { directory, conversationHistory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Interactive training message', {
        skillId,
        directory: projectPath,
        historyLength: conversationHistory?.length || 0
      });

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Try to get skill from local filesystem first
      const skills = await parser.parseSkills(projectPath);
      let skill = skills.find(s => s.id === skillId);

      // If not found locally, try Strapi database
      if (!skill) {
        logger.info('Skill not found in local filesystem, checking Strapi database', { skillId });
        try {
          const { strapiClient } = await import('@/services/strapi-client.js');
          const strapiSkill = await strapiClient.getSkill(skillId);

          if (strapiSkill) {
            logger.info('Skill found in Strapi database', { skillId, skillName: strapiSkill.name });
            // Add missing fields for compatibility with local skill format
            skill = {
              ...strapiSkill,
              path: `strapi://${strapiSkill.id}`,
              skillMdPath: `strapi://${strapiSkill.id}`,
              content: strapiSkill.skillmd, // Map skillmd to content for compatibility
              trainingHistory: [], // Convert TrainingSession[] to TrainingRecord[] if needed
            } as any; // Type assertion for compatibility layer
          }
        } catch (strapiError) {
          logger.warn('Failed to fetch skill from Strapi', { skillId, error: strapiError });
        }
      }

      if (!skill) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Skill not found in local filesystem or database'
        })}\n\n`);
        res.end();
        return;
      }

      // Select appropriate training agent (skill override -> global config -> local fallback)
      let trainingAgent;
      try {
        trainingAgent = await selectTrainingAgent(skillId, projectPath);
        logger.info('Training agent selected', {
          agentId: trainingAgent.id,
          agentName: trainingAgent.name
        });
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Failed to select training agent'
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

Skill Path: ${skill.skillMdPath}
Current Experience Score: ${skill.experienceScore || 0}%

Please begin the training process. You can now interact with the user if you need input.`;
        } else if (history.length === 1 && history[0].role === 'user' && history[0].content === '__START_TRAINING__') {
          // Auto-start message from client
          fullPrompt = `Train the skill: ${skill.name}

Skill Path: ${skill.skillMdPath}
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

        logger.info('Training message completed', { skillId });

      } catch (execError) {
        logger.error('Training message execution error', execError);

        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: execError instanceof Error ? execError.message : 'Unknown error during training'
        })}\n\n`);
      }

      res.end();

    } catch (error) {
      logger.error('Training message error', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process training message' });
      }
    }
  });

  /**
   * Get Claude history directory path
   */
  router.get('/history-path', async (req: Request, res: Response) => {
    try {
      const historyDir = path.join(homedir(), '.claude', 'history');
      res.json({ path: historyDir });
    } catch (error) {
      logger.error('Get history path error', error);
      res.status(500).json({ error: 'Failed to get history path' });
    }
  });

  /**
   * Get available tools list
   */
  router.get('/tools', async (req: Request, res: Response) => {
    try {
      // Available tools from Claude Agent SDK
      const tools = [
        { name: 'Read', description: 'Read files from disk' },
        { name: 'Write', description: 'Write new files to disk' },
        { name: 'Edit', description: 'Edit existing files' },
        { name: 'Bash', description: 'Execute bash commands' },
        { name: 'Grep', description: 'Search for patterns in files' },
        { name: 'Glob', description: 'Find files by pattern' },
        { name: 'WebFetch', description: 'Fetch content from URLs' },
        { name: 'WebSearch', description: 'Search the web' },
        { name: 'AskUserQuestion', description: 'Ask user for input' },
        { name: 'TodoWrite', description: 'Manage todo list' },
      ];

      res.json({ tools });
    } catch (error) {
      logger.error('Get tools error', error);
      res.status(500).json({ error: 'Failed to get tools' });
    }
  });

  /**
   * Create a new agent manually
   */
  router.post('/agents', async (req: Request, res: Response) => {
    try {
      const { directory, agent } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Manual agent creation requested', {
        directory: projectPath,
        agentName: agent.name,
        hasInputFields: !!agent.inputFields,
        inputFieldsCount: agent.inputFields?.length || 0,
        hasSkills: !!agent.skills,
        skillsCount: agent.skills?.length || 0
      });
      console.log('Agent inputFields:', JSON.stringify(agent.inputFields, null, 2));
      console.log('Agent skills:', JSON.stringify(agent.skills, null, 2));

      // Validate required fields
      if (!agent.name || !agent.description || !agent.systemPrompt) {
        res.status(400).json({
          error: 'Missing required fields: name, description, systemPrompt'
        });
        return;
      }

      // Validate skills if provided
      if (agent.skills && Array.isArray(agent.skills) && agent.skills.length > 0) {
        const validation = await validateSkillReferences(agent.skills, projectPath);
        if (!validation.valid) {
          res.status(400).json({
            error: `Invalid skill references: ${validation.invalidSkills.join(', ')}`
          });
          return;
        }
      }

      // Create .claude/agents directory if not exists
      const agentsDir = path.join(projectPath, '.claude', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      // Generate file name (kebab-case)
      const fileName = agent.name.toLowerCase().replace(/\s+/g, '-');
      const filePath = path.join(agentsDir, `${fileName}.md`);

      // Check if file already exists
      try {
        await fs.access(filePath);
        res.status(409).json({
          error: `Agent "${fileName}" already exists. Choose a different name.`
        });
        return;
      } catch {
        // File doesn't exist, proceed
      }

      // Build frontmatter
      const frontmatter = [
        '---',
        `name: ${fileName}`,
        `description: ${agent.description}`,
      ];

      if (agent.tools && agent.tools.length > 0) {
        frontmatter.push(`tools: ${agent.tools.join(',')}`);
      }

      if (agent.model) {
        frontmatter.push(`model: ${agent.model}`);
      }

      // Add MCP tools if provided
      if (agent.mcpTools && typeof agent.mcpTools === 'object' && Object.keys(agent.mcpTools).length > 0) {
        frontmatter.push('mcp_tools:');
        Object.entries(agent.mcpTools).forEach(([serverId, tools]) => {
          if (Array.isArray(tools) && tools.length > 0) {
            frontmatter.push(`  ${serverId}:`);
            tools.forEach((toolName: string) => {
              frontmatter.push(`    - ${toolName}`);
            });
          }
        });
      }

      // Add input fields if provided
      if (agent.inputFields && Array.isArray(agent.inputFields) && agent.inputFields.length > 0) {
        frontmatter.push('input_fields:');
        agent.inputFields.forEach((field: any) => {
          frontmatter.push(`  - name: ${field.name}`);
          frontmatter.push(`    type: ${field.type}`);
          frontmatter.push(`    label: ${field.label}`);
          if (field.placeholder) frontmatter.push(`    placeholder: ${field.placeholder}`);
          if (field.required) frontmatter.push(`    required: true`);
          if (field.options && field.options.length > 0) {
            frontmatter.push(`    options:`);
            field.options.forEach((opt: string) => frontmatter.push(`      - ${opt}`));
          }
          if (field.default !== undefined) frontmatter.push(`    default: ${field.default}`);
        });
      }

      // Add output schema if provided
      if (agent.outputSchema) {
        const outputSchemaStr = typeof agent.outputSchema === 'string'
          ? agent.outputSchema
          : JSON.stringify(agent.outputSchema);
        frontmatter.push(`output_schema: ${outputSchemaStr}`);
      }

      // Add skills if provided
      if (agent.skills && Array.isArray(agent.skills) && agent.skills.length > 0) {
        frontmatter.push(`skills: ${agent.skills.join(',')}`);
      }

      frontmatter.push('---');

      // Build file content
      const content = [
        frontmatter.join('\n'),
        '',
        agent.systemPrompt,
      ].join('\n');

      // Write file
      await fs.writeFile(filePath, content, 'utf-8');

      logger.info('Agent created successfully', { filePath, fileName });

      res.json({
        success: true,
        agentId: fileName,
        filePath,
        message: `Agent "${fileName}" created successfully`
      });

    } catch (error) {
      logger.error('Create agent error', error);
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  /**
   * Update an agent
   */
  router.put('/agents/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory, agent } = req.body;
      const projectPath = (directory as string) || process.cwd();

      // Validate required fields
      if (!agent.name || !agent.description || !agent.systemPrompt) {
        res.status(400).json({ error: 'Missing required fields: name, description, systemPrompt' });
        return;
      }

      // Validate skills if provided
      if (agent.skills && Array.isArray(agent.skills) && agent.skills.length > 0) {
        const validation = await validateSkillReferences(agent.skills, projectPath);
        if (!validation.valid) {
          res.status(400).json({
            error: `Invalid skill references: ${validation.invalidSkills.join(', ')}`
          });
          return;
        }
      }

      const agentsDir = path.join(projectPath, '.claude', 'agents');

      // Check if agents directory exists
      if (!existsSync(agentsDir)) {
        res.status(404).json({ error: '.claude/agents directory not found' });
        return;
      }

      // Build the file path for the agent
      const filePath = path.join(agentsDir, `${id}.md`);

      // Check if agent exists
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      // Build frontmatter
      const frontmatter = [
        '---',
        `name: ${id}`, // Keep the same ID/name
        `description: ${agent.description}`,
      ];

      if (agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0) {
        frontmatter.push(`tools: ${agent.tools.join(',')}`);
      }

      if (agent.model) {
        frontmatter.push(`model: ${agent.model}`);
      }

      // Add MCP tools if provided
      if (agent.mcpTools && typeof agent.mcpTools === 'object' && Object.keys(agent.mcpTools).length > 0) {
        frontmatter.push('mcp_tools:');
        Object.entries(agent.mcpTools).forEach(([serverId, tools]) => {
          if (Array.isArray(tools) && tools.length > 0) {
            frontmatter.push(`  ${serverId}:`);
            tools.forEach((toolName: string) => {
              frontmatter.push(`    - ${toolName}`);
            });
          }
        });
      }

      // Add input fields if provided
      if (agent.inputFields && Array.isArray(agent.inputFields) && agent.inputFields.length > 0) {
        frontmatter.push('input_fields:');
        agent.inputFields.forEach((field: any) => {
          frontmatter.push(`  - name: ${field.name}`);
          frontmatter.push(`    type: ${field.type}`);
          frontmatter.push(`    label: ${field.label}`);
          if (field.placeholder) frontmatter.push(`    placeholder: ${field.placeholder}`);
          if (field.required) frontmatter.push(`    required: true`);
          if (field.options && field.options.length > 0) {
            frontmatter.push(`    options:`);
            field.options.forEach((opt: string) => frontmatter.push(`      - ${opt}`));
          }
          if (field.default !== undefined) frontmatter.push(`    default: ${field.default}`);
        });
      }

      // Add output schema if provided
      if (agent.outputSchema) {
        const outputSchemaStr = typeof agent.outputSchema === 'string'
          ? agent.outputSchema
          : JSON.stringify(agent.outputSchema);
        frontmatter.push(`output_schema: ${outputSchemaStr}`);
      }

      // Add skills if provided
      if (agent.skills && Array.isArray(agent.skills) && agent.skills.length > 0) {
        frontmatter.push(`skills: ${agent.skills.join(',')}`);
      }

      frontmatter.push('---');

      // Build full content
      const content = [
        frontmatter.join('\n'),
        '',
        agent.systemPrompt
      ].join('\n');

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8');

      logger.info('Agent updated', { id, filePath });

      res.json({
        success: true,
        agentId: id,
        filePath,
        message: `Agent "${agent.name}" updated successfully`
      });

    } catch (error) {
      logger.error('Update agent error', error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  /**
   * Get list of MCP servers
   */
  router.get('/mcp-servers', async (req: Request, res: Response) => {
    try {
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const servers = await mcpService.getMCPServers(projectPath);

      // Auto-fetch tools for each server
      const serversWithTools = await Promise.all(
        servers.map(async (server) => {
          try {
            const toolsResult = await mcpService.listMCPServerTools(server.id, projectPath);
            if (toolsResult.success && toolsResult.tools.length > 0) {
              return { ...server, tools: toolsResult.tools };
            }
          } catch (error) {
            logger.warn('Failed to fetch tools for server', { serverId: server.id, error });
          }
          return server;
        })
      );

      res.json({ servers: serversWithTools });
    } catch (error) {
      logger.error('Get MCP servers error', error);
      res.status(500).json({ error: 'Failed to get MCP servers' });
    }
  });

  /**
   * Get MCP server details by ID
   */
  router.get('/mcp-servers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const server = await mcpService.getMCPServerById(id, projectPath);

      if (!server) {
        res.status(404).json({ error: 'MCP server not found' });
        return;
      }

      res.json({ server });
    } catch (error) {
      logger.error('Get MCP server error', error);
      res.status(500).json({ error: 'Failed to get MCP server' });
    }
  });

  /**
   * Create a new MCP server
   */
  router.post('/mcp-servers', async (req: Request, res: Response) => {
    try {
      const { name, config, directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      // Validate required fields
      if (!name) {
        res.status(400).json({
          error: 'Missing required field: name'
        });
        return;
      }

      if (!config) {
        res.status(400).json({
          error: 'Missing required field: config'
        });
        return;
      }

      const newServer = await mcpService.addMCPServer(name, config, projectPath);

      logger.info('MCP server created', { name });

      res.json({
        success: true,
        server: newServer,
        message: `MCP server "${name}" created successfully`
      });
    } catch (error) {
      logger.error('Create MCP server error', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create MCP server';
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Update an MCP server
   */
  router.put('/mcp-servers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { config, directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      if (!config) {
        res.status(400).json({ error: 'Missing required field: config' });
        return;
      }

      const updatedServer = await mcpService.updateMCPServer(id, config, projectPath);

      logger.info('MCP server updated', { id });

      res.json({
        success: true,
        server: updatedServer,
        message: `MCP server "${id}" updated successfully`
      });
    } catch (error) {
      logger.error('Update MCP server error', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update MCP server';
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Delete an MCP server
   */
  router.delete('/mcp-servers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      await mcpService.deleteMCPServer(id, projectPath);

      logger.info('MCP server deleted', { id });

      res.json({
        success: true,
        message: `MCP server "${id}" deleted successfully`
      });
    } catch (error) {
      logger.error('Delete MCP server error', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete MCP server';
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Test an MCP server
   */
  router.post('/mcp-servers/:id/test', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      const result = await mcpService.testMCPServer(id, projectPath);

      res.json(result);
    } catch (error) {
      logger.error('Test MCP server error', error);
      res.status(500).json({ error: 'Failed to test MCP server' });
    }
  });

  /**
   * Toggle MCP server enabled/disabled state
   */
  router.post('/mcp-servers/:id/toggle', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      const result = await mcpService.toggleMCPServer(id, projectPath);

      res.json(result);
    } catch (error) {
      logger.error('Toggle MCP server error', error);
      res.status(500).json({ error: 'Failed to toggle MCP server' });
    }
  });

  /**
   * List tools provided by an MCP server
   */
  router.get('/mcp-servers/:id/tools', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const result = await mcpService.listMCPServerTools(id, projectPath);

      res.json(result);
    } catch (error) {
      logger.error('List MCP server tools error', error);
      res.status(500).json({ error: 'Failed to list MCP server tools' });
    }
  });

  /**
   * Export MCP configuration
   */
  router.get('/mcp-servers/export', async (req: Request, res: Response) => {
    try {
      const { directory } = req.query;
      const projectPath = (directory as string) || process.cwd();

      const config = await mcpService.exportMCPConfig(projectPath);

      res.json(config);
    } catch (error) {
      logger.error('Export MCP config error', error);
      res.status(500).json({ error: 'Failed to export MCP configuration' });
    }
  });

  /**
   * Import MCP configuration
   */
  router.post('/mcp-servers/import', async (req: Request, res: Response) => {
    try {
      const { config, mode, directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      if (!config || !mode) {
        res.status(400).json({ error: 'Missing required fields: config, mode' });
        return;
      }

      if (mode !== 'merge' && mode !== 'overwrite') {
        res.status(400).json({ error: 'Invalid mode. Must be "merge" or "overwrite"' });
        return;
      }

      await mcpService.importMCPConfig(config, mode, projectPath);

      logger.info('MCP config imported', { mode });

      res.json({
        success: true,
        message: `MCP configuration imported successfully (${mode})`,
      });
    } catch (error) {
      logger.error('Import MCP config error', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to import MCP configuration';
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Bulk delete MCP servers
   */
  router.post('/mcp-servers/bulk-delete', async (req: Request, res: Response) => {
    try {
      const { serverIds, directory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
        res.status(400).json({ error: 'Missing or invalid serverIds array' });
        return;
      }

      const result = await mcpService.bulkDeleteMCPServers(serverIds, projectPath);

      logger.info('Bulk delete MCP servers', result);

      res.json({
        success: true,
        successCount: result.success,
        failed: result.failed,
        errors: result.errors,
        message: `Deleted ${result.success} server(s). ${result.failed} failed.`,
      });
    } catch (error) {
      logger.error('Bulk delete MCP servers error', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to bulk delete MCP servers';
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Execute an agent
   */
  router.post('/agents/:id/execute', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { directory, userPrompt, permissionMode } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Agent execution requested', { id, directory: projectPath, permissionMode, userPrompt });
      console.log('🔍 USER PROMPT RECEIVED:', userPrompt);

      // Get agent details
      const agents = await parser.parseAgents(projectPath);
      const agent = agents.find(a => a.id === id);

      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial status
      res.write(`data: ${JSON.stringify({
        type: 'status',
        status: 'starting',
        message: `Executing agent: ${agent.name}`
      })}\n\n`);

      // Import SDK service dynamically
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Build prompt
      const prompt = userPrompt || 'Execute the agent task';

      console.log('🚀 FINAL PROMPT TO SDK:', prompt);
      console.log('📤 STDIN MESSAGE (JSON format sent to Claude CLI):');
      console.log(JSON.stringify({
        role: 'user',
        content: prompt
      }, null, 2));

      // Send stdin message to UI for debugging
      res.write(`data: ${JSON.stringify({
        type: 'debug',
        message: `📤 STDIN to Claude CLI: ${JSON.stringify({ role: 'user', content: prompt })}`
      })}\n\n`);

      // Execute agent using SDK
      logger.info('Starting agent execution', {
        agentId: id,
        agentName: agent.name,
        prompt: prompt,
        tools: agent.metadata?.allowedTools,
        toolsType: typeof agent.metadata?.allowedTools
      });

      // Capture stderr for debugging
      let stderrOutput = '';

      try {
        // Parse tools - ensure it's an array
        let allowedTools = agent.metadata?.tools || agent.metadata?.allowedTools;

        // If no tools found, extract from mcp_tools
        if (!allowedTools && agent.metadata?.mcpTools) {
          allowedTools = Object.values(agent.metadata.mcpTools).flat();
        }

        if (allowedTools && typeof allowedTools === 'string') {
          // If tools is a string, split by comma
          allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
        }

        logger.info('Parsed tools', { allowedTools, type: typeof allowedTools });

        // Load and merge skills
        let enhancedSystemPrompt = agent.content;
        if (agent.metadata?.skills && agent.metadata.skills.length > 0) {
          const allSkills = await parser.parseSkills(projectPath);

          for (const skillId of agent.metadata.skills) {
            const skill = allSkills.find(s => s.id === skillId);
            if (skill) {
              logger.info('Loading skill for agent', { agentId: agent.id, skillId, skillName: skill.name });

              // Merge skill tools with agent tools
              if (skill.metadata?.allowedTools) {
                const skillTools = skill.metadata.allowedTools;
                if (Array.isArray(skillTools)) {
                  if (!allowedTools) allowedTools = [];
                  else if (!Array.isArray(allowedTools)) allowedTools = [allowedTools as any];
                  allowedTools = [...new Set([...allowedTools, ...skillTools])];
                }
              }

              // Merge skill MCP tools with agent MCP tools
              if (skill.metadata?.mcpTools) {
                if (!agent.metadata.mcpTools) agent.metadata.mcpTools = {};
                Object.assign(agent.metadata.mcpTools, skill.metadata.mcpTools);
              }

              // Append skill content to system prompt
              enhancedSystemPrompt += `\n\n# Skill: ${skill.name}\n${skill.content}`;
            }
          }
        }

        // Load MCP configuration
        let mcpServers = await loadMcpConfig(projectPath);

        // Filter MCP servers to only include those specified in agent's mcpTools
        if (agent.metadata?.mcpTools && mcpServers) {
          const allowedServerNames = Object.keys(agent.metadata.mcpTools);
          const filteredServers: Record<string, any> = {};

          for (const serverName of allowedServerNames) {
            if (mcpServers[serverName]) {
              filteredServers[serverName] = mcpServers[serverName];
            }
          }

          mcpServers = filteredServers;
          logger.info('Filtered MCP servers to only allowed servers', {
            allowedServers: allowedServerNames,
            loadedServers: Object.keys(filteredServers)
          });
        }

        // Enforce strict tool usage: only allow explicitly specified tools
        let disallowedTools: string[] | undefined;
        const allBuiltInTools = [
          'WebFetch', 'WebSearch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
          'Task', 'TodoWrite', 'ExitPlanMode', 'NotebookEdit', 'BashOutput',
          'KillShell', 'AskUserQuestion', 'Skill', 'SlashCommand'
        ];

        if (allowedTools && Array.isArray(allowedTools) && allowedTools.length > 0) {
          // Agent has explicit allowed tools - block all other built-in tools
          disallowedTools = allBuiltInTools.filter(tool => !allowedTools.includes(tool));
          logger.info('Enforcing strict tool allowlist, blocking non-allowed built-in tools', {
            allowedTools,
            disallowedTools
          });
        } else if (agent.metadata?.mcpTools && !allowedTools) {
          // Agent uses ONLY MCP tools - block all built-in tools
          disallowedTools = allBuiltInTools;
          logger.info('Agent uses only MCP tools, blocking all built-in tools', {
            allowedTools,
            disallowedTools
          });
        }

        // Map UI permission modes to CLI permission modes
        const cliPermissionMode = permissionMode === 'bypass' ? 'bypassPermissions' : permissionMode;

        const queryInstance = query({
          prompt,
          options: {
            systemPrompt: enhancedSystemPrompt,
            model: 'claude-sonnet-4-5',
            cwd: projectPath,
            allowedTools: allowedTools as string[] | undefined,
            disallowedTools: disallowedTools,
            mcpServers: mcpServers as any,
            permissionMode: (cliPermissionMode || 'default') as any,
            stderr: (data: string) => {
              stderrOutput += data;
              logger.error('Claude CLI stderr', { stderr: data });
              // Send stderr to client for debugging
              res.write(`data: ${JSON.stringify({
                type: 'debug',
                message: `STDERR: ${data}`
              })}\n\n`);
            },
          },
        });

        // Stream responses
        for await (const message of queryInstance) {
          logger.debug('Agent message', { type: message.type });

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
          message: 'Agent execution completed'
        })}\n\n`);

        logger.info('Agent execution completed', { agentId: id });

      } catch (execError) {
        logger.error('Agent execution error', execError, { stderrOutput });

        // Include stderr in error message for debugging
        let errorMessage = execError instanceof Error ? execError.message : 'Unknown error';
        if (stderrOutput) {
          errorMessage += `\n\nClaude CLI Output:\n${stderrOutput}`;
        }

        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: errorMessage
        })}\n\n`);
      }

      res.end();
    } catch (error) {
      logger.error('Execute agent error', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to execute agent' });
      }
    }
  });

  /**
   * Agent creation conversation with history
   */
  router.post('/agents/create-with-claude/message', async (req: Request, res: Response) => {
    try {
      const { directory, conversationHistory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Agent creation message', {
        directory: projectPath,
        historyLength: conversationHistory?.length || 0
      });

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Import agent creator prompt
      const { AGENT_CREATOR_SYSTEM_PROMPT } = await import('@/services/prompts/agent-creator-prompt.js');

      // Import SDK
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Send initial status
      res.write(`data: ${JSON.stringify({
        type: 'status',
        status: 'processing',
        message: 'Processing message...'
      })}\n\n`);

      try {
        // Get the conversation history and build a comprehensive prompt
        const history = conversationHistory || [];

        // Build a prompt that includes conversation history as context
        let fullPrompt = '';

        if (history.length > 1) {
          // Include previous conversation as context
          fullPrompt = 'Previous conversation:\n\n';
          for (let i = 0; i < history.length - 1; i++) {
            const msg = history[i];
            fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
          }
          fullPrompt += '---\n\n';
        }

        // Add the current user message
        const lastMessage = history.length > 0 ? history[history.length - 1] : null;
        fullPrompt += lastMessage?.content || "Let's create a new agent.";

        const queryInstance = query({
          prompt: fullPrompt,
          options: {
            systemPrompt: AGENT_CREATOR_SYSTEM_PROMPT,
            model: 'claude-sonnet-4-5',
            cwd: projectPath,
            allowedTools: ['Write', 'Read', 'Grep', 'Glob'],
            permissionMode: 'bypassPermissions' as any,
            stderr: (data: string) => {
              logger.debug('Claude CLI stderr', { stderr: data });
            },
          },
        });

        // Stream responses
        for await (const message of queryInstance) {
          logger.debug('Agent creator message', { type: message.type });

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
          message: 'Response completed'
        })}\n\n`);

        logger.info('Agent creation message completed');

      } catch (execError) {
        logger.error('Agent creation error', execError);

        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: execError instanceof Error ? execError.message : 'Unknown error'
        })}\n\n`);
      }

      res.end();
    } catch (error) {
      logger.error('Agent creation message error', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process message' });
      }
    }
  });

  /**
   * POST /skills/create-with-claude/message
   * Stream skill creation conversation with Claude
   */
  router.post('/skills/create-with-claude/message', async (req: Request, res: Response) => {
    try {
      const { directory, conversationHistory } = req.body;
      const projectPath = (directory as string) || process.cwd();

      logger.info('Skill creation message', {
        directory: projectPath,
        historyLength: conversationHistory?.length || 0
      });

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Import skill creator prompt
      const { SKILL_CREATOR_SYSTEM_PROMPT } = await import('@/services/prompts/skill-creator-prompt.js');

      // Import SDK
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Send initial status
      res.write(`data: ${JSON.stringify({
        type: 'status',
        status: 'processing',
        message: 'Processing message...'
      })}\n\n`);

      try {
        // Get the conversation history and build a comprehensive prompt
        const history = conversationHistory || [];

        // Build a prompt that includes conversation history as context
        let fullPrompt = '';

        if (history.length > 1) {
          // Include previous conversation as context
          fullPrompt = 'Previous conversation:\n\n';
          for (let i = 0; i < history.length - 1; i++) {
            const msg = history[i];
            fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
          }
          fullPrompt += '---\n\n';
        }

        // Add the current user message
        const lastMessage = history.length > 0 ? history[history.length - 1] : null;
        fullPrompt += lastMessage?.content || "Let's create a new skill.";

        const queryInstance = query({
          prompt: fullPrompt,
          options: {
            systemPrompt: SKILL_CREATOR_SYSTEM_PROMPT,
            model: 'claude-sonnet-4-5',
            cwd: projectPath,
            allowedTools: ['Write', 'Read', 'Grep', 'Glob'],
            permissionMode: 'bypassPermissions' as any,
            stderr: (data: string) => {
              logger.debug('Claude CLI stderr', { stderr: data });
            },
          },
        });

        // Stream responses
        for await (const message of queryInstance) {
          logger.debug('Skill creator message', { type: message.type });

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
          message: 'Response completed'
        })}\n\n`);

        logger.info('Skill creation message completed');

      } catch (execError) {
        logger.error('Skill creation error', execError);

        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: execError instanceof Error ? execError.message : 'Unknown error'
        })}\n\n`);
      }

      res.end();
    } catch (error) {
      logger.error('Skill creation message error', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process message' });
      }
    }
  });

  /**
   * GET /training-agent-config
   * Get current training agent configuration
   */
  router.get('/training-agent-config', async (req: Request, res: Response) => {
    try {
      const { ConfigService } = await import('@/services/config-service.js');
      const configService = ConfigService.getInstance();
      const config = configService.getConfig();

      res.json({
        trainingAgentId: config.trainingAgentId || null,
        fallbackToLocal: !config.trainingAgentId
      });
    } catch (error) {
      logger.error('Get training agent config error', error);
      res.status(500).json({ error: 'Failed to get training agent configuration' });
    }
  });

  /**
   * PUT /training-agent-config
   * Update training agent configuration
   */
  router.put('/training-agent-config', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.body;

      logger.info('Updating training agent config', { agentId });

      // Validate agent exists in Strapi if agentId is provided
      if (agentId) {
        const { strapiClient } = await import('@/services/strapi-client.js');
        const agent = await strapiClient.getAgent(agentId);
        if (!agent) {
          res.status(404).json({ error: 'Agent not found in database' });
          return;
        }
      }

      // Update config
      const { ConfigService } = await import('@/services/config-service.js');
      const configService = ConfigService.getInstance();
      await configService.updateConfig({
        trainingAgentId: agentId || undefined
      });

      logger.info('Training agent config updated', { agentId });

      res.json({
        success: true,
        trainingAgentId: agentId || null,
        fallbackToLocal: !agentId
      });
    } catch (error) {
      logger.error('Update training agent config error', error);
      res.status(500).json({ error: 'Failed to update training agent configuration' });
    }
  });

  return router;
}
