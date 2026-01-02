/**
 * Flow Templates Service
 *
 * Pre-built flow templates for quick start when creating new flows.
 * These templates provide common workflow patterns that users can
 * customize for their specific use cases.
 */

import type {
  Flow,
  FlowNode,
  FlowCategory,
  FlowStatus,
  InputNode,
  AgentNode,
  OutputNode,
  FlowInputField,
  FlowInputSchema,
  FlowOutputSchema,
} from '../types/flow-types';

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

/**
 * Flow template definition (without id and timestamps)
 */
export interface FlowTemplate {
  /** Unique template identifier */
  templateId: string;

  /** Template display name */
  name: string;

  /** Template description */
  description: string;

  /** Template category */
  category: FlowCategory;

  /** Emoji icon for display */
  icon: string;

  /** Tags for filtering */
  tags: string[];

  /** Default flow data to use when creating from template */
  flowData: Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique node ID
 */
const generateNodeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create default input node
 */
const createInputNode = (fields: FlowInputField[]): InputNode => ({
  nodeId: generateNodeId('input'),
  type: 'input',
  name: 'Input',
  description: 'Flow input configuration',
  position: { x: 0, y: 0 },
  inputFields: fields,
  validationRules: {},
});

/**
 * Create default agent node
 */
const createAgentNode = (
  name: string,
  promptTemplate: string,
  skills: string[] = [],
  timeout: number = 120000
): AgentNode => ({
  nodeId: generateNodeId('agent'),
  type: 'agent',
  name,
  description: `${name} agent node`,
  position: { x: 0, y: 100 },
  agentId: '', // User needs to select an agent
  promptTemplate,
  skills,
  modelOverride: 'default',
  timeout,
  retryOnError: true,
  maxRetries: 3,
});

/**
 * Create default output node
 */
const createOutputNode = (
  format: 'json' | 'markdown' | 'text' | 'html' | 'csv' = 'markdown',
  outputType: 'response' | 'file' | 'webhook' = 'response'
): OutputNode => ({
  nodeId: generateNodeId('output'),
  type: 'output',
  name: 'Output',
  description: 'Flow output configuration',
  position: { x: 0, y: 200 },
  outputType,
  format,
  saveToFile: false,
  includeMetadata: true,
  includeTimestamp: true,
});

/**
 * Link nodes together by setting nextNodeId
 */
const linkNodes = (nodes: FlowNode[]): FlowNode[] => {
  return nodes.map((node, index) => ({
    ...node,
    nextNodeId: index < nodes.length - 1 ? nodes[index + 1].nodeId : null,
  }));
};

/**
 * Generate input schema from input fields
 */
const generateInputSchema = (fields: FlowInputField[]): FlowInputSchema => ({
  properties: fields.reduce((acc, field) => {
    acc[field.name] = {
      type: field.type === 'number' ? 'number' : 'string',
      description: field.description,
      default: field.defaultValue,
    };
    return acc;
  }, {} as Record<string, { type: string; description?: string; default?: any }>),
  required: fields.filter((f) => f.required).map((f) => f.name),
});

/**
 * Generate default output schema
 */
const generateOutputSchema = (description: string = 'Flow execution result'): FlowOutputSchema => ({
  properties: {
    result: { type: 'string', description },
  },
});

// =============================================================================
// FLOW TEMPLATES
// =============================================================================

/**
 * Web Scraper Template
 * Scrapes content from a given URL and returns structured data
 */
const webScraperTemplate: FlowTemplate = {
  templateId: 'web-scraper',
  name: 'Web Scraper',
  description:
    'Scrape content from websites and extract structured data. Perfect for gathering information from web pages.',
  category: 'web-scraping',
  icon: '🌐',
  tags: ['web', 'scraping', 'extraction', 'content'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'url',
        type: 'url',
        label: 'Website URL',
        required: true,
        placeholder: 'https://example.com',
        description: 'The URL of the website to scrape',
      },
      {
        name: 'extractionInstructions',
        type: 'textarea',
        label: 'Extraction Instructions',
        required: false,
        placeholder: 'Extract the main article content, headings, and any relevant links...',
        description: 'Specific instructions for what content to extract from the page',
      },
      {
        name: 'outputFormat',
        type: 'select',
        label: 'Output Format',
        required: false,
        options: ['markdown', 'json', 'plain-text'],
        defaultValue: 'markdown',
        description: 'The format for the extracted content',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'Web Scraper Agent',
      `You are a web scraping assistant. Your task is to analyze and extract content from the following URL.

URL: {{url}}

{{#if extractionInstructions}}
Extraction Instructions: {{extractionInstructions}}
{{else}}
Please extract the main content, headings, key information, and any relevant links from the page.
{{/if}}

Format the output as {{outputFormat}}.

Be thorough and accurate in your extraction. Preserve the structure and hierarchy of the content where applicable.`,
      [], // User will select appropriate skills (e.g., browser, fetch)
      180000 // 3 minute timeout for web operations
    );
    const outputNode = createOutputNode('markdown', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'Web Scraper',
      slug: 'web-scraper',
      description: 'Scrape and extract content from websites',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Extracted web content'),
      isActive: false,
      version: '1.0.0',
      category: 'web-scraping' as FlowCategory,
      metadata: { templateId: 'web-scraper' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * Data Processor Template
 * Process and transform data using AI
 */
const dataProcessorTemplate: FlowTemplate = {
  templateId: 'data-processor',
  name: 'Data Processor',
  description:
    'Process, transform, and analyze data using AI. Great for data cleaning, summarization, and format conversion.',
  category: 'data-processing',
  icon: '📊',
  tags: ['data', 'processing', 'transform', 'analyze'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'inputData',
        type: 'textarea',
        label: 'Input Data',
        required: true,
        placeholder: 'Paste your data here (JSON, CSV, or plain text)...',
        description: 'The data to process',
      },
      {
        name: 'processingTask',
        type: 'select',
        label: 'Processing Task',
        required: true,
        options: [
          'summarize',
          'clean-and-format',
          'extract-entities',
          'convert-format',
          'analyze-patterns',
          'custom',
        ],
        defaultValue: 'summarize',
        description: 'What to do with the data',
      },
      {
        name: 'customInstructions',
        type: 'textarea',
        label: 'Custom Instructions',
        required: false,
        placeholder: 'Additional instructions for processing...',
        description: 'Specific instructions for custom processing tasks',
      },
      {
        name: 'outputFormat',
        type: 'select',
        label: 'Output Format',
        required: false,
        options: ['json', 'csv', 'markdown', 'plain-text'],
        defaultValue: 'json',
        description: 'Desired output format',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'Data Processor Agent',
      `You are a data processing assistant. Process the following data according to the specified task.

PROCESSING TASK: {{processingTask}}

INPUT DATA:
{{inputData}}

{{#if customInstructions}}
ADDITIONAL INSTRUCTIONS:
{{customInstructions}}
{{/if}}

Please process the data and format the output as {{outputFormat}}.

Guidelines:
- For 'summarize': Provide a concise summary of the key information
- For 'clean-and-format': Clean up formatting, fix inconsistencies, remove duplicates
- For 'extract-entities': Identify and extract named entities (people, places, dates, etc.)
- For 'convert-format': Convert between data formats while preserving information
- For 'analyze-patterns': Identify patterns, trends, and anomalies in the data
- For 'custom': Follow the provided custom instructions

Ensure your output is accurate and well-structured.`,
      [],
      120000
    );
    const outputNode = createOutputNode('json', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'Data Processor',
      slug: 'data-processor',
      description: 'Process and transform data using AI',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Processed data output'),
      isActive: false,
      version: '1.0.0',
      category: 'data-processing' as FlowCategory,
      metadata: { templateId: 'data-processor' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * API Integration Template
 * Connect to external APIs and process responses
 */
const apiIntegrationTemplate: FlowTemplate = {
  templateId: 'api-integration',
  name: 'API Integration',
  description:
    'Connect to external APIs, fetch data, and process responses. Ideal for integrating with third-party services.',
  category: 'api-integration',
  icon: '🔌',
  tags: ['api', 'integration', 'rest', 'fetch'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'apiEndpoint',
        type: 'url',
        label: 'API Endpoint',
        required: true,
        placeholder: 'https://api.example.com/data',
        description: 'The API endpoint URL to call',
      },
      {
        name: 'httpMethod',
        type: 'select',
        label: 'HTTP Method',
        required: true,
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        defaultValue: 'GET',
        description: 'The HTTP method to use',
      },
      {
        name: 'requestBody',
        type: 'textarea',
        label: 'Request Body (JSON)',
        required: false,
        placeholder: '{\n  "key": "value"\n}',
        description: 'JSON body for POST/PUT/PATCH requests',
      },
      {
        name: 'headers',
        type: 'textarea',
        label: 'Headers (JSON)',
        required: false,
        placeholder: '{\n  "Authorization": "Bearer token"\n}',
        description: 'Custom headers as JSON object',
      },
      {
        name: 'processingInstructions',
        type: 'textarea',
        label: 'Response Processing Instructions',
        required: false,
        placeholder: 'Extract the user names and emails from the response...',
        description: 'How to process and transform the API response',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'API Integration Agent',
      `You are an API integration assistant. Make an API call and process the response.

API ENDPOINT: {{apiEndpoint}}
HTTP METHOD: {{httpMethod}}

{{#if requestBody}}
REQUEST BODY:
{{requestBody}}
{{/if}}

{{#if headers}}
HEADERS:
{{headers}}
{{/if}}

Make the API request and then process the response.

{{#if processingInstructions}}
PROCESSING INSTRUCTIONS:
{{processingInstructions}}
{{else}}
Summarize the key information from the API response and format it in a readable way.
{{/if}}

Handle any errors gracefully and report them clearly.`,
      [], // User will select appropriate skills (e.g., fetch, http-client)
      60000
    );
    const outputNode = createOutputNode('json', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'API Integration',
      slug: 'api-integration',
      description: 'Connect to external APIs and process responses',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Processed API response'),
      isActive: false,
      version: '1.0.0',
      category: 'api-integration' as FlowCategory,
      metadata: { templateId: 'api-integration' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * Content Writer Template
 * Generate various types of content using AI
 */
const contentWriterTemplate: FlowTemplate = {
  templateId: 'content-writer',
  name: 'Content Writer',
  description:
    'Generate blog posts, articles, social media content, and more. Perfect for content creation workflows.',
  category: 'automation',
  icon: '✍️',
  tags: ['content', 'writing', 'blog', 'social-media'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'contentType',
        type: 'select',
        label: 'Content Type',
        required: true,
        options: ['blog-post', 'article', 'social-media', 'email', 'product-description', 'other'],
        defaultValue: 'blog-post',
        description: 'Type of content to generate',
      },
      {
        name: 'topic',
        type: 'text',
        label: 'Topic',
        required: true,
        placeholder: 'The future of AI in healthcare',
        description: 'Main topic or subject for the content',
      },
      {
        name: 'keywords',
        type: 'text',
        label: 'Keywords',
        required: false,
        placeholder: 'AI, healthcare, machine learning, diagnosis',
        description: 'Keywords to include (comma-separated)',
      },
      {
        name: 'tone',
        type: 'select',
        label: 'Tone',
        required: false,
        options: ['professional', 'casual', 'friendly', 'formal', 'humorous', 'informative'],
        defaultValue: 'professional',
        description: 'Writing tone and style',
      },
      {
        name: 'length',
        type: 'select',
        label: 'Content Length',
        required: false,
        options: ['short', 'medium', 'long'],
        defaultValue: 'medium',
        description: 'Approximate length of the content',
      },
      {
        name: 'additionalInstructions',
        type: 'textarea',
        label: 'Additional Instructions',
        required: false,
        placeholder: 'Include a call-to-action at the end...',
        description: 'Any specific requirements or guidelines',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'Content Writer Agent',
      `You are a professional content writer. Create high-quality content based on the following specifications:

CONTENT TYPE: {{contentType}}
TOPIC: {{topic}}
TONE: {{tone}}
LENGTH: {{length}}

{{#if keywords}}
KEYWORDS TO INCLUDE: {{keywords}}
{{/if}}

{{#if additionalInstructions}}
ADDITIONAL INSTRUCTIONS:
{{additionalInstructions}}
{{/if}}

Guidelines:
- Write engaging, original content that matches the specified tone
- For blog posts: Include an introduction, main points with subheadings, and a conclusion
- For social media: Keep it concise and engaging with appropriate hashtags
- For emails: Include a compelling subject line and clear call-to-action
- Naturally incorporate the provided keywords
- Adjust length based on the specification:
  - Short: 200-400 words
  - Medium: 500-800 words
  - Long: 1000+ words

Deliver polished, publication-ready content.`,
      [],
      180000
    );
    const outputNode = createOutputNode('markdown', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'Content Writer',
      slug: 'content-writer',
      description: 'Generate blog posts, articles, and other content',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Generated content'),
      isActive: false,
      version: '1.0.0',
      category: 'automation' as FlowCategory,
      metadata: { templateId: 'content-writer' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * Document Analyzer Template
 * Analyze documents and extract key information
 */
const documentAnalyzerTemplate: FlowTemplate = {
  templateId: 'document-analyzer',
  name: 'Document Analyzer',
  description:
    'Analyze documents, extract key information, summarize content, and answer questions about the document.',
  category: 'data-processing',
  icon: '📄',
  tags: ['document', 'analysis', 'extraction', 'summary'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'documentContent',
        type: 'textarea',
        label: 'Document Content',
        required: true,
        placeholder: 'Paste the document content here...',
        description: 'The document text to analyze',
      },
      {
        name: 'analysisType',
        type: 'select',
        label: 'Analysis Type',
        required: true,
        options: ['summary', 'key-points', 'entities', 'sentiment', 'questions', 'full-analysis'],
        defaultValue: 'summary',
        description: 'Type of analysis to perform',
      },
      {
        name: 'questions',
        type: 'textarea',
        label: 'Questions (optional)',
        required: false,
        placeholder: 'What is the main argument?\nWho are the key stakeholders?',
        description: 'Specific questions to answer about the document (one per line)',
      },
      {
        name: 'focusAreas',
        type: 'text',
        label: 'Focus Areas',
        required: false,
        placeholder: 'financial data, recommendations, risks',
        description: 'Specific areas to focus on (comma-separated)',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'Document Analyzer Agent',
      `You are a document analysis expert. Analyze the following document and provide insights.

DOCUMENT:
{{documentContent}}

ANALYSIS TYPE: {{analysisType}}

{{#if focusAreas}}
FOCUS AREAS: {{focusAreas}}
{{/if}}

{{#if questions}}
SPECIFIC QUESTIONS TO ANSWER:
{{questions}}
{{/if}}

Based on the analysis type, provide:
- Summary: A concise summary of the document (2-3 paragraphs)
- Key Points: Bullet points of the most important information
- Entities: List of people, organizations, dates, and locations mentioned
- Sentiment: Overall tone and sentiment analysis
- Questions: Direct answers to the provided questions
- Full Analysis: Comprehensive analysis including all of the above

Be accurate, thorough, and cite specific parts of the document when relevant.`,
      [],
      120000
    );
    const outputNode = createOutputNode('markdown', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'Document Analyzer',
      slug: 'document-analyzer',
      description: 'Analyze documents and extract key information',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Document analysis results'),
      isActive: false,
      version: '1.0.0',
      category: 'data-processing' as FlowCategory,
      metadata: { templateId: 'document-analyzer' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * Code Assistant Template
 * Help with coding tasks, reviews, and explanations
 */
const codeAssistantTemplate: FlowTemplate = {
  templateId: 'code-assistant',
  name: 'Code Assistant',
  description:
    'Get help with coding tasks - write, review, explain, or debug code in any programming language.',
  category: 'automation',
  icon: '💻',
  tags: ['code', 'programming', 'development', 'debug'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'task',
        type: 'select',
        label: 'Task Type',
        required: true,
        options: ['write-code', 'review-code', 'explain-code', 'debug-code', 'refactor-code', 'convert-code'],
        defaultValue: 'write-code',
        description: 'What coding task to perform',
      },
      {
        name: 'language',
        type: 'select',
        label: 'Programming Language',
        required: true,
        options: [
          'javascript',
          'typescript',
          'python',
          'java',
          'csharp',
          'go',
          'rust',
          'php',
          'ruby',
          'swift',
          'kotlin',
          'other',
        ],
        defaultValue: 'typescript',
        description: 'Programming language to use',
      },
      {
        name: 'codeInput',
        type: 'textarea',
        label: 'Code / Description',
        required: true,
        placeholder:
          'For write-code: Describe what you need\nFor other tasks: Paste your code here...',
        description: 'Code to analyze or description of what to write',
      },
      {
        name: 'targetLanguage',
        type: 'text',
        label: 'Target Language (for conversion)',
        required: false,
        placeholder: 'python',
        description: 'Target language when converting code',
      },
      {
        name: 'additionalContext',
        type: 'textarea',
        label: 'Additional Context',
        required: false,
        placeholder: 'Any additional context, requirements, or constraints...',
        description: 'Extra information to help with the task',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'Code Assistant Agent',
      `You are an expert software developer. Help with the following coding task.

TASK: {{task}}
LANGUAGE: {{language}}

CODE/DESCRIPTION:
\`\`\`
{{codeInput}}
\`\`\`

{{#if targetLanguage}}
TARGET LANGUAGE: {{targetLanguage}}
{{/if}}

{{#if additionalContext}}
ADDITIONAL CONTEXT:
{{additionalContext}}
{{/if}}

Based on the task type:
- write-code: Write clean, well-documented code that follows best practices
- review-code: Provide a thorough code review with suggestions for improvement
- explain-code: Explain what the code does step by step
- debug-code: Identify bugs and provide fixes
- refactor-code: Refactor for better readability, performance, or maintainability
- convert-code: Convert to the target language while preserving functionality

Always include:
1. Clear comments explaining the code
2. Error handling where appropriate
3. Best practices for the language
4. Any relevant warnings or considerations`,
      [],
      180000
    );
    const outputNode = createOutputNode('markdown', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'Code Assistant',
      slug: 'code-assistant',
      description: 'Help with coding tasks - write, review, explain, or debug code',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Code assistance result'),
      isActive: false,
      version: '1.0.0',
      category: 'automation' as FlowCategory,
      metadata: { templateId: 'code-assistant' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * Email Responder Template
 * Draft professional email responses
 */
const emailResponderTemplate: FlowTemplate = {
  templateId: 'email-responder',
  name: 'Email Responder',
  description:
    'Draft professional email responses with the right tone and content. Perfect for customer support and business communication.',
  category: 'automation',
  icon: '📧',
  tags: ['email', 'response', 'communication', 'support'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'originalEmail',
        type: 'textarea',
        label: 'Original Email',
        required: true,
        placeholder: 'Paste the email you want to respond to...',
        description: 'The email that needs a response',
      },
      {
        name: 'responseIntent',
        type: 'select',
        label: 'Response Intent',
        required: true,
        options: [
          'acknowledge',
          'provide-info',
          'resolve-issue',
          'follow-up',
          'decline-politely',
          'escalate',
          'custom',
        ],
        defaultValue: 'provide-info',
        description: 'The purpose of your response',
      },
      {
        name: 'tone',
        type: 'select',
        label: 'Tone',
        required: false,
        options: ['formal', 'friendly', 'professional', 'empathetic', 'apologetic'],
        defaultValue: 'professional',
        description: 'Tone for the response',
      },
      {
        name: 'keyPoints',
        type: 'textarea',
        label: 'Key Points to Include',
        required: false,
        placeholder: '- Confirm the order was shipped\n- Provide tracking number\n- Offer assistance...',
        description: 'Main points you want to address in the response',
      },
      {
        name: 'signature',
        type: 'text',
        label: 'Signature Name',
        required: false,
        placeholder: 'John Smith',
        description: 'Name for the email signature',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'Email Responder Agent',
      `You are a professional email communication expert. Draft a response to the following email.

ORIGINAL EMAIL:
{{originalEmail}}

RESPONSE INTENT: {{responseIntent}}
TONE: {{tone}}

{{#if keyPoints}}
KEY POINTS TO ADDRESS:
{{keyPoints}}
{{/if}}

{{#if signature}}
SIGN OFF AS: {{signature}}
{{/if}}

Guidelines:
- Start with an appropriate greeting
- Address all points from the original email
- Be clear, concise, and professional
- Include a proper sign-off
- Match the specified tone throughout
- For 'decline-politely': Be respectful and offer alternatives if possible
- For 'resolve-issue': Show empathy and provide a clear resolution
- For 'escalate': Explain the escalation and set expectations

Provide a complete, ready-to-send email response.`,
      [],
      60000
    );
    const outputNode = createOutputNode('text', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'Email Responder',
      slug: 'email-responder',
      description: 'Draft professional email responses',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Email response draft'),
      isActive: false,
      version: '1.0.0',
      category: 'automation' as FlowCategory,
      metadata: { templateId: 'email-responder' },
      webhookEnabled: false,
    };
  })(),
};

/**
 * File Processor Template
 * Process and manipulate files
 */
const fileProcessorTemplate: FlowTemplate = {
  templateId: 'file-processor',
  name: 'File Processor',
  description:
    'Process files - convert formats, extract data, merge documents, or generate reports from file content.',
  category: 'file-manipulation',
  icon: '📁',
  tags: ['file', 'processing', 'conversion', 'extract'],
  flowData: (() => {
    const inputFields: FlowInputField[] = [
      {
        name: 'fileContent',
        type: 'textarea',
        label: 'File Content',
        required: true,
        placeholder: 'Paste the file content here...',
        description: 'Content of the file to process',
      },
      {
        name: 'sourceFormat',
        type: 'select',
        label: 'Source Format',
        required: true,
        options: ['json', 'csv', 'xml', 'yaml', 'markdown', 'plain-text', 'html'],
        defaultValue: 'json',
        description: 'Format of the input file',
      },
      {
        name: 'operation',
        type: 'select',
        label: 'Operation',
        required: true,
        options: ['convert', 'extract', 'summarize', 'validate', 'transform', 'merge'],
        defaultValue: 'convert',
        description: 'What operation to perform',
      },
      {
        name: 'targetFormat',
        type: 'select',
        label: 'Target Format',
        required: false,
        options: ['json', 'csv', 'xml', 'yaml', 'markdown', 'plain-text', 'html'],
        defaultValue: 'csv',
        description: 'Desired output format (for conversion)',
      },
      {
        name: 'transformRules',
        type: 'textarea',
        label: 'Transformation Rules',
        required: false,
        placeholder: 'e.g., Extract only email fields, rename "firstName" to "first_name"...',
        description: 'Specific rules for transformation',
      },
    ];

    const inputNode = createInputNode(inputFields);
    const agentNode = createAgentNode(
      'File Processor Agent',
      `You are a file processing expert. Process the following file content.

SOURCE FORMAT: {{sourceFormat}}
OPERATION: {{operation}}

FILE CONTENT:
{{fileContent}}

{{#if targetFormat}}
TARGET FORMAT: {{targetFormat}}
{{/if}}

{{#if transformRules}}
TRANSFORMATION RULES:
{{transformRules}}
{{/if}}

Based on the operation:
- convert: Convert to the target format while preserving all data
- extract: Extract specific data based on the transformation rules
- summarize: Provide a summary of the file contents
- validate: Check for errors and inconsistencies
- transform: Apply the specified transformation rules
- merge: Combine with any additional provided data

Ensure the output is valid and properly formatted.`,
      [], // User will select appropriate skills (e.g., filesystem)
      120000
    );
    const outputNode = createOutputNode('text', 'response');

    const nodes = linkNodes([inputNode, agentNode, outputNode]);

    return {
      name: 'File Processor',
      slug: 'file-processor',
      description: 'Process and manipulate file content',
      nodes,
      status: 'draft' as FlowStatus,
      inputSchema: generateInputSchema(inputFields),
      outputSchema: generateOutputSchema('Processed file content'),
      isActive: false,
      version: '1.0.0',
      category: 'file-manipulation' as FlowCategory,
      metadata: { templateId: 'file-processor' },
      webhookEnabled: false,
    };
  })(),
};

// =============================================================================
// TEMPLATE REGISTRY
// =============================================================================

/**
 * All available flow templates
 */
export const flowTemplates: FlowTemplate[] = [
  webScraperTemplate,
  dataProcessorTemplate,
  apiIntegrationTemplate,
  contentWriterTemplate,
  documentAnalyzerTemplate,
  codeAssistantTemplate,
  emailResponderTemplate,
  fileProcessorTemplate,
];

/**
 * Get all templates
 */
export function getAllTemplates(): FlowTemplate[] {
  return flowTemplates;
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): FlowTemplate | undefined {
  return flowTemplates.find((t) => t.templateId === templateId);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: FlowCategory): FlowTemplate[] {
  return flowTemplates.filter((t) => t.category === category);
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query: string): FlowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return flowTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Create a new flow from a template
 * Returns flow data ready to be saved (regenerates node IDs for uniqueness)
 */
export function createFlowFromTemplate(
  templateId: string
): Omit<Flow, 'id' | 'createdAt' | 'updatedAt'> | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  // Deep clone the flow data
  const flowData = JSON.parse(JSON.stringify(template.flowData));

  // Regenerate node IDs for uniqueness
  const idMap = new Map<string, string>();
  flowData.nodes = flowData.nodes.map((node: FlowNode) => {
    const newId = generateNodeId(node.type);
    idMap.set(node.nodeId, newId);
    return { ...node, nodeId: newId };
  });

  // Update nextNodeId references
  flowData.nodes = flowData.nodes.map((node: FlowNode) => {
    if (node.nextNodeId && idMap.has(node.nextNodeId)) {
      return { ...node, nextNodeId: idMap.get(node.nextNodeId) };
    }
    return node;
  });

  // Generate a unique slug
  flowData.slug = `${flowData.slug}-${Date.now()}`;

  return flowData;
}

export default {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  createFlowFromTemplate,
};
