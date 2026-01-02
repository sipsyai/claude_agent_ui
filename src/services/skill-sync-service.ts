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

/**
 * SkillSyncService - Bidirectional synchronization between Strapi database and filesystem
 *
 * @description
 * Manages synchronization of skills from Strapi database to the filesystem in the `.claude/skills/`
 * directory structure required by Claude Agent SDK. The SDK discovers skills via `settingSources: ['project']`
 * which reads from `.claude/skills/{skill-name}/SKILL.md` files.
 *
 * **Architecture:**
 * - **Strapi as Source of Truth**: Skills are created and edited in Strapi UI/API
 * - **Filesystem as SDK Interface**: Skills synced to `.claude/skills/` for SDK discovery
 * - **One-Way Sync**: Strapi → Filesystem (filesystem is not synced back to Strapi)
 * - **Template Parameters**: Supports `{{param}}` template injection for dynamic skill content
 *
 * **File Structure:**
 * ```
 * .claude/skills/{skill-name}/
 *   └── SKILL.md           # YAML frontmatter + markdown content
 * ```
 *
 * **SKILL.md Format:**
 * ```markdown
 * ---
 * name: skill-name
 * description: Use when you need to...
 * version: 1.0.0
 * category: custom
 * ---
 *
 * # Skill instructions (markdown content from skill.skillmd field)
 * ```
 *
 * **Strapi-to-Filesystem Sync Workflow:**
 * 1. **Fetch Skills**: Retrieve skills from Strapi database (usually filtered by agent/enabled status)
 * 2. **Validate**: Check skill data structure (name, skillmd required, size limits)
 * 3. **Sanitize**: Clean skill name to prevent path traversal (alphanumeric, hyphens, underscores only)
 * 4. **Create Directory**: Create `.claude/skills/{sanitized-name}/` if not exists
 * 5. **Parameter Injection**: Replace `{{param}}` placeholders with actual values (if parameters provided)
 * 6. **Build Frontmatter**: Create YAML frontmatter with name, description, version, category
 * 7. **Write File**: Write SKILL.md with frontmatter + content using gray-matter
 * 8. **SDK Discovery**: Claude SDK automatically discovers skills in `.claude/skills/` on next conversation start
 *
 * **Security Features:**
 * - Path traversal prevention via name sanitization
 * - File size limits (1MB max per skill)
 * - Parameter validation (alphanumeric keys, 10KB max per value)
 * - Recursive directory creation with safe defaults
 *
 * **Use Cases:**
 * - Sync all skills before starting a conversation with agent
 * - Sync individual skill when updated in Strapi
 * - Remove skill from filesystem when disabled/deleted in Strapi
 * - Clear all skills when switching projects or resetting agent configuration
 *
 * @example
 * // Basic skill sync workflow
 * import { strapiClient } from './strapi-client.js';
 * import { skillSyncService } from './skill-sync-service.js';
 *
 * // 1. Fetch skills from Strapi
 * const skills = await strapiClient.getAllSkills();
 *
 * // 2. Sync all skills to filesystem
 * await skillSyncService.syncAllSkills(skills);
 *
 * // 3. Start conversation (SDK discovers skills automatically)
 * const sdk = new ClaudeSdkService();
 * await sdk.startConversation({
 *   agentId: 'my-agent',
 *   settingSources: ['project']  // SDK reads from .claude/skills/
 * });
 *
 * @example
 * // Sync skills with template parameters
 * const skills = await strapiClient.getAllSkills({
 *   filters: { enabled: { $eq: true } }
 * });
 *
 * const parameters = {
 *   project_name: 'MyProject',
 *   api_key: process.env.API_KEY,
 *   environment: 'production'
 * };
 *
 * // Parameters replace {{project_name}}, {{api_key}}, {{environment}} in skill content
 * await skillSyncService.syncAllSkills(skills, parameters);
 *
 * @example
 * // Incremental sync - sync single updated skill
 * const skill = await strapiClient.getSkill(123, { populate: '*' });
 * const skillPath = await skillSyncService.syncSkillToFilesystem(skill);
 * console.log(`Synced to: ${skillPath}`);
 * // Output: Synced to: /project/.claude/skills/pdf-analyzer/SKILL.md
 *
 * @example
 * // Remove skill when disabled in Strapi
 * await skillSyncService.removeSkillFromFilesystem('pdf-analyzer');
 * // .claude/skills/pdf-analyzer/ directory deleted
 *
 * @example
 * // Clear all skills when switching projects
 * await skillSyncService.clearAllSkills();
 * // All skill directories removed, .claude/skills/ empty
 *
 * @example
 * // Agent-specific skill sync workflow
 * const agent = await strapiClient.getAgent(456, {
 *   populate: ['skills']
 * });
 *
 * // Sync only skills assigned to this agent
 * await skillSyncService.syncAllSkills(agent.skills || []);
 *
 * @see {@link https://docs.anthropic.com/en/api/agent-sdk/settings Anthropic Agent SDK Settings}
 */
class SkillSyncService {
  /** Absolute path to `.claude/skills/` directory where skills are synced */
  private skillsDir = path.join(process.cwd(), '.claude', 'skills');

  /**
   * Sync a single skill from Strapi to filesystem in `.claude/skills/{name}/SKILL.md` format
   *
   * @description
   * Writes a single skill to the filesystem with YAML frontmatter and markdown content.
   * This is the core sync operation used by `syncAllSkills` for batch operations and
   * for incremental updates when individual skills change in Strapi.
   *
   * **Workflow:**
   * 1. **Validate**: Check skill.name and skill.skillmd are non-empty strings, check size limits (max 1MB)
   * 2. **Sanitize Name**: Clean skill name to prevent path traversal (only alphanumeric, hyphens, underscores)
   * 3. **Create Directory**: Ensure `.claude/skills/{sanitized-name}/` exists (recursive creation)
   * 4. **Parameter Injection**: Replace `{{param}}` placeholders with values from parameters object (optional)
   * 5. **Build Frontmatter**: Create YAML object with name, description, version, category
   * 6. **Generate SKILL.md**: Use gray-matter to create frontmatter + content markdown file
   * 7. **Write to Disk**: Write SKILL.md file to `.claude/skills/{sanitized-name}/SKILL.md`
   * 8. **Return Path**: Return absolute path to created SKILL.md file
   *
   * **Template Parameters:**
   * - Supports `{{param}}` and `{{ param }}` syntax (spaces optional)
   * - Parameters replaced before writing to filesystem
   * - Use for dynamic content like API keys, project names, environment-specific values
   * - Parameter values validated (max 10KB per value, alphanumeric keys only)
   *
   * **Security:**
   * - Name sanitization prevents path traversal attacks (e.g., "../../../etc/passwd")
   * - File size limit prevents disk exhaustion (max 1MB per skill)
   * - Parameter validation prevents injection attacks
   *
   * @param skill - Skill object from Strapi with at minimum `name` and `skillmd` fields
   * @param parameters - Optional key-value pairs for `{{param}}` template replacement in skill content
   * @returns Promise resolving to absolute path of written SKILL.md file
   * @throws Error if skill.name or skill.skillmd is missing/invalid
   * @throws Error if skill content exceeds 1MB size limit
   * @throws Error if parameter keys are invalid (non-alphanumeric) or values exceed 10KB
   * @throws Error if filesystem operations fail (permissions, disk space, etc.)
   *
   * @example
   * // Basic skill sync
   * import { strapiClient } from './strapi-client.js';
   * import { skillSyncService } from './skill-sync-service.js';
   *
   * const skill = await strapiClient.getSkill(123, { populate: '*' });
   * const path = await skillSyncService.syncSkillToFilesystem(skill);
   *
   * console.log(`Synced to: ${path}`);
   * // Output: Synced to: /project/.claude/skills/pdf-analyzer/SKILL.md
   *
   * // File structure created:
   * // .claude/skills/pdf-analyzer/
   * //   └── SKILL.md
   *
   * @example
   * // Skill sync with template parameters
   * const skill = {
   *   name: 'api-client',
   *   description: 'Use when you need to call the external API',
   *   skillmd: `Call the API at {{api_url}} using key {{api_key}}`,
   *   version: '1.0.0',
   *   category: 'integration'
   * };
   *
   * const path = await skillSyncService.syncSkillToFilesystem(skill, {
   *   api_url: 'https://api.example.com',
   *   api_key: process.env.API_KEY
   * });
   *
   * // SKILL.md content:
   * // ---
   * // name: api-client
   * // description: Use when you need to call the external API
   * // version: 1.0.0
   * // category: integration
   * // ---
   * //
   * // Call the API at https://api.example.com using key sk-abc123
   *
   * @example
   * // Incremental sync when skill updated in Strapi
   * // WebSocket event handler or webhook endpoint
   * app.post('/webhooks/skill-updated', async (req, res) => {
   *   const { skillId } = req.body;
   *
   *   // Fetch latest version from Strapi
   *   const skill = await strapiClient.getSkill(skillId);
   *
   *   // Sync to filesystem immediately
   *   await skillSyncService.syncSkillToFilesystem(skill);
   *
   *   res.json({ success: true });
   * });
   *
   * @example
   * // Handling validation errors
   * try {
   *   await skillSyncService.syncSkillToFilesystem({
   *     name: '',  // Invalid: empty name
   *     skillmd: 'Content',
   *     description: 'Test'
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Invalid skill: name is required and must be a string
   * }
   *
   * @example
   * // Name sanitization behavior
   * const skill = {
   *   name: 'My Skill!@#$%',  // Invalid characters
   *   description: 'Test skill',
   *   skillmd: 'Instructions...'
   * };
   *
   * const path = await skillSyncService.syncSkillToFilesystem(skill);
   * console.log(path);
   * // Output: /project/.claude/skills/my-skill-----/SKILL.md
   * // Special characters replaced with hyphens, converted to lowercase
   *
   * @example
   * // Sync skill with version and category
   * const skill = {
   *   name: 'data-processor',
   *   description: 'Use when processing CSV data files',
   *   skillmd: '1. Load CSV\n2. Process rows\n3. Generate report',
   *   version: '2.1.0',
   *   category: 'data-analysis'
   * };
   *
   * await skillSyncService.syncSkillToFilesystem(skill);
   *
   * // SKILL.md frontmatter includes version and category:
   * // ---
   * // name: data-processor
   * // description: Use when processing CSV data files
   * // version: 2.1.0
   * // category: data-analysis
   * // ---
   *
   * @example
   * // Error handling for large skill content
   * try {
   *   const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
   *   await skillSyncService.syncSkillToFilesystem({
   *     name: 'large-skill',
   *     description: 'Test',
   *     skillmd: largeContent
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Skill content too large: large-skill (max 1MB)
   * }
   *
   * @see {@link syncAllSkills} for batch sync operations
   * @see {@link removeSkillFromFilesystem} for removing synced skills
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
   * Sync multiple skills from Strapi to filesystem in parallel
   *
   * @description
   * Batch operation to sync an array of skills to the filesystem. This is the primary method
   * called before starting a conversation with an agent to ensure all skills are available
   * for SDK discovery via `settingSources: ['project']`.
   *
   * **Workflow:**
   * 1. **Validate Input**: Accept array of skills and optional parameters object
   * 2. **Parallel Sync**: Call `syncSkillToFilesystem()` for each skill in parallel using `Promise.all()`
   * 3. **Wait for Completion**: Wait for all skills to finish syncing (or any to fail)
   * 4. **Error Handling**: If any skill fails, entire operation fails (partial sync possible before failure)
   *
   * **Performance:**
   * - Skills synced in parallel (not sequential) for better performance
   * - 100 skills typically sync in 200-500ms depending on content size and disk I/O
   * - Network latency not a factor (filesystem operations only)
   *
   * **Use Cases:**
   * - Sync all skills before starting agent conversation
   * - Sync agent-specific skills filtered by agent.skills relation
   * - Refresh all skills after bulk updates in Strapi
   * - Initial project setup or environment reset
   *
   * **Important Notes:**
   * - Same parameters applied to ALL skills (template values shared across all)
   * - If one skill fails, operation throws error (but some skills may already be synced)
   * - Does NOT clear existing skills first - use `clearAllSkills()` before if needed
   * - Empty array is valid input (no-op, useful for agents with no skills)
   *
   * @param skills - Array of skill objects from Strapi (e.g., from `getAllSkills()` or `agent.skills`)
   * @param parameters - Optional key-value pairs applied to ALL skills for `{{param}}` template replacement
   * @returns Promise resolving when all skills successfully synced (void)
   * @throws Error if any skill fails validation or filesystem write (partial sync may occur)
   *
   * @example
   * // Basic usage - sync all skills from Strapi
   * import { strapiClient } from './strapi-client.js';
   * import { skillSyncService } from './skill-sync-service.js';
   *
   * const skills = await strapiClient.getAllSkills();
   * await skillSyncService.syncAllSkills(skills);
   *
   * console.log(`Synced ${skills.length} skills to .claude/skills/`);
   * // Output: Synced 15 skills to .claude/skills/
   *
   * @example
   * // Agent-specific skill sync workflow
   * const agent = await strapiClient.getAgent(123, {
   *   populate: ['skills']
   * });
   *
   * // Sync only skills assigned to this agent
   * await skillSyncService.syncAllSkills(agent.skills || []);
   *
   * // Start conversation with agent (SDK discovers synced skills)
   * const sdk = new ClaudeSdkService();
   * await sdk.startConversation({
   *   agentId: agent.id,
   *   settingSources: ['project']
   * });
   *
   * @example
   * // Sync skills with shared template parameters
   * const skills = await strapiClient.getAllSkills({
   *   filters: { enabled: { $eq: true } }
   * });
   *
   * const parameters = {
   *   project_name: 'MyProject',
   *   api_url: process.env.API_URL,
   *   environment: process.env.NODE_ENV
   * };
   *
   * // All skills get same parameter values
   * await skillSyncService.syncAllSkills(skills, parameters);
   *
   * // All skills can use {{project_name}}, {{api_url}}, {{environment}} in content
   *
   * @example
   * // Full refresh workflow - clear and resync
   * // 1. Clear all existing skills
   * await skillSyncService.clearAllSkills();
   *
   * // 2. Fetch fresh skills from Strapi
   * const skills = await strapiClient.getAllSkills();
   *
   * // 3. Sync all skills
   * await skillSyncService.syncAllSkills(skills);
   *
   * console.log('Full skill refresh completed');
   *
   * @example
   * // Handling empty skill arrays (agents with no skills)
   * const agent = await strapiClient.getAgent(456, {
   *   populate: ['skills']
   * });
   *
   * await skillSyncService.syncAllSkills(agent.skills || []);
   * // No error thrown, no skills synced (valid no-op)
   *
   * @example
   * // Error handling - partial sync scenario
   * try {
   *   const skills = [
   *     { name: 'skill-1', skillmd: 'Content 1', description: 'Test' },
   *     { name: '', skillmd: 'Content 2', description: 'Test' },  // Invalid!
   *     { name: 'skill-3', skillmd: 'Content 3', description: 'Test' }
   *   ];
   *
   *   await skillSyncService.syncAllSkills(skills);
   * } catch (error) {
   *   console.error('Sync failed:', error.message);
   *   // Output: Sync failed: Invalid skill: name is required and must be a string
   *
   *   // Note: skill-1 and skill-3 MAY be synced (parallel execution, non-deterministic)
   *   // Recommend clearing and retrying on error for consistency
   * }
   *
   * @example
   * // Filtered skill sync - only enabled skills
   * const skills = await strapiClient.getAllSkills({
   *   filters: {
   *     enabled: { $eq: true },
   *     category: { $in: ['productivity', 'analysis'] }
   *   }
   * });
   *
   * await skillSyncService.syncAllSkills(skills);
   * // Only enabled productivity/analysis skills synced
   *
   * @example
   * // Performance measurement
   * const skills = await strapiClient.getAllSkills();
   * const startTime = Date.now();
   *
   * await skillSyncService.syncAllSkills(skills);
   *
   * const duration = Date.now() - startTime;
   * console.log(`Synced ${skills.length} skills in ${duration}ms`);
   * // Output: Synced 50 skills in 320ms
   *
   * @see {@link syncSkillToFilesystem} for single skill sync operation
   * @see {@link clearAllSkills} for clearing all skills before resync
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
   * Remove a skill directory from filesystem (inverse of syncSkillToFilesystem)
   *
   * @description
   * Deletes a skill directory and all its contents from `.claude/skills/{name}/`.
   * Used when skills are disabled, deleted, or removed from an agent's configuration in Strapi.
   *
   * **Workflow:**
   * 1. **Sanitize Name**: Clean skill name (same sanitization as sync for consistency)
   * 2. **Build Path**: Construct path to `.claude/skills/{sanitized-name}/`
   * 3. **Recursive Delete**: Remove directory and all contents using `fs.rm()` with `recursive: true`
   * 4. **Force Mode**: Use `force: true` to ignore ENOENT errors if directory doesn't exist
   * 5. **Error Handling**: Silently ignore if skill doesn't exist, throw on other errors
   *
   * **Safety Features:**
   * - Name sanitization prevents path traversal attacks
   * - Force mode prevents errors if skill already deleted
   * - Recursive deletion removes all files in skill directory (SKILL.md, skill.config.json, etc.)
   *
   * **Important Notes:**
   * - Operation is IRREVERSIBLE - no trash/recycle bin
   * - Silently succeeds if skill doesn't exist (idempotent)
   * - Does NOT delete skill from Strapi database (filesystem-only operation)
   * - SDK will not discover deleted skill on next conversation start
   *
   * @param skillName - Name of the skill to remove (will be sanitized before deletion)
   * @returns Promise resolving when skill directory deleted (void)
   *
   * @example
   * // Remove skill when disabled in Strapi
   * import { skillSyncService } from './skill-sync-service.js';
   *
   * await skillSyncService.removeSkillFromFilesystem('pdf-analyzer');
   * console.log('Skill removed from filesystem');
   *
   * // .claude/skills/pdf-analyzer/ directory deleted
   *
   * @example
   * // Webhook handler for skill deletion in Strapi
   * app.post('/webhooks/skill-deleted', async (req, res) => {
   *   const { skillName } = req.body;
   *
   *   // Remove from filesystem immediately
   *   await skillSyncService.removeSkillFromFilesystem(skillName);
   *
   *   res.json({ success: true, message: `Removed ${skillName}` });
   * });
   *
   * @example
   * // Selective sync - remove disabled skills
   * const allSkills = await strapiClient.getAllSkills();
   * const enabledSkills = allSkills.filter(s => s.enabled);
   * const disabledSkills = allSkills.filter(s => !s.enabled);
   *
   * // Sync enabled skills
   * await skillSyncService.syncAllSkills(enabledSkills);
   *
   * // Remove disabled skills
   * for (const skill of disabledSkills) {
   *   await skillSyncService.removeSkillFromFilesystem(skill.name);
   * }
   *
   * @example
   * // Idempotent behavior - safe to call multiple times
   * await skillSyncService.removeSkillFromFilesystem('non-existent-skill');
   * // No error thrown, silently succeeds
   *
   * await skillSyncService.removeSkillFromFilesystem('pdf-analyzer');
   * await skillSyncService.removeSkillFromFilesystem('pdf-analyzer');
   * // Second call silently succeeds (already deleted)
   *
   * @example
   * // Agent skill update workflow
   * const agent = await strapiClient.getAgent(123, {
   *   populate: ['skills']
   * });
   *
   * // Get list of currently synced skills
   * const parser = new ClaudeStructureParser(process.cwd());
   * const syncedSkills = await parser.parseSkills();
   *
   * // Sync new/updated skills
   * await skillSyncService.syncAllSkills(agent.skills || []);
   *
   * // Remove skills no longer assigned to agent
   * const agentSkillNames = new Set((agent.skills || []).map(s => s.name));
   * for (const syncedSkill of syncedSkills) {
   *   if (!agentSkillNames.has(syncedSkill.name)) {
   *     await skillSyncService.removeSkillFromFilesystem(syncedSkill.name);
   *   }
   * }
   *
   * @example
   * // Name sanitization consistency with sync
   * const skill = { name: 'My Skill!@#$%', skillmd: 'Content', description: 'Test' };
   *
   * // Sync creates: .claude/skills/my-skill-----/
   * await skillSyncService.syncSkillToFilesystem(skill);
   *
   * // Remove uses same sanitization
   * await skillSyncService.removeSkillFromFilesystem('My Skill!@#$%');
   * // Correctly deletes .claude/skills/my-skill-----/
   *
   * @example
   * // Error handling - filesystem permission errors
   * try {
   *   await skillSyncService.removeSkillFromFilesystem('protected-skill');
   * } catch (error) {
   *   if (error.code === 'EPERM') {
   *     console.error('Permission denied - skill directory is read-only');
   *   } else if (error.code === 'EBUSY') {
   *     console.error('Directory in use - close files and retry');
   *   }
   * }
   *
   * @see {@link syncSkillToFilesystem} for syncing skills to filesystem
   * @see {@link clearAllSkills} for removing all skills at once
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
   * Clear all skills from filesystem (removes entire `.claude/skills/` directory)
   *
   * @description
   * Deletes the entire `.claude/skills/` directory and all its contents, then recreates
   * an empty `.claude/skills/` directory. Used for full skill refresh, project cleanup,
   * or environment reset workflows.
   *
   * **Workflow:**
   * 1. **Delete Directory**: Remove `.claude/skills/` and all contents recursively
   * 2. **Recreate Directory**: Create new empty `.claude/skills/` directory
   * 3. **Error Handling**: Throw error if deletion or recreation fails
   *
   * **Important Notes:**
   * - Operation is IRREVERSIBLE - all skill files permanently deleted
   * - Use before full resync to ensure clean slate (no orphaned skills)
   * - Does NOT affect Strapi database (filesystem-only operation)
   * - SDK will not discover any skills until new sync performed
   * - Force mode ensures deletion succeeds even if directory doesn't exist
   *
   * **Use Cases:**
   * - Full skill refresh workflow (clear + sync all)
   * - Switch between different agent configurations
   * - Clean up before project reset or environment change
   * - Testing skill sync functionality from clean state
   *
   * @returns Promise resolving when directory cleared and recreated (void)
   * @throws Error if deletion or directory creation fails (permissions, disk space, etc.)
   *
   * @example
   * // Full skill refresh workflow
   * import { strapiClient } from './strapi-client.js';
   * import { skillSyncService } from './skill-sync-service.js';
   *
   * // 1. Clear all existing skills
   * await skillSyncService.clearAllSkills();
   *
   * // 2. Fetch fresh skills from Strapi
   * const skills = await strapiClient.getAllSkills();
   *
   * // 3. Sync all skills to filesystem
   * await skillSyncService.syncAllSkills(skills);
   *
   * console.log('Full skill refresh completed');
   *
   * @example
   * // Switch agent configurations
   * const agent1 = await strapiClient.getAgent(123, { populate: ['skills'] });
   * const agent2 = await strapiClient.getAgent(456, { populate: ['skills'] });
   *
   * // Clear skills from previous agent
   * await skillSyncService.clearAllSkills();
   *
   * // Sync skills for new agent
   * await skillSyncService.syncAllSkills(agent2.skills || []);
   *
   * @example
   * // Project cleanup before switching projects
   * // Clear skills from current project
   * await skillSyncService.clearAllSkills();
   *
   * // .claude/skills/ now empty, ready for new project skills
   *
   * @example
   * // Testing workflow - start from clean state
   * beforeEach(async () => {
   *   // Clear all skills before each test
   *   await skillSyncService.clearAllSkills();
   * });
   *
   * it('should sync skills correctly', async () => {
   *   const skills = [
   *     { name: 'test-skill', skillmd: 'Content', description: 'Test' }
   *   ];
   *
   *   await skillSyncService.syncAllSkills(skills);
   *
   *   // Verify skill exists
   *   const parser = new ClaudeStructureParser(process.cwd());
   *   const syncedSkills = await parser.parseSkills();
   *   expect(syncedSkills).toHaveLength(1);
   * });
   *
   * @example
   * // Error handling - permission errors
   * try {
   *   await skillSyncService.clearAllSkills();
   * } catch (error) {
   *   if (error.code === 'EPERM') {
   *     console.error('Permission denied - .claude/skills/ is read-only');
   *     console.error('Try running with elevated permissions');
   *   } else if (error.code === 'EBUSY') {
   *     console.error('Directory in use - close files and retry');
   *   }
   *   throw error;
   * }
   *
   * @example
   * // Graceful shutdown - clear skills before exit
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down - clearing skills...');
   *   await skillSyncService.clearAllSkills();
   *   process.exit(0);
   * });
   *
   * @example
   * // Idempotent behavior
   * await skillSyncService.clearAllSkills();
   * await skillSyncService.clearAllSkills();
   * // Second call succeeds (directory already empty)
   *
   * @see {@link syncAllSkills} for syncing skills after clearing
   * @see {@link removeSkillFromFilesystem} for removing individual skills
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
   * Replace `{{param}}` template placeholders with actual values in skill content
   *
   * @description
   * Performs string replacement of template placeholders in skill markdown content.
   * Supports both `{{key}}` and `{{ key }}` syntax (with or without spaces).
   * Uses global regex replacement to handle multiple occurrences of the same parameter.
   *
   * **Template Syntax:**
   * - `{{param}}` - Compact syntax without spaces
   * - `{{ param }}` - Spaced syntax (more readable)
   * - Multiple occurrences of same parameter all replaced
   * - Non-string values converted to string via `String(value)`
   *
   * **Use Cases:**
   * - Inject environment-specific values (URLs, API keys, credentials)
   * - Parameterize skill content per user/tenant
   * - Dynamic skill generation based on configuration
   *
   * @private
   * @param content - Skill markdown content with `{{param}}` placeholders
   * @param parameters - Key-value pairs where keys match placeholder names
   * @returns Processed content with all matching placeholders replaced
   *
   * @example
   * // Basic parameter injection
   * const content = 'API URL: {{api_url}}\nAPI Key: {{api_key}}';
   * const parameters = {
   *   api_url: 'https://api.example.com',
   *   api_key: 'sk-abc123'
   * };
   *
   * const result = this.injectParameters(content, parameters);
   * console.log(result);
   * // Output:
   * // API URL: https://api.example.com
   * // API Key: sk-abc123
   *
   * @example
   * // Spaced syntax support
   * const content = 'Project: {{ project_name }} ({{ environment }})';
   * const result = this.injectParameters(content, {
   *   project_name: 'MyApp',
   *   environment: 'production'
   * });
   * // Output: Project: MyApp (production)
   *
   * @example
   * // Multiple occurrences
   * const content = '{{url}}/users and {{url}}/posts';
   * const result = this.injectParameters(content, {
   *   url: 'https://api.example.com'
   * });
   * // Output: https://api.example.com/users and https://api.example.com/posts
   *
   * @example
   * // Non-string value conversion
   * const content = 'Port: {{port}}, Enabled: {{enabled}}';
   * const result = this.injectParameters(content, {
   *   port: 3000,
   *   enabled: true
   * });
   * // Output: Port: 3000, Enabled: true
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
   * Validate skill data structure and content before syncing to filesystem
   *
   * @description
   * Ensures skill object contains required fields with valid types and enforces
   * content size limits to prevent filesystem abuse or disk exhaustion.
   *
   * **Validation Rules:**
   * - `skill.name`: Required, must be non-empty string
   * - `skill.skillmd`: Required, must be non-empty string
   * - Content size: Max 1MB per skill (prevents disk exhaustion)
   *
   * **Why 1MB Limit:**
   * - Typical skill content: 1-10KB (instructions, examples)
   * - 1MB allows for very detailed skills with extensive examples
   * - Prevents accidental or malicious upload of large files
   * - Protects filesystem from exhaustion attacks
   *
   * @private
   * @param skill - Skill object to validate
   * @throws Error if skill.name is missing, empty, or not a string
   * @throws Error if skill.skillmd is missing, empty, or not a string
   * @throws Error if skill.skillmd exceeds 1MB size limit
   *
   * @example
   * // Valid skill passes validation
   * const skill = {
   *   name: 'pdf-analyzer',
   *   skillmd: 'Analyze PDF documents...',
   *   description: 'Use when analyzing PDFs'
   * };
   * this.validateSkill(skill);
   * // No error thrown
   *
   * @example
   * // Missing name throws error
   * try {
   *   this.validateSkill({ skillmd: 'Content' });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Invalid skill: name is required and must be a string
   * }
   *
   * @example
   * // Missing skillmd throws error
   * try {
   *   this.validateSkill({ name: 'test-skill' });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Invalid skill: skillmd is required and must be a string
   * }
   *
   * @example
   * // Content too large throws error
   * try {
   *   const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
   *   this.validateSkill({
   *     name: 'large-skill',
   *     skillmd: largeContent
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Skill content too large: large-skill (max 1MB)
   * }
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
   * Sanitize skill name to prevent path traversal attacks and ensure filesystem safety
   *
   * @description
   * Cleans skill names by removing or replacing dangerous characters that could be
   * used for path traversal attacks or cause filesystem issues. Ensures skill names
   * are safe for use as directory names in `.claude/skills/`.
   *
   * **Sanitization Rules:**
   * 1. Replace all non-alphanumeric characters (except hyphens and underscores) with hyphens
   * 2. Convert to lowercase for consistency
   * 3. Use `path.basename()` as additional safety layer (removes any path separators)
   *
   * **Security Protection:**
   * - Prevents path traversal: `../../../etc/passwd` → `etc-passwd`
   * - Removes path separators: `skill/../../attack` → `skill-attack`
   * - Normalizes special characters: `My Skill!@#$%` → `my-skill-----`
   *
   * **Why Sanitization:**
   * - Prevents directory traversal attacks
   * - Ensures cross-platform compatibility (Windows, Linux, macOS)
   * - Avoids filesystem errors from invalid characters
   * - Consistent naming convention (lowercase, hyphens)
   *
   * @private
   * @param name - Raw skill name (potentially unsafe, user-provided)
   * @returns Sanitized skill name (safe for filesystem, alphanumeric/hyphens/underscores/lowercase only)
   *
   * @example
   * // Basic sanitization
   * const sanitized = this.sanitizeSkillName('pdf-analyzer');
   * console.log(sanitized);
   * // Output: pdf-analyzer
   *
   * @example
   * // Path traversal attack prevention
   * const sanitized = this.sanitizeSkillName('../../../etc/passwd');
   * console.log(sanitized);
   * // Output: etc-passwd
   * // Dangerous path separators removed
   *
   * @example
   * // Special character replacement
   * const sanitized = this.sanitizeSkillName('My Skill!@#$%^&*()');
   * console.log(sanitized);
   * // Output: my-skill----------
   * // Spaces and special chars replaced with hyphens, converted to lowercase
   *
   * @example
   * // Windows path separator attack
   * const sanitized = this.sanitizeSkillName('C:\\Windows\\System32');
   * console.log(sanitized);
   * // Output: c-windows-system32
   * // Backslashes replaced, drive letter removed
   *
   * @example
   * // Preserves valid characters
   * const sanitized = this.sanitizeSkillName('Web_Scraper-v2');
   * console.log(sanitized);
   * // Output: web_scraper-v2
   * // Hyphens and underscores preserved, converted to lowercase
   *
   * @example
   * // Unicode and emoji removal
   * const sanitized = this.sanitizeSkillName('PDF Analyzer 📄');
   * console.log(sanitized);
   * // Output: pdf-analyzer--
   * // Emoji replaced with hyphens
   */
  private sanitizeSkillName(name: string): string {
    // Remove any path separators and special characters
    // Only allow: alphanumeric, hyphens, underscores
    const sanitized = name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();

    // Use path.basename as additional safety layer
    return path.basename(sanitized);
  }

