/**
 * Environment variable substitution utility
 * Supports ${VAR} and ${VAR:-default} syntax as per Claude Agent SDK
 */

/**
 * Substitute environment variables in a string
 *
 * Supports two syntaxes:
 * - ${VAR}: Replace with environment variable value, leave as-is if not found
 * - ${VAR:-default}: Replace with environment variable value, or use default if not found
 *
 * @param value - String potentially containing ${VAR} patterns
 * @returns String with environment variables substituted
 *
 * @example
 * process.env.API_TOKEN = "secret123";
 * substituteEnvVars("Bearer ${API_TOKEN}") // "Bearer secret123"
 * substituteEnvVars("${MISSING}") // "${MISSING}" (unchanged)
 * substituteEnvVars("${MISSING:-default}") // "default"
 * substituteEnvVars("${DEBUG:-false}") // "false" (if DEBUG not set)
 */
export function substituteEnvVars(value: string): string {
  // Match ${VAR} or ${VAR:-default}
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-(.*?))?\}/g,
    (match, varName, defaultValue) => {
      const envValue = process.env[varName];

      // If env var is set, use it
      if (envValue !== undefined) {
        return envValue;
      }

      // If default value is provided, use it
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      // Otherwise, leave the pattern as-is
      return match;
    }
  );
}

/**
 * Recursively substitute environment variables in an object
 *
 * Walks through all string values in the object and substitutes env vars.
 * Handles nested objects and arrays.
 *
 * @param obj - Object potentially containing ${VAR} patterns in string values
 * @returns New object with environment variables substituted
 *
 * @example
 * process.env.API_KEY = "secret";
 * substituteEnvVarsInObject({
 *   headers: {
 *     Authorization: "Bearer ${API_KEY}"
 *   }
 * })
 * // Returns: { headers: { Authorization: "Bearer secret" } }
 */
export function substituteEnvVarsInObject<T extends Record<string, any>>(
  obj: T
): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'string'
        ? substituteEnvVars(item)
        : typeof item === 'object' && item !== null
        ? substituteEnvVarsInObject(item)
        : item
    ) as any as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = substituteEnvVars(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = substituteEnvVarsInObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if a string contains environment variable patterns
 *
 * @param value - String to check
 * @returns true if string contains ${VAR} or ${VAR:-default} patterns
 *
 * @example
 * hasEnvVarPattern("Bearer ${TOKEN}") // true
 * hasEnvVarPattern("no variables here") // false
 */
export function hasEnvVarPattern(value: string): boolean {
  return /\$\{[A-Za-z_][A-Za-z0-9_]*(?::-.*?)?\}/.test(value);
}

/**
 * Extract all environment variable names from a string
 *
 * @param value - String potentially containing ${VAR} patterns
 * @returns Array of variable names (without ${} or defaults)
 *
 * @example
 * extractEnvVarNames("${API_KEY} and ${DEBUG:-false}") // ["API_KEY", "DEBUG"]
 */
export function extractEnvVarNames(value: string): string[] {
  const matches = value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-.*?)?\}/g);
  return Array.from(matches, (m) => m[1]);
}
