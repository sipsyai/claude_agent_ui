import * as fs from 'fs';
import * as path from 'path';

// Types
interface Task {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  taskType: 'skill' | 'agent';
  status: 'pending' | 'running' | 'completed' | 'failed';
  userPrompt: string;
  inputValues?: Record<string, any>;
  permissionMode?: 'default' | 'bypass' | 'auto';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  executionLog?: any[];
  metadata?: any;
}

interface SSEEvent {
  type: string;
  status?: string;
  message?: string;
  messageType?: string;
  content?: any;
  error?: string;
  timestamp: string;
}

interface TestScenario {
  name: string;
  description: string;
  taskName: string;
  agentId: string;
  taskType: 'skill' | 'agent';
  userPrompt: string;
  inputValues?: Record<string, any>;
  permissionMode?: 'default' | 'bypass' | 'auto';
  expectedStatus: 'completed' | 'failed';
  expectedEvents: string[];
}

interface SDKPayload {
  prompt: string;
  options: {
    systemPrompt: string;
    model: string;
    cwd: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    mcpServers?: Record<string, any>;
    permissionMode: string;
  };
}

interface TestResult {
  scenario: TestScenario;
  task: Task | null;
  events: SSEEvent[];
  success: boolean;
  error?: string;
  duration: number;
  eventCount: number;
  startTime: string;
  endTime: string;
  sdkPayload?: SDKPayload;
}

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const OUTPUT_DIR = path.join(process.cwd(), 'test-results-new');
const SCENARIOS_DIR = path.join(OUTPUT_DIR, 'scenarios');

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(SCENARIOS_DIR)) {
  fs.mkdirSync(SCENARIOS_DIR, { recursive: true });
}

// Test Scenarios
const scenarios: TestScenario[] = [
  {
    name: 'Scenario 1: Website-to-Markdown with toolConfig/mcpConfig',
    description: 'Test skill execution with new toolConfig and mcpConfig components',
    taskName: 'Test Website to Markdown with Playwright',
    agentId: 'w5a8pxto572zoznb5t0lsi06', // website-to-markdown documentId
    taskType: 'skill',
    userPrompt: 'Navigate to https://example.com and take a snapshot',
    inputValues: {},
    permissionMode: 'bypass',
    expectedStatus: 'completed',
    expectedEvents: ['status', 'message', 'result', 'done']
  }
];

// Helper Functions
function formatTimestamp(): string {
  return new Date().toISOString();
}

async function createTask(scenario: TestScenario): Promise<Task | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: scenario.taskName,
        agentId: scenario.agentId,
        taskType: scenario.taskType,
        userPrompt: scenario.userPrompt,
        inputValues: scenario.inputValues || {},
        permissionMode: scenario.permissionMode || 'bypass'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to create task: ${error}`);
      return null;
    }

    const data: any = await response.json();
    return data.task;
  } catch (error: any) {
    console.error(`❌ Error creating task: ${error.message}`);
    return null;
  }
}

/**
 * Reconstruct SDK payload from task and skill data
 * ✅ Updated to use toolConfig and mcpConfig components (Strapi 5)
 */
async function buildSDKPayload(task: Task, skillData: any): Promise<SDKPayload> {
  // Build skill lock warning
  const skillLockWarning = `# ⚠️ FORCED SKILL EXECUTION MODE

You are executing ONLY the "${skillData.name}" skill.
- Do NOT attempt to use any other skills or commands.
- Do NOT look for other skills in the filesystem.
- Follow ONLY the instructions defined in this skill.
- Use ONLY the tools specified in this skill's configuration.

---

