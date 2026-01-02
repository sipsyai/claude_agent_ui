import type { Schema, Struct } from '@strapi/strapi';

export interface AgentAgentSelection extends Struct.ComponentSchema {
  collectionName: 'components_agent_agent_selections';
  info: {
    description: 'Agent selection component with enabled flag and metadata';
    displayName: 'Agent Selection';
  };
  attributes: {
    agent: Schema.Attribute.Relation<'oneToOne', 'api::agent.agent'> &
      Schema.Attribute.Required;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
  };
}

export interface AgentAnalytics extends Struct.ComponentSchema {
  collectionName: 'components_agent_analytics';
  info: {
    description: 'Execution metrics and analytics for agents';
    displayName: 'Analytics';
    icon: 'chartLine';
  };
  attributes: {
    averageExecutionTime: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    executionCount: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    failureCount: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    lastCalculatedAt: Schema.Attribute.DateTime;
    lastExecutedAt: Schema.Attribute.DateTime;
    successCount: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    successRate: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    totalExecutionTime: Schema.Attribute.BigInteger &
      Schema.Attribute.SetMinMax<
        {
          min: '0';
        },
        string
      > &
      Schema.Attribute.DefaultTo<'0'>;
  };
}

export interface AgentModelConfiguration extends Struct.ComponentSchema {
  collectionName: 'components_agent_model_configurations';
  info: {
    description: 'AI model settings and configuration';
    displayName: 'Model Configuration';
    icon: 'brain';
  };
  attributes: {
    maxTokens: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 200000;
          min: 1;
        },
        number
      >;
    model: Schema.Attribute.Enumeration<
      ['haiku', 'sonnet', 'sonnet-4', 'opus', 'opus-4']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'sonnet'>;
    stopSequences: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    temperature: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    timeout: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1000;
        },
        number
      > &
      Schema.Attribute.DefaultTo<300000>;
    topK: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    topP: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      >;
  };
}

export interface AgentToolConfiguration extends Struct.ComponentSchema {
  collectionName: 'components_agent_tool_configurations';
  info: {
    description: 'Tool permissions and configuration for agents';
    displayName: 'Tool Configuration';
    icon: 'cog';
  };
  attributes: {
    allowedTools: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    disallowedTools: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    inheritFromParent: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    toolPermissions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
  };
}

export interface FlowAgentNode extends Struct.ComponentSchema {
  collectionName: 'components_flow_agent_nodes';
  info: {
    description: 'Flow node for executing an agent with configured skills';
    displayName: 'Agent Node';
    icon: 'robot';
  };
  attributes: {
    agent: Schema.Attribute.Relation<'oneToOne', 'api::agent.agent'> &
      Schema.Attribute.Required;
    description: Schema.Attribute.Text;
    maxRetries: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 10;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<3>;
    maxTokens: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 200000;
          min: 1;
        },
        number
      >;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    modelOverride: Schema.Attribute.Enumeration<
      ['default', 'haiku', 'sonnet', 'sonnet-4', 'opus', 'opus-4']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Agent'>;
    nextNodeId: Schema.Attribute.String;
    nodeId: Schema.Attribute.String & Schema.Attribute.Required;
    position: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<{
        x: 0;
        y: 100;
      }>;
    promptTemplate: Schema.Attribute.Text & Schema.Attribute.Required;
    retryOnError: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    skills: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    timeout: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1000;
        },
        number
      > &
      Schema.Attribute.DefaultTo<300000>;
  };
}

export interface FlowInputNode extends Struct.ComponentSchema {
  collectionName: 'components_flow_input_nodes';
  info: {
    description: 'Flow input node for defining inputs the flow accepts';
    displayName: 'Input Node';
    icon: 'login';
  };
  attributes: {
    description: Schema.Attribute.Text;
    inputFields: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<[]>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Input'>;
    nextNodeId: Schema.Attribute.String;
    nodeId: Schema.Attribute.String & Schema.Attribute.Required;
    position: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<{
        x: 0;
        y: 0;
      }>;
    validationRules: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
  };
}

export interface FlowOutputNode extends Struct.ComponentSchema {
  collectionName: 'components_flow_output_nodes';
  info: {
    description: 'Flow output node for defining how results are delivered';
    displayName: 'Output Node';
    icon: 'logout';
  };
  attributes: {
    description: Schema.Attribute.Text;
    fileName: Schema.Attribute.String;
    filePath: Schema.Attribute.String;
    format: Schema.Attribute.Enumeration<
      ['json', 'markdown', 'text', 'html', 'csv', 'zip']
    > &
      Schema.Attribute.DefaultTo<'json'>;
    includeMetadata: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    includeTimestamp: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Output'>;
    nodeId: Schema.Attribute.String & Schema.Attribute.Required;
    outputType: Schema.Attribute.Enumeration<
      ['response', 'file', 'database', 'webhook', 'email']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'response'>;
    position: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<{
        x: 0;
        y: 200;
      }>;
    saveToFile: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    transformTemplate: Schema.Attribute.Text;
    webhookHeaders: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    webhookUrl: Schema.Attribute.String;
  };
}

export interface FlowSchedule extends Struct.ComponentSchema {
  collectionName: 'components_flow_schedules';
  info: {
    description: 'Schedule configuration for automated flow execution';
    displayName: 'Schedule';
    icon: 'clock';
  };
  attributes: {
    cronExpression: Schema.Attribute.String;
    defaultInput: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    endDate: Schema.Attribute.DateTime;
    intervalUnit: Schema.Attribute.Enumeration<
      ['minutes', 'hours', 'days', 'weeks']
    > &
      Schema.Attribute.DefaultTo<'minutes'>;
    intervalValue: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<60>;
    isEnabled: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    lastRunAt: Schema.Attribute.DateTime;
    maxRetries: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 10;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<3>;
    maxRuns: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    nextRunAt: Schema.Attribute.DateTime;
    retryDelayMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<5>;
    retryOnFailure: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    runCount: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    scheduleType: Schema.Attribute.Enumeration<['once', 'cron', 'interval']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'interval'>;
    startDate: Schema.Attribute.DateTime;
    timezone: Schema.Attribute.String & Schema.Attribute.DefaultTo<'UTC'>;
  };
}

