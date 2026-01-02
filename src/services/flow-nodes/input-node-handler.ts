/**
 * Claude Agent UI - Input Node Handler
 *
 * Handles input nodes in flow execution.
 * Responsibilities:
 * - Validate input data against field definitions
 * - Apply validation rules and constraints
 * - Transform input data for downstream nodes
 * - Set up context variables from input
 *
 * @see src/types/flow-types.ts for InputNode type definition
 */

import { createLogger, type Logger } from '../logger.js';
import type { NodeHandler } from '../flow-execution-service.js';
import type {
  FlowNode,
  FlowExecutionContext,
  NodeExecutionResult,
  InputNode,
  FlowInputField,
} from '../../types/flow-types.js';
import { isInputNode } from '../../types/flow-types.js';

/**
 * InputNodeHandler - Validates and processes flow input data
 *
 * This handler is the entry point for flow execution.
 * It validates user-provided input against the input field definitions
 * and sets up the execution context with validated data.
 */
export class InputNodeHandler implements NodeHandler {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('InputNodeHandler');
  }

  /**
   * Execute the input node
   * @param node - The input node to execute
   * @param context - The flow execution context
   * @returns Node execution result with validated input data
   */
  async execute(node: FlowNode, context: FlowExecutionContext): Promise<NodeExecutionResult> {
    // Type guard to ensure we have an InputNode
    if (!isInputNode(node)) {
      return {
        success: false,
        error: `Expected input node, got ${node.type}`,
      };
    }

    const inputNode = node as InputNode;
    const { input } = context;

    this.logger.info('Processing input node', {
      nodeId: inputNode.nodeId,
      nodeName: inputNode.name,
      fieldCount: inputNode.inputFields?.length || 0,
    });

    try {
      // Validate input against field definitions
      const validationResult = this.validateInput(inputNode, input);

      if (!validationResult.valid) {
        context.log('error', `Input validation failed: ${validationResult.errors.join(', ')}`, node.nodeId);
        return {
          success: false,
          error: `Input validation failed: ${validationResult.errors.join(', ')}`,
          errorDetails: { validationErrors: validationResult.errors },
        };
      }

      // Process and transform input data
      const processedData = this.processInput(inputNode, input);

      // Set up context variables for template interpolation
      const outputData = {
        ...processedData,
        _inputNode: {
          nodeId: inputNode.nodeId,
          name: inputNode.name,
          processedAt: new Date().toISOString(),
        },
      };

      context.log('info', 'Input validation passed', node.nodeId, {
        fieldCount: Object.keys(processedData).length,
      });

      return {
        success: true,
        output: outputData,
        data: processedData,
        continueExecution: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Input node execution failed', error as Error, {
        nodeId: inputNode.nodeId,
      });

      return {
        success: false,
        error: errorMessage,
        errorDetails: error instanceof Error ? { stack: error.stack } : undefined,
      };
    }
  }

  /**
   * Validate input against field definitions
   */
  private validateInput(
    node: InputNode,
    input: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const fields = node.inputFields || [];

    for (const field of fields) {
      const value = input[field.name];

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required field '${field.label || field.name}' is missing`);
        continue;
      }

      // Skip validation for empty optional fields
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Validate by field type
      const typeError = this.validateFieldType(field, value);
      if (typeError) {
        errors.push(typeError);
      }

      // Validate pattern (regex)
      if (field.pattern) {
        try {
          const regex = new RegExp(field.pattern);
          if (typeof value === 'string' && !regex.test(value)) {
            errors.push(`Field '${field.label || field.name}' does not match the required pattern`);
          }
        } catch {
          this.logger.warn('Invalid regex pattern in field definition', {
            fieldName: field.name,
            pattern: field.pattern,
          });
        }
      }

      // Validate min/max for numbers
      if (field.type === 'number' && typeof value === 'number') {
        if (field.min !== undefined && value < field.min) {
          errors.push(`Field '${field.label || field.name}' must be at least ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`Field '${field.label || field.name}' must be at most ${field.max}`);
        }
      }

      // Validate min/max length for strings
      if ((field.type === 'text' || field.type === 'textarea') && typeof value === 'string') {
        if (field.min !== undefined && value.length < field.min) {
          errors.push(`Field '${field.label || field.name}' must be at least ${field.min} characters`);
        }
        if (field.max !== undefined && value.length > field.max) {
          errors.push(`Field '${field.label || field.name}' must be at most ${field.max} characters`);
        }
      }

      // Validate select options
      if ((field.type === 'select' || field.type === 'multiselect') && field.options) {
        const values = field.type === 'multiselect' ? (Array.isArray(value) ? value : [value]) : [value];
        for (const v of values) {
          if (!field.options.includes(v)) {
            errors.push(`Field '${field.label || field.name}' has invalid option: ${v}`);
          }
        }
      }
    }

    // Apply custom validation rules if defined
    if (node.validationRules) {
      const customErrors = this.applyValidationRules(node.validationRules, input);
      errors.push(...customErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate field type
   */
  private validateFieldType(field: FlowInputField, value: any): string | null {
    const fieldLabel = field.label || field.name;

    switch (field.type) {
      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          return `Field '${fieldLabel}' must be a text value`;
        }
        break;

      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return `Field '${fieldLabel}' must be a number`;
        }
        break;

      case 'url':
        if (typeof value !== 'string') {
          return `Field '${fieldLabel}' must be a URL string`;
        }
        try {
          new URL(value);
        } catch {
          return `Field '${fieldLabel}' must be a valid URL`;
        }
        break;

      case 'email':
        if (typeof value !== 'string') {
          return `Field '${fieldLabel}' must be an email string`;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return `Field '${fieldLabel}' must be a valid email address`;
        }
        break;

      case 'checkbox':
        if (typeof value !== 'boolean') {
          return `Field '${fieldLabel}' must be a boolean value`;
        }
        break;

      case 'date':
      case 'datetime':
        if (typeof value !== 'string' && !(value instanceof Date)) {
          return `Field '${fieldLabel}' must be a date value`;
        }
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return `Field '${fieldLabel}' must be a valid date`;
          }
        }
        break;

      case 'select':
        if (typeof value !== 'string') {
          return `Field '${fieldLabel}' must be a string value`;
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          return `Field '${fieldLabel}' must be an array of values`;
        }
        break;

      case 'file':
        // File validation would depend on the actual file handling mechanism
        // For now, just check if it's an object with expected properties
        if (typeof value !== 'object' || !value.name) {
          return `Field '${fieldLabel}' must be a valid file reference`;
        }
        break;

      default:
        // Unknown field type, skip validation
        break;
    }

    return null;
  }

  /**
   * Apply custom validation rules
   */
  private applyValidationRules(
    rules: Record<string, any>,
    input: Record<string, any>
  ): string[] {
    const errors: string[] = [];

    // Support for various rule types
    // Example rules structure:
    // {
    //   "conditionalRequired": { "fieldA": { "when": "fieldB", "equals": "value" } },
    //   "comparison": { "startDate": { "lessThan": "endDate" } }
    // }

    if (rules.conditionalRequired) {
      for (const [field, condition] of Object.entries(rules.conditionalRequired as Record<string, any>)) {
        const { when, equals } = condition;
        if (input[when] === equals && !input[field]) {
          errors.push(`Field '${field}' is required when '${when}' is '${equals}'`);
        }
      }
    }

    if (rules.comparison) {
      for (const [field, comparison] of Object.entries(rules.comparison as Record<string, any>)) {
        if (comparison.lessThan) {
          const fieldValue = input[field];
          const compareValue = input[comparison.lessThan];
          if (fieldValue !== undefined && compareValue !== undefined && fieldValue >= compareValue) {
            errors.push(`Field '${field}' must be less than '${comparison.lessThan}'`);
          }
        }
        if (comparison.greaterThan) {
          const fieldValue = input[field];
          const compareValue = input[comparison.greaterThan];
          if (fieldValue !== undefined && compareValue !== undefined && fieldValue <= compareValue) {
            errors.push(`Field '${field}' must be greater than '${comparison.greaterThan}'`);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Process and transform input data
   */
  private processInput(
    node: InputNode,
    input: Record<string, any>
  ): Record<string, any> {
    const processed: Record<string, any> = {};
    const fields = node.inputFields || [];

    for (const field of fields) {
      let value = input[field.name];

      // Apply default value if not provided
      if ((value === undefined || value === null || value === '') && field.defaultValue !== undefined) {
        value = field.defaultValue;
      }

      // Type coercion based on field type
      if (value !== undefined && value !== null) {
        switch (field.type) {
          case 'number':
            value = typeof value === 'number' ? value : Number(value);
            break;
          case 'checkbox':
            value = Boolean(value);
            break;
          case 'date':
          case 'datetime':
            value = typeof value === 'string' ? new Date(value).toISOString() : value;
            break;
          case 'multiselect':
            value = Array.isArray(value) ? value : [value];
            break;
        }
      }

      processed[field.name] = value;
    }

    // Also include any extra input fields not defined in the schema
    // (for flexibility in development/testing)
    for (const [key, value] of Object.entries(input)) {
      if (!(key in processed)) {
        processed[key] = value;
      }
    }

    return processed;
  }
}

/**
 * Singleton instance for registration
 */
export const inputNodeHandler = new InputNodeHandler();