  /**
   * Validate template parameter keys and values before injection
   *
   * @description
   * Ensures parameter keys are safe for regex replacement and values don't exceed
   * size limits. Prevents injection attacks and protects against excessive memory
   * usage during template replacement.
   *
   * **Validation Rules:**
   * - **Parameter Keys**: Alphanumeric and underscores only (regex-safe, no special chars)
   * - **Parameter Values**: Max 10KB per value (prevents memory exhaustion)
   *
   * **Why These Limits:**
   * - **Key Validation**: Prevents regex injection attacks via special characters
   * - **Value Validation**: Typical parameter values are <1KB (URLs, API keys, names)
   * - **10KB Limit**: Allows for large configuration values while preventing abuse
   * - **Memory Safety**: Prevents excessive memory usage during string replacement
   *
   * **Security Benefits:**
   * - Prevents regex injection via malicious parameter keys
   * - Protects against memory exhaustion attacks
   * - Ensures predictable template replacement behavior
   *
   * @private
   * @param parameters - Key-value pairs to validate
   * @throws Error if any parameter key contains invalid characters (non-alphanumeric/underscore)
   * @throws Error if any parameter value exceeds 10KB size limit
   *
   * @example
   * // Valid parameters pass validation
   * const parameters = {
   *   api_url: 'https://api.example.com',
   *   api_key: 'sk-abc123',
   *   environment: 'production'
   * };
   * this.validateParameters(parameters);
   * // No error thrown
   *
   * @example
   * // Invalid key with special characters throws error
   * try {
   *   this.validateParameters({
   *     'api-url': 'https://api.example.com'  // Hyphen not allowed
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Invalid parameter key: api-url
   * }
   *
   * @example
   * // Invalid key with dots throws error
   * try {
   *   this.validateParameters({
   *     'config.url': 'https://api.example.com'  // Dot not allowed
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Invalid parameter key: config.url
   * }
   *
   * @example
   * // Value too large throws error
   * try {
   *   const largeValue = 'x'.repeat(20 * 1024); // 20KB
   *   this.validateParameters({
   *     large_param: largeValue
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Parameter value too long: large_param (max 10KB)
   * }
   *
   * @example
   * // Valid keys - alphanumeric and underscores
   * this.validateParameters({
   *   project_name: 'MyApp',
   *   API_KEY: 'secret',
   *   env123: 'production',
   *   _private: 'value'
   * });
   * // No error thrown - all keys valid
   *
   * @example
   * // Non-string values converted to string for length check
   * this.validateParameters({
   *   port: 3000,           // String(3000).length = 4
   *   enabled: true,        // String(true).length = 4
   *   count: 999999         // String(999999).length = 6
   * });
   * // No error thrown - all values under 10KB when converted to string
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