export interface McpServerSelection extends Struct.ComponentSchema {
  collectionName: 'components_mcp_server_selections';
  info: {
    description: 'Select and configure MCP servers from the MCP Server collection';
    displayName: 'MCP Server Selection';
    icon: 'server';
  };
  attributes: {
    customArgs: Schema.Attribute.JSON;
    customEnv: Schema.Attribute.JSON;
    customStartupTimeout: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 300000;
          min: 1000;
        },
        number
      >;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    mcpServer: Schema.Attribute.Relation<
      'oneToOne',
      'api::mcp-server.mcp-server'
    > &
      Schema.Attribute.Required;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    selectedTools: Schema.Attribute.Component<'mcp.tool-selection', true>;
  };
}

export interface McpToolSelection extends Struct.ComponentSchema {
  collectionName: 'components_mcp_tool_selections';
  info: {
    description: 'Select and configure MCP tools from the MCP Tool collection';
    displayName: 'MCP Tool Selection';
    icon: 'puzzle';
  };
  attributes: {
    customConfig: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    mcpTool: Schema.Attribute.Relation<'oneToOne', 'api::mcp-tool.mcp-tool'>;
    permissions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
  };
}

export interface SharedMetadata extends Struct.ComponentSchema {
  collectionName: 'components_shared_metadata';
  info: {
    description: 'Key-value metadata pairs for flexible data storage';
    displayName: 'Metadata';
    icon: 'tag';
  };
  attributes: {
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
        minLength: 1;
      }>;
    type: Schema.Attribute.Enumeration<
      ['string', 'number', 'boolean', 'json', 'date']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'string'>;
    value: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 5000;
      }>;
  };
}

export interface SkillInputField extends Struct.ComponentSchema {
  collectionName: 'components_skill_input_fields';
  info: {
    description: 'Dynamic form field for skill execution';
    displayName: 'Input Field';
    icon: 'textField';
  };
  attributes: {
    default: Schema.Attribute.JSON;
    description: Schema.Attribute.Text;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    options: Schema.Attribute.JSON;
    placeholder: Schema.Attribute.String;
    required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    type: Schema.Attribute.Enumeration<
      [
        'text',
        'textarea',
        'dropdown',
        'multiselect',
        'checkbox',
        'number',
        'filepath',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'text'>;
  };
}

export interface SkillSkillFile extends Struct.ComponentSchema {
  collectionName: 'components_skill_skill_files';
  info: {
    description: 'Additional documentation files for skills (REFERENCE.md, EXAMPLES.md, TROUBLESHOOTING.md, etc.)';
    displayName: 'Skill File';
    icon: 'fileText';
  };
  attributes: {
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    displayOrder: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    file: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    fileType: Schema.Attribute.Enumeration<
      [
        'REFERENCE',
        'EXAMPLES',
        'TROUBLESHOOTING',
        'CHANGELOG',
        'FAQ',
        'API_DOCS',
        'TUTORIAL',
        'CUSTOM',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'REFERENCE'>;
  };
}

export interface SkillSkillSelection extends Struct.ComponentSchema {
  collectionName: 'components_skill_skill_selections';
  info: {
    description: 'Skill selection component with enabled flag and metadata';
    displayName: 'Skill Selection';
  };
  attributes: {
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    skill: Schema.Attribute.Relation<'oneToOne', 'api::skill.skill'> &
      Schema.Attribute.Required;
  };
}

export interface SkillTrainingSession extends Struct.ComponentSchema {
  collectionName: 'components_skill_training_sessions';
  info: {
    description: 'Training session record with scores, issues, and improvements';
    displayName: 'Training Session';
    icon: 'graduationCap';
  };
  attributes: {
    improvements: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    issues: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    notes: Schema.Attribute.Text;
    score: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    success: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    timestamp: Schema.Attribute.DateTime & Schema.Attribute.Required;
    trainedBy: Schema.Attribute.String;
    trainingType: Schema.Attribute.Enumeration<
      ['automatic', 'manual', 'feedback', 'evaluation']
    > &
      Schema.Attribute.DefaultTo<'automatic'>;
  };
}

export interface TaskTaskSelection extends Struct.ComponentSchema {
  collectionName: 'components_task_task_selections';
  info: {
    description: 'Task selection component with enabled flag and metadata';
    displayName: 'Task Selection';
  };
  attributes: {
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    task: Schema.Attribute.Relation<'oneToOne', 'api::task.task'> &
      Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'agent.agent-selection': AgentAgentSelection;
      'agent.analytics': AgentAnalytics;
      'agent.model-configuration': AgentModelConfiguration;
      'agent.tool-configuration': AgentToolConfiguration;
      'flow.agent-node': FlowAgentNode;
      'flow.input-node': FlowInputNode;
      'flow.output-node': FlowOutputNode;
      'flow.schedule': FlowSchedule;
      'mcp.server-selection': McpServerSelection;
      'mcp.tool-selection': McpToolSelection;
      'shared.metadata': SharedMetadata;
      'skill.input-field': SkillInputField;
      'skill.skill-file': SkillSkillFile;
      'skill.skill-selection': SkillSkillSelection;
      'skill.training-session': SkillTrainingSession;
      'task.task-selection': TaskTaskSelection;
    }
  }
}
