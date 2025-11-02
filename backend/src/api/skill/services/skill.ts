/**
 * skill service
 */

import { factories } from '@strapi/strapi';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { validateAdditionalFile } from '../utils/validation';

interface SkillMdExport {
  frontmatter: Record<string, any>;
  content: string;
  additionalFiles: Array<{ filename: string; content: string }>;
}

interface SkillImportResult {
  success: boolean;
  skill?: any;
  error?: string;
  warnings?: string[];
}

export default factories.createCoreService('api::skill.skill', ({ strapi }) => ({
  /**
   * Find a skill with all MCP relations populated
   */
  async findWithMcpRelations(id: number) {
    return await strapi.entityService.findOne('api::skill.skill', id, {
      populate: {
        toolConfig: true,
        mcpConfig: {
          populate: {
            mcpServer: true,
            selectedTools: {
              populate: ['mcpTool']
            }
          }
        },
        additionalFiles: true,
        agents: true,
        trainingAgent: true
      }
    });
  },

  /**
   * Format MCP config component for Claude SDK frontmatter
   * Transforms mcpConfig component into mcp_tools/mcp-tools format
   */
  formatMcpConfigForFrontmatter(mcpConfig: any[] = []) {
    const mcpToolsByServer: Record<string, string[]> = {};

    if (mcpConfig && mcpConfig.length > 0) {
      mcpConfig.forEach(config => {
        // Extract server name
        const serverName = typeof config.mcpServer === 'string'
          ? config.mcpServer
          : config.mcpServer?.name;

        if (!serverName) return;

        // Extract selected tools
        if (config.selectedTools && config.selectedTools.length > 0) {
          if (!mcpToolsByServer[serverName]) {
            mcpToolsByServer[serverName] = [];
          }

          config.selectedTools.forEach((toolSel: any) => {
            const toolName = typeof toolSel.mcpTool === 'string'
              ? toolSel.mcpTool
              : toolSel.mcpTool?.name;

            if (toolName && !mcpToolsByServer[serverName].includes(toolName)) {
              mcpToolsByServer[serverName].push(toolName);
            }
          });
        }
      });
    }

    return Object.keys(mcpToolsByServer).length > 0 ? mcpToolsByServer : null;
  },

  /**
   * Generate SKILL.md content with YAML frontmatter
   */
  async generateSkillMdContent(skill: any): Promise<string> {
    const frontmatter: Record<string, any> = {
      name: skill.name,
      description: skill.description
    };

    // Add optional SDK fields
    if (skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0) {
      frontmatter['allowed-tools'] = skill.toolConfig.allowedTools.join(', ');
    }

    if (skill.toolConfig?.disallowedTools && skill.toolConfig.disallowedTools.length > 0) {
      frontmatter['disallowed-tools'] = skill.toolConfig.disallowedTools.join(', ');
    }

    // Add MCP tools
    const mcpTools = this.formatMcpConfigForFrontmatter(skill.mcpConfig);
    if (mcpTools) {
      frontmatter['mcp_tools'] = mcpTools;
    }

    if (skill.version) {
      frontmatter.version = skill.version;
    }

    if (skill.mode) {
      frontmatter.mode = skill.mode;
    }

    if (skill.model && skill.model !== 'inherit') {
      frontmatter.model = skill.model;
    }

    if (skill.disableModelInvocation) {
      frontmatter['disable-model-invocation'] = skill.disableModelInvocation;
    }

    if (skill.license) {
      frontmatter.license = skill.license;
    }

    if (skill.experienceScore > 0) {
      frontmatter.experience_score = skill.experienceScore;
    }

    if (skill.trainingHistory && skill.trainingHistory.length > 0) {
      frontmatter.training_history = skill.trainingHistory;
    }

    // Generate YAML frontmatter
    const yamlContent = yaml.dump(frontmatter, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });

    // Combine frontmatter and content
    const skillMd = `---\n${yamlContent}---\n\n${skill.skillmd}`;

    return skillMd;
  },

  /**
   * Export skill to SKILL.md format
   */
  async exportToSkillMd(id: number): Promise<SkillMdExport> {
    const skill = await this.findWithMcpRelations(id);

    if (!skill) {
      throw new Error(`Skill with id ${id} not found`);
    }

    // Generate main SKILL.md content
    const content = await this.generateSkillMdContent(skill);

    // Extract frontmatter for structured response
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch
      ? yaml.load(frontmatterMatch[1]) as Record<string, any>
      : {};

    // Extract additional files
    const additionalFiles = (skill as any).additionalFiles || [];

    return {
      frontmatter,
      content,
      additionalFiles: additionalFiles.map((file: any) => ({
        filename: file.filename,
        content: file.content
      }))
    };
  },

  /**
   * Parse SKILL.md content
   * Extracts frontmatter and markdown content
   */
  parseSkillMd(skillMdContent: string): { frontmatter: any; content: string } {
    // Trim content and match YAML frontmatter between --- delimiters
    const trimmedContent = skillMdContent.trim();
    const frontmatterMatch = trimmedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      throw new Error('Invalid SKILL.md format: Missing YAML frontmatter');
    }

    const frontmatterYaml = frontmatterMatch[1];
    const content = frontmatterMatch[2].trim();

    let frontmatter: any;
    try {
      frontmatter = yaml.load(frontmatterYaml);
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error.message}`);
    }

    return { frontmatter, content };
  },

  /**
   * Validate additional file name
   * Returns true if filename matches pattern ^[A-Z_]+\.md$ and is not SKILL.md
   */
  validateAdditionalFileName(filename: string): boolean {
    const filenameRegex = /^[A-Z_]+\.md$/;
    return filenameRegex.test(filename) && filename !== 'SKILL.md';
  },

  /**
   * Scan directory for additional markdown files
   * Excludes SKILL.md and only includes files matching ^[A-Z_]+\.md$ pattern
   */
  async scanAdditionalFiles(dirPath: string): Promise<Array<{ filename: string; content: string; warnings: string[] }>> {
    const results: Array<{ filename: string; content: string; warnings: string[] }> = [];

    try {
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        return results;
      }

      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        // Skip SKILL.md
        if (file === 'SKILL.md') {
          continue;
        }

        // Only process .md files
        if (!file.endsWith('.md')) {
          continue;
        }

        // Validate filename pattern
        if (!this.validateAdditionalFileName(file)) {
          continue; // Skip files that don't match pattern
        }

        const filePath = path.join(dirPath, file);

        // Check if it's a file (not directory)
        if (!fs.statSync(filePath).isFile()) {
          continue;
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf-8');

        // Validate file
        const validation = validateAdditionalFile(file, content);
        const warnings: string[] = [];

        if (!validation.valid) {
          // Skip invalid files but log warning
          warnings.push(...validation.errors);
          continue;
        }

        if (validation.warnings.length > 0) {
          warnings.push(...validation.warnings);
        }

        results.push({
          filename: file,
          content,
          warnings
        });
      }

      return results;

    } catch (error) {
      // Return empty array on error, don't fail the import
      return results;
    }
  },

  /**
   * Find or create MCP servers and tools from frontmatter
   */
  async resolveMcpRelations(mcpToolsFrontmatter: any) {
    const mcpServerIds: any[] = [];
    const mcpToolIds: any[] = [];

    if (!mcpToolsFrontmatter || typeof mcpToolsFrontmatter !== 'object') {
      return { mcpServerIds, mcpToolIds };
    }

    // mcpToolsFrontmatter format: { 'server-name': ['tool1', 'tool2'] }
    for (const [serverName, toolNames] of Object.entries(mcpToolsFrontmatter)) {
      if (!Array.isArray(toolNames)) continue;

      // Find or skip server
      const servers = await strapi.entityService.findMany('api::mcp-server.mcp-server', {
        filters: { name: serverName },
        limit: 1
      });

      if (servers && servers.length > 0) {
        const server = servers[0];
        mcpServerIds.push(server.id);

        // Find tools for this server
        for (const toolName of toolNames) {
          const tools = await strapi.entityService.findMany('api::mcp-tool.mcp-tool', {
            filters: {
              name: toolName,
              mcpServer: { id: server.id }
            },
            limit: 1
          });

          if (tools && tools.length > 0) {
            mcpToolIds.push(tools[0].id);
          }
        }
      }
    }

    return { mcpServerIds, mcpToolIds };
  },

  /**
   * Import skill from SKILL.md content
   */
  async importFromSkillMd(
    skillMdContent: string,
    overwrite: boolean = false,
    additionalFiles?: Array<{ filename: string; content: string }>
  ): Promise<SkillImportResult> {
    const warnings: string[] = [];

    try {
      // Parse SKILL.md
      const { frontmatter, content } = this.parseSkillMd(skillMdContent);

      // Validate required fields
      if (!frontmatter.name) {
        return { success: false, error: 'Missing required field: name' };
      }
      if (!frontmatter.description) {
        return { success: false, error: 'Missing required field: description' };
      }

      // Check if skill already exists
      const existingSkills = await strapi.entityService.findMany('api::skill.skill', {
        filters: { name: frontmatter.name },
        limit: 1
      });

      if (existingSkills && existingSkills.length > 0 && !overwrite) {
        return {
          success: false,
          error: `Skill with name "${frontmatter.name}" already exists. Use overwrite=true to replace.`
        };
      }

      // Resolve MCP relations
      const { mcpServerIds, mcpToolIds } = await this.resolveMcpRelations(
        frontmatter.mcp_tools || frontmatter.mcpTools || frontmatter['mcp-tools']
      );

      if (frontmatter.mcp_tools && (mcpServerIds.length === 0 && mcpToolIds.length === 0)) {
        warnings.push('MCP tools specified but no matching servers/tools found in database');
      }

      // Parse allowed-tools
      let allowedTools: string[] = [];
      if (frontmatter['allowed-tools']) {
        if (typeof frontmatter['allowed-tools'] === 'string') {
          allowedTools = frontmatter['allowed-tools'].split(',').map((t: string) => t.trim());
        } else if (Array.isArray(frontmatter['allowed-tools'])) {
          allowedTools = frontmatter['allowed-tools'];
        }
      }

      // Process additional files
      const additionalFilesComponents: any[] = [];
      if (additionalFiles && additionalFiles.length > 0) {
        for (const file of additionalFiles) {
          // Validate file
          const validation = validateAdditionalFile(file.filename, file.content);

          if (!validation.valid) {
            warnings.push(`Skipping file "${file.filename}": ${validation.errors.join(', ')}`);
            continue;
          }

          if (validation.warnings.length > 0) {
            warnings.push(...validation.warnings.map(w => `${file.filename}: ${w}`));
          }

          additionalFilesComponents.push({
            filename: file.filename,
            content: file.content
          });
        }
      }

      // Prepare skill data
      const skillData: any = {
        name: frontmatter.name,
        displayName: frontmatter.displayName || frontmatter.name,
        description: frontmatter.description,
        skillmd: content,
        allowedTools: allowedTools,
        version: frontmatter.version || '1.0.0',
        mode: frontmatter.mode || false,
        model: frontmatter.model || 'inherit',
        disableModelInvocation: frontmatter['disable-model-invocation'] || frontmatter.disableModelInvocation || false,
        license: frontmatter.license || null,
        experienceScore: frontmatter.experience_score || frontmatter.experienceScore || 0,
        trainingHistory: frontmatter.training_history || frontmatter.trainingHistory || [],
        category: frontmatter.category || 'custom',
        isPublic: frontmatter.isPublic !== undefined ? frontmatter.isPublic : true,
        mcpServers: mcpServerIds,
        mcpTools: mcpToolIds,
        additionalFiles: additionalFilesComponents
      };

      // Create or update skill
      let skill: any;
      if (existingSkills && existingSkills.length > 0 && overwrite) {
        skill = await strapi.entityService.update('api::skill.skill', existingSkills[0].id, {
          data: skillData
        });
      } else {
        skill = await strapi.entityService.create('api::skill.skill', {
          data: skillData
        });
      }

      return {
        success: true,
        skill,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Import skill from file path
   */
  async importFromFile(filePath: string, overwrite: boolean = false): Promise<SkillImportResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      // Read SKILL.md content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Get directory containing the SKILL.md file
      const dirPath = path.dirname(filePath);

      // Scan for additional markdown files in the same directory
      const additionalFilesData = await this.scanAdditionalFiles(dirPath);

      // Extract files and warnings
      const additionalFiles = additionalFilesData.map(f => ({
        filename: f.filename,
        content: f.content
      }));

      const warnings: string[] = [];
      additionalFilesData.forEach(f => {
        if (f.warnings.length > 0) {
          warnings.push(...f.warnings);
        }
      });

      // Import skill with additional files
      const result = await this.importFromSkillMd(content, overwrite, additionalFiles);

      // Merge warnings
      if (warnings.length > 0) {
        result.warnings = [...(result.warnings || []), ...warnings];
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Import multiple skills from directory
   * Looks for SKILL.md files in subdirectories
   */
  async importFromDirectory(dirPath: string, overwrite: boolean = false): Promise<{
    success: boolean;
    results: Array<{ name: string; result: SkillImportResult }>;
    summary: { total: number; successful: number; failed: number };
  }> {
    const results: Array<{ name: string; result: SkillImportResult }> = [];

    try {
      if (!fs.existsSync(dirPath)) {
        return {
          success: false,
          results: [],
          summary: { total: 0, successful: 0, failed: 0 }
        };
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = path.join(dirPath, entry.name, 'SKILL.md');

          if (fs.existsSync(skillMdPath)) {
            const result = await this.importFromFile(skillMdPath, overwrite);
            results.push({ name: entry.name, result });
          }
        } else if (entry.name === 'SKILL.md') {
          const skillMdPath = path.join(dirPath, entry.name);
          const result = await this.importFromFile(skillMdPath, overwrite);
          results.push({ name: path.basename(dirPath), result });
        }
      }

      const successful = results.filter(r => r.result.success).length;
      const failed = results.filter(r => !r.result.success).length;

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful,
          failed
        }
      };

    } catch (error) {
      return {
        success: false,
        results,
        summary: { total: 0, successful: 0, failed: results.length }
      };
    }
  }
}));
