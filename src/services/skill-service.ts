import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { Skill, Agent, TrainingRecord, InputField } from './claude-structure-parser';
import { ClaudeStructureParser } from './claude-structure-parser.js';

/**
 * Request payload for creating a new skill in the `.claude/skills/` directory
 *
 * @description
 * Defines the structure for creating a new skill file with YAML frontmatter and markdown content.
 * Skills are stored as `SKILL.md` files in `.claude/skills/{name}/` with optional `skill.config.json`
 * for input field definitions.
 *
 * @example
 * // Basic skill creation
 * const request: CreateSkillRequest = {
 *   name: 'pdf-analyzer',
 *   description: 'Use when you need to analyze PDF documents and extract key information',
 *   content: 'Analyze the PDF document and extract:\n- Main topics\n- Key findings\n- Action items'
 * };
 *
 * @example
 * // Skill with allowed tools and MCP tools
 * const request: CreateSkillRequest = {
 *   name: 'web-scraper',
 *   description: 'Use when you need to fetch and parse web pages',
 *   allowedTools: ['WebFetch', 'Read', 'Write'],
 *   mcpTools: {
 *     'playwright-server': ['navigate', 'screenshot', 'extract_text'],
 *     'cheerio-server': ['parse_html', 'select_elements']
 *   },
 *   content: 'Steps:\n1. Fetch the URL\n2. Parse HTML\n3. Extract data\n4. Save results'
 * };
 *
 * @example
 * // Skill with input fields for parameterization
 * const request: CreateSkillRequest = {
 *   name: 'code-reviewer',
 *   description: 'Use when you need to review code for quality and best practices',
 *   allowedTools: ['Read', 'Grep', 'Glob'],
 *   inputFields: [
 *     {
 *       name: 'language',
 *       type: 'string',
 *       description: 'Programming language to review',
 *       required: true
 *     },
 *     {
 *       name: 'focus_areas',
 *       type: 'array',
 *       description: 'Areas to focus on (security, performance, readability)',
 *       required: false
 *     }
 *   ],
 *   content: 'Review the code for:\n- Security vulnerabilities\n- Performance issues\n- Code style\n- Best practices'
 * };
 */
export interface CreateSkillRequest {
  /** Skill identifier (lowercase, hyphens, numbers only, max 64 chars) */
  name: string;
  /** Brief description including "Use when..." guidance (max 1024 chars) */
  description: string;
  /** Optional array of allowed Claude SDK tool names */
  allowedTools?: string[];
  /** Optional MCP tools organized by server ID: { serverId: [toolName1, toolName2] } */
  mcpTools?: Record<string, string[]>;
  /** Optional input parameters for skill execution (stored in skill.config.json) */
  inputFields?: InputField[];
  /** Skill instructions/content in markdown format */
  content: string;
}

/**
 * Request payload for updating an existing skill
 *
 * @description
 * Defines the structure for updating an existing skill's YAML frontmatter and markdown content.
 * The skill name (ID) cannot be changed; use deleteSkill + createSkill to rename.
 * Updates replace the entire SKILL.md file and skill.config.json (if inputFields provided).
 *
 * @example
 * // Update skill description and content
 * const request: UpdateSkillRequest = {
 *   description: 'Use when you need to analyze PDF documents for compliance',
 *   content: 'Updated instructions:\n1. Check compliance\n2. Extract findings\n3. Generate report'
 * };
 *
 * @example
 * // Update skill with new allowed tools
 * const request: UpdateSkillRequest = {
 *   description: 'Use when you need to scrape web data with rate limiting',
 *   allowedTools: ['WebFetch', 'Read', 'Write', 'Bash'],
 *   content: 'Steps:\n1. Fetch with delays\n2. Parse\n3. Save'
 * };
 *
 * @example
 * // Update skill with modified MCP tools and input fields
 * const request: UpdateSkillRequest = {
 *   description: 'Use when you need to review code with custom rules',
 *   allowedTools: ['Read', 'Grep', 'Glob'],
 *   mcpTools: {
 *     'eslint-server': ['lint', 'fix'],
 *     'prettier-server': ['format']
 *   },
 *   inputFields: [
 *     {
 *       name: 'language',
 *       type: 'string',
 *       description: 'Programming language',
 *       required: true
 *     },
 *     {
 *       name: 'severity',
 *       type: 'string',
 *       description: 'Minimum severity level (error, warning, info)',
 *       required: false
 *     }
 *   ],
 *   content: 'Review with custom rules:\n- Run linter\n- Check formatting\n- Report issues'
 * };
 */
export interface UpdateSkillRequest {
  /** Updated brief description including "Use when..." guidance (max 1024 chars) */
  description: string;
  /** Optional array of allowed Claude SDK tool names (replaces existing) */
  allowedTools?: string[];
  /** Optional MCP tools organized by server ID (replaces existing) */
  mcpTools?: Record<string, string[]>;
  /** Optional input parameters (replaces existing skill.config.json or removes if empty) */
  inputFields?: InputField[];
  /** Updated skill instructions/content in markdown format */
  content: string;
}

/**
 * Response payload for skill creation, update, and deletion operations
 *
 * @description
 * Standard response format for skill management operations.
 * On success: `success=true` with optional `skill` and `path` data.
 * On failure: `success=false` with `error` message describing what went wrong.
 *
 * @example
 * // Successful skill creation
 * const response: CreateSkillResponse = {
 *   success: true,
 *   skill: {
 *     id: 'pdf-analyzer',
 *     name: 'pdf-analyzer',
 *     description: 'Use when you need to analyze PDF documents',
 *     path: '/project/.claude/skills/pdf-analyzer',
 *     skillMdPath: '/project/.claude/skills/pdf-analyzer/SKILL.md',
 *     content: 'Analyze the PDF...',
 *     metadata: {
 *       allowedTools: ['Read', 'Write']
 *     }
 *   },
 *   path: '/project/.claude/skills/pdf-analyzer/SKILL.md'
 * };
 *
 * @example
 * // Failed skill creation (validation error)
 * const response: CreateSkillResponse = {
 *   success: false,
 *   error: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 * };
 *
 * @example
 * // Failed skill creation (already exists)
 * const response: CreateSkillResponse = {
 *   success: false,
 *   error: 'Skill "pdf-analyzer" already exists at /project/.claude/skills/pdf-analyzer'
 * };
 *
 * @example
 * // Successful skill deletion
 * const response: CreateSkillResponse = {
 *   success: true,
 *   path: '/project/.claude/skills/pdf-analyzer'
 * };
 */
export interface CreateSkillResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Parsed skill object (on create/update success) */
  skill?: Skill;
  /** File system path to SKILL.md or skill directory */
  path?: string;
  /** Error message (on failure) describing what went wrong */
  error?: string;
}

