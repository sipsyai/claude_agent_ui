import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, constants } from 'fs';
import ignore from 'ignore';
import { CUIError, FileSystemEntry } from '@/types/index.js';
import { createLogger } from './logger.js';
import { type Logger } from './logger.js';

const execAsync = promisify(exec);

/**
 * FileSystemService - Secure abstraction over Node.js filesystem operations
 *
 * @description
 * The FileSystemService provides a secure, validated layer over Node.js filesystem operations,
 * implementing comprehensive security checks to prevent path traversal attacks, null byte injection,
 * and other filesystem-related vulnerabilities. It supports directory listing, file reading, git
 * repository detection, and executable validation with configurable size limits and path restrictions.
 *
 * **Key Responsibilities:**
 * - Secure file and directory access with path validation
 * - Path traversal attack prevention (.. detection, normalization)
 * - File size limit enforcement (default: 10MB)
 * - UTF-8 text validation (binary file detection)
 * - Hidden file/directory protection (. prefix detection)
 * - Optional path restrictions (allowedBasePaths whitelist)
 * - Git repository detection and HEAD commit retrieval
 * - Executable validation with permission checks
 * - Gitignore-aware directory listing
 *
 * **Architecture:**
 * - **Security-First Design**: All paths validated and normalized before filesystem access
 * - **Path Validation**: Absolute path requirement, traversal detection, character validation
 * - **Size Limits**: Configurable max file size to prevent memory exhaustion
 * - **Error Handling**: Detailed CUIError instances with appropriate HTTP status codes
 * - **Logging**: Comprehensive debug/warning/error logging for security auditing
 * - **Git Integration**: Repository detection and commit hash retrieval via git CLI
 *
 * **Security Features:**
 * - Path traversal prevention (.. segments rejected before normalization)
 * - Null byte injection detection (\u0000)
 * - Hidden file/directory blocking (. prefix rejection)
 * - Invalid character detection (<>:|?*)
 * - Optional path whitelist (allowedBasePaths)
 * - File size limits (configurable, default 10MB)
 * - UTF-8 validation for text files (binary file detection)
 * - Windows drive letter support (C:, D:, etc.)
 *
 * **Use Cases:**
 * - Secure file reading for chat attachments and agent context
 * - Directory browsing for project file exploration
 * - Git repository detection for version control integration
 * - Executable validation for MCP server stdio commands
 * - Gitignore-aware file listing for SDK settings discovery
 *
 * @example
 * ```typescript
 * // Basic usage - unrestricted file access with size limits
 * import { FileSystemService } from './file-system-service';
 *
 * const fs = new FileSystemService();
 *
 * // Read a file (validates path, checks size, validates UTF-8)
 * const result = await fs.readFile('/home/user/project/README.md');
 * console.log(result.content); // File contents
 * console.log(result.size); // 1024 bytes
 * console.log(result.lastModified); // "2024-01-01T00:00:00.000Z"
 * ```
 *
 * @example
 * ```typescript
 * // Restricted file access - limit to specific directories
 * import { FileSystemService } from './file-system-service';
 *
 * // Allow access only to /home/user/projects and /home/user/documents
 * const fs = new FileSystemService(
 *   5 * 1024 * 1024, // 5MB max file size
 *   ['/home/user/projects', '/home/user/documents'] // Allowed base paths
 * );
 *
 * // This succeeds (within allowed paths)
 * await fs.readFile('/home/user/projects/app/src/index.ts');
 *
 * // This fails with PATH_NOT_ALLOWED error
 * try {
 *   await fs.readFile('/etc/passwd');
 * } catch (error) {
 *   console.error(error.code); // "PATH_NOT_ALLOWED"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Directory listing with gitignore support
 * import { FileSystemService } from './file-system-service';
 *
 * const fs = new FileSystemService();
 *
 * // List directory (flat)
 * const result = await fs.listDirectory('/home/user/project');
 * console.log(result.entries);
 * // [
 * //   { name: 'src', type: 'directory', lastModified: '...' },
 * //   { name: 'README.md', type: 'file', size: 1024, lastModified: '...' }
 * // ]
 *
 * // List directory recursively with gitignore filtering
 * const recursiveResult = await fs.listDirectory(
 *   '/home/user/project',
 *   true, // recursive
 *   true  // respectGitignore
 * );
 * // Automatically excludes node_modules/, .git/, etc. based on .gitignore
 * ```
 *
 * @example
 * ```typescript
 * // Git repository operations
 * import { FileSystemService } from './file-system-service';
 *
 * const fs = new FileSystemService();
 *
 * // Check if directory is a git repository
 * const isGit = await fs.isGitRepository('/home/user/project');
 * if (isGit) {
 *   // Get current commit hash
 *   const commitHash = await fs.getCurrentGitHead('/home/user/project');
 *   console.log(`Current commit: ${commitHash}`); // "a1b2c3d4..."
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Executable validation for MCP servers
 * import { FileSystemService } from './file-system-service';
 *
 * const fs = new FileSystemService();
 *
 * // Validate MCP server executable exists and has execute permissions
 * try {
 *   await fs.validateExecutable('/usr/local/bin/mcp-server');
 *   console.log('Executable is valid');
 * } catch (error) {
 *   if (error.code === 'EXECUTABLE_NOT_FOUND') {
 *     console.error('MCP server not found');
 *   } else if (error.code === 'NOT_EXECUTABLE') {
 *     console.error('File exists but not executable (chmod +x required)');
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Security: path traversal prevention
 * import { FileSystemService } from './file-system-service';
 *
 * const fs = new FileSystemService();
 *
 * // These all fail with PATH_TRAVERSAL_DETECTED error:
 * try {
 *   await fs.readFile('/home/user/../../../etc/passwd');
 * } catch (error) {
 *   console.error(error.code); // "PATH_TRAVERSAL_DETECTED"
 * }
 *
 * // Hidden file access is also blocked
 * try {
 *   await fs.readFile('/home/user/.ssh/id_rsa');
 * } catch (error) {
 *   console.error(error.code); // "INVALID_PATH"
 *   console.error(error.message); // "Path contains hidden files/directories"
 * }
 * ```
 *
 * @see CUIError for error codes and status codes
 * @see Logger for logging integration
 */