`;

  // Inject parameters into skill content
  let processedContent = skillData.skillmd || skillData.content || '';
  const parameters = task.inputValues || {};

  if (Object.keys(parameters).length > 0) {
    Object.entries(parameters).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      processedContent = processedContent.replace(regex, String(value));
    });
  }

  // Build system prompt
  let systemPrompt: string;
  if (Object.keys(parameters).length > 0) {
    const paramContext = Object.entries(parameters)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    systemPrompt = skillLockWarning + `# Skill Parameters\n${paramContext}\n\n${processedContent}`;
  } else {
    systemPrompt = skillLockWarning + processedContent;
  }

  // ✅ Parse allowed tools from toolConfig component (Strapi 5)
  let allowedTools: string[] | undefined = undefined;
  let disallowedTools: string[] | undefined = undefined;

  if (skillData.toolConfig?.allowedTools) {
    if (Array.isArray(skillData.toolConfig.allowedTools)) {
      allowedTools = skillData.toolConfig.allowedTools;
    } else if (typeof skillData.toolConfig.allowedTools === 'string') {
      allowedTools = skillData.toolConfig.allowedTools.split(',').map((t: string) => t.trim());
    }
  }

  if (skillData.toolConfig?.disallowedTools) {
    if (Array.isArray(skillData.toolConfig.disallowedTools)) {
      disallowedTools = skillData.toolConfig.disallowedTools;
    }
  }

  // ✅ Build MCP servers from mcpConfig component (Strapi 5)
  let mcpServers: Record<string, any> | undefined = undefined;
  const mcpToolNames: string[] = [];

  if (skillData.mcpConfig && Array.isArray(skillData.mcpConfig) && skillData.mcpConfig.length > 0) {
    mcpServers = {};

    for (const config of skillData.mcpConfig) {
      const serverName = typeof config.mcpServer === 'string'
        ? config.mcpServer
        : config.mcpServer?.name;

      if (serverName && config.mcpServer && typeof config.mcpServer !== 'string') {
        mcpServers[serverName] = {
          command: config.mcpServer.command,
          args: config.mcpServer.args
        };

        // ✅ Collect MCP tool names from selectedTools
        if (config.selectedTools && Array.isArray(config.selectedTools)) {
          for (const toolSel of config.selectedTools) {
            const toolName = typeof toolSel.mcpTool === 'string'
              ? toolSel.mcpTool
              : toolSel.mcpTool?.name;

            if (toolName) {
              // MCP tools are prefixed with "mcp__<server-name>__<tool-name>"
              const mcpToolFullName = `mcp__${serverName}__${toolName}`;
              mcpToolNames.push(mcpToolFullName);
            }
          }
        }
      }
    }
  }

  // ✅ Add MCP tool names to allowedTools
  if (mcpToolNames.length > 0) {
    if (!allowedTools) {
      allowedTools = [];
    }
    allowedTools = [...allowedTools, ...mcpToolNames];
  }

  // Legacy fallback for old format
  if (!allowedTools && skillData.metadata?.allowedTools) {
    if (Array.isArray(skillData.metadata.allowedTools)) {
      allowedTools = skillData.metadata.allowedTools;
    } else if (typeof skillData.metadata.allowedTools === 'string') {
      allowedTools = skillData.metadata.allowedTools.split(',').map((t: string) => t.trim());
    }
  }

  // Map permission mode
  const cliPermissionMode = task.permissionMode === 'bypass' ? 'bypassPermissions' : task.permissionMode || 'default';

  return {
    prompt: task.userPrompt,
    options: {
      systemPrompt,
      model: 'claude-sonnet-4-5',
      cwd: process.cwd(),
      allowedTools,
      disallowedTools,
      mcpServers,
      permissionMode: cliPermissionMode
    }
  };
}