/**
 * Validates skill name format against naming rules
 *
 * @description
 * Validates that a skill name conforms to the required naming rules for `.claude/skills/` directory structure.
 * The name is used as both the directory name and the skill identifier, so it must be filesystem-safe
 * and URL-friendly.
 *
 * **Validation Rules:**
 * - Required: Must be non-empty after trimming whitespace
 * - Length: Maximum 64 characters
 * - Format: Lowercase letters (a-z), numbers (0-9), and hyphens (-) only
 * - Regex: `/^[a-z0-9-]+$/`
 *
 * **Common Issues:**
 * - Uppercase letters: Use lowercase only (e.g., "PDF-Analyzer" → "pdf-analyzer")
 * - Spaces: Replace with hyphens (e.g., "web scraper" → "web-scraper")
 * - Underscores: Replace with hyphens (e.g., "code_review" → "code-review")
 * - Special characters: Remove or replace (e.g., "skill@v2" → "skill-v2")
 *
 * @param name - Skill name to validate
 * @returns Error message string if validation fails, null if valid
 *
 * @private
 *
 * @example
 * // Valid skill names
 * validateSkillName('pdf-analyzer');  // null (valid)
 * validateSkillName('web-scraper');   // null (valid)
 * validateSkillName('skill-v2');      // null (valid)
 * validateSkillName('code123');       // null (valid)
 * validateSkillName('a');             // null (valid - single char)
 *
 * @example
 * // Invalid: Empty or whitespace-only
 * validateSkillName('');          // 'Skill name is required'
 * validateSkillName('   ');       // 'Skill name is required'
 * validateSkillName(null as any); // 'Skill name is required'
 *
 * @example
 * // Invalid: Too long (>64 chars)
 * const longName = 'a'.repeat(65);
 * validateSkillName(longName);
 * // Returns: 'Skill name must be 64 characters or less'
 *
 * @example
 * // Invalid: Contains uppercase letters
 * validateSkillName('PDF-Analyzer');
 * // Returns: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 * validateSkillName('WebScraper');
 * // Returns: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 *
 * @example
 * // Invalid: Contains spaces or special characters
 * validateSkillName('web scraper');
 * // Returns: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 * validateSkillName('code_review');
 * // Returns: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 * validateSkillName('skill@v2');
 * // Returns: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 * validateSkillName('skill.config');
 * // Returns: 'Skill name must contain only lowercase letters, numbers, and hyphens'
 *
 * @example
 * // Usage in createSkill validation
 * const nameError = validateSkillName(request.name);
 * if (nameError) {
 *   return { success: false, error: nameError };
 * }
 * // Proceed with skill creation...
 *
 * @example
 * // User-friendly validation with suggestions
 * const name = 'PDF Analyzer';
 * const error = validateSkillName(name);
 *
 * if (error) {
 *   // Suggest corrected name
 *   const suggested = name.toLowerCase().replace(/\s+/g, '-');
 *   console.log(`Invalid name: ${name}`);
 *   console.log(`Error: ${error}`);
 *   console.log(`Suggestion: ${suggested}`);
 *   // Output:
 *   // Invalid name: PDF Analyzer
 *   // Error: Skill name must contain only lowercase letters, numbers, and hyphens
 *   // Suggestion: pdf-analyzer
 * }
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
 * Validates skill description content and format
 *
 * @description
 * Validates that a skill description provides clear guidance on when to use the skill.
 * The description is displayed to Claude and helps the AI agent decide when to activate
 * the skill, so it must be descriptive and include usage context.
 *
 * **Validation Rules:**
 * - Required: Must be non-empty after trimming whitespace
 * - Length: Maximum 1024 characters
 * - Content: Must include "Use when" phrase (case-insensitive) for usage guidance
 *
 * **Best Practices:**
 * - Start with "Use when you need to..." for clarity
 * - Be specific about the skill's purpose and use cases
 * - Include key scenarios or contexts where the skill applies
 * - Avoid vague descriptions like "A useful skill" or "Does stuff"
 *
 * @param description - Skill description to validate
 * @returns Error message string if validation fails, null if valid
 *
 * @private
 *
 * @example
 * // Valid descriptions
 * validateSkillDescription('Use when you need to analyze PDF documents');
 * // null (valid)
 *
 * validateSkillDescription('Use when you need to scrape websites and extract structured data');
 * // null (valid)
 *
 * validateSkillDescription('Use when reviewing code for security vulnerabilities and best practices');
 * // null (valid)
 *
 * @example
 * // Valid: Case-insensitive "use when" check
 * validateSkillDescription('USE WHEN you need to process images');
 * // null (valid)
 *
 * validateSkillDescription('You should use when analyzing logs');
 * // null (valid - contains "use when")
 *
 * validateSkillDescription('This skill is helpful to use when debugging');
 * // null (valid - contains "use when")
 *
 * @example
 * // Invalid: Empty or whitespace-only
 * validateSkillDescription('');
 * // Returns: 'Skill description is required'
 *
 * validateSkillDescription('   ');
 * // Returns: 'Skill description is required'
 *
 * validateSkillDescription(null as any);
 * // Returns: 'Skill description is required'
 *
 * @example
 * // Invalid: Too long (>1024 chars)
 * const longDesc = 'Use when you need to ' + 'a'.repeat(1020);
 * validateSkillDescription(longDesc);
 * // Returns: 'Skill description must be 1024 characters or less'
 *
 * @example
 * // Invalid: Missing "Use when" guidance
 * validateSkillDescription('A helpful skill for PDF processing');
 * // Returns: 'Skill description should include "Use when..." to describe when to use this skill'
 *
 * validateSkillDescription('Analyzes documents and extracts data');
 * // Returns: 'Skill description should include "Use when..." to describe when to use this skill'
 *
 * validateSkillDescription('This is a web scraper');
 * // Returns: 'Skill description should include "Use when..." to describe when to use this skill'
 *
 * @example
 * // Usage in createSkill validation
 * const descError = validateSkillDescription(request.description);
 * if (descError) {
 *   return { success: false, error: descError };
 * }
 * // Proceed with skill creation...
 *
 * @example
 * // User-friendly validation with suggestions
 * const description = 'Analyzes PDF documents';
 * const error = validateSkillDescription(description);
 *
 * if (error) {
 *   // Suggest corrected description
 *   const suggested = `Use when you need to ${description.toLowerCase()}`;
 *   console.log(`Invalid description: ${description}`);
 *   console.log(`Error: ${error}`);
 *   console.log(`Suggestion: ${suggested}`);
 *   // Output:
 *   // Invalid description: Analyzes PDF documents
 *   // Error: Skill description should include "Use when..." to describe when to use this skill
 *   // Suggestion: Use when you need to analyzes pdf documents
 * }
 *
 * @example
 * // Comprehensive validation flow
 * function validateDescription(desc: string): string {
 *   const error = validateSkillDescription(desc);
 *   if (error) {
 *     throw new Error(`Invalid description: ${error}`);
 *   }
 *   return desc;
 * }
 *
 * try {
 *   validateDescription('Use when analyzing code');
 *   console.log('Valid description');
 * } catch (err) {
 *   console.error(err.message);
 * }
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
 * Creates YAML frontmatter block for SKILL.md file
 *
 * @description
 * Generates the YAML frontmatter section that appears at the top of SKILL.md files.
 * The frontmatter contains skill metadata including name, description, allowed tools,
 * and MCP tool configurations. This metadata is parsed by ClaudeStructureParser and
 * used by Claude agents to understand skill capabilities and tool permissions.
 *
 * **YAML Frontmatter Format:**
 * ```yaml
 * ---
 * name: skill-name
 * description: Use when you need to...
 * allowed-tools: Tool1, Tool2, Tool3
 * mcp_tools:
 *   server-id-1:
 *     - tool-name-1
 *     - tool-name-2
 *   server-id-2:
 *     - tool-name-3
 * ---
 * ```
 *
 * **Field Descriptions:**
 * - `name`: Skill identifier (matches directory name, lowercase-hyphenated)
 * - `description`: Usage guidance (must include "Use when" phrase)
 * - `allowed-tools`: Optional comma-separated list of Claude SDK tool names (Read, Write, Bash, etc.)
 * - `mcp_tools`: Optional nested structure mapping MCP server IDs to their tool names
 *
 * **Important Notes:**
 * - The frontmatter is wrapped in `---` delimiters (YAML fence)
 * - allowed-tools is omitted if no tools are specified
 * - mcp_tools uses nested YAML structure with 2-space indentation
 * - Server IDs in mcp_tools match MCP server configuration IDs
 * - Tool names must match those exposed by the MCP server
 *
 * @param request - Skill creation request with name, description, and optional tool configurations
 * @returns YAML frontmatter string with `---` delimiters and newline-separated fields
 *
 * @private
 *
 * @example
 * // Basic skill frontmatter (no tools)
 * const frontmatter = createSkillFrontmatter({
 *   name: 'pdf-analyzer',
 *   description: 'Use when you need to analyze PDF documents',
 *   content: '...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: pdf-analyzer
 * // description: Use when you need to analyze PDF documents
 * // ---
 *
 * @example
 * // Skill with allowed Claude SDK tools
 * const frontmatter = createSkillFrontmatter({
 *   name: 'web-scraper',
 *   description: 'Use when you need to fetch and parse web pages',
 *   allowedTools: ['WebFetch', 'Read', 'Write'],
 *   content: '...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: web-scraper
 * // description: Use when you need to fetch and parse web pages
 * // allowed-tools: WebFetch, Read, Write
 * // ---
 *
 * @example
 * // Skill with MCP tools only
 * const frontmatter = createSkillFrontmatter({
 *   name: 'browser-automation',
 *   description: 'Use when you need to automate browser interactions',
 *   mcpTools: {
 *     'playwright-server': ['navigate', 'screenshot', 'extract_text'],
 *     'cheerio-server': ['parse_html', 'select_elements']
 *   },
 *   content: '...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: browser-automation
 * // description: Use when you need to automate browser interactions
 * // mcp_tools:
 * //   playwright-server:
 * //     - navigate
 * //     - screenshot
 * //     - extract_text
 * //   cheerio-server:
 * //     - parse_html
 * //     - select_elements
 * // ---
 *
 * @example
 * // Skill with both allowed tools and MCP tools
 * const frontmatter = createSkillFrontmatter({
 *   name: 'code-reviewer',
 *   description: 'Use when you need to review code for quality and best practices',
 *   allowedTools: ['Read', 'Grep', 'Glob'],
 *   mcpTools: {
 *     'eslint-server': ['lint', 'fix'],
 *     'prettier-server': ['format']
 *   },
 *   content: '...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: code-reviewer
 * // description: Use when you need to review code for quality and best practices
 * // allowed-tools: Read, Grep, Glob
 * // mcp_tools:
 * //   eslint-server:
 * //     - lint
 * //     - fix
 * //   prettier-server:
 * //     - format
 * // ---
 *
 * @example
 * // Empty tool arrays are filtered out (no output for empty mcpTools server)
 * const frontmatter = createSkillFrontmatter({
 *   name: 'data-processor',
 *   description: 'Use when processing data files',
 *   allowedTools: [],  // Empty array - not included in output
 *   mcpTools: {
 *     'valid-server': ['tool1', 'tool2'],
 *     'empty-server': []  // Empty array - filtered out
 *   },
 *   content: '...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: data-processor
 * // description: Use when processing data files
 * // mcp_tools:
 * //   valid-server:
 * //     - tool1
 * //     - tool2
 * // ---
 *
 * @example
 * // Usage in createSkill workflow
 * const request: CreateSkillRequest = {
 *   name: 'api-tester',
 *   description: 'Use when you need to test REST APIs',
 *   allowedTools: ['WebFetch', 'Read', 'Write'],
 *   content: 'Steps:\n1. Send request\n2. Validate response\n3. Log results'
 * };
 *
 * const frontmatter = createSkillFrontmatter(request);
 * const skillContent = `${frontmatter}\n\n${request.content}`;
 * await fs.writeFile('SKILL.md', skillContent, 'utf-8');
 *
 * @example
 * // Parsing generated frontmatter
 * import * as yaml from 'js-yaml';
 *
 * const frontmatter = createSkillFrontmatter({
 *   name: 'test-skill',
 *   description: 'Use when testing',
 *   allowedTools: ['Read'],
 *   content: '...'
 * });
 *
 * // Extract YAML content (between --- delimiters)
 * const lines = frontmatter.split('\n');
 * const yamlContent = lines.slice(1, -1).join('\n');
 * const parsed = yaml.load(yamlContent);
 *
 * console.log(parsed);
 * // Output:
 * // {
 * //   name: 'test-skill',
 * //   description: 'Use when testing',
 * //   'allowed-tools': 'Read'
 * // }
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
 * Creates a new skill in the `.claude/skills/` directory
 *
 * @description
 * Creates a new skill by generating a directory structure with SKILL.md (containing YAML frontmatter
 * and markdown content) and optionally skill.config.json (if inputFields are provided). The skill
 * name serves as both the directory name and the skill identifier.
 *
 * **File Structure:**
 * ```
 * .claude/skills/{name}/
 *   ├── SKILL.md           # YAML frontmatter + markdown content
 *   └── skill.config.json  # Optional: input field definitions
 * ```
 *
 * **SKILL.md Format:**
 * ```markdown
 * ---
 * name: skill-name
 * description: Use when you need to...
 * allowed-tools: Read, Write, Grep
 * mcp_tools:
 *   server-id:
 *     - tool-name
 * ---
 *
 * # Skill instructions (markdown content)
 * ```
 *
 * **Validation Rules:**
 * - Name: Required, 1-64 chars, lowercase letters/numbers/hyphens only, must match /^[a-z0-9-]+$/
 * - Description: Required, 1-1024 chars, must include "Use when" (case-insensitive)
 * - Content: Required, non-empty markdown instructions
 * - Uniqueness: Skill name must not already exist in `.claude/skills/`
 *
 * @param request - Skill creation request with name, description, content, and optional metadata
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to CreateSkillResponse with success status, skill data, and path
 *
 * @example
 * // Basic skill creation
 * const response = await createSkill(
 *   {
 *     name: 'pdf-analyzer',
 *     description: 'Use when you need to analyze PDF documents and extract key information',
 *     content: 'Analyze the PDF document and extract:\n- Main topics\n- Key findings\n- Action items'
 *   },
 *   '/Users/john/projects/my-app'
 * );
 *
 * if (response.success) {
 *   console.log('Created skill:', response.skill.name);
 *   console.log('Location:', response.path);
 *   // Output:
 *   // Created skill: pdf-analyzer
 *   // Location: /Users/john/projects/my-app/.claude/skills/pdf-analyzer/SKILL.md
 * } else {
 *   console.error('Error:', response.error);
 * }
 *
 * @example
 * // Skill with allowed tools and MCP tools
 * const response = await createSkill(
 *   {
 *     name: 'web-scraper',
 *     description: 'Use when you need to fetch and parse web pages',
 *     allowedTools: ['WebFetch', 'Read', 'Write'],
 *     mcpTools: {
 *       'playwright-server': ['navigate', 'screenshot', 'extract_text'],
 *       'cheerio-server': ['parse_html', 'select_elements']
 *     },
 *     content: 'Steps:\n1. Fetch the URL using WebFetch\n2. Parse HTML\n3. Extract data\n4. Save results'
 *   },
 *   process.cwd()
 * );
 *
 * // Generated SKILL.md:
 * // ---
 * // name: web-scraper
 * // description: Use when you need to fetch and parse web pages
 * // allowed-tools: WebFetch, Read, Write
 * // mcp_tools:
 * //   playwright-server:
 * //     - navigate
 * //     - screenshot
 * //     - extract_text
 * //   cheerio-server:
 * //     - parse_html
 * //     - select_elements
 * // ---
 * //
 * // Steps:
 * // 1. Fetch the URL using WebFetch
 * // 2. Parse HTML
 * // 3. Extract data
 * // 4. Save results
 *
 * @example
 * // Skill with input fields (creates skill.config.json)
 * const response = await createSkill(
 *   {
 *     name: 'code-reviewer',
 *     description: 'Use when you need to review code for quality and best practices',
 *     allowedTools: ['Read', 'Grep', 'Glob'],
 *     inputFields: [
 *       {
 *         name: 'language',
 *         type: 'string',
 *         description: 'Programming language to review',
 *         required: true
 *       },
 *       {
 *         name: 'focus_areas',
 *         type: 'array',
 *         description: 'Areas to focus on (security, performance, readability)',
 *         required: false
 *       }
 *     ],
 *     content: 'Review the code for:\n- Security vulnerabilities\n- Performance issues\n- Code style\n- Best practices'
 *   },
 *   '/Users/john/projects/my-app'
 * );
 *
 * // Creates two files:
 * // .claude/skills/code-reviewer/SKILL.md
 * // .claude/skills/code-reviewer/skill.config.json (contains inputFields)
 *
 * @example
 * // Handling validation errors
 * const response = await createSkill(
 *   {
 *     name: 'Invalid Name!',  // Contains invalid characters
 *     description: 'This is a skill',  // Missing "Use when"
 *     content: ''  // Empty content
 *   },
 *   process.cwd()
 * );
 *
 * // response.success === false
 * // response.error === 'Skill name must contain only lowercase letters, numbers, and hyphens'
 *
 * @example
 * // Handling duplicate skill names
 * // First creation succeeds
 * await createSkill(
 *   {
 *     name: 'pdf-analyzer',
 *     description: 'Use when analyzing PDFs',
 *     content: 'Instructions...'
 *   },
 *   process.cwd()
 * );
 *
 * // Second creation with same name fails
 * const response = await createSkill(
 *   {
 *     name: 'pdf-analyzer',
 *     description: 'Use when analyzing PDFs v2',
 *     content: 'Different instructions...'
 *   },
 *   process.cwd()
 * );
 *
 * // response.success === false
 * // response.error === 'Skill "pdf-analyzer" already exists at /path/.claude/skills/pdf-analyzer'
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Creates updated YAML frontmatter block for SKILL.md during skill updates
 *
 * @description
 * Generates a new YAML frontmatter section for updating existing SKILL.md files.
 * Similar to createSkillFrontmatter but takes the skill name separately since it cannot
 * be changed during updates (name is derived from the existing skill directory).
 *
 * **Key Differences from createSkillFrontmatter:**
 * - Name parameter is separate (preserves existing skill ID)
 * - Used exclusively by updateSkill() function
 * - Replaces all existing frontmatter fields (full replacement, not partial merge)
 *
 * **YAML Frontmatter Format:**
 * ```yaml
 * ---
 * name: skill-name
 * description: Use when you need to...
 * allowed-tools: Tool1, Tool2, Tool3
 * mcp_tools:
 *   server-id-1:
 *     - tool-name-1
 *     - tool-name-2
 * ---
 * ```
 *
 * **Update Semantics:**
 * - All fields are replaced (not merged) with values from UpdateSkillRequest
 * - If allowedTools is undefined/empty, the field is omitted from frontmatter
 * - If mcpTools is undefined/empty, the field is omitted from frontmatter
 * - This enables removing previously configured tools by omitting them from the update request
 *
 * @param name - Skill identifier (preserved from existing skill, cannot be changed)
 * @param request - Skill update request with description and optional tool configurations
 * @returns YAML frontmatter string with `---` delimiters and newline-separated fields
 *
 * @private
 *
 * @example
 * // Update description only (removes any existing allowed tools and MCP tools)
 * const frontmatter = updateSkillFrontmatter('pdf-analyzer', {
 *   description: 'Use when you need to analyze PDF documents for compliance',
 *   content: 'Updated instructions...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: pdf-analyzer
 * // description: Use when you need to analyze PDF documents for compliance
 * // ---
 *
 * @example
 * // Update with new allowed tools (replaces existing tools)
 * const frontmatter = updateSkillFrontmatter('web-scraper', {
 *   description: 'Use when you need to scrape web data with rate limiting',
 *   allowedTools: ['WebFetch', 'Read', 'Write', 'Bash'],  // Replaced tool list
 *   content: 'Updated steps...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: web-scraper
 * // description: Use when you need to scrape web data with rate limiting
 * // allowed-tools: WebFetch, Read, Write, Bash
 * // ---
 *
 * @example
 * // Update with modified MCP tools (replaces existing MCP configuration)
 * const frontmatter = updateSkillFrontmatter('code-reviewer', {
 *   description: 'Use when you need to review code with custom linting rules',
 *   allowedTools: ['Read', 'Grep', 'Glob'],
 *   mcpTools: {
 *     'eslint-server': ['lint', 'fix'],
 *     'prettier-server': ['format']
 *   },
 *   content: 'Updated review steps...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: code-reviewer
 * // description: Use when you need to review code with custom linting rules
 * // allowed-tools: Read, Grep, Glob
 * // mcp_tools:
 * //   eslint-server:
 * //     - lint
 * //     - fix
 * //   prettier-server:
 * //     - format
 * // ---
 *
 * @example
 * // Remove all tools from skill (omit allowedTools and mcpTools)
 * const frontmatter = updateSkillFrontmatter('browser-automation', {
 *   description: 'Use when you need basic browser automation',
 *   // allowedTools: undefined - not included in frontmatter
 *   // mcpTools: undefined - not included in frontmatter
 *   content: 'Simplified instructions...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: browser-automation
 * // description: Use when you need basic browser automation
 * // ---
 *
 * @example
 * // Empty arrays are treated as "remove" (not included in frontmatter)
 * const frontmatter = updateSkillFrontmatter('data-processor', {
 *   description: 'Use when processing data files',
 *   allowedTools: [],  // Empty - field omitted
 *   mcpTools: {},      // Empty - field omitted
 *   content: 'Process data...'
 * });
 *
 * console.log(frontmatter);
 * // Output:
 * // ---
 * // name: data-processor
 * // description: Use when processing data files
 * // ---
 *
 * @example
 * // Usage in updateSkill workflow
 * const skillId = 'pdf-analyzer';
 * const request: UpdateSkillRequest = {
 *   description: 'Use when you need to analyze PDF documents for compliance',
 *   allowedTools: ['Read', 'Write'],
 *   content: 'New instructions:\n1. Check compliance\n2. Extract findings\n3. Generate report'
 * };
 *
 * const frontmatter = updateSkillFrontmatter(skillId, request);
 * const skillContent = `${frontmatter}\n\n${request.content}`;
 * const skillMdPath = path.join(projectRoot, '.claude', 'skills', skillId, 'SKILL.md');
 * await fs.writeFile(skillMdPath, skillContent, 'utf-8');
 *
 * @example
 * // Comparison: Name handling in create vs update
 * // Create: Name comes from request
 * const createFrontmatter = createSkillFrontmatter({
 *   name: 'new-skill',  // Name in request
 *   description: 'Use when...',
 *   content: '...'
 * });
 *
 * // Update: Name passed separately (from skillId parameter to updateSkill)
 * const updateFrontmatter = updateSkillFrontmatter(
 *   'existing-skill',  // Name preserved from existing directory
 *   {
 *     description: 'Use when...',
 *     content: '...'
 *     // No 'name' field in UpdateSkillRequest
 *   }
 * );
 *
 * @example
 * // Full replacement semantics example
 * // Original SKILL.md frontmatter:
 * // ---
 * // name: web-scraper
 * // description: Use when you need to scrape websites
 * // allowed-tools: WebFetch, Read
 * // mcp_tools:
 * //   playwright-server:
 * //     - navigate
 * // ---
 *
 * // Update with new MCP tools (playwright-server is removed, cheerio-server is added)
 * const frontmatter = updateSkillFrontmatter('web-scraper', {
 *   description: 'Use when you need to parse HTML',
 *   allowedTools: ['Read', 'Write'],  // WebFetch removed, Write added
 *   mcpTools: {
 *     'cheerio-server': ['parse_html', 'select']  // playwright-server gone
 *   },
 *   content: 'Parse HTML...'
 * });
 *
 * // New frontmatter completely replaces old:
 * // ---
 * // name: web-scraper
 * // description: Use when you need to parse HTML
 * // allowed-tools: Read, Write
 * // mcp_tools:
 * //   cheerio-server:
 * //     - parse_html
 * //     - select
 * // ---
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
 * Updates an existing skill in the `.claude/skills/` directory
 *
 * @description
 * Updates an existing skill by replacing its SKILL.md file with new frontmatter and content.
 * If inputFields are provided, skill.config.json is created/updated; if omitted, the config
 * file is deleted. The skill name (ID) cannot be changed; use deleteSkill + createSkill to rename.
 *
 * **Update Behavior:**
 * - SKILL.md: Entire file is replaced (frontmatter + content)
 * - skill.config.json: Created/updated if inputFields provided, deleted if inputFields empty/undefined
 * - Skill name: Preserved (cannot be changed via update)
 * - All frontmatter fields: Replaced with new values from request
 *
 * **Validation Rules:**
 * - Description: Required, 1-1024 chars, must include "Use when" (case-insensitive)
 * - Content: Required, non-empty markdown instructions
 * - Skill existence: Skill must exist in `.claude/skills/{skillId}/`
 *
 * @param skillId - Skill identifier (directory name in .claude/skills/)
 * @param request - Skill update request with description, content, and optional metadata
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to CreateSkillResponse with success status, updated skill data, and path
 *
 * @example
 * // Basic skill update (description and content only)
 * const response = await updateSkill(
 *   'pdf-analyzer',
 *   {
 *     description: 'Use when you need to analyze PDF documents for compliance and regulations',
 *     content: 'Updated instructions:\n1. Check compliance\n2. Extract findings\n3. Generate report'
 *   },
 *   '/Users/john/projects/my-app'
 * );
 *
 * if (response.success) {
 *   console.log('Updated skill:', response.skill.name);
 *   console.log('New description:', response.skill.description);
 * } else {
 *   console.error('Error:', response.error);
 * }
 *
 * @example
 * // Update skill with new allowed tools
 * const response = await updateSkill(
 *   'web-scraper',
 *   {
 *     description: 'Use when you need to scrape web data with rate limiting',
 *     allowedTools: ['WebFetch', 'Read', 'Write', 'Bash'],  // Added 'Bash'
 *     content: 'Steps:\n1. Fetch with delays\n2. Parse\n3. Save'
 *   },
 *   process.cwd()
 * );
 *
 * // Updated SKILL.md frontmatter now includes 'Bash' in allowed-tools
 *
 * @example
 * // Update skill with modified MCP tools and input fields
 * const response = await updateSkill(
 *   'code-reviewer',
 *   {
 *     description: 'Use when you need to review code with custom linting rules',
 *     allowedTools: ['Read', 'Grep', 'Glob'],
 *     mcpTools: {
 *       'eslint-server': ['lint', 'fix'],
 *       'prettier-server': ['format']
 *     },
 *     inputFields: [
 *       {
 *         name: 'language',
 *         type: 'string',
 *         description: 'Programming language',
 *         required: true
 *       },
 *       {
 *         name: 'severity',
 *         type: 'string',
 *         description: 'Minimum severity level (error, warning, info)',
 *         required: false
 *       }
 *     ],
 *     content: 'Review with custom rules:\n- Run linter\n- Check formatting\n- Report issues'
 *   },
 *   process.cwd()
 * );
 *
 * // Updates both SKILL.md and skill.config.json
 *
 * @example
 * // Remove input fields from skill (deletes skill.config.json)
 * const response = await updateSkill(
 *   'code-reviewer',
 *   {
 *     description: 'Use when you need to review code',
 *     allowedTools: ['Read', 'Grep', 'Glob'],
 *     // inputFields omitted or set to undefined
 *     content: 'Review the code for best practices'
 *   },
 *   process.cwd()
 * );
 *
 * // skill.config.json is deleted if it existed
 *
 * @example
 * // Handling validation errors
 * const response = await updateSkill(
 *   'pdf-analyzer',
 *   {
 *     description: 'This is a skill',  // Missing "Use when"
 *     content: ''  // Empty content
 *   },
 *   process.cwd()
 * );
 *
 * // response.success === false
 * // response.error === 'Skill description should include "Use when..." to describe when to use this skill'
 *
 * @example
 * // Handling non-existent skill
 * const response = await updateSkill(
 *   'nonexistent-skill',
 *   {
 *     description: 'Use when needed',
 *     content: 'Instructions...'
 *   },
 *   process.cwd()
 * );
 *
 * // response.success === false
 * // response.error === 'Skill "nonexistent-skill" does not exist'
 *
 * @example
 * // Complete workflow: Update and verify
 * const response = await updateSkill(
 *   'web-scraper',
 *   {
 *     description: 'Use when you need to scrape websites with retry logic',
 *     allowedTools: ['WebFetch', 'Read', 'Write', 'Bash'],
 *     mcpTools: {
 *       'playwright-server': ['navigate', 'screenshot', 'extract_text', 'wait_for_selector']
 *     },
 *     content: 'Scraping with retries:\n1. Set retry count\n2. Fetch URL\n3. Retry on failure\n4. Parse and save'
 *   },
 *   process.cwd()
 * );
 *
 * if (response.success) {
 *   // Verify the update
 *   const parser = new ClaudeStructureParser();
 *   const skills = await parser.parseSkills(process.cwd());
 *   const updatedSkill = skills.find(s => s.id === 'web-scraper');
 *   console.log('Allowed tools:', updatedSkill.metadata?.allowedTools);
 *   console.log('MCP tools:', updatedSkill.metadata?.mcpTools);
 * }
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Checks if a skill exists in the `.claude/skills/` directory
 *
 * @description
 * Verifies whether a skill directory exists at `.claude/skills/{name}/`.
 * This is a synchronous filesystem check that only validates directory existence,
 * not SKILL.md validity or content structure.
 *
 * **Use Cases:**
 * - Pre-flight validation before creating a skill (prevent duplicates)
 * - Validate skill references in agent configurations
 * - Batch validation of skill dependencies
 * - Cleanup verification after deletion
 *
 * @param name - Skill identifier (directory name in .claude/skills/)
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to true if skill directory exists, false otherwise
 *
 * @example
 * // Check if skill exists before creation
 * const exists = await skillExists('pdf-analyzer', process.cwd());
 * if (exists) {
 *   console.log('Skill already exists, choose a different name');
 * } else {
 *   // Proceed with creation
 *   await createSkill({ name: 'pdf-analyzer', ... }, process.cwd());
 * }
 *
 * @example
 * // Validate skill references in agent config
 * const agentSkills = ['pdf-analyzer', 'web-scraper', 'code-reviewer'];
 * const validationResults = await Promise.all(
 *   agentSkills.map(async (skillName) => ({
 *     skill: skillName,
 *     exists: await skillExists(skillName, '/Users/john/projects/my-app')
 *   }))
 * );
 *
 * const missingSkills = validationResults.filter(r => !r.exists);
 * if (missingSkills.length > 0) {
 *   console.error('Missing skills:', missingSkills.map(r => r.skill));
 * }
 * // Output: Missing skills: ['code-reviewer']
 *
 * @example
 * // Verify deletion completed successfully
 * await deleteSkill('old-skill', process.cwd());
 * const stillExists = await skillExists('old-skill', process.cwd());
 * console.log('Deletion verified:', !stillExists);
 * // Output: Deletion verified: true
 *
 * @example
 * // Batch validation for UI display
 * const skillNames = ['skill1', 'skill2', 'skill3'];
 * const existenceMap = new Map();
 *
 * for (const name of skillNames) {
 *   existenceMap.set(name, await skillExists(name, process.cwd()));
 * }
 *
 * // Display with status indicators
 * skillNames.forEach(name => {
 *   const status = existenceMap.get(name) ? '✓' : '✗';
 *   console.log(`${status} ${name}`);
 * });
 * // Output:
 * // ✓ skill1
 * // ✗ skill2
 * // ✓ skill3
 */
