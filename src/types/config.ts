/**
 * Configuration types for CUI
 */
import { RouterConfiguration } from './router-config.js';

/**
 * Server configuration
 *
 * Defines the host and port for the CUI server.
 */
export interface ServerConfig {
  /** Server host address (default: 'localhost') */
  host: string;

  /** Server port number (default: 3001) */
  port: number;
}

/**
 * Gemini API configuration
 *
 * Configuration for Google's Gemini API integration.
 */
export interface GeminiConfig {
  /**
   * Google API key for Gemini
   * Can also be set via GOOGLE_API_KEY environment variable
   */
  apiKey?: string;

  /**
   * Gemini model to use
   * Default: 'gemini-2.5-flash'
   */
  model?: string;
}

/**
 * Interface configuration
 *
 * User interface preferences and notification settings.
 */
export interface InterfaceConfig {
  /** Color scheme preference */
  colorScheme: 'light' | 'dark' | 'system';

  /** Interface language code (e.g., 'en', 'es') */
  language: string;

  /** Notification settings */
  notifications?: {
    /** Whether notifications are enabled */
    enabled: boolean;

    /** Optional ntfy.sh server URL for notifications */
    ntfyUrl?: string;

    /** Optional web push notification configuration */
    webPush?: {
      /** VAPID subject (e.g. mailto:you@example.com) */
      subject?: string;

      /** VAPID public key for web push */
      vapidPublicKey?: string;

      /** VAPID private key for web push */
      vapidPrivateKey?: string;
    };
  };
}

export interface CUIConfig {
  /**
   * Unique machine identifier
   * Format: {hostname}-{16char_hash}
   * Example: "wenbomacbook-a1b2c3d4e5f6g7h8"
   */
  machine_id: string;

  /**
   * Server configuration
   */
  server: ServerConfig;

  /**
   * Authentication token for API access
   * 32-character random string generated on first run
   */
  authToken: string;

  /**
   * Gemini API configuration (optional)
   */
  gemini?: GeminiConfig;

  /**
   * Optional router configuration for Claude Code Router
   */
  router?: RouterConfiguration;

  /**
   * Interface preferences and settings
   */
  interface: InterfaceConfig;

  /**
   * Training agent ID from Strapi database (optional)
   * If not set, falls back to local training-agent.md
   */
  trainingAgentId?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<CUIConfig, 'machine_id' | 'authToken'> = {
  server: {
    host: 'localhost',
    port: 3001
  },
  interface: {
    colorScheme: 'system',
    language: 'en'
  }
};