export class FileSystemService {
  /** Logger instance for security auditing and debugging */
  private logger: Logger;

  /** Maximum file size in bytes (default: 10MB) */
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB default

  /** Allowed base paths whitelist (empty array = all paths allowed) */
  private allowedBasePaths: string[] = []; // Empty means all paths allowed
  
  constructor(maxFileSize?: number, allowedBasePaths?: string[]) {
    this.logger = createLogger('FileSystemService');
    if (maxFileSize !== undefined) {
      this.maxFileSize = maxFileSize;
    }
    if (allowedBasePaths) {
      this.allowedBasePaths = allowedBasePaths.map(p => path.normalize(p));
    }
  }

  /**
   * List directory contents with comprehensive security validation and gitignore support
   *
   * @description
   * Lists files and subdirectories in a directory with optional recursive traversal and gitignore
   * filtering. Returns an array of entries with metadata (name, type, size, last modified).
   * Supports both flat and recursive directory listing with automatic sorting (directories first,
   * then alphabetically by name).
   *
   * **Workflow:**
   * 1. Validate and normalize path (prevent traversal attacks)
   * 2. Check path exists and is a directory (not file)
   * 3. Load .gitignore patterns if respectGitignore is true
   * 4. List directory entries (flat or recursive based on parameters)
   * 5. Filter entries based on gitignore patterns (if enabled)
   * 6. Sort entries (directories first, then alphabetically)
   * 7. Return path, entries array, and total count
   *
   * **Security Checks:**
   * - Path traversal prevention (.. segments, normalization)
   * - Hidden file/directory blocking (. prefix)
   * - Null byte injection detection
   * - Optional path whitelist (allowedBasePaths)
   *
   * **Gitignore Support:**
   * - Loads .gitignore from target directory
   * - Respects gitignore patterns for file/directory filtering
   * - Always ignores .git directory
   * - Gracefully handles missing .gitignore files
   *
   * @param requestedPath - Absolute path to directory (must be absolute, no relative paths)
   * @param recursive - If true, recursively list all subdirectories (default: false)
   * @param respectGitignore - If true, filter entries based on .gitignore patterns (default: false)
   * @returns Promise resolving to object with directory listing
   * @returns path - Normalized absolute path to the directory
   * @returns entries - Array of FileSystemEntry objects with file/directory metadata
   * @returns total - Total number of entries returned (same as entries.length)
   *
   * @throws {CUIError} PATH_NOT_FOUND (404) - Directory does not exist
   * @throws {CUIError} NOT_A_DIRECTORY (400) - Path exists but is a file
   * @throws {CUIError} ACCESS_DENIED (403) - Insufficient permissions to read directory
   * @throws {CUIError} PATH_TRAVERSAL_DETECTED (400) - Path contains .. segments
   * @throws {CUIError} INVALID_PATH (400) - Path is relative, contains hidden files, null bytes, or invalid characters
   * @throws {CUIError} PATH_NOT_ALLOWED (403) - Path is outside allowedBasePaths
   * @throws {CUIError} LIST_DIRECTORY_FAILED (500) - Unexpected error listing directory
   *
   * @example
   * ```typescript
   * // Basic flat directory listing
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const result = await fs.listDirectory('/home/user/project');
   * console.log(result.path); // "/home/user/project"
   * console.log(result.total); // 5
   * console.log(result.entries);
   * // [
   * //   { name: 'src', type: 'directory', lastModified: '2024-01-01T00:00:00.000Z' },
   * //   { name: 'tests', type: 'directory', lastModified: '2024-01-01T00:00:00.000Z' },
   * //   { name: 'package.json', type: 'file', size: 1024, lastModified: '2024-01-01T00:00:00.000Z' },
   * //   { name: 'README.md', type: 'file', size: 512, lastModified: '2024-01-01T00:00:00.000Z' },
   * //   { name: 'tsconfig.json', type: 'file', size: 256, lastModified: '2024-01-01T00:00:00.000Z' }
   * // ]
   * ```
   *
   * @example
   * ```typescript
   * // Recursive directory listing
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const result = await fs.listDirectory('/home/user/project', true);
   * console.log(result.entries);
   * // [
   * //   { name: 'src', type: 'directory', lastModified: '...' },
   * //   { name: 'src/index.ts', type: 'file', size: 2048, lastModified: '...' },
   * //   { name: 'src/utils', type: 'directory', lastModified: '...' },
   * //   { name: 'src/utils/helpers.ts', type: 'file', size: 1024, lastModified: '...' },
   * //   { name: 'tests', type: 'directory', lastModified: '...' },
   * //   { name: 'tests/index.test.ts', type: 'file', size: 512, lastModified: '...' },
   * //   ...
   * // ]
   * ```
   *
   * @example
   * ```typescript
   * // Directory listing with gitignore filtering
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * // .gitignore contains:
   * // node_modules/
   * // dist/
   * // *.log
   *
   * const result = await fs.listDirectory('/home/user/project', true, true);
   * // Automatically excludes node_modules/, dist/, .git/, and *.log files
   * console.log(result.entries);
   * // [
   * //   { name: 'src', type: 'directory', ... },
   * //   { name: 'src/index.ts', type: 'file', ... },
   * //   { name: 'tests', type: 'directory', ... },
   * //   { name: 'package.json', type: 'file', ... }
   * //   // node_modules/, dist/, .git/ excluded
   * // ]
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - directory not found
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.listDirectory('/nonexistent/directory');
   * } catch (error) {
   *   console.error(error.code); // "PATH_NOT_FOUND"
   *   console.error(error.statusCode); // 404
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - not a directory
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.listDirectory('/home/user/project/README.md'); // File, not directory
   * } catch (error) {
   *   console.error(error.code); // "NOT_A_DIRECTORY"
   *   console.error(error.statusCode); // 400
   * }
   * ```
   *
   * @example
   * ```typescript
   * // File browser UI integration
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * async function displayDirectory(path: string) {
   *   const result = await fs.listDirectory(path, false, true);
   *
   *   console.log(`\n${result.path} (${result.total} items)\n`);
   *   result.entries.forEach(entry => {
   *     const icon = entry.type === 'directory' ? '📁' : '📄';
   *     const size = entry.size ? ` (${entry.size} bytes)` : '';
   *     console.log(`${icon} ${entry.name}${size}`);
   *   });
   * }
   *
   * await displayDirectory('/home/user/project');
   * // /home/user/project (5 items)
   * // 📁 src
   * // 📁 tests
   * // 📄 package.json (1024 bytes)
   * // 📄 README.md (512 bytes)
   * // 📄 tsconfig.json (256 bytes)
   * ```
   *
   * @example
   * ```typescript
   * // SDK settings discovery - find all .claude directories
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const result = await fs.listDirectory('/home/user/project', true, true);
   * const claudeDirs = result.entries.filter(entry =>
   *   entry.type === 'directory' && entry.name.includes('.claude')
   * );
   * console.log('Found .claude directories:', claudeDirs);
   * // Useful for Claude SDK settingSources discovery
   * ```
   */
  async listDirectory(
    requestedPath: string,
    recursive: boolean = false,
    respectGitignore: boolean = false
  ): Promise<{ path: string; entries: FileSystemEntry[]; total: number }> {
    this.logger.debug('List directory requested', { requestedPath, recursive, respectGitignore });
    
    try {
      // Validate and normalize path
      const safePath = await this.validatePath(requestedPath);
      
      // Check if path exists and is a directory
      const stats = await fs.stat(safePath);
      if (!stats.isDirectory()) {
        throw new CUIError('NOT_A_DIRECTORY', `Path is not a directory: ${requestedPath}`, 400);
      }
      
      // Initialize gitignore if requested
      let ig: ReturnType<typeof ignore> | null = null;
      if (respectGitignore) {
        ig = await this.loadGitignore(safePath);
      }
      
      // Get entries
      const entries: FileSystemEntry[] = recursive
        ? await this.listDirectoryRecursive(safePath, safePath, ig)
        : await this.listDirectoryFlat(safePath, ig);
      
      // Sort entries: directories first, then by name
      entries.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      this.logger.debug('Directory listed successfully', { 
        path: safePath, 
        entryCount: entries.length,
        recursive,
        respectGitignore
      });
      
      return {
        path: safePath,
        entries,
        total: entries.length
      };
    } catch (error) {
      if (error instanceof CUIError) {
        throw error;
      }
      
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === 'ENOENT') {
        throw new CUIError('PATH_NOT_FOUND', `Path not found: ${requestedPath}`, 404);
      } else if (errorCode === 'EACCES') {
        throw new CUIError('ACCESS_DENIED', `Access denied to path: ${requestedPath}`, 403);
      }
      
      this.logger.error('Error listing directory', error, { requestedPath });
      throw new CUIError('LIST_DIRECTORY_FAILED', `Failed to list directory: ${error}`, 500);
    }
  }

  /**
   * Read file contents with comprehensive security validation
   *
   * @description
   * Reads a text file from disk with complete security validation including path traversal prevention,
   * size limit enforcement, and UTF-8 validation. Returns file contents along with metadata (size,
   * last modified timestamp, encoding). Automatically rejects binary files and files exceeding size limits.
   *
   * **Workflow:**
   * 1. Validate and normalize path (prevent traversal attacks)
   * 2. Check file exists and is a file (not directory)
   * 3. Check file size against maxFileSize limit
   * 4. Read file contents as UTF-8
   * 5. Validate content is valid UTF-8 text (reject binary files)
   * 6. Return file data with metadata
   *
   * **Security Checks:**
   * - Path traversal prevention (.. segments, normalization)
   * - Hidden file/directory blocking (. prefix)
   * - Null byte injection detection
   * - File size limit enforcement (default: 10MB)
   * - UTF-8 validation (binary file detection)
   * - Optional path whitelist (allowedBasePaths)
   *
   * @param requestedPath - Absolute path to file (must be absolute, no relative paths)
   * @returns Promise resolving to object with file data and metadata
   * @returns path - Normalized absolute path to the file
   * @returns content - File contents as UTF-8 string
   * @returns size - File size in bytes
   * @returns lastModified - ISO 8601 timestamp of last modification
   * @returns encoding - Always 'utf-8' for text files
   *
   * @throws {CUIError} FILE_NOT_FOUND (404) - File does not exist
   * @throws {CUIError} NOT_A_FILE (400) - Path exists but is a directory
   * @throws {CUIError} FILE_TOO_LARGE (400) - File exceeds maxFileSize limit
   * @throws {CUIError} BINARY_FILE (400) - File contains binary data or invalid UTF-8
   * @throws {CUIError} ACCESS_DENIED (403) - Insufficient permissions to read file
   * @throws {CUIError} PATH_TRAVERSAL_DETECTED (400) - Path contains .. segments
   * @throws {CUIError} INVALID_PATH (400) - Path is relative, contains hidden files, null bytes, or invalid characters
   * @throws {CUIError} PATH_NOT_ALLOWED (403) - Path is outside allowedBasePaths
   * @throws {CUIError} READ_FILE_FAILED (500) - Unexpected error reading file
   *
   * @example
   * ```typescript
   * // Basic file reading
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const result = await fs.readFile('/home/user/project/README.md');
   * console.log(result.content); // "# My Project\n\nWelcome to..."
   * console.log(result.size); // 1024
   * console.log(result.lastModified); // "2024-01-01T12:00:00.000Z"
   * console.log(result.encoding); // "utf-8"
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - file not found
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.readFile('/nonexistent/file.txt');
   * } catch (error) {
   *   console.error(error.code); // "FILE_NOT_FOUND"
   *   console.error(error.statusCode); // 404
   *   console.error(error.message); // "File not found: /nonexistent/file.txt"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - file too large
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService(1024 * 1024); // 1MB limit
   *
   * try {
   *   await fs.readFile('/home/user/large-file.log'); // 5MB file
   * } catch (error) {
   *   console.error(error.code); // "FILE_TOO_LARGE"
   *   console.error(error.statusCode); // 400
   *   console.error(error.message); // "File size (5242880 bytes) exceeds maximum allowed size (1048576 bytes)"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - binary file rejected
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.readFile('/home/user/image.png'); // Binary file
   * } catch (error) {
   *   console.error(error.code); // "BINARY_FILE"
   *   console.error(error.statusCode); // 400
   *   console.error(error.message); // "File appears to be binary or not valid UTF-8"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Reading with path restrictions
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService(undefined, ['/home/user/projects']);
   *
   * // This succeeds
   * const result = await fs.readFile('/home/user/projects/app/src/index.ts');
   *
   * // This fails with PATH_NOT_ALLOWED
   * try {
   *   await fs.readFile('/etc/passwd');
   * } catch (error) {
   *   console.error(error.code); // "PATH_NOT_ALLOWED"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Security: path traversal prevention
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * // All of these fail with PATH_TRAVERSAL_DETECTED or INVALID_PATH
   * try {
   *   await fs.readFile('/home/user/../../../etc/passwd');
   * } catch (error) {
   *   console.error(error.code); // "PATH_TRAVERSAL_DETECTED"
   * }
   *
   * try {
   *   await fs.readFile('/home/user/.ssh/id_rsa'); // Hidden file
   * } catch (error) {
   *   console.error(error.code); // "INVALID_PATH"
   * }
   * ```
   */
  async readFile(requestedPath: string): Promise<{ path: string; content: string; size: number; lastModified: string; encoding: string }> {
    this.logger.debug('Read file requested', { requestedPath });
    
    try {
      // Validate and normalize path
      const safePath = await this.validatePath(requestedPath);
      
      // Check if path exists and is a file
      const stats = await fs.stat(safePath);
      if (!stats.isFile()) {
        throw new CUIError('NOT_A_FILE', `Path is not a file: ${requestedPath}`, 400);
      }
      
      // Check file size
      if (stats.size > this.maxFileSize) {
        throw new CUIError(
          'FILE_TOO_LARGE', 
          `File size (${stats.size} bytes) exceeds maximum allowed size (${this.maxFileSize} bytes)`, 
          400
        );
      }
      
      // Read file content
      const content = await fs.readFile(safePath, 'utf-8');
      
      // Check if content is valid UTF-8 text
      if (!this.isValidUtf8(content)) {
        throw new CUIError('BINARY_FILE', 'File appears to be binary or not valid UTF-8', 400);
      }
      
      this.logger.debug('File read successfully', { 
        path: safePath, 
        size: stats.size 
      });
      
      return {
        path: safePath,
        content,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        encoding: 'utf-8'
      };
    } catch (error) {
      if (error instanceof CUIError) {
        throw error;
      }
      
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === 'ENOENT') {
        throw new CUIError('FILE_NOT_FOUND', `File not found: ${requestedPath}`, 404);
      } else if (errorCode === 'EACCES') {
        throw new CUIError('ACCESS_DENIED', `Access denied to file: ${requestedPath}`, 403);
      }
      
      this.logger.error('Error reading file', error, { requestedPath });
      throw new CUIError('READ_FILE_FAILED', `Failed to read file: ${error}`, 500);
    }
  }

  /**
   * Validate and normalize a path to prevent path traversal attacks
   */
  private async validatePath(requestedPath: string): Promise<string> {
    // Require absolute paths
    if (!path.isAbsolute(requestedPath)) {
      throw new CUIError('INVALID_PATH', 'Path must be absolute', 400);
    }
    
    // Check for path traversal attempts before normalization
    if (requestedPath.includes('..')) {
      this.logger.warn('Path traversal attempt detected', { 
        requestedPath 
      });
      throw new CUIError('PATH_TRAVERSAL_DETECTED', 'Invalid path: path traversal detected', 400);
    }
    
    // Normalize the path to resolve . segments and clean up
    const normalizedPath = path.normalize(requestedPath);
    
    // Check against allowed base paths if configured
    if (this.allowedBasePaths.length > 0) {
      const isAllowed = this.allowedBasePaths.some(basePath => 
        normalizedPath.startsWith(basePath)
      );
      
      if (!isAllowed) {
        this.logger.warn('Path outside allowed directories', { 
          requestedPath, 
          normalizedPath,
          allowedBasePaths: this.allowedBasePaths 
        });
        throw new CUIError('PATH_NOT_ALLOWED', 'Path is outside allowed directories', 403);
      }
    }
    
    // Additional security checks
    const segments = normalizedPath.split(path.sep);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;

      // Skip drive letter on Windows (e.g., "C:")
      const isDriveLetter = process.platform === 'win32' && i === 0 && /^[A-Za-z]:$/.test(segment);
      if (isDriveLetter) {
        continue;
      }

      // Check for hidden files/directories
      if (segment.startsWith('.')) {
        this.logger.warn('Hidden file/directory detected', {
          requestedPath,
          segment
        });
        throw new CUIError('INVALID_PATH', 'Path contains hidden files/directories', 400);
      }

      // Check for null bytes
      if (segment.includes('\u0000')) {
        this.logger.warn('Null byte detected in path', {
          requestedPath,
          segment
        });
        throw new CUIError('INVALID_PATH', 'Path contains null bytes', 400);
      }

      // Check for invalid characters
      if (/[<>:|?*]/.test(segment)) {
        this.logger.warn('Invalid characters detected in path', {
          requestedPath,
          segment
        });
        throw new CUIError('INVALID_PATH', 'Path contains invalid characters', 400);
      }
    }
    
    this.logger.debug('Path validated successfully', { 
      requestedPath, 
      normalizedPath 
    });
    
    return normalizedPath;
  }

  /**
   * Check if content appears to be valid UTF-8 text
   */
  private isValidUtf8(content: string): boolean {
    // Check for null bytes - common binary file indicator
    if (content.includes('\u0000')) {
      return false;
    }
    
    // Check for control characters (excluding tab, newline, and carriage return)
    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i);
      // Allow tab (9), newline (10), and carriage return (13)
      // Reject other control characters (1-8, 11-12, 14-31)
      if ((charCode >= 1 && charCode <= 8) || 
          (charCode >= 11 && charCode <= 12) || 
          (charCode >= 14 && charCode <= 31)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * List directory contents without recursion
   */
  private async listDirectoryFlat(
    dirPath: string,
    ig: ReturnType<typeof ignore> | null
  ): Promise<FileSystemEntry[]> {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    const entries: FileSystemEntry[] = [];
    
    for (const dirent of dirents) {
      // Check gitignore BEFORE any expensive operations
      if (ig && ig.ignores(dirent.name)) {
        continue;
      }
      
      const fullPath = path.join(dirPath, dirent.name);
      const stats = await fs.stat(fullPath);
      entries.push({
        name: dirent.name,
        type: dirent.isDirectory() ? 'directory' : 'file',
        size: dirent.isFile() ? stats.size : undefined,
        lastModified: stats.mtime.toISOString()
      });
    }
    
    return entries;
  }

  /**
   * List directory contents recursively
   */
  private async listDirectoryRecursive(
    dirPath: string,
    basePath: string,
    ig: ReturnType<typeof ignore> | null
  ): Promise<FileSystemEntry[]> {
    const entries: FileSystemEntry[] = [];
    
    async function traverse(currentPath: string): Promise<void> {
      const dirents = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const dirent of dirents) {
        const fullPath = path.join(currentPath, dirent.name);
        const relativePath = path.relative(basePath, fullPath);
        
        // Check gitignore BEFORE any expensive operations
        if (ig && ig.ignores(relativePath)) {
          // Skip this entry entirely - don't stat, don't recurse into directories
          continue;
        }
        
        const stats = await fs.stat(fullPath);
        entries.push({
          name: relativePath,
          type: dirent.isDirectory() ? 'directory' : 'file',
          size: dirent.isFile() ? stats.size : undefined,
          lastModified: stats.mtime.toISOString()
        });
        
        // Recurse into subdirectories (already checked it's not ignored)
        if (dirent.isDirectory()) {
          await traverse(fullPath);
        }
      }
    }
    
    await traverse(dirPath);
    return entries;
  }

  /**
   * Load gitignore patterns from a directory and its parents
   */
  private async loadGitignore(dirPath: string): Promise<ReturnType<typeof ignore>> {
    const ig = ignore();
    
    // Load .gitignore from the directory
    try {
      const gitignorePath = path.join(dirPath, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(content);
      this.logger.debug('Loaded .gitignore', { path: gitignorePath });
    } catch (error) {
      // .gitignore doesn't exist or can't be read - that's fine
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode !== 'ENOENT') {
        this.logger.debug('Error reading .gitignore', { error, path: dirPath });
      }
    }
    
    // Always ignore .git directory
    ig.add('.git');
    
    return ig;
  }

  /**
   * Check if a directory is a git repository
   *
   * @description
   * Determines if a directory is a git repository by executing `git rev-parse --git-dir` command.
   * Returns true if the directory contains a .git directory (is a git repository), false otherwise.
   * Useful for enabling git-specific features like commit hash retrieval and version control integration.
   *
   * **Workflow:**
   * 1. Execute `git rev-parse --git-dir` in the target directory
   * 2. If command succeeds (exit code 0), directory is a git repository
   * 3. If command fails (exit code non-zero), directory is not a git repository
   * 4. Return boolean result
   *
   * **Use Cases:**
   * - Enable git integration features conditionally
   * - Detect git repositories for version control workflows
   * - Pre-flight check before calling getCurrentGitHead()
   * - Determine if git-based features should be enabled in UI
   *
   * @param dirPath - Absolute or relative path to directory to check
   * @returns Promise resolving to true if directory is a git repository, false otherwise
   *
   * @example
   * ```typescript
   * // Check if project directory is a git repository
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const isGit = await fs.isGitRepository('/home/user/project');
   * if (isGit) {
   *   console.log('Git repository detected - enabling version control features');
   * } else {
   *   console.log('Not a git repository - version control features disabled');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Pre-flight check before retrieving commit hash
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * if (await fs.isGitRepository('/home/user/project')) {
   *   const commitHash = await fs.getCurrentGitHead('/home/user/project');
   *   console.log(`Current commit: ${commitHash}`);
   * } else {
   *   console.log('Not a git repository - skipping commit hash retrieval');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Scan multiple directories to find git repositories
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const directories = [
   *   '/home/user/project-a',
   *   '/home/user/project-b',
   *   '/home/user/project-c'
   * ];
   *
   * const gitRepos = [];
   * for (const dir of directories) {
   *   if (await fs.isGitRepository(dir)) {
   *     gitRepos.push(dir);
   *   }
   * }
   *
   * console.log(`Found ${gitRepos.length} git repositories:`, gitRepos);
   * ```
   *
   * @example
   * ```typescript
   * // Graceful degradation - always returns false on error
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * // Non-existent directory - returns false
   * const result1 = await fs.isGitRepository('/nonexistent/path');
   * console.log(result1); // false
   *
   * // Directory without git - returns false
   * const result2 = await fs.isGitRepository('/tmp');
   * console.log(result2); // false
   *
   * // Git repository - returns true
   * const result3 = await fs.isGitRepository('/home/user/my-repo');
   * console.log(result3); // true
   * ```
   */
  async isGitRepository(dirPath: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: dirPath });
      return true;
    } catch (error) {
      this.logger.debug('Directory is not a git repository', { dirPath, error });
      return false;
    }
  }

  /**
   * Get current git HEAD commit hash
   *
   * @description
   * Retrieves the current git commit hash (SHA-1) from HEAD in a git repository by executing
   * `git rev-parse HEAD` command. Returns the full 40-character commit hash or null if the
   * directory is not a git repository or git command fails. Useful for version tracking,
   * audit trails, and reproducibility workflows.
   *
   * **Workflow:**
   * 1. Execute `git rev-parse HEAD` in the target directory
   * 2. If command succeeds, parse stdout to extract commit hash
   * 3. Trim whitespace from commit hash
   * 4. Return commit hash string
   * 5. If command fails, return null (not a git repository or no commits)
   *
   * **Use Cases:**
   * - Track git commit hash for session metadata and audit trails
   * - Display current commit in UI for version transparency
   * - Include commit hash in log files for reproducibility
   * - Verify project version matches expected commit
   * - Enable commit-based workflows (e.g., "pin to commit")
   *
   * @param dirPath - Absolute or relative path to git repository directory
   * @returns Promise resolving to commit hash string (40 characters) or null if not a git repository
   *
   * @example
   * ```typescript
   * // Get current commit hash for session metadata
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const commitHash = await fs.getCurrentGitHead('/home/user/project');
   * if (commitHash) {
   *   console.log(`Current commit: ${commitHash}`);
   *   // "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
   * } else {
   *   console.log('Not a git repository or no commits');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Include commit hash in chat session metadata
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const workingDirectory = '/home/user/project';
   * const commitHash = await fs.getCurrentGitHead(workingDirectory);
   *
   * const sessionMetadata = {
   *   workingDirectory,
   *   gitCommit: commitHash || 'not-a-git-repo',
   *   timestamp: new Date().toISOString()
   * };
   *
   * console.log('Session metadata:', sessionMetadata);
   * // {
   * //   workingDirectory: '/home/user/project',
   * //   gitCommit: 'a1b2c3d4...',
   * //   timestamp: '2024-01-01T00:00:00.000Z'
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Display version info in UI
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * async function displayVersionInfo(projectPath: string) {
   *   const isGit = await fs.isGitRepository(projectPath);
   *
   *   if (isGit) {
   *     const commitHash = await fs.getCurrentGitHead(projectPath);
   *     const shortHash = commitHash?.substring(0, 7) || 'unknown';
   *     console.log(`📦 Project: ${projectPath}`);
   *     console.log(`🔖 Version: ${shortHash}`);
   *   } else {
   *     console.log(`📦 Project: ${projectPath}`);
   *     console.log(`🔖 Version: not versioned`);
   *   }
   * }
   *
   * await displayVersionInfo('/home/user/my-app');
   * // 📦 Project: /home/user/my-app
   * // 🔖 Version: a1b2c3d
   * ```
   *
   * @example
   * ```typescript
   * // Graceful degradation - returns null on error
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * // Not a git repository - returns null
   * const result1 = await fs.getCurrentGitHead('/tmp');
   * console.log(result1); // null
   *
   * // Non-existent directory - returns null
   * const result2 = await fs.getCurrentGitHead('/nonexistent/path');
   * console.log(result2); // null
   *
   * // Git repository with commits - returns commit hash
   * const result3 = await fs.getCurrentGitHead('/home/user/my-repo');
   * console.log(result3); // "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
   * ```
   *
   * @example
   * ```typescript
   * // Verify project is on expected commit
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const expectedCommit = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
   * const currentCommit = await fs.getCurrentGitHead('/home/user/project');
   *
   * if (currentCommit === expectedCommit) {
   *   console.log('✅ Project is on expected commit');
   * } else {
   *   console.warn(`⚠️ Project is on different commit: ${currentCommit}`);
   *   console.warn(`   Expected: ${expectedCommit}`);
   * }
   * ```
   */
  async getCurrentGitHead(dirPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: dirPath });
      return stdout.trim();
    } catch (error) {
      this.logger.debug('Failed to get git HEAD', { dirPath, error });
      return null;
    }
  }

  /**
   * Validate that an executable exists and has executable permissions
   *
   * @description
   * Validates that a file exists at the specified path and has executable permissions (chmod +x).
   * Throws detailed CUIError if validation fails with appropriate error codes and HTTP status codes.
   * Essential for validating MCP server stdio executables before attempting to spawn child processes.
   *
   * **Workflow:**
   * 1. Check if file exists at the specified path
   * 2. Check if file has executable permissions (fs.access with X_OK)
   * 3. If validation succeeds, return void (no error)
   * 4. If validation fails, throw CUIError with appropriate code and message
   *
   * **Validation Checks:**
   * - File existence check (existsSync)
   * - Executable permission check (fs.access with constants.X_OK)
   * - Detailed error messages for troubleshooting
   *
   * **Use Cases:**
   * - Validate MCP server stdio executables before spawning
   * - Pre-flight checks for script execution
   * - Verify tool installations (e.g., git, npm, python)
   * - Detect permission issues early (before EACCES spawn errors)
   * - Provide user-friendly error messages for missing executables
   *
   * @param executablePath - Absolute or relative path to executable file
   * @returns Promise resolving to void if validation succeeds
   *
   * @throws {CUIError} EXECUTABLE_NOT_FOUND (404) - File does not exist at the specified path
   * @throws {CUIError} NOT_EXECUTABLE (403) - File exists but does not have executable permissions
   * @throws {CUIError} EXECUTABLE_VALIDATION_FAILED (500) - Unexpected error during validation
   *
   * @example
   * ```typescript
   * // Validate MCP server executable before spawning
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.validateExecutable('/usr/local/bin/mcp-server');
   *   console.log('✅ MCP server executable is valid');
   *   // Proceed with spawning child process
   * } catch (error) {
   *   if (error.code === 'EXECUTABLE_NOT_FOUND') {
   *     console.error('❌ MCP server not found - please install it first');
   *   } else if (error.code === 'NOT_EXECUTABLE') {
   *     console.error('❌ MCP server exists but is not executable');
   *     console.error('   Run: chmod +x /usr/local/bin/mcp-server');
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Validate tool installations
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * async function validateTools() {
   *   const tools = [
   *     { name: 'git', path: '/usr/bin/git' },
   *     { name: 'node', path: '/usr/local/bin/node' },
   *     { name: 'npm', path: '/usr/local/bin/npm' }
   *   ];
   *
   *   for (const tool of tools) {
   *     try {
   *       await fs.validateExecutable(tool.path);
   *       console.log(`✅ ${tool.name} is installed and executable`);
   *     } catch (error) {
   *       console.error(`❌ ${tool.name} validation failed:`, error.message);
   *     }
   *   }
   * }
   *
   * await validateTools();
   * // ✅ git is installed and executable
   * // ✅ node is installed and executable
   * // ✅ npm is installed and executable
   * ```
   *
   * @example
   * ```typescript
   * // MCP server configuration validation
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * const mcpServers = [
   *   { name: 'filesystem', command: '/usr/local/bin/mcp-filesystem' },
   *   { name: 'database', command: '/usr/local/bin/mcp-database' },
   *   { name: 'search', command: '/usr/local/bin/mcp-search' }
   * ];
   *
   * for (const server of mcpServers) {
   *   try {
   *     await fs.validateExecutable(server.command);
   *     console.log(`✅ ${server.name} MCP server is ready`);
   *   } catch (error) {
   *     console.error(`❌ ${server.name} MCP server validation failed:`, error.message);
   *     if (error.code === 'NOT_EXECUTABLE') {
   *       console.error(`   Fix: chmod +x ${server.command}`);
   *     }
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - file not found
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.validateExecutable('/nonexistent/executable');
   * } catch (error) {
   *   console.error(error.code); // "EXECUTABLE_NOT_FOUND"
   *   console.error(error.statusCode); // 404
   *   console.error(error.message); // "Executable not found: /nonexistent/executable"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - not executable
   * import { FileSystemService } from './file-system-service';
   *
   * const fs = new FileSystemService();
   *
   * try {
   *   await fs.validateExecutable('/home/user/script.sh'); // File exists but no +x
   * } catch (error) {
   *   console.error(error.code); // "NOT_EXECUTABLE"
   *   console.error(error.statusCode); // 403
   *   console.error(error.message); // "File exists but is not executable: /home/user/script.sh"
   *
   *   // Provide user-friendly fix suggestion
   *   console.error('\nTo fix this issue, run:');
   *   console.error(`chmod +x ${error.message.split(': ')[1]}`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Pre-flight check before spawning child process
   * import { FileSystemService } from './file-system-service';
   * import { spawn } from 'child_process';
   *
   * const fs = new FileSystemService();
   *
   * async function runMcpServer(command: string, args: string[]) {
   *   // Validate executable before spawning
   *   await fs.validateExecutable(command);
   *
   *   // If validation succeeds, spawn child process
   *   const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
   *
   *   child.on('error', (error) => {
   *     // This should rarely happen since we validated the executable
   *     console.error('Spawn error:', error);
   *   });
   *
   *   return child;
   * }
   *
   * try {
   *   const mcpProcess = await runMcpServer('/usr/local/bin/mcp-server', ['--port', '8080']);
   *   console.log('MCP server spawned successfully');
   * } catch (error) {
   *   console.error('Failed to start MCP server:', error.message);
   * }
   * ```
   */
  async validateExecutable(executablePath: string): Promise<void> {
    this.logger.debug('Validating executable', { executablePath });

    try {
      // Check if file exists
      if (!existsSync(executablePath)) {
        throw new CUIError(
          'EXECUTABLE_NOT_FOUND',
          `Executable not found: ${executablePath}`,
          404
        );
      }

      // Check if file is executable
      try {
        await fs.access(executablePath, constants.X_OK);
      } catch (_error) {
        throw new CUIError(
          'NOT_EXECUTABLE',
          `File exists but is not executable: ${executablePath}`,
          403
        );
      }

      this.logger.debug('Executable validation successful', { executablePath });
    } catch (error) {
      if (error instanceof CUIError) {
        throw error;
      }
      
      this.logger.error('Error validating executable', error, { executablePath });
      throw new CUIError(
        'EXECUTABLE_VALIDATION_FAILED',
        `Failed to validate executable: ${error}`,
        500
      );
    }
  }
}