export async function skillExists(name: string, projectRoot: string): Promise<boolean> {
  const skillDir = path.join(projectRoot, '.claude', 'skills', name);
  return existsSync(skillDir);
}

/**
 * Deletes a skill from the `.claude/skills/` directory
 *
 * @description
 * Permanently deletes a skill by removing its entire directory (`.claude/skills/{name}/`),
 * including SKILL.md, skill.config.json, and any other files within the skill directory.
 * This operation is irreversible and uses recursive deletion with force flag.
 *
 * **Deletion Behavior:**
 * - Removes entire skill directory and all contents recursively
 * - Force flag ensures no errors if directory contains unexpected files
 * - Does NOT update agent configurations that reference this skill
 * - Does NOT update Strapi database (use SkillSyncService.removeSkill for sync)
 *
 * **Important Notes:**
 * - This is a filesystem-only operation; Strapi sync must be handled separately
 * - Agent configurations may contain broken references after deletion
 * - Consider backing up skills before deletion if you may need to restore them
 * - Use validateSkillReferences() on agents after deletion to find broken references
 *
 * @param name - Skill identifier (directory name in .claude/skills/)
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to CreateSkillResponse with success status and path
 *
 * @example
 * // Basic skill deletion
 * const response = await deleteSkill('pdf-analyzer', process.cwd());
 *
 * if (response.success) {
 *   console.log('Deleted skill at:', response.path);
 *   // Output: Deleted skill at: /Users/john/projects/my-app/.claude/skills/pdf-analyzer
 * } else {
 *   console.error('Error:', response.error);
 * }
 *
 * @example
 * // Safe deletion with confirmation and backup
 * const skillName = 'web-scraper';
 *
 * // Step 1: Verify skill exists
 * const exists = await skillExists(skillName, process.cwd());
 * if (!exists) {
 *   console.log('Skill does not exist');
 *   return;
 * }
 *
 * // Step 2: Check if skill is used by agents
 * const usage = await getSkillUsage(skillName, process.cwd());
 * if (usage.count > 0) {
 *   console.warn(`Warning: Skill is used by ${usage.count} agent(s): ${usage.agentIds.join(', ')}`);
 *   const confirmDelete = await getUserConfirmation('Delete anyway?');
 *   if (!confirmDelete) return;
 * }
 *
 * // Step 3: Backup skill before deletion
 * const parser = new ClaudeStructureParser();
 * const skills = await parser.parseSkills(process.cwd());
 * const skillToDelete = skills.find(s => s.id === skillName);
 * const backup = JSON.stringify(skillToDelete, null, 2);
 * await fs.writeFile(`backup-${skillName}.json`, backup);
 *
 * // Step 4: Delete skill
 * const response = await deleteSkill(skillName, process.cwd());
 * console.log('Deletion result:', response.success ? 'Success' : response.error);
 *
 * @example
 * // Handling non-existent skill
 * const response = await deleteSkill('nonexistent-skill', process.cwd());
 *
 * // response.success === false
 * // response.error === 'Skill "nonexistent-skill" does not exist'
 *
 * @example
 * // Bulk deletion with error handling
 * const skillsToDelete = ['old-skill-1', 'old-skill-2', 'old-skill-3'];
 * const results = await Promise.all(
 *   skillsToDelete.map(async (name) => {
 *     const response = await deleteSkill(name, process.cwd());
 *     return {
 *       skill: name,
 *       success: response.success,
 *       error: response.error
 *     };
 *   })
 * );
 *
 * const successful = results.filter(r => r.success);
 * const failed = results.filter(r => !r.success);
 *
 * console.log(`Deleted ${successful.length} skills`);
 * if (failed.length > 0) {
 *   console.error('Failed to delete:', failed.map(r => `${r.skill} (${r.error})`));
 * }
 *
 * @example
 * // Delete and verify cleanup
 * const skillName = 'temporary-skill';
 *
 * // Delete skill
 * const deleteResponse = await deleteSkill(skillName, process.cwd());
 * console.log('Deleted:', deleteResponse.success);
 *
 * // Verify deletion
 * const stillExists = await skillExists(skillName, process.cwd());
 * console.log('Cleanup verified:', !stillExists);
 *
 * // Output:
 * // Deleted: true
 * // Cleanup verified: true
 *
 * @example
 * // Complete workflow: Delete skill and update agents
 * const skillName = 'deprecated-skill';
 *
 * // Step 1: Find agents using this skill
 * const usage = await getSkillUsage(skillName, process.cwd());
 * console.log(`Skill used by ${usage.count} agents:`, usage.agentIds);
 *
 * // Step 2: Delete skill
 * await deleteSkill(skillName, process.cwd());
 *
 * // Step 3: Update affected agents (remove broken reference)
 * // Note: This requires agent update logic (not shown here)
 * for (const agentId of usage.agentIds) {
 *   console.log(`TODO: Remove "${skillName}" from agent "${agentId}" configuration`);
 * }
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validates that all referenced skill names exist in the `.claude/skills/` directory
 *
 * @description
 * Validates an array of skill names to ensure they all exist in the project's `.claude/skills/`
 * directory. This is essential for verifying agent configurations, skill dependencies, and
 * preventing broken references when skills are deleted or renamed.
 *
 * **Validation Workflow:**
 * 1. Returns immediately if skill array is empty or undefined (valid: true)
 * 2. Iterates through each skill name
 * 3. Checks if skill directory exists at `.claude/skills/{skillName}/`
 * 4. Collects invalid (non-existent) skill names
 * 5. Returns validation result with list of invalid skills
 *
 * **Use Cases:**
 * - Validate agent configuration before saving (ensure all referenced skills exist)
 * - Pre-flight validation before deleting a skill (check if it would break agent configs)
 * - Batch validation of skill dependencies across multiple agents
 * - UI validation in agent editor (highlight missing skills in real-time)
 * - Database integrity checks after skill sync operations
 *
 * **Important Notes:**
 * - Empty skill arrays are considered valid (agents don't need skills)
 * - Only checks directory existence, not SKILL.md validity or content
 * - Does not validate skill names format (assumes valid skill IDs)
 * - Synchronous filesystem checks (may be slow for large skill arrays)
 *
 * @param skillNames - Array of skill identifiers to validate (directory names in .claude/skills/)
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to validation result with validity flag and array of invalid skill names
 *
 * @example
 * // Valid skill references (all skills exist)
 * const result = await validateSkillReferences(
 *   ['pdf-analyzer', 'web-scraper', 'code-reviewer'],
 *   process.cwd()
 * );
 *
 * console.log('Valid:', result.valid);           // true
 * console.log('Invalid skills:', result.invalidSkills);  // []
 *
 * @example
 * // Invalid skill references (some skills don't exist)
 * const result = await validateSkillReferences(
 *   ['pdf-analyzer', 'nonexistent-skill', 'web-scraper'],
 *   '/Users/john/projects/my-app'
 * );
 *
 * console.log('Valid:', result.valid);           // false
 * console.log('Invalid skills:', result.invalidSkills);  // ['nonexistent-skill']
 *
 * @example
 * // Empty skill array (valid - agents don't need skills)
 * const result = await validateSkillReferences([], process.cwd());
 *
 * console.log('Valid:', result.valid);           // true
 * console.log('Invalid skills:', result.invalidSkills);  // []
 *
 * @example
 * // Validate agent configuration before saving
 * const agentConfig = {
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   skills: ['pdf-analyzer', 'web-scraper', 'data-processor']
 * };
 *
 * const validation = await validateSkillReferences(
 *   agentConfig.skills,
 *   process.cwd()
 * );
 *
 * if (!validation.valid) {
 *   console.error('Cannot save agent: Missing skills:', validation.invalidSkills.join(', '));
 *   // UI: Display error message with missing skill names
 *   throw new Error(`Missing skills: ${validation.invalidSkills.join(', ')}`);
 * }
 *
 * // Proceed with saving agent configuration
 * await saveAgentConfig(agentConfig);
 *
 * @example
 * // Real-time validation in agent editor UI
 * async function validateAgentSkills(selectedSkills: string[]) {
 *   const validation = await validateSkillReferences(selectedSkills, process.cwd());
 *
 *   if (!validation.valid) {
 *     // Highlight missing skills in red
 *     validation.invalidSkills.forEach(skillName => {
 *       document.querySelector(`[data-skill="${skillName}"]`)?.classList.add('invalid');
 *     });
 *
 *     // Show warning message
 *     showWarning(`Missing skills: ${validation.invalidSkills.join(', ')}`);
 *   }
 * }
 *
 * @example
 * // Check if deleting a skill would break agent configurations
 * const skillToDelete = 'pdf-analyzer';
 *
 * // Step 1: Get all agents
 * const parser = new ClaudeStructureParser();
 * const agents = await parser.parseAgents(process.cwd());
 *
 * // Step 2: Check each agent's remaining skills (excluding the one to delete)
 * const brokenAgents = [];
 *
 * for (const agent of agents) {
 *   if (agent.metadata?.skills?.includes(skillToDelete)) {
 *     // Get skills that would remain after deletion
 *     const remainingSkills = agent.metadata.skills.filter(s => s !== skillToDelete);
 *
 *     // Validate remaining skills
 *     const validation = await validateSkillReferences(remainingSkills, process.cwd());
 *
 *     if (!validation.valid) {
 *       brokenAgents.push({
 *         agent: agent.id,
 *         brokenSkills: validation.invalidSkills
 *       });
 *     }
 *   }
 * }
 *
 * if (brokenAgents.length > 0) {
 *   console.warn('Deleting skill would break:', brokenAgents);
 * }
 *
 * @example
 * // Batch validation for skill dependencies
 * const agentConfigurations = [
 *   { id: 'agent1', skills: ['skill1', 'skill2'] },
 *   { id: 'agent2', skills: ['skill2', 'skill3'] },
 *   { id: 'agent3', skills: ['skill4', 'skill5'] }
 * ];
 *
 * const validationResults = await Promise.all(
 *   agentConfigurations.map(async (config) => ({
 *     agent: config.id,
 *     validation: await validateSkillReferences(config.skills, process.cwd())
 *   }))
 * );
 *
 * const invalidAgents = validationResults.filter(r => !r.validation.valid);
 *
 * if (invalidAgents.length > 0) {
 *   console.error('Invalid agent configurations:');
 *   invalidAgents.forEach(({ agent, validation }) => {
 *     console.error(`  ${agent}: Missing skills [${validation.invalidSkills.join(', ')}]`);
 *   });
 * }
 * // Output:
 * // Invalid agent configurations:
 * //   agent3: Missing skills [skill4, skill5]
 *
 * @example
 * // Database integrity check after skill sync
 * import { strapiClient } from './strapi-client';
 *
 * async function validateDatabaseIntegrity() {
 *   // Get all agents from database
 *   const agents = await strapiClient.getAllAgents();
 *
 *   const integrityIssues = [];
 *
 *   for (const agent of agents) {
 *     const skillIds = agent.skillSelection?.skills?.map(s => s.id) || [];
 *
 *     if (skillIds.length > 0) {
 *       const validation = await validateSkillReferences(skillIds, process.cwd());
 *
 *       if (!validation.valid) {
 *         integrityIssues.push({
 *           agentId: agent.id,
 *           agentName: agent.name,
 *           missingSkills: validation.invalidSkills
 *         });
 *       }
 *     }
 *   }
 *
 *   if (integrityIssues.length > 0) {
 *     console.error('Database integrity issues detected:');
 *     integrityIssues.forEach(issue => {
 *       console.error(`  Agent "${issue.agentName}" references missing skills: ${issue.missingSkills.join(', ')}`);
 *     });
 *
 *     // Auto-fix: Remove missing skills from agent configurations
 *     // (implementation depends on requirements)
 *   }
 *
 *   return integrityIssues;
 * }
 *
 * @example
 * // User-friendly error messages
 * async function createAgentWithValidation(agentConfig: any) {
 *   const validation = await validateSkillReferences(
 *     agentConfig.skills || [],
 *     process.cwd()
 *   );
 *
 *   if (!validation.valid) {
 *     const errorMessage = validation.invalidSkills.length === 1
 *       ? `Skill "${validation.invalidSkills[0]}" does not exist`
 *       : `Skills ${validation.invalidSkills.map(s => `"${s}"`).join(', ')} do not exist`;
 *
 *     throw new Error(errorMessage);
 *   }
 *
 *   // Create agent...
 * }
 *
 * try {
 *   await createAgentWithValidation({
 *     id: 'my-agent',
 *     skills: ['pdf-analyzer', 'missing-skill']
 *   });
 * } catch (err) {
 *   console.error(err.message);
 *   // Output: Skill "missing-skill" does not exist
 * }
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
 * Gets usage information for a specific skill across all agents
 *
 * @description
 * Analyzes all agents in the `.claude/agents/` directory to find which ones reference a specific skill.
 * Returns a list of agent IDs that use the skill and a count of total usages. This is useful for
 * understanding skill dependencies, preventing orphaned skills, and validating deletion safety.
 *
 * **Analysis Workflow:**
 * 1. Parse all agents from `.claude/agents/` directory using ClaudeStructureParser
 * 2. Filter agents that have the specified skill in their `metadata.skills` array
 * 3. Extract agent IDs from matching agents
 * 4. Return array of agent IDs and count
 *
 * **Use Cases:**
 * - Check if a skill is used before deletion (prevent breaking agent configurations)
 * - Display "Used by N agents" badge in skill management UI
 * - Find skill dependencies for documentation generation
 * - Identify unused skills for cleanup/archival
 * - Validate skill rename/move operations (find all references)
 * - Generate skill usage reports and analytics
 *
 * **Important Notes:**
 * - Only checks filesystem agents (`.claude/agents/`), not Strapi database
 * - Does NOT validate if the skill itself exists (may return usage for non-existent skills)
 * - Returns empty array if no agents use the skill
 * - Synchronous agent parsing (may be slow with many agents)
 * - Skill names are case-sensitive matches
 *
 * @param skillName - Skill identifier to search for (directory name in .claude/skills/)
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to usage information with agent IDs array and total count
 *
 * @example
 * // Check usage for an existing skill
 * const usage = await getSkillUsage('pdf-analyzer', process.cwd());
 *
 * console.log('Used by agents:', usage.agentIds);  // ['agent-1', 'agent-2', 'data-agent']
 * console.log('Total usage count:', usage.count);  // 3
 *
 * @example
 * // Check usage for skill not used by any agents
 * const usage = await getSkillUsage('unused-skill', process.cwd());
 *
 * console.log('Used by agents:', usage.agentIds);  // []
 * console.log('Total usage count:', usage.count);  // 0
 *
 * @example
 * // Safe skill deletion with usage check
 * const skillName = 'web-scraper';
 *
 * const usage = await getSkillUsage(skillName, process.cwd());
 *
 * if (usage.count > 0) {
 *   console.warn(
 *     `Warning: Skill "${skillName}" is used by ${usage.count} agent(s): ${usage.agentIds.join(', ')}`
 *   );
 *
 *   const confirmDelete = await getUserConfirmation(
 *     `Are you sure you want to delete this skill? ${usage.count} agent(s) will be affected.`
 *   );
 *
 *   if (!confirmDelete) {
 *     console.log('Deletion cancelled');
 *     return;
 *   }
 *
 *   // Optionally update agents to remove skill reference
 *   console.log('TODO: Remove skill from affected agents:', usage.agentIds);
 * }
 *
 * // Proceed with deletion
 * await deleteSkill(skillName, process.cwd());
 *
 * @example
 * // Display "Used by N agents" badge in skill management UI
 * async function renderSkillCard(skillName: string) {
 *   const usage = await getSkillUsage(skillName, process.cwd());
 *
 *   const badge = usage.count > 0
 *     ? `<span class="badge">Used by ${usage.count} agent${usage.count === 1 ? '' : 's'}</span>`
 *     : '<span class="badge secondary">Unused</span>';
 *
 *   return `
 *     <div class="skill-card">
 *       <h3>${skillName}</h3>
 *       ${badge}
 *     </div>
 *   `;
 * }
 *
 * @example
 * // Find unused skills for cleanup
 * const parser = new ClaudeStructureParser();
 * const skills = await parser.parseSkills(process.cwd());
 *
 * const unusedSkills = [];
 *
 * for (const skill of skills) {
 *   const usage = await getSkillUsage(skill.id, process.cwd());
 *
 *   if (usage.count === 0) {
 *     unusedSkills.push(skill.id);
 *   }
 * }
 *
 * console.log('Unused skills:', unusedSkills);
 * // Output: Unused skills: ['old-skill', 'deprecated-skill', 'experimental-skill']
 *
 * // Optionally archive or delete unused skills
 * if (unusedSkills.length > 0) {
 *   console.log(`Found ${unusedSkills.length} unused skills. Archive or delete?`);
 * }
 *
 * @example
 * // Generate skill usage report
 * async function generateSkillUsageReport(projectRoot: string) {
 *   const parser = new ClaudeStructureParser();
 *   const skills = await parser.parseSkills(projectRoot);
 *
 *   const report = [];
 *
 *   for (const skill of skills) {
 *     const usage = await getSkillUsage(skill.id, projectRoot);
 *
 *     report.push({
 *       skill: skill.id,
 *       description: skill.description,
 *       usageCount: usage.count,
 *       usedBy: usage.agentIds,
 *       status: usage.count > 0 ? 'active' : 'unused'
 *     });
 *   }
 *
 *   // Sort by usage count (most used first)
 *   report.sort((a, b) => b.usageCount - a.usageCount);
 *
 *   console.log('=== Skill Usage Report ===');
 *   report.forEach(item => {
 *     console.log(`\n${item.skill} (${item.usageCount} uses)`);
 *     console.log(`  Description: ${item.description}`);
 *     if (item.usedBy.length > 0) {
 *       console.log(`  Used by: ${item.usedBy.join(', ')}`);
 *     }
 *   });
 *
 *   return report;
 * }
 *
 * @example
 * // Validate skill rename operation
 * async function renameSkill(oldName: string, newName: string, projectRoot: string) {
 *   // Step 1: Find all agents using the old skill name
 *   const usage = await getSkillUsage(oldName, projectRoot);
 *
 *   console.log(`Found ${usage.count} agent(s) using skill "${oldName}"`);
 *
 *   // Step 2: Rename the skill directory
 *   const oldDir = path.join(projectRoot, '.claude', 'skills', oldName);
 *   const newDir = path.join(projectRoot, '.claude', 'skills', newName);
 *   await fs.rename(oldDir, newDir);
 *
 *   // Step 3: Update all agent configurations to reference new name
 *   console.log(`TODO: Update ${usage.count} agent(s) to reference "${newName}":`, usage.agentIds);
 *   // (Agent update implementation depends on agent config format)
 *
 *   console.log('Skill renamed successfully');
 * }
 *
 * @example
 * // Display skill details with usage information
 * async function displaySkillDetails(skillName: string) {
 *   const parser = new ClaudeStructureParser();
 *   const skills = await parser.parseSkills(process.cwd());
 *   const skill = skills.find(s => s.id === skillName);
 *
 *   if (!skill) {
 *     console.error(`Skill "${skillName}" not found`);
 *     return;
 *   }
 *
 *   const usage = await getSkillUsage(skillName, process.cwd());
 *
 *   console.log('=== Skill Details ===');
 *   console.log('Name:', skill.name);
 *   console.log('Description:', skill.description);
 *   console.log('Usage Count:', usage.count);
 *
 *   if (usage.count > 0) {
 *     console.log('Used by agents:');
 *     usage.agentIds.forEach((agentId, index) => {
 *       console.log(`  ${index + 1}. ${agentId}`);
 *     });
 *   } else {
 *     console.log('Status: Unused');
 *   }
 * }
 *
 * @example
 * // Bulk operation: Delete all unused skills
 * async function deleteAllUnusedSkills(projectRoot: string) {
 *   const parser = new ClaudeStructureParser();
 *   const skills = await parser.parseSkills(projectRoot);
 *
 *   const deletionResults = [];
 *
 *   for (const skill of skills) {
 *     const usage = await getSkillUsage(skill.id, projectRoot);
 *
 *     if (usage.count === 0) {
 *       console.log(`Deleting unused skill: ${skill.id}`);
 *       const result = await deleteSkill(skill.id, projectRoot);
 *       deletionResults.push({ skill: skill.id, success: result.success });
 *     }
 *   }
 *
 *   const successful = deletionResults.filter(r => r.success).length;
 *   console.log(`Deleted ${successful} unused skill(s)`);
 *
 *   return deletionResults;
 * }
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
 * Gets all skills with complete usage information across all agents
 *
 * @description
 * Retrieves all skills from the `.claude/skills/` directory and enriches each skill with
 * usage information by analyzing which agents reference them. Returns an array of skills
 * with `usedInAgents` and `usageCount` properties populated, enabling comprehensive skill
 * analytics and dependency visualization.
 *
 * **Processing Workflow:**
 * 1. Parse all skills from `.claude/skills/` directory using ClaudeStructureParser
 * 2. Parse all agents from `.claude/agents/` directory in parallel
 * 3. Build a skill usage map by iterating through all agent configurations
 * 4. For each agent with skills, record which skills it uses
 * 5. Enhance each skill object with `usedInAgents` (array of agent IDs) and `usageCount`
 * 6. Return enriched skills array
 *
 * **Returned Skill Properties (Enhanced):**
 * - All standard Skill interface properties (id, name, description, path, content, metadata, etc.)
 * - `usedInAgents`: string[] - Array of agent IDs that reference this skill
 * - `usageCount`: number - Total number of agents using this skill
 *
 * **Use Cases:**
 * - Display skills table with usage statistics in management UI
 * - Generate skill analytics dashboard with usage charts
 * - Identify popular vs unused skills for optimization
 * - Sort skills by popularity (most/least used)
 * - Skill cleanup: Find and archive/delete unused skills
 * - Dependency visualization: Show skill-agent relationships
 * - Export skill usage reports for documentation
 *
 * **Important Notes:**
 * - Parses both skills and agents (may be slow with large directories)
 * - Only checks filesystem (`.claude/skills/`, `.claude/agents/`), not Strapi database
 * - Usage count includes each agent only once (even if agent references skill multiple times)
 * - Skills with zero usage have empty `usedInAgents` array and `usageCount: 0`
 * - Parallel parsing of skills and agents for performance optimization
 *
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to array of Skill objects enriched with usage information
 *
 * @example
 * // Get all skills with usage information
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * skills.forEach(skill => {
 *   console.log(`${skill.name}:`);
 *   console.log(`  Used by ${skill.usageCount} agent(s)`);
 *   if (skill.usedInAgents && skill.usedInAgents.length > 0) {
 *     console.log(`  Agents: ${skill.usedInAgents.join(', ')}`);
 *   } else {
 *     console.log(`  Status: Unused`);
 *   }
 * });
 *
 * // Example output:
 * // pdf-analyzer:
 * //   Used by 3 agent(s)
 * //   Agents: agent-1, agent-2, data-agent
 * // web-scraper:
 * //   Used by 1 agent(s)
 * //   Agents: web-agent
 * // old-skill:
 * //   Used by 0 agent(s)
 * //   Status: Unused
 *
 * @example
 * // Display skills table with usage statistics
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * console.log('Skills Management Dashboard');
 * console.log('━'.repeat(80));
 * console.log('Skill Name'.padEnd(30), 'Usage Count'.padEnd(15), 'Used By');
 * console.log('─'.repeat(80));
 *
 * skills.forEach(skill => {
 *   const usedBy = skill.usedInAgents && skill.usedInAgents.length > 0
 *     ? skill.usedInAgents.join(', ')
 *     : '-';
 *
 *   console.log(
 *     skill.name.padEnd(30),
 *     skill.usageCount.toString().padEnd(15),
 *     usedBy
 *   );
 * });
 *
 * // Output:
 * // Skills Management Dashboard
 * // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * // Skill Name                    Usage Count     Used By
 * // ────────────────────────────────────────────────────────────────────────────────
 * // pdf-analyzer                  3               agent-1, agent-2, data-agent
 * // web-scraper                   1               web-agent
 * // code-reviewer                 2               dev-agent, qa-agent
 * // old-skill                     0               -
 *
 * @example
 * // Sort skills by popularity (most used first)
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * const sortedByPopularity = skills.sort((a, b) => b.usageCount - a.usageCount);
 *
 * console.log('Most Popular Skills:');
 * sortedByPopularity.slice(0, 5).forEach((skill, index) => {
 *   console.log(`${index + 1}. ${skill.name} (${skill.usageCount} uses)`);
 * });
 *
 * // Output:
 * // Most Popular Skills:
 * // 1. pdf-analyzer (3 uses)
 * // 2. code-reviewer (2 uses)
 * // 3. web-scraper (1 uses)
 * // 4. old-skill (0 uses)
 *
 * @example
 * // Find and list unused skills for cleanup
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * const unusedSkills = skills.filter(skill => skill.usageCount === 0);
 *
 * console.log(`Found ${unusedSkills.length} unused skill(s):`);
 * unusedSkills.forEach(skill => {
 *   console.log(`  - ${skill.name}: ${skill.description}`);
 * });
 *
 * // Prompt for cleanup action
 * if (unusedSkills.length > 0) {
 *   const action = await prompt('Archive, delete, or keep unused skills? (a/d/k):');
 *   // Handle user choice...
 * }
 *
 * @example
 * // Generate skill analytics dashboard data
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * const analytics = {
 *   total: skills.length,
 *   used: skills.filter(s => s.usageCount > 0).length,
 *   unused: skills.filter(s => s.usageCount === 0).length,
 *   averageUsage: skills.reduce((sum, s) => sum + s.usageCount, 0) / skills.length,
 *   mostPopular: skills.sort((a, b) => b.usageCount - a.usageCount)[0],
 *   usageDistribution: {
 *     '0 uses': skills.filter(s => s.usageCount === 0).length,
 *     '1-2 uses': skills.filter(s => s.usageCount >= 1 && s.usageCount <= 2).length,
 *     '3+ uses': skills.filter(s => s.usageCount >= 3).length
 *   }
 * };
 *
 * console.log('=== Skill Analytics ===');
 * console.log('Total skills:', analytics.total);
 * console.log('Used skills:', analytics.used);
 * console.log('Unused skills:', analytics.unused);
 * console.log('Average usage:', analytics.averageUsage.toFixed(2));
 * console.log('Most popular:', analytics.mostPopular?.name, `(${analytics.mostPopular?.usageCount} uses)`);
 * console.log('\nUsage Distribution:');
 * Object.entries(analytics.usageDistribution).forEach(([range, count]) => {
 *   console.log(`  ${range}: ${count} skill(s)`);
 * });
 *
 * @example
 * // Export skill usage report to JSON
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * const report = skills.map(skill => ({
 *   name: skill.name,
 *   description: skill.description,
 *   usageCount: skill.usageCount,
 *   usedInAgents: skill.usedInAgents || [],
 *   status: skill.usageCount > 0 ? 'active' : 'unused',
 *   allowedTools: skill.metadata?.allowedTools || [],
 *   mcpTools: skill.metadata?.mcpTools || {}
 * }));
 *
 * await fs.writeFile(
 *   'skill-usage-report.json',
 *   JSON.stringify(report, null, 2),
 *   'utf-8'
 * );
 *
 * console.log('Report exported to skill-usage-report.json');
 *
 * @example
 * // Display skill dependency graph (skill -> agents)
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * console.log('=== Skill Dependency Graph ===');
 * skills.forEach(skill => {
 *   if (skill.usageCount > 0) {
 *     console.log(`\n${skill.name}`);
 *     skill.usedInAgents?.forEach(agentId => {
 *       console.log(`  └─> ${agentId}`);
 *     });
 *   }
 * });
 *
 * // Output:
 * // === Skill Dependency Graph ===
 * //
 * // pdf-analyzer
 * //   └─> agent-1
 * //   └─> agent-2
 * //   └─> data-agent
 * //
 * // web-scraper
 * //   └─> web-agent
 *
 * @example
 * // Filter and display skills by usage threshold
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * const heavilyUsedSkills = skills.filter(s => s.usageCount >= 3);
 * const lightlyUsedSkills = skills.filter(s => s.usageCount > 0 && s.usageCount < 3);
 * const unusedSkills = skills.filter(s => s.usageCount === 0);
 *
 * console.log(`Heavily Used (3+ agents): ${heavilyUsedSkills.length} skill(s)`);
 * heavilyUsedSkills.forEach(s => console.log(`  - ${s.name} (${s.usageCount})`));
 *
 * console.log(`\nLightly Used (1-2 agents): ${lightlyUsedSkills.length} skill(s)`);
 * lightlyUsedSkills.forEach(s => console.log(`  - ${s.name} (${s.usageCount})`));
 *
 * console.log(`\nUnused: ${unusedSkills.length} skill(s)`);
 * unusedSkills.forEach(s => console.log(`  - ${s.name}`));
 *
 * @example
 * // Generate CSV export for skills with usage
 * const skills = await getSkillsWithUsageInfo(process.cwd());
 *
 * const csvHeader = 'Skill Name,Description,Usage Count,Used By\n';
 * const csvRows = skills.map(skill =>
 *   `"${skill.name}","${skill.description}",${skill.usageCount},"${(skill.usedInAgents || []).join(', ')}"`
 * ).join('\n');
 *
 * const csv = csvHeader + csvRows;
 * await fs.writeFile('skills-usage.csv', csv, 'utf-8');
 *
 * console.log('CSV export saved to skills-usage.csv');
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
 * Updates a skill's experience score and appends a new training record to its history
 *
 * @description
 * Updates the `experience_score` and `training_history` fields in a skill's SKILL.md YAML frontmatter.
 * The experience score is rounded to an integer and the training record is prepended to the history
 * array (most recent first). The training history is capped at 10 records maximum (oldest records
 * are dropped when limit is exceeded).
 *
 * **Update Workflow:**
 * 1. Verify skill exists at `.claude/skills/{skillId}/SKILL.md`
 * 2. Read and parse existing SKILL.md file content
 * 3. Extract YAML frontmatter between `---` delimiters
 * 4. Parse frontmatter YAML to JavaScript object
 * 5. Update `experience_score` field with rounded new score
 * 6. Prepend new training record to `training_history` array (create if doesn't exist)
 * 7. Trim training history to last 10 records if needed
 * 8. Rebuild YAML frontmatter with updated data
 * 9. Reconstruct file content (frontmatter + body)
 * 10. Write updated content back to SKILL.md
 *
 * **Experience Score:**
 * - Represents skill quality/effectiveness based on training outcomes
 * - Stored as integer (newScore is rounded using Math.round())
 * - Updated after each training session by training agents
 * - Higher scores indicate better-performing skills
 *
 * **Training History:**
 * - Array of TrainingRecord objects documenting skill usage and outcomes
 * - Ordered chronologically (newest first, oldest last)
 * - Limited to 10 most recent records (FIFO queue with max size 10)
 * - Each record includes: timestamp, agent, task, outcome, feedback, metrics
 * - Used for skill analytics, debugging, and improvement tracking
 *
 * **Important Notes:**
 * - Only updates SKILL.md (filesystem), not Strapi database
 * - Requires valid SKILL.md with YAML frontmatter (returns error if malformed)
 * - Score is always rounded to integer (decimals are not preserved)
 * - Training history is automatically initialized if missing
 * - Older records beyond 10 are silently dropped
 * - Preserves all other frontmatter fields unchanged
 *
 * @param skillId - Skill identifier (directory name in .claude/skills/)
 * @param newScore - New experience score (will be rounded to integer)
 * @param trainingRecord - Training record to append to history (TrainingRecord object)
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to result with success flag and optional error message
 *
 * @example
 * // Update skill experience after successful training
 * const trainingRecord: TrainingRecord = {
 *   timestamp: new Date().toISOString(),
 *   agent: 'training-agent-1',
 *   task: 'Extract data from PDF invoice',
 *   outcome: 'success',
 *   feedback: 'Successfully extracted all required fields',
 *   metrics: {
 *     accuracy: 0.95,
 *     executionTime: 3.2
 *   }
 * };
 *
 * const result = await updateSkillExperience(
 *   'pdf-analyzer',
 *   87.5,  // Rounded to 88
 *   trainingRecord,
 *   process.cwd()
 * );
 *
 * if (result.success) {
 *   console.log('Skill experience updated successfully');
 * } else {
 *   console.error('Error:', result.error);
 * }
 *
 * @example
 * // Update experience score after failed training (lower score)
 * const failedRecord: TrainingRecord = {
 *   timestamp: new Date().toISOString(),
 *   agent: 'training-agent-2',
 *   task: 'Parse complex PDF with tables',
 *   outcome: 'failure',
 *   feedback: 'Failed to extract table data correctly',
 *   metrics: {
 *     accuracy: 0.45,
 *     errors: 12
 *   }
 * };
 *
 * // Lower the score due to failure
 * const currentScore = 88;
 * const penaltyFactor = 0.9;
 * const newScore = currentScore * penaltyFactor;  // 79.2 → rounds to 79
 *
 * const result = await updateSkillExperience(
 *   'pdf-analyzer',
 *   newScore,
 *   failedRecord,
 *   process.cwd()
 * );
 *
 * @example
 * // Iterative training with experience updates
 * async function trainSkill(skillId: string, trainingTasks: any[]) {
 *   let currentScore = 50;  // Initial score
 *
 *   for (const task of trainingTasks) {
 *     // Execute training task
 *     const outcome = await executeTrainingTask(skillId, task);
 *
 *     // Calculate new score based on outcome
 *     if (outcome.success) {
 *       currentScore = Math.min(100, currentScore + outcome.improvement);
 *     } else {
 *       currentScore = Math.max(0, currentScore - 10);
 *     }
 *
 *     // Record training
 *     const record: TrainingRecord = {
 *       timestamp: new Date().toISOString(),
 *       agent: 'training-bot',
 *       task: task.description,
 *       outcome: outcome.success ? 'success' : 'failure',
 *       feedback: outcome.feedback,
 *       metrics: outcome.metrics
 *     };
 *
 *     // Update skill experience
 *     await updateSkillExperience(skillId, currentScore, record, process.cwd());
 *
 *     console.log(`Training iteration ${task.id}: Score ${currentScore}`);
 *   }
 *
 *   console.log(`Training completed. Final score: ${currentScore}`);
 * }
 *
 * @example
 * // Handling non-existent skill error
 * const result = await updateSkillExperience(
 *   'nonexistent-skill',
 *   75,
 *   { timestamp: new Date().toISOString(), agent: 'bot', task: 'test', outcome: 'success', feedback: 'ok' },
 *   process.cwd()
 * );
 *
 * if (!result.success) {
 *   console.error('Error:', result.error);
 *   // Output: Error: Skill "nonexistent-skill" does not exist
 * }
 *
 * @example
 * // Score rounding behavior
 * await updateSkillExperience('skill1', 87.4, record, projectRoot);  // Stored as 87
 * await updateSkillExperience('skill1', 87.5, record, projectRoot);  // Stored as 88
 * await updateSkillExperience('skill1', 87.6, record, projectRoot);  // Stored as 88
 * await updateSkillExperience('skill1', 88.0, record, projectRoot);  // Stored as 88
 *
 * @example
 * // Training history cap at 10 records
 * const skillId = 'web-scraper';
 *
 * // Skill currently has 9 training records
 * const history = await getSkillTrainingHistory(skillId, process.cwd());
 * console.log('Current history length:', history.history?.length);  // 9
 *
 * // Add 3 more records
 * for (let i = 0; i < 3; i++) {
 *   const record: TrainingRecord = {
 *     timestamp: new Date().toISOString(),
 *     agent: `agent-${i}`,
 *     task: `Task ${i}`,
 *     outcome: 'success',
 *     feedback: `Training ${i} completed`
 *   };
 *
 *   await updateSkillExperience(skillId, 85 + i, record, process.cwd());
 * }
 *
 * // History is capped at 10 (oldest 2 records were dropped)
 * const updatedHistory = await getSkillTrainingHistory(skillId, process.cwd());
 * console.log('Updated history length:', updatedHistory.history?.length);  // 10
 * console.log('Most recent task:', updatedHistory.history?.[0].task);  // 'Task 2'
 * console.log('Oldest task:', updatedHistory.history?.[9].task);  // (9th oldest record)
 *
 * @example
 * // Complete training workflow with experience tracking
 * async function runTrainingSession(skillId: string, projectRoot: string) {
 *   // Get current skill state
 *   const parser = new ClaudeStructureParser();
 *   const skills = await parser.parseSkills(projectRoot);
 *   const skill = skills.find(s => s.id === skillId);
 *
 *   const currentScore = skill?.experienceScore || 0;
 *   console.log('Starting training. Current score:', currentScore);
 *
 *   // Execute training
 *   const testCases = [
 *     { input: 'test1.pdf', expected: { fields: 5 } },
 *     { input: 'test2.pdf', expected: { fields: 8 } },
 *     { input: 'test3.pdf', expected: { fields: 3 } }
 *   ];
 *
 *   let successCount = 0;
 *
 *   for (const testCase of testCases) {
 *     const result = await testSkill(skillId, testCase);
 *     const success = result.fields === testCase.expected.fields;
 *
 *     if (success) successCount++;
 *
 *     const record: TrainingRecord = {
 *       timestamp: new Date().toISOString(),
 *       agent: 'test-runner',
 *       task: `Test ${testCase.input}`,
 *       outcome: success ? 'success' : 'failure',
 *       feedback: success ? 'All fields extracted' : `Expected ${testCase.expected.fields}, got ${result.fields}`,
 *       metrics: {
 *         accuracy: result.fields / testCase.expected.fields,
 *         fieldsExtracted: result.fields
 *       }
 *     };
 *
 *     // Calculate new score (weighted average)
 *     const accuracyRate = successCount / testCases.length;
 *     const newScore = currentScore * 0.7 + accuracyRate * 100 * 0.3;
 *
 *     await updateSkillExperience(skillId, newScore, record, projectRoot);
 *   }
 *
 *   console.log(`Training completed. Success rate: ${successCount}/${testCases.length}`);
 * }
 *
 * @example
 * // Error handling for malformed SKILL.md
 * const result = await updateSkillExperience(
 *   'broken-skill',  // Assume this has malformed frontmatter
 *   80,
 *   trainingRecord,
 *   process.cwd()
 * );
 *
 * if (!result.success) {
 *   console.error('Error:', result.error);
 *   // Possible errors:
 *   // - "Invalid SKILL.md format: missing frontmatter"
 *   // - "Skill 'broken-skill' does not exist"
 *   // - YAML parsing errors
 * }
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Retrieves the complete training history for a skill
 *
 * @description
 * Fetches the `training_history` field from a skill's SKILL.md YAML frontmatter, which contains
 * a chronological record of all training sessions, outcomes, and metrics. The history is limited
 * to the last 10 training records (most recent first) and is used for skill analytics, debugging,
 * and performance tracking.
 *
 * **Retrieval Workflow:**
 * 1. Parse all skills from `.claude/skills/` directory using ClaudeStructureParser
 * 2. Find skill matching the provided skillId
 * 3. Extract `trainingHistory` field from parsed skill object
 * 4. Return training records array (or empty array if no history exists)
 *
 * **Training History Structure:**
 * - Array of TrainingRecord objects in reverse chronological order (newest first)
 * - Each record contains:
 *   - `timestamp`: ISO 8601 datetime string when training occurred
 *   - `agent`: ID of the agent that performed the training
 *   - `task`: Description of the training task/scenario
 *   - `outcome`: Training result ('success' | 'failure' | 'partial')
 *   - `feedback`: Human-readable feedback about the training session
 *   - `metrics`: Optional object with performance metrics (accuracy, execution time, etc.)
 * - Maximum 10 records (older records are dropped by updateSkillExperience)
 * - Empty array if skill has never been trained
 *
 * **Use Cases:**
 * - Display training history timeline in skill details UI
 * - Analyze skill performance trends over time
 * - Debug skill failures by reviewing error patterns
 * - Generate training reports and analytics dashboards
 * - Identify improvement opportunities based on feedback
 * - Track which agents have trained the skill
 * - Calculate success rates and average metrics
 *
 * **Important Notes:**
 * - Returns empty array (not error) if skill has no training history
 * - Only retrieves from filesystem (`.claude/skills/`), not Strapi database
 * - History is capped at 10 records maximum
 * - Returns error if skill doesn't exist
 * - Uses ClaudeStructureParser (slower than direct file read for single skill)
 *
 * @param skillId - Skill identifier (directory name in .claude/skills/)
 * @param projectRoot - Absolute path to project root directory (where .claude/ is located)
 * @returns Promise resolving to result with success flag, training history array, and optional error message
 *
 * @example
 * // Get training history for a skill
 * const result = await getSkillTrainingHistory('pdf-analyzer', process.cwd());
 *
 * if (result.success && result.history) {
 *   console.log(`Found ${result.history.length} training record(s)`);
 *
 *   result.history.forEach((record, index) => {
 *     console.log(`\n${index + 1}. ${record.task} (${record.outcome})`);
 *     console.log(`   Agent: ${record.agent}`);
 *     console.log(`   Time: ${new Date(record.timestamp).toLocaleString()}`);
 *     console.log(`   Feedback: ${record.feedback}`);
 *     if (record.metrics) {
 *       console.log(`   Metrics:`, record.metrics);
 *     }
 *   });
 * } else {
 *   console.error('Error:', result.error);
 * }
 *
 * // Example output:
 * // Found 3 training record(s)
 * //
 * // 1. Extract invoice data (success)
 * //    Agent: training-agent-1
 * //    Time: 1/2/2026, 3:45:00 PM
 * //    Feedback: Successfully extracted all fields
 * //    Metrics: { accuracy: 0.95, executionTime: 3.2 }
 * //
 * // 2. Parse complex PDF (failure)
 * //    Agent: training-agent-2
 * //    Time: 1/2/2026, 2:30:00 PM
 * //    Feedback: Failed to extract table data
 * //    Metrics: { accuracy: 0.45, errors: 12 }
 *
 * @example
 * // Display training history timeline in UI
 * async function renderTrainingTimeline(skillId: string) {
 *   const result = await getSkillTrainingHistory(skillId, process.cwd());
 *
 *   if (!result.success || !result.history || result.history.length === 0) {
 *     return '<p>No training history available</p>';
 *   }
 *
 *   const timeline = result.history.map(record => {
 *     const statusIcon = record.outcome === 'success' ? '✅' : '❌';
 *     const date = new Date(record.timestamp).toLocaleDateString();
 *
 *     return `
 *       <div class="timeline-item ${record.outcome}">
 *         <span class="icon">${statusIcon}</span>
 *         <div class="content">
 *           <strong>${record.task}</strong>
 *           <p>${record.feedback}</p>
 *           <small>${date} by ${record.agent}</small>
 *         </div>
 *       </div>
 *     `;
 *   }).join('');
 *
 *   return `<div class="training-timeline">${timeline}</div>`;
 * }
 *
 * @example
 * // Calculate skill success rate from training history
 * const result = await getSkillTrainingHistory('web-scraper', process.cwd());
 *
 * if (result.success && result.history && result.history.length > 0) {
 *   const successCount = result.history.filter(r => r.outcome === 'success').length;
 *   const failureCount = result.history.filter(r => r.outcome === 'failure').length;
 *   const partialCount = result.history.filter(r => r.outcome === 'partial').length;
 *
 *   const successRate = (successCount / result.history.length) * 100;
 *
 *   console.log('=== Training Statistics ===');
 *   console.log('Total sessions:', result.history.length);
 *   console.log('Successes:', successCount);
 *   console.log('Failures:', failureCount);
 *   console.log('Partial:', partialCount);
 *   console.log('Success rate:', successRate.toFixed(1) + '%');
 * } else {
 *   console.log('No training data available');
 * }
 *
 * // Output:
 * // === Training Statistics ===
 * // Total sessions: 10
 * // Successes: 7
 * // Failures: 2
 * // Partial: 1
 * // Success rate: 70.0%
 *
 * @example
 * // Analyze performance trends over time
 * const result = await getSkillTrainingHistory('code-reviewer', process.cwd());
 *
 * if (result.success && result.history && result.history.length > 0) {
 *   console.log('=== Performance Trend Analysis ===');
 *
 *   // Group by outcome
 *   const recentRecords = result.history.slice(0, 5);  // Last 5
 *   const olderRecords = result.history.slice(5);     // Earlier records
 *
 *   const recentSuccessRate = recentRecords.filter(r => r.outcome === 'success').length / recentRecords.length;
 *   const olderSuccessRate = olderRecords.length > 0
 *     ? olderRecords.filter(r => r.outcome === 'success').length / olderRecords.length
 *     : 0;
 *
 *   const trend = recentSuccessRate > olderSuccessRate ? '📈 Improving' :
 *                 recentSuccessRate < olderSuccessRate ? '📉 Declining' :
 *                 '➡️  Stable';
 *
 *   console.log('Recent success rate:', (recentSuccessRate * 100).toFixed(1) + '%');
 *   console.log('Earlier success rate:', (olderSuccessRate * 100).toFixed(1) + '%');
 *   console.log('Trend:', trend);
 * }
 *
 * @example
 * // Generate training report with metrics
 * async function generateTrainingReport(skillId: string, projectRoot: string) {
 *   const result = await getSkillTrainingHistory(skillId, projectRoot);
 *
 *   if (!result.success || !result.history || result.history.length === 0) {
 *     console.log('No training data available for report');
 *     return;
 *   }
 *
 *   console.log(`=== Training Report: ${skillId} ===`);
 *   console.log(`Total training sessions: ${result.history.length}`);
 *   console.log('\nRecent Training Sessions:');
 *
 *   result.history.forEach((record, index) => {
 *     console.log(`\n${index + 1}. ${record.task}`);
 *     console.log(`   Outcome: ${record.outcome.toUpperCase()}`);
 *     console.log(`   Agent: ${record.agent}`);
 *     console.log(`   Timestamp: ${record.timestamp}`);
 *     console.log(`   Feedback: ${record.feedback}`);
 *
 *     if (record.metrics) {
 *       console.log('   Metrics:');
 *       Object.entries(record.metrics).forEach(([key, value]) => {
 *         console.log(`     - ${key}: ${value}`);
 *       });
 *     }
 *   });
 *
 *   // Calculate average metrics
 *   const recordsWithMetrics = result.history.filter(r => r.metrics);
 *   if (recordsWithMetrics.length > 0) {
 *     console.log('\n=== Average Metrics ===');
 *
 *     const allMetricKeys = new Set<string>();
 *     recordsWithMetrics.forEach(r => {
 *       Object.keys(r.metrics!).forEach(k => allMetricKeys.add(k));
 *     });
 *
 *     allMetricKeys.forEach(metricKey => {
 *       const values = recordsWithMetrics
 *         .map(r => r.metrics![metricKey])
 *         .filter(v => typeof v === 'number');
 *
 *       if (values.length > 0) {
 *         const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
 *         console.log(`${metricKey}: ${avg.toFixed(2)}`);
 *       }
 *     });
 *   }
 * }
 *
 * @example
 * // Handle non-existent skill
 * const result = await getSkillTrainingHistory('nonexistent-skill', process.cwd());
 *
 * if (!result.success) {
 *   console.error('Error:', result.error);
 *   // Output: Error: Skill "nonexistent-skill" not found
 * }
 *
 * @example
 * // Handle skill with no training history
 * const result = await getSkillTrainingHistory('new-skill', process.cwd());
 *
 * if (result.success) {
 *   if (!result.history || result.history.length === 0) {
 *     console.log('Skill has not been trained yet');
 *   } else {
 *     console.log(`Found ${result.history.length} training record(s)`);
 *   }
 * }
 *
 * @example
 * // Export training history to JSON
 * async function exportTrainingHistory(skillId: string, projectRoot: string) {
 *   const result = await getSkillTrainingHistory(skillId, projectRoot);
 *
 *   if (!result.success) {
 *     console.error('Failed to retrieve training history:', result.error);
 *     return;
 *   }
 *
 *   const exportData = {
 *     skillId,
 *     exportedAt: new Date().toISOString(),
 *     recordCount: result.history?.length || 0,
 *     trainingHistory: result.history || []
 *   };
 *
 *   await fs.writeFile(
 *     `${skillId}-training-history.json`,
 *     JSON.stringify(exportData, null, 2),
 *     'utf-8'
 *   );
 *
 *   console.log(`Training history exported to ${skillId}-training-history.json`);
 * }
 *
 * @example
 * // Identify common failure patterns
 * const result = await getSkillTrainingHistory('pdf-analyzer', process.cwd());
 *
 * if (result.success && result.history) {
 *   const failures = result.history.filter(r => r.outcome === 'failure');
 *
 *   if (failures.length > 0) {
 *     console.log('=== Failure Pattern Analysis ===');
 *     console.log(`Found ${failures.length} failure(s):\n`);
 *
 *     const failureReasons = new Map<string, number>();
 *
 *     failures.forEach(failure => {
 *       // Group by feedback message
 *       const reason = failure.feedback;
 *       failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
 *     });
 *
 *     console.log('Most common failure reasons:');
 *     Array.from(failureReasons.entries())
 *       .sort((a, b) => b[1] - a[1])
 *       .forEach(([reason, count]) => {
 *         console.log(`  ${count}x: ${reason}`);
 *       });
 *   } else {
 *     console.log('No failures found in training history');
 *   }
 * }
 *
 * @example
 * // Track which agents have trained the skill
 * const result = await getSkillTrainingHistory('web-scraper', process.cwd());
 *
 * if (result.success && result.history) {
 *   const agentUsage = new Map<string, number>();
 *
 *   result.history.forEach(record => {
 *     agentUsage.set(record.agent, (agentUsage.get(record.agent) || 0) + 1);
 *   });
 *
 *   console.log('=== Training Agents ===');
 *   Array.from(agentUsage.entries())
 *     .sort((a, b) => b[1] - a[1])
 *     .forEach(([agent, count]) => {
 *       console.log(`${agent}: ${count} session(s)`);
 *     });
 * }
 * // Output:
 * // === Training Agents ===
 * // training-agent-1: 5 session(s)
 * // training-agent-2: 3 session(s)
 * // manual-trainer: 2 session(s)
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
