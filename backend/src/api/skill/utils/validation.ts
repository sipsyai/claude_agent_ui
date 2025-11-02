/**
 * Skill Validation Utilities
 * Based on Claude Agent SDK specifications
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate skill name according to Claude Agent SDK rules
 * - Must be lowercase letters, numbers, and hyphens only
 * - Max 64 characters
 * - No "anthropic" or "claude" in the name
 * - No XML tags
 */
export function validateSkillName(name: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required
  if (!name || name.trim() === '') {
    errors.push('Name is required');
    return { valid: false, errors, warnings };
  }

  // Check max length
  if (name.length > 64) {
    errors.push(`Name exceeds 64 character limit (current: ${name.length})`);
  }

  // Check regex pattern
  const nameRegex = /^[a-z0-9-]+$/;
  if (!nameRegex.test(name)) {
    errors.push('Name must contain only lowercase letters, numbers, and hyphens');
  }

  // Check reserved words
  const lowerName = name.toLowerCase();
  if (lowerName.includes('anthropic') || lowerName.includes('claude')) {
    errors.push('Name cannot contain "anthropic" or "claude"');
  }

  // Check for XML tags
  if (/<[^>]*>/g.test(name)) {
    errors.push('Name cannot contain XML tags');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate skill description
 * - Must be 10-1024 characters
 * - Should describe WHAT and WHEN
 * - No XML tags
 */
export function validateDescription(description: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!description || description.trim() === '') {
    errors.push('Description is required');
    return { valid: false, errors, warnings };
  }

  if (description.length < 10) {
    errors.push(`Description too short (minimum 10 characters, current: ${description.length})`);
  }

  if (description.length > 1024) {
    errors.push(`Description too long (maximum 1024 characters, current: ${description.length})`);
  }

  if (/<[^>]*>/g.test(description)) {
    errors.push('Description cannot contain XML tags');
  }

  // Warning if description doesn't mention when to use
  const hasWhenKeywords = /when|use|for|if|should/i.test(description);
  if (!hasWhenKeywords) {
    warnings.push('Description should include WHEN to use this skill (e.g., "Use when...", "For tasks involving...")');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate semantic version
 */
export function validateVersion(version: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!version) {
    warnings.push('Version not specified, will use default "1.0.0"');
    return { valid: true, errors, warnings };
  }

  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(version)) {
    errors.push('Version must follow semantic versioning format (e.g., "1.0.0")');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate training history structure
 */
export function validateTrainingHistory(trainingHistory: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!trainingHistory || !Array.isArray(trainingHistory)) {
    warnings.push('Training history should be an array');
    return { valid: true, errors, warnings };
  }

  trainingHistory.forEach((entry, index) => {
    if (!entry.date) {
      errors.push(`Training history entry ${index}: missing 'date' field`);
    }

    if (entry.score_before !== undefined && (entry.score_before < 0 || entry.score_before > 100)) {
      errors.push(`Training history entry ${index}: score_before must be between 0-100`);
    }

    if (entry.score_after !== undefined && (entry.score_after < 0 || entry.score_after > 100)) {
      errors.push(`Training history entry ${index}: score_after must be between 0-100`);
    }

    const validModes = ['real_execution', 'user_feedback', 'documentation_only'];
    if (entry.mode && !validModes.includes(entry.mode)) {
      errors.push(`Training history entry ${index}: mode must be one of ${validModes.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate complete skill object
 */
export function validateSkill(skill: any): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate name
  const nameResult = validateSkillName(skill.name);
  allErrors.push(...nameResult.errors);
  allWarnings.push(...nameResult.warnings);

  // Validate description
  const descResult = validateDescription(skill.description);
  allErrors.push(...descResult.errors);
  allWarnings.push(...descResult.warnings);

  // Validate version
  if (skill.version) {
    const versionResult = validateVersion(skill.version);
    allErrors.push(...versionResult.errors);
    allWarnings.push(...versionResult.warnings);
  }

  // Validate training history
  if (skill.trainingHistory) {
    const trainingResult = validateTrainingHistory(skill.trainingHistory);
    allErrors.push(...trainingResult.errors);
    allWarnings.push(...trainingResult.warnings);
  }

  // Validate content
  if (!skill.content || skill.content.length < 50) {
    allErrors.push('Content must be at least 50 characters');
  }

  // Validate experience score
  if (skill.experienceScore !== undefined) {
    if (skill.experienceScore < 0 || skill.experienceScore > 100) {
      allErrors.push('Experience score must be between 0-100');
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Validate additional file name
 * Must match pattern: ^[A-Z_]+\.md$ (e.g., REFERENCE.md, EXAMPLES.md)
 */
export function validateAdditionalFileName(filename: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!filename || filename.trim() === '') {
    errors.push('Filename cannot be empty');
    return { valid: false, errors, warnings };
  }

  // Check regex pattern: UPPERCASE with underscores, .md extension
  const filenameRegex = /^[A-Z_]+\.md$/;
  if (!filenameRegex.test(filename)) {
    errors.push(`Filename "${filename}" must match pattern ^[A-Z_]+\\.md$ (e.g., REFERENCE.md, EXAMPLES.md)`);
  }

  // Reserved name check
  if (filename === 'SKILL.md') {
    errors.push('SKILL.md is reserved for the main skill file');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate file size
 * Max 10MB to prevent memory issues
 */
export function validateFileSize(content: string, maxSizeMB: number = 10): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sizeInBytes = Buffer.byteLength(content, 'utf8');
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > maxSizeMB) {
    errors.push(`File size ${sizeInMB.toFixed(2)}MB exceeds maximum ${maxSizeMB}MB`);
  }

  if (sizeInMB > maxSizeMB * 0.8) {
    warnings.push(`File size ${sizeInMB.toFixed(2)}MB is approaching limit of ${maxSizeMB}MB`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate additional file
 * Combines filename and content validation
 */
export function validateAdditionalFile(filename: string, content: string): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate filename
  const filenameResult = validateAdditionalFileName(filename);
  allErrors.push(...filenameResult.errors);
  allWarnings.push(...filenameResult.warnings);

  // Validate file size
  const sizeResult = validateFileSize(content);
  allErrors.push(...sizeResult.errors);
  allWarnings.push(...sizeResult.warnings);

  // Check if content is empty
  if (!content || content.trim().length === 0) {
    allErrors.push(`File "${filename}" has empty content`);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}
