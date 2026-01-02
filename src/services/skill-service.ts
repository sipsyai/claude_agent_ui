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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
