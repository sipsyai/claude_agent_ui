#!/usr/bin/env tsx

/**
 * End-to-End Test: Create and Verify All Entity Types
 *
 * This script tests the complete PostgreSQL migration by:
 * 1. Creating test data for all 7 entity types via Strapi API
 * 2. Verifying correct storage and retrieval
 * 3. Testing relations between entities
 *
 * Entity types tested:
 * - agents
 * - skills
 * - mcp-servers
 * - tasks
 * - chat-sessions
 * - chat-messages
 * - mcp-tools
 */

import http from 'http';

// Configuration
const STRAPI_URL = process.env.STRAPI_API_URL || 'http://localhost:1337/api';
const STRAPI_BASE_URL = STRAPI_URL.replace('/api', '');

interface TestResult {
  entity: string;
  operation: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

const testResults: TestResult[] = [];

// Helper function to make HTTP requests
function makeRequest(
  method: string,
  path: string,
  data?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, STRAPI_BASE_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      const body = JSON.stringify(data);
      options.headers!['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${parsed.error?.message || responseData}`
              )
            );
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test result logging
function logResult(result: TestResult) {
  testResults.push(result);
  const icon = result.success ? '✅' : '❌';
  console.log(
    `${icon} ${result.entity} - ${result.operation}: ${result.message}`
  );
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

// Test 1: Create and verify MCP Server
async function testMcpServer(): Promise<number | null> {
  const entityType = 'mcp-server';
  const testData = {
    data: {
      name: 'Test MCP Server E2E',
      description: 'Test MCP server for E2E validation',
      command: 'node',
      args: ['test-server.js'],
      env: { TEST_MODE: 'true' },
      disabled: false,
      transport: 'stdio',
      startupTimeout: 30000,
      restartPolicy: 'on-failure',
      isHealthy: true,
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity
    const isValid =
      retrieved.name === testData.data.name &&
      retrieved.description === testData.data.description &&
      retrieved.command === testData.data.command &&
      retrieved.transport === testData.data.transport;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid,
      message: isValid
        ? 'Data integrity verified'
        : 'Data mismatch detected',
      data: retrieved,
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Test 2: Create and verify MCP Tool (with relation to MCP Server)
async function testMcpTool(mcpServerId: number | null): Promise<number | null> {
  const entityType = 'mcp-tool';
  const testData = {
    data: {
      name: 'test_tool_e2e',
      description: 'Test tool for E2E validation',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
      ...(mcpServerId && { mcpServer: mcpServerId }),
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}?populate=*`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity and relation
    const isValid =
      retrieved.name === testData.data.name &&
      retrieved.description === testData.data.description;

    const hasRelation = mcpServerId
      ? retrieved.mcpServer?.data?.id === mcpServerId
      : true;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid && hasRelation,
      message: isValid && hasRelation
        ? 'Data integrity and relation verified'
        : 'Data mismatch or relation issue',
      data: { ...retrieved, relationVerified: hasRelation },
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Test 3: Create and verify Skill
async function testSkill(): Promise<number | null> {
  const entityType = 'skill';
  const testData = {
    data: {
      name: 'test-skill-e2e',
      displayName: 'Test Skill E2E',
      description: 'Test skill for E2E validation of PostgreSQL migration',
      skillmd: `# Test Skill

This is a test skill for E2E validation.

## Instructions
- Test instruction 1
- Test instruction 2

## Examples
Example usage here.
`,
      experienceScore: 0,
      category: 'custom',
      isPublic: true,
      version: '1.0.0',
      license: 'MIT',
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity
    const isValid =
      retrieved.name === testData.data.name &&
      retrieved.displayName === testData.data.displayName &&
      retrieved.description === testData.data.description &&
      retrieved.category === testData.data.category;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid,
      message: isValid
        ? 'Data integrity verified'
        : 'Data mismatch detected',
      data: retrieved,
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Test 4: Create and verify Agent (with components and relations)
async function testAgent(
  skillId: number | null,
  mcpServerId: number | null
): Promise<number | null> {
  const entityType = 'agent';
  const testData = {
    data: {
      name: 'Test Agent E2E',
      description: 'Test agent for E2E validation',
      systemPrompt: 'You are a test agent for E2E validation of the PostgreSQL migration. Your role is to verify that all entity types can be created and retrieved correctly.',
      enabled: true,
      modelConfig: {
        model: 'sonnet',
        temperature: 1.0,
        maxTokens: 4096,
        timeout: 300000,
      },
      toolConfig: {
        allowedTools: ['Read', 'Write', 'Bash'],
        disallowedTools: [],
        inheritFromParent: true,
      },
      analytics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
      },
      ...(skillId && {
        skillSelection: [
          {
            skill: skillId,
            enabled: true,
          },
        ],
      }),
      ...(mcpServerId && {
        mcpConfig: [
          {
            mcpServer: mcpServerId,
            enabled: true,
          },
        ],
      }),
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}?populate=deep`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity
    const isValid =
      retrieved.name === testData.data.name &&
      retrieved.description === testData.data.description &&
      retrieved.enabled === testData.data.enabled &&
      retrieved.modelConfig?.model === testData.data.modelConfig.model;

    // Verify components
    const hasModelConfig = !!retrieved.modelConfig;
    const hasToolConfig = !!retrieved.toolConfig;
    const hasAnalytics = !!retrieved.analytics;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid && hasModelConfig && hasToolConfig,
      message: isValid && hasModelConfig && hasToolConfig
        ? 'Data integrity and components verified'
        : 'Data mismatch or missing components',
      data: {
        ...retrieved,
        components: { hasModelConfig, hasToolConfig, hasAnalytics },
      },
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Test 5: Create and verify Task
async function testTask(): Promise<number | null> {
  const entityType = 'task';
  const now = new Date().toISOString();
  const testData = {
    data: {
      message: 'Test task for E2E validation',
      status: 'completed',
      result: {
        output: 'Test completed successfully',
        files: [],
      },
      startedAt: now,
      completedAt: now,
      executionTime: 1234,
      tokensUsed: 500,
      cost: 0.01,
      metadata: {
        testRun: true,
        timestamp: now,
      },
      executionLog: [
        { timestamp: now, message: 'Task started' },
        { timestamp: now, message: 'Task completed' },
      ],
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity
    const isValid =
      retrieved.message === testData.data.message &&
      retrieved.status === testData.data.status &&
      retrieved.executionTime === testData.data.executionTime &&
      retrieved.tokensUsed === testData.data.tokensUsed;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid,
      message: isValid
        ? 'Data integrity verified'
        : 'Data mismatch detected',
      data: retrieved,
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Test 6: Create and verify Chat Session (with relations)
async function testChatSession(
  agentId: number | null,
  skillId: number | null
): Promise<number | null> {
  const entityType = 'chat-session';
  const testData = {
    data: {
      title: 'Test Chat Session E2E',
      status: 'active',
      sessionId: `test-session-${Date.now()}`,
      permissionMode: 'default',
      planMode: false,
      ...(agentId && { agent: agentId }),
      ...(skillId && { skills: [skillId] }),
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}?populate=*`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity
    const isValid =
      retrieved.title === testData.data.title &&
      retrieved.status === testData.data.status &&
      retrieved.sessionId === testData.data.sessionId;

    // Verify relations
    const hasAgentRelation = agentId
      ? retrieved.agent?.data?.id === agentId
      : true;
    const hasSkillRelation = skillId
      ? retrieved.skills?.data?.some((s: any) => s.id === skillId)
      : true;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid && hasAgentRelation && hasSkillRelation,
      message:
        isValid && hasAgentRelation && hasSkillRelation
          ? 'Data integrity and relations verified'
          : 'Data mismatch or relation issue',
      data: {
        ...retrieved,
        relations: { hasAgentRelation, hasSkillRelation },
      },
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Test 7: Create and verify Chat Message (with relation to Chat Session)
async function testChatMessage(
  chatSessionId: number | null
): Promise<number | null> {
  const entityType = 'chat-message';
  const now = new Date().toISOString();
  const testData = {
    data: {
      role: 'user',
      content: 'This is a test message for E2E validation',
      timestamp: now,
      attachments: [],
      metadata: {
        testRun: true,
        timestamp: now,
      },
      ...(chatSessionId && { session: chatSessionId }),
    },
  };

  try {
    // Create
    const createResponse = await makeRequest(
      'POST',
      `/api/${entityType}s`,
      testData
    );
    const createdId = createResponse.data?.id;

    if (!createdId) {
      logResult({
        entity: entityType,
        operation: 'create',
        success: false,
        message: 'Failed to get created ID',
        error: 'No ID in response',
      });
      return null;
    }

    logResult({
      entity: entityType,
      operation: 'create',
      success: true,
      message: `Created with ID ${createdId}`,
      data: { id: createdId },
    });

    // Retrieve and verify
    const getResponse = await makeRequest(
      'GET',
      `/api/${entityType}s/${createdId}?populate=*`
    );
    const retrieved = getResponse.data?.attributes;

    if (!retrieved) {
      logResult({
        entity: entityType,
        operation: 'retrieve',
        success: false,
        message: 'Failed to retrieve created entity',
        error: 'No data in response',
      });
      return createdId;
    }

    // Verify data integrity
    const isValid =
      retrieved.role === testData.data.role &&
      retrieved.content === testData.data.content;

    // Verify relation
    const hasSessionRelation = chatSessionId
      ? retrieved.session?.data?.id === chatSessionId
      : true;

    logResult({
      entity: entityType,
      operation: 'retrieve',
      success: isValid && hasSessionRelation,
      message:
        isValid && hasSessionRelation
          ? 'Data integrity and relation verified'
          : 'Data mismatch or relation issue',
      data: { ...retrieved, relationVerified: hasSessionRelation },
    });

    return createdId;
  } catch (error) {
    logResult({
      entity: entityType,
      operation: 'create/retrieve',
      success: false,
      message: 'Operation failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Main test execution
async function runTests() {
  console.log('\n=================================================');
  console.log('PostgreSQL E2E Entity Test');
  console.log('=================================================\n');
  console.log(`Testing against: ${STRAPI_BASE_URL}\n`);

  console.log('Running tests in order (respecting dependencies)...\n');

  // Test entities in dependency order
  console.log('Phase 1: Independent entities');
  console.log('─────────────────────────────');
  const mcpServerId = await testMcpServer();
  const skillId = await testSkill();
  const taskId = await testTask();

  console.log('\nPhase 2: Dependent entities');
  console.log('─────────────────────────────');
  const mcpToolId = await testMcpTool(mcpServerId);
  const agentId = await testAgent(skillId, mcpServerId);

  console.log('\nPhase 3: Chat entities');
  console.log('─────────────────────────────');
  const chatSessionId = await testChatSession(agentId, skillId);
  const chatMessageId = await testChatMessage(chatSessionId);

  // Generate report
  console.log('\n=================================================');
  console.log('Test Results Summary');
  console.log('=================================================\n');

  const passed = testResults.filter((r) => r.success).length;
  const failed = testResults.filter((r) => !r.success).length;
  const total = testResults.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // Group by entity
  const byEntity = new Map<string, TestResult[]>();
  testResults.forEach((result) => {
    if (!byEntity.has(result.entity)) {
      byEntity.set(result.entity, []);
    }
    byEntity.get(result.entity)!.push(result);
  });

  console.log('Results by Entity:');
  console.log('─────────────────────────────');
  byEntity.forEach((results, entity) => {
    const entityPassed = results.filter((r) => r.success).length;
    const entityTotal = results.length;
    const icon = entityPassed === entityTotal ? '✅' : '❌';
    console.log(`${icon} ${entity}: ${entityPassed}/${entityTotal} passed`);
  });

  // Created entity IDs
  console.log('\nCreated Entity IDs:');
  console.log('─────────────────────────────');
  console.log(`MCP Server: ${mcpServerId || 'FAILED'}`);
  console.log(`MCP Tool: ${mcpToolId || 'FAILED'}`);
  console.log(`Skill: ${skillId || 'FAILED'}`);
  console.log(`Agent: ${agentId || 'FAILED'}`);
  console.log(`Task: ${taskId || 'FAILED'}`);
  console.log(`Chat Session: ${chatSessionId || 'FAILED'}`);
  console.log(`Chat Message: ${chatMessageId || 'FAILED'}`);

  // Generate JSON report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    totalTests: total,
    passed,
    failed,
    results: testResults,
  };

  const reportPath = './test-results/e2e-entities-report.json';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
  } catch (error) {
    console.warn(`\nWarning: Could not save report: ${error}`);
  }

  console.log('\n=================================================\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});
