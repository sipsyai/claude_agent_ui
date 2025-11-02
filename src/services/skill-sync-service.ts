/**
 * Skill Sync Service
 *
 * Syncs Strapi skills to filesystem in .claude/skills/{skill-name}/SKILL.md format
 * Required for Claude Agent SDK to discover and use skills via settingSources: ['project']
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import type { Skill } from '../types/agent.types.js';

class SkillSyncService {
  private skillsDir = path.join(process.cwd(), '.claude', 'skills');

  /**
   * Sync a single skill to filesystem
   * @param skill - Skill object from Strapi
   * @param parameters - Parameter values for {{param}} template replacement
   * @returns Path to the written SKILL.md file
   */
  async syncSkillToFilesystem(
    skill: Skill,
    parameters?: Record<string, any>
  ): Promise<string> {
    try {
      // 1. Validate skill data
      this.validateSkill(skill);

      // 2. Sanitize skill name (prevent path traversal)
      const sanitizedName = this.sanitizeSkillName(skill.name);

      // 3. Create skill directory
      const skillDir = path.join(this.skillsDir, sanitizedName);
      await fs.mkdir(skillDir, { recursive: true });

      // 4. Parameter injection
      let content = skill.skillmd;
      if (parameters && Object.keys(parameters).length > 0) {
        this.validateParameters(parameters);
        content = this.injectParameters(content, parameters);
      }

      // 5. Build YAML frontmatter
      const frontmatter = {
        name: skill.name,
        description: skill.description,
        version: skill.version || '1.0.0',
        category: skill.category || 'custom',
      };

      // 6. Create markdown with frontmatter
      const skillMd = matter.stringify(content, frontmatter);
      const skillPath = path.join(skillDir, 'SKILL.md');

      // 7. Write to filesystem
      await fs.writeFile(skillPath, skillMd, 'utf-8');

      console.log(`[SkillSync] ✅ Synced skill: ${skill.name} → ${skillPath}`);
      return skillPath;
    } catch (error) {
      console.error(`[SkillSync] ❌ Failed to sync skill ${skill.name}:`, error);
      throw error;
    }
  }

  /**
   * Sync multiple skills to filesystem
   * @param skills - Array of skill objects
   * @param parameters - Parameter values for template replacement (same for all skills)
   */
  async syncAllSkills(
    skills: Skill[],
    parameters?: Record<string, any>
  ): Promise<void> {
    console.log(`[SkillSync] Syncing ${skills.length} skills to filesystem...`);

    await Promise.all(
      skills.map(skill => this.syncSkillToFilesystem(skill, parameters))
    );

    console.log(`[SkillSync] ✅ Synced ${skills.length} skills successfully`);
  }

  /**
   * Remove a skill from filesystem
   * @param skillName - Name of the skill to remove
   */
  async removeSkillFromFilesystem(skillName: string): Promise<void> {
    try {
      const sanitizedName = this.sanitizeSkillName(skillName);
      const skillDir = path.join(this.skillsDir, sanitizedName);
      await fs.rm(skillDir, { recursive: true, force: true });
      console.log(`[SkillSync] ✅ Removed skill: ${skillName}`);
    } catch (error) {
      // Ignore if directory doesn't exist
      if ((error as any).code !== 'ENOENT') {
        console.error(`[SkillSync] ❌ Failed to remove skill ${skillName}:`, error);
      }
    }
  }

  /**
   * Clear all skills from filesystem
   */
  async clearAllSkills(): Promise<void> {
    try {
      await fs.rm(this.skillsDir, { recursive: true, force: true });
      await fs.mkdir(this.skillsDir, { recursive: true });
      console.log('[SkillSync] ✅ Cleared all skills');
    } catch (error) {
      console.error('[SkillSync] ❌ Failed to clear skills:', error);
      throw error;
    }
  }

  /**
   * Replace {{param}} templates with actual values
   * @param content - Skill markdown content with {{param}} placeholders
   * @param parameters - Key-value pairs for replacement
   * @returns Processed content with parameters injected
   */
  private injectParameters(
    content: string,
    parameters: Record<string, any>
  ): string {
    let processed = content;

    for (const [key, value] of Object.entries(parameters)) {
      // Support both {{key}} and {{ key }} formats
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    return processed;
  }

  /**
   * Validate skill data
   * @param skill - Skill object to validate
   * @throws Error if skill data is invalid
   */
  private validateSkill(skill: Skill): void {
    if (!skill.name || typeof skill.name !== 'string') {
      throw new Error('Invalid skill: name is required and must be a string');
    }

    if (!skill.skillmd || typeof skill.skillmd !== 'string') {
      throw new Error('Invalid skill: skillmd is required and must be a string');
    }

    // Check content size limit (1MB)
    const MAX_SKILL_SIZE = 1024 * 1024; // 1MB
    if (skill.skillmd.length > MAX_SKILL_SIZE) {
      throw new Error(`Skill content too large: ${skill.name} (max 1MB)`);
    }
  }

  /**
   * Sanitize skill name to prevent path traversal attacks
   * @param name - Raw skill name
   * @returns Sanitized skill name (alphanumeric, hyphens, underscores only)
   */
  private sanitizeSkillName(name: string): string {
    // Remove any path separators and special characters
    // Only allow: alphanumeric, hyphens, underscores
    const sanitized = name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();

    // Use path.basename as additional safety layer
    return path.basename(sanitized);
  }

  /**
   * Validate parameter values
   * @param parameters - Parameters to validate
   * @throws Error if parameters are invalid
   */
  private validateParameters(parameters: Record<string, any>): void {
    for (const [key, value] of Object.entries(parameters)) {
      // Key validation: only alphanumeric and underscore
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        throw new Error(`Invalid parameter key: ${key}`);
      }

      // Value validation: max length 10KB
      const MAX_PARAM_LENGTH = 10 * 1024; // 10KB
      if (String(value).length > MAX_PARAM_LENGTH) {
        throw new Error(`Parameter value too long: ${key} (max 10KB)`);
      }
    }
  }
}

// Export singleton instance
export const skillSyncService = new SkillSyncService();
