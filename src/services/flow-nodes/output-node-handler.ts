/**
 * Claude Agent UI - Output Node Handler
 *
 * Handles output nodes in flow execution.
 * Responsibilities:
 * - Format output data according to specified format
 * - Save output to file if configured
 * - Send to webhook if configured
 * - Add metadata and timestamps as needed
 * - Transform output using templates
 *
 * @see src/types/flow-types.ts for OutputNode type definition
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger, type Logger } from '../logger.js';
import type { NodeHandler } from '../flow-execution-service.js';
import type {
  FlowNode,
  FlowExecutionContext,
  NodeExecutionResult,
  OutputNode,
  FlowOutputFormat,
} from '../../types/flow-types.js';
import { isOutputNode } from '../../types/flow-types.js';

/**
 * OutputNodeHandler - Formats and delivers flow output
 *
 * This handler is typically the terminal node in a flow.
 * It takes the accumulated data from previous nodes and
 * formats/delivers it according to the output configuration.
 */
export class OutputNodeHandler implements NodeHandler {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('OutputNodeHandler');
  }

  /**
   * Execute the output node
   * @param node - The output node to execute
   * @param context - The flow execution context
   * @returns Node execution result with formatted output
   */
  async execute(node: FlowNode, context: FlowExecutionContext): Promise<NodeExecutionResult> {
    // Type guard to ensure we have an OutputNode
    if (!isOutputNode(node)) {
      return {
        success: false,
        error: `Expected output node, got ${node.type}`,
      };
    }

    const outputNode = node as OutputNode;
    const { data, execution, flow } = context;

    this.logger.info('Processing output node', {
      nodeId: outputNode.nodeId,
      nodeName: outputNode.name,
      outputType: outputNode.outputType,
      format: outputNode.format,
    });

    try {
      // 1. Build the output content
      let outputContent: any = data;

      // Apply transform template if specified
      if (outputNode.transformTemplate) {
        outputContent = this.applyTransformTemplate(
          outputNode.transformTemplate,
          data,
          context.variables
        );
      }

      // 2. Add metadata if configured
      if (outputNode.includeMetadata) {
        outputContent = {
          data: outputContent,
          metadata: {
            flowId: flow.id,
            flowName: flow.name,
            executionId: execution.id,
            status: execution.status,
            tokensUsed: execution.tokensUsed,
            cost: execution.cost,
          },
        };
      }

      // 3. Add timestamp if configured
      if (outputNode.includeTimestamp) {
        const wrapper = typeof outputContent === 'object' && outputContent !== null
          ? outputContent
          : { data: outputContent };
        wrapper.timestamp = new Date().toISOString();
        wrapper.executionTime = execution.executionTime;
        outputContent = wrapper;
      }

      // 4. Format the output
      const formattedOutput = this.formatOutput(outputContent, outputNode.format);

      // 5. Deliver the output based on outputType
      const deliveryResult = await this.deliverOutput(outputNode, formattedOutput, context);

      if (!deliveryResult.success) {
        return {
          success: false,
          error: deliveryResult.error,
          errorDetails: deliveryResult.errorDetails,
        };
      }

      context.log('info', `Output delivered via ${outputNode.outputType}`, node.nodeId, {
        format: outputNode.format,
        deliveryPath: deliveryResult.path,
      });

      return {
        success: true,
        output: {
          formatted: formattedOutput,
          deliveryType: outputNode.outputType,
          deliveryPath: deliveryResult.path,
          format: outputNode.format,
        },
        data: {
          output: formattedOutput,
          [outputNode.nodeId]: formattedOutput,
        },
        continueExecution: false, // Output node is terminal
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Output node execution failed', error as Error, {
        nodeId: outputNode.nodeId,
      });

      return {
        success: false,
        error: errorMessage,
        errorDetails: error instanceof Error ? { stack: error.stack } : undefined,
      };
    }
  }

  /**
   * Apply transform template to output data
   * Supports Handlebars-like {{variable}} syntax
   */
  private applyTransformTemplate(
    template: string,
    data: Record<string, any>,
    variables: Record<string, any>
  ): any {
    // If template is JSON-like, try to parse and interpolate
    if (template.trim().startsWith('{') || template.trim().startsWith('[')) {
      try {
        // Interpolate variables in the template string first
        const interpolated = this.interpolateTemplate(template, { ...data, ...variables });
        return JSON.parse(interpolated);
      } catch {
        // If parsing fails, return as interpolated string
        return this.interpolateTemplate(template, { ...data, ...variables });
      }
    }

    // For non-JSON templates, just interpolate
    return this.interpolateTemplate(template, { ...data, ...variables });
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const parts = trimmedPath.split('.');
      let value: any = context;

      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return match;
        }
      }

      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  /**
   * Format output according to specified format
   */
  private formatOutput(data: any, format: FlowOutputFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'markdown':
        return this.toMarkdown(data);

      case 'text':
        return this.toPlainText(data);

      case 'html':
        return this.toHtml(data);

      case 'csv':
        return this.toCsv(data);

      case 'zip':
        // ZIP format would require additional handling
        // For now, return JSON representation
        return JSON.stringify(data, null, 2);

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Convert data to markdown format
   */
  private toMarkdown(data: any): string {
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item, index) => `${index + 1}. ${this.toMarkdown(item)}`).join('\n');
    }

    if (typeof data === 'object' && data !== null) {
      const lines: string[] = [];

      // Handle metadata section
      if (data.metadata) {
        lines.push('## Execution Metadata\n');
        lines.push('| Property | Value |');
        lines.push('|----------|-------|');
        for (const [key, value] of Object.entries(data.metadata)) {
          lines.push(`| ${key} | ${value} |`);
        }
        lines.push('');
      }

      // Handle data section
      const mainData = data.data || data;
      if (typeof mainData === 'string') {
        lines.push(mainData);
      } else if (typeof mainData === 'object') {
        lines.push('## Output Data\n');
        lines.push('```json');
        lines.push(JSON.stringify(mainData, null, 2));
        lines.push('```');
      }

      // Add timestamp if present
      if (data.timestamp) {
        lines.push(`\n---\n*Generated at: ${data.timestamp}*`);
      }

      return lines.join('\n');
    }

    return String(data);
  }

  /**
   * Convert data to plain text format
   */
  private toPlainText(data: any): string {
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.toPlainText(item)).join('\n');
    }

    if (typeof data === 'object' && data !== null) {
      const lines: string[] = [];

      const flatten = (obj: any, prefix = ''): void => {
        for (const [key, value] of Object.entries(obj)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flatten(value, newKey);
          } else {
            lines.push(`${newKey}: ${JSON.stringify(value)}`);
          }
        }
      };

      flatten(data);
      return lines.join('\n');
    }

    return String(data);
  }

  /**
   * Convert data to HTML format
   */
  private toHtml(data: any): string {
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    if (typeof data === 'string') {
      return `<p>${escapeHtml(data)}</p>`;
    }

    if (Array.isArray(data)) {
      const items = data.map((item) => `<li>${this.toHtml(item)}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    if (typeof data === 'object' && data !== null) {
      const rows: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        const valueHtml = typeof value === 'object'
          ? `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`
          : escapeHtml(String(value));
        rows.push(`<tr><th>${escapeHtml(key)}</th><td>${valueHtml}</td></tr>`);
      }

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Flow Output</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; }
    pre { background: #f8f8f8; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Flow Output</h1>
  <table>${rows.join('')}</table>
</body>
</html>`.trim();
    }

    return `<p>${escapeHtml(String(data))}</p>`;
  }

  /**
   * Convert data to CSV format
   */
  private toCsv(data: any): string {
    const escapeCSV = (value: any): string => {
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '';
      }

      // If array of objects, create CSV with headers
      if (typeof data[0] === 'object' && data[0] !== null) {
        const headers = Object.keys(data[0]);
        const headerRow = headers.map(escapeCSV).join(',');
        const dataRows = data.map((row) =>
          headers.map((h) => escapeCSV(row[h])).join(',')
        );
        return [headerRow, ...dataRows].join('\n');
      }

      // Simple array
      return data.map(escapeCSV).join('\n');
    }

    if (typeof data === 'object' && data !== null) {
      const rows = Object.entries(data).map(
        ([key, value]) => `${escapeCSV(key)},${escapeCSV(value)}`
      );
      return rows.join('\n');
    }

    return escapeCSV(data);
  }

  /**
   * Deliver the output based on outputType
   */
  private async deliverOutput(
    node: OutputNode,
    formattedOutput: string,
    context: FlowExecutionContext
  ): Promise<{ success: boolean; path?: string; error?: string; errorDetails?: any }> {
    switch (node.outputType) {
      case 'response':
        // Response type just returns the formatted output
        return { success: true, path: 'response' };

      case 'file':
        return await this.saveToFile(node, formattedOutput, context);

      case 'webhook':
        return await this.sendToWebhook(node, formattedOutput, context);

      case 'database':
        // Database delivery would store in a database
        // For now, this is handled by the execution service via Strapi
        return { success: true, path: 'database' };

      case 'email':
        // Email delivery would require email service integration
        // Not implemented in this personal-use version
        context.log('warn', 'Email output type not implemented', node.nodeId);
        return { success: true, path: 'email (not sent)' };

      default:
        return { success: true, path: 'unknown' };
    }
  }

  /**
   * Save output to file
   */
  private async saveToFile(
    node: OutputNode,
    content: string,
    context: FlowExecutionContext
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!node.saveToFile) {
      return { success: true };
    }

    try {
      // Determine file extension based on format
      const extensions: Record<FlowOutputFormat, string> = {
        json: '.json',
        markdown: '.md',
        text: '.txt',
        html: '.html',
        csv: '.csv',
        zip: '.zip',
      };

      const extension = extensions[node.format] || '.txt';

      // Build file path
      let filePath = node.filePath || './output';
      let fileName = node.fileName || `flow-output-${context.execution.id}${extension}`;

      // Interpolate variables in path and name
      const variables = { ...context.variables, ...context.data };
      filePath = this.interpolateTemplate(filePath, variables);
      fileName = this.interpolateTemplate(fileName, variables);

      const fullPath = path.join(filePath, fileName);

      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');

      this.logger.info('Output saved to file', { path: fullPath });

      return { success: true, path: fullPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to save output to file', error as Error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send output to webhook
   */
  private async sendToWebhook(
    node: OutputNode,
    content: string,
    context: FlowExecutionContext
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!node.webhookUrl) {
      return { success: false, error: 'Webhook URL not configured' };
    }

    try {
      // Interpolate webhook URL with variables
      const variables = { ...context.variables, ...context.data };
      const webhookUrl = this.interpolateTemplate(node.webhookUrl, variables);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': node.format === 'json' ? 'application/json' : 'text/plain',
        ...node.webhookHeaders,
      };

      // Send webhook request
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: content,
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      }

      this.logger.info('Output sent to webhook', { url: webhookUrl, status: response.status });

      return { success: true, path: webhookUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send output to webhook', error as Error);
      return { success: false, error: errorMessage };
    }
  }
}

/**
 * Singleton instance for registration
 */
export const outputNodeHandler = new OutputNodeHandler();
