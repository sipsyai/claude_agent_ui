/**
 * Claude Code Router provider configuration
 *
 * Defines a model provider (e.g., OpenRouter, Together AI) for routing.
 */
export interface RouterProvider {
  /** Provider name (e.g., 'openrouter', 'together') */
  name: string;

  /** API base URL for the provider */
  api_base_url: string;

  /** API key for authentication */
  api_key: string;

  /** List of model identifiers supported by this provider */
  models: string[];

  /** Optional request/response transformer configuration */
  transformer?: Record<string, unknown>;
}

/**
 * Claude Code Router configuration
 *
 * Enables routing of Claude model requests to alternative providers
 * based on configurable rules.
 */
export interface RouterConfiguration {
  /** Whether router is enabled */
  enabled: boolean;

  /** Array of configured providers */
  providers: RouterProvider[];

  /**
   * Routing rules mapping Claude models to provider model identifiers
   *
   * Router rules always resolve to model identifiers, which are strings.
   * Example: { "sonnet": "anthropic/claude-3-5-sonnet", "opus": "anthropic/claude-opus-4" }
   */
  rules: Record<string, string>;
}