async function executeTask(taskId: string): Promise<TestResult['events']> {
  const events: SSEEvent[] = [];
  const url = `${BACKEND_URL}/api/tasks/${taskId}/execute`;

  console.log(`   📡 Connecting to SSE stream: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(`   ✅ Stream ended`);
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete events in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6); // Remove 'data: ' prefix

          try {
            const parsed = JSON.parse(data);
            const sseEvent: SSEEvent = {
              ...parsed,
              timestamp: formatTimestamp()
            };
            events.push(sseEvent);

            // Log event type
            if (sseEvent.type === 'status') {
              console.log(`   📊 Status: ${sseEvent.status} - ${sseEvent.message}`);
            } else if (sseEvent.type === 'message') {
              console.log(`   💬 Message: ${sseEvent.messageType}`);
            } else if (sseEvent.type === 'done') {
              console.log(`   ✅ Execution completed`);
              return events;
            }
          } catch (error: any) {
            console.error(`   ⚠️  Error parsing SSE data: ${error.message}`);
          }
        }
      }
    }

    return events;
  } catch (error: any) {
    console.error(`   ❌ SSE connection error: ${error.message}`);
    return events;
  }
}

async function getTask(taskId: string): Promise<Task | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`);
    if (!response.ok) {
      return null;
    }
    const data: any = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

async function runScenario(scenario: TestScenario): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  console.log(`${'='.repeat(80)}`);

  const startTime = formatTimestamp();
  const startMs = Date.now();

  try {
    // Step 1: Create task
    console.log(`\n1️⃣  Creating task...`);
    const task = await createTask(scenario);

    if (!task) {
      const endTime = formatTimestamp();
      const duration = Date.now() - startMs;

      return {
        scenario,
        task: null,
        events: [],
        success: false,
        error: 'Failed to create task',
        duration,
        eventCount: 0,
        startTime,
        endTime
      };
    }

    console.log(`   ✅ Task created: ${task.id}`);
    console.log(`   📝 Task name: ${task.name}`);
    console.log(`   🎯 Agent ID: ${task.agentId}`);
    console.log(`   📊 Initial status: ${task.status}`);

    // Step 2: Fetch skill data and build SDK payload
    console.log(`\n2️⃣  Fetching skill data and building SDK payload...`);
    let sdkPayload: SDKPayload | undefined;
    try {
      const skillResponse = await fetch(`http://localhost:1337/api/skills/${task.agentId}?populate[toolConfig]=true&populate[mcpConfig][populate][mcpServer]=true&populate[mcpConfig][populate][selectedTools][populate][mcpTool]=true`);
      if (skillResponse.ok) {
        const skillJson: any = await skillResponse.json();
        const skillData = skillJson.data;
        sdkPayload = await buildSDKPayload(task, skillData);
        console.log(`   ✅ SDK payload built successfully`);
        console.log(`   📝 System prompt length: ${sdkPayload.options.systemPrompt.length} chars`);
        console.log(`   🔧 Allowed tools: ${sdkPayload.options.allowedTools?.join(', ') || 'none specified'}`);
        console.log(`   🚫 Disallowed tools: ${sdkPayload.options.disallowedTools?.join(', ') || 'none'}`);
        console.log(`   🔌 MCP servers: ${sdkPayload.options.mcpServers ? Object.keys(sdkPayload.options.mcpServers).join(', ') : 'none'}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Failed to build SDK payload: ${error.message}`);
    }

    // Step 3: Execute task
    console.log(`\n3️⃣  Executing task...`);
    const events = await executeTask(task.id);

    // Step 4: Get final task state
    console.log(`\n4️⃣  Fetching final task state...`);
    const finalTask = await getTask(task.id);

    const endTime = formatTimestamp();
    const duration = Date.now() - startMs;

    const result: TestResult = {
      scenario,
      task: finalTask,
      events,
      success: finalTask ? finalTask.status === scenario.expectedStatus : false,
      duration,
      eventCount: events.length,
      startTime,
      endTime,
      sdkPayload
    };

    // Log summary
    console.log(`\n📊 Summary:`);
    console.log(`   Status: ${finalTask?.status || 'unknown'}`);
    console.log(`   Events received: ${events.length}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);

    return result;

  } catch (error: any) {
    const endTime = formatTimestamp();
    const duration = Date.now() - startMs;

    console.error(`\n❌ Scenario failed with error: ${error.message}`);

    return {
      scenario,
      task: null,
      events: [],
      success: false,
      error: error.message,
      duration,
      eventCount: 0,
      startTime,
      endTime
    };
  }
}

/**
 * Generate TypeScript code representation of SDK payload
 */
function generateTypeScriptPayload(payload: SDKPayload, scenario: TestScenario): string {
  const escapedSystemPrompt = payload.options.systemPrompt
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const allowedToolsStr = payload.options.allowedTools
    ? `[${payload.options.allowedTools.map(t => `'${t}'`).join(', ')}]`
    : 'undefined';

  const disallowedToolsStr = payload.options.disallowedTools
    ? `[${payload.options.disallowedTools.map(t => `'${t}'`).join(', ')}]`
    : 'undefined';

  const mcpServersStr = payload.options.mcpServers
    ? JSON.stringify(payload.options.mcpServers, null, 6).replace(/\n/g, '\n    ')
    : 'undefined';

  return `/**
 * SDK Payload for: ${scenario.name}
 * Generated: ${new Date().toISOString()}
 *
 * ✅ Using toolConfig and mcpConfig from Strapi 5
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const queryInstance = query({
  prompt: \`${payload.prompt}\`,
  options: {
    systemPrompt: \`${escapedSystemPrompt}\`,
    model: '${payload.options.model}',
    cwd: '${payload.options.cwd}',
    allowedTools: ${allowedToolsStr},
    disallowedTools: ${disallowedToolsStr},
    mcpServers: ${mcpServersStr},
    permissionMode: '${payload.options.permissionMode}' as any,
    stderr: (data: string) => {
      console.error('[stderr]', data);
    }
  }
});

// Stream responses
for await (const message of queryInstance) {
  console.log('Message:', message);
}
`;
}

async function saveResults(results: TestResult[]): Promise<void> {
  console.log(`\n💾 Saving results...`);

  // Save each scenario's detailed results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const scenarioNum = i + 1;

    // 1. Save complete scenario JSON
    const jsonFilename = `scenario-${scenarioNum}.json`;
    const jsonPath = path.join(SCENARIOS_DIR, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    console.log(`   ✅ Saved: ${jsonFilename}`);

    // 2. Save SDK Payload as separate JSON (if exists)
    if (result.sdkPayload) {
      const payloadFilename = `scenario-${scenarioNum}-sdk-payload.json`;
      const payloadPath = path.join(SCENARIOS_DIR, payloadFilename);
      fs.writeFileSync(payloadPath, JSON.stringify(result.sdkPayload, null, 2));
      console.log(`   📦 Saved SDK Payload: ${payloadFilename}`);

      // 3. Save SDK Payload as TypeScript code
      const tsFilename = `scenario-${scenarioNum}-sdk-payload.ts`;
      const tsPath = path.join(SCENARIOS_DIR, tsFilename);
      const tsContent = generateTypeScriptPayload(result.sdkPayload, result.scenario);
      fs.writeFileSync(tsPath, tsContent);
      console.log(`   📦 Saved SDK Payload (TS): ${tsFilename}`);

      // 4. Save System Prompt as separate markdown file
      const promptFilename = `scenario-${scenarioNum}-system-prompt.md`;
      const promptPath = path.join(SCENARIOS_DIR, promptFilename);
      fs.writeFileSync(promptPath, result.sdkPayload.options.systemPrompt);
      console.log(`   📄 Saved System Prompt: ${promptFilename}`);
    }
  }

  // Save summary
  const summary = {
    totalScenarios: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalEvents: results.reduce((sum, r) => sum + r.eventCount, 0),
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    results: results.map(r => ({
      name: r.scenario.name,
      success: r.success,
      status: r.task?.status,
      eventCount: r.eventCount,
      duration: r.duration,
      error: r.error
    })),
    timestamp: formatTimestamp()
  };

  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`   ✅ Saved: summary.json`);
}

// Main execution
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║              TASK EXECUTION TEST - toolConfig/mcpConfig                    ║
║                                                                            ║
║  Testing backend task execution with new Strapi 5 component structure     ║
║  Backend URL: ${BACKEND_URL.padEnd(56)}║
║  Output Directory: ${OUTPUT_DIR.padEnd(49)}║
╚════════════════════════════════════════════════════════════════════════════╝
`);

  const allResults: TestResult[] = [];

  // Run all scenarios
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    allResults.push(result);

    // Wait a bit between scenarios
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Save all results
  await saveResults(allResults);

  // Print final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 FINAL SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total Scenarios: ${allResults.length}`);
  console.log(`Successful: ${allResults.filter(r => r.success).length} ✅`);
  console.log(`Failed: ${allResults.filter(r => r.success).length} ❌`);
  console.log(`Total Events Captured: ${allResults.reduce((sum, r) => sum + r.eventCount, 0)}`);
  console.log(`Total Duration: ${allResults.reduce((sum, r) => sum + r.duration, 0)}ms`);
  console.log(`\n📁 Results saved to: ${OUTPUT_DIR}`);
  console.log(`${'='.repeat(80)}\n`);

  // Individual scenario results
  console.log(`\n📋 Scenario Results:`);
  allResults.forEach((result, index) => {
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`\n${index + 1}. ${statusIcon} ${result.scenario.name}`);
    console.log(`   Status: ${result.task?.status || 'N/A'}`);
    console.log(`   Events: ${result.eventCount}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}

// Run the tests
main().catch(console.error);
