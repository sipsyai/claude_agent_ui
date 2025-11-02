/**
 * skill controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::skill.skill', ({ strapi }) => ({
  /**
   * Export skill to SKILL.md format
   * GET /api/skills/:id/export
   */
  async export(ctx) {
    const { id } = ctx.params;

    try {
      const skillService = strapi.service('api::skill.skill');
      const exportData = await skillService.exportToSkillMd(parseInt(id));

      ctx.send({
        data: exportData
      });
    } catch (error) {
      ctx.throw(404, `Skill not found or export failed: ${error.message}`);
    }
  },

  /**
   * Download skill as SKILL.md file
   * GET /api/skills/:id/download
   */
  async download(ctx) {
    const { id } = ctx.params;

    try {
      const skillService = strapi.service('api::skill.skill');
      const exportData = await skillService.exportToSkillMd(parseInt(id));

      // Set headers for file download
      ctx.set('Content-Type', 'text/markdown; charset=utf-8');
      ctx.set('Content-Disposition', `attachment; filename="SKILL.md"`);

      // Send SKILL.md content
      ctx.send(exportData.content);
    } catch (error) {
      ctx.throw(404, `Skill not found or download failed: ${error.message}`);
    }
  },

  /**
   * Download skill directory as ZIP (SKILL.md + additional files)
   * GET /api/skills/:id/download-archive
   */
  async downloadArchive(ctx) {
    const { id } = ctx.params;

    try {
      const skillService = strapi.service('api::skill.skill');
      const exportData = await skillService.exportToSkillMd(parseInt(id));

      // For now, just return the structure
      // TODO: Implement ZIP archive creation
      ctx.send({
        message: 'Archive download not yet implemented',
        data: {
          files: [
            { name: 'SKILL.md', content: exportData.content },
            ...exportData.additionalFiles.map(f => ({
              name: f.filename,
              content: f.content
            }))
          ]
        }
      });
    } catch (error) {
      ctx.throw(404, `Skill not found or archive creation failed: ${error.message}`);
    }
  },

  /**
   * Import skill from SKILL.md content (request body)
   * POST /api/skills/import
   * Body: { content: "---\nname: skill-name\n...", overwrite: false }
   */
  async import(ctx) {
    const { content, overwrite } = ctx.request.body;

    if (!content) {
      return ctx.badRequest('Missing "content" in request body');
    }

    try {
      const skillService = strapi.service('api::skill.skill');
      const result = await skillService.importFromSkillMd(content, overwrite || false);

      if (result.success) {
        ctx.send({
          success: true,
          data: result.skill,
          warnings: result.warnings
        });
      } else {
        ctx.badRequest(result.error);
      }
    } catch (error) {
      ctx.throw(500, `Import failed: ${error.message}`);
    }
  },

  /**
   * Import skill from file path
   * POST /api/skills/import-file
   * Body: { filePath: "/path/to/SKILL.md", overwrite: false }
   */
  async importFile(ctx) {
    const { filePath, overwrite } = ctx.request.body;

    if (!filePath) {
      return ctx.badRequest('Missing "filePath" in request body');
    }

    try {
      const skillService = strapi.service('api::skill.skill');
      const result = await skillService.importFromFile(filePath, overwrite || false);

      if (result.success) {
        ctx.send({
          success: true,
          data: result.skill,
          warnings: result.warnings
        });
      } else {
        ctx.badRequest(result.error);
      }
    } catch (error) {
      ctx.throw(500, `Import failed: ${error.message}`);
    }
  },

  /**
   * Import multiple skills from directory
   * POST /api/skills/import-directory
   * Body: { dirPath: "/path/to/skills", overwrite: false }
   */
  async importDirectory(ctx) {
    const { dirPath, overwrite } = ctx.request.body;

    if (!dirPath) {
      return ctx.badRequest('Missing "dirPath" in request body');
    }

    try {
      const skillService = strapi.service('api::skill.skill');
      const result = await skillService.importFromDirectory(dirPath, overwrite || false);

      if (result.success) {
        ctx.send({
          success: true,
          results: result.results,
          summary: result.summary
        });
      } else {
        ctx.badRequest('Directory import failed');
      }
    } catch (error) {
      ctx.throw(500, `Import failed: ${error.message}`);
    }
  }
}));
