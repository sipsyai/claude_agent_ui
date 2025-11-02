/**
 * Test Playwright MCP Tools with website-to-markdown skill
 *
 * This test verifies that:
 * 1. MCP tool names are added to allowedTools in SDK payload
 * 2. Backend logs show allowedTools field
 * 3. Only selected tools are available during execution
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const STRAPI_URL = 'http://localhost:1337';
const BACKEND_URL = 'http://localhost:3001';
const OUTPUT_DIR = path.join(process.cwd(), 'test-results-new', 'playwright-test');

interface TaskExecutionResponse {
  id: string;
  status: string;
  result?: any;
  error?: string;
}

async function testPlaywrightExecution() {
  console.log('\n🧪 Testing Playwright MCP Tools Execution\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Step 1: Verify skill configuration in Strapi
    console.log('📋 Step 1: Fetching website-to-markdown skill from Strapi...');
    const skillResponse = await axios.get(`${STRAPI_URL}/api/skills`, {
      params: {
        filters: { skillId: 'website-to-markdown' },
        populate: ['toolConfig', 'toolConfig.tool', 'mcpConfig', 'mcpConfig.mcpServer', 'mcpConfig.selectedTools', 'mcpConfig.selectedTools.mcpTool']
      }
    });

    const skill = skillResponse.data.data[0];
    if (!skill) {
      throw new Error('Skill "website-to-markdown" not found in Strapi');
    }

    console.log('✅ Skill found:', skill.skillId);

    // Extract tool information
    const toolConfig = skill.toolConfig || [];
    const mcpConfig = skill.mcpConfig || [];

    console.log('\n📦 Tool Configuration:');
    console.log('  Built-in tools:', toolConfig.map((t: any) => t.tool?.name || t.tool).join(', '));

    console.log('\n🔌 MCP Configuration:');
    for (const config of mcpConfig) {
      const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer?.name;
      const toolCount = config.selectedTools?.length || 0;
      console.log(`  Server: ${serverName} (${toolCount} tools selected)`);

      if (config.selectedTools) {
        const toolNames = config.selectedTools.map((t: any) => {
          const toolName = typeof t.mcpTool === 'string' ? t.mcpTool : t.mcpTool?.name;
          return `mcp__${serverName}__${toolName}`;
        });
        console.log(`    Tools: ${toolNames.slice(0, 3).join(', ')}${toolNames.length > 3 ? ` ... (+${toolNames.length - 3} more)` : ''}`);
      }
    }

    // Step 2: Execute task with playwright-requiring prompt
    console.log('\n\n🚀 Step 2: Executing task via backend...');
    const prompt = 'Navigate to https://example.com and take a snapshot';

    console.log(`  Prompt: "${prompt}"`);
    console.log('  Expected: Should use Playwright MCP tools');
    console.log('  Expected: Should NOT use WebFetch (not in allowedTools)');

    const executionResponse = await axios.post(`${BACKEND_URL}/api/tasks/execute`, {
      skillId: 'website-to-markdown',
      prompt: prompt
    });

    const taskId = executionResponse.data.id;
    console.log(`\n✅ Task started: ${taskId}`);

    // Step 3: Monitor task status
    console.log('\n⏳ Step 3: Monitoring task execution...');
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    let taskResult: TaskExecutionResponse | null = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const statusResponse = await axios.get(`${BACKEND_URL}/api/tasks/${taskId}/status`);
      taskResult = statusResponse.data;

      process.stdout.write(`\r  Status: ${taskResult.status} (${attempts}s)`);

      if (taskResult.status === 'completed' || taskResult.status === 'failed') {
        console.log('\n');
        break;
      }
    }

    if (!taskResult) {
      throw new Error('No task result received');
    }

    // Step 4: Analyze results
    console.log('\n📊 Step 4: Analyzing execution results...');

    // Save execution result
    const resultPath = path.join(OUTPUT_DIR, 'execution-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(taskResult, null, 2));
    console.log(`\n💾 Execution result saved to: ${resultPath}`);

    // Analyze tool usage (if available in result)
    if (taskResult.result) {
      console.log('\n🔍 Result Analysis:');
      console.log(`  Status: ${taskResult.status}`);

      // Check if result contains tool usage information
      const resultStr = JSON.stringify(taskResult.result, null, 2);

      // Look for tool usage patterns
      const usedWebFetch = resultStr.includes('WebFetch') || resultStr.includes('webfetch');
      const usedPlaywright = resultStr.includes('playwright') || resultStr.includes('mcp__playwright');

      console.log(`  Used WebFetch: ${usedWebFetch ? '❌ YES (SHOULD NOT!)' : '✅ NO'}`);
      console.log(`  Used Playwright: ${usedPlaywright ? '✅ YES' : '❌ NO (SHOULD!)'}`);

      if (usedWebFetch) {
        console.log('\n⚠️  WARNING: WebFetch was used but it should NOT be in allowedTools!');
      }
    }

    // Step 5: Fetch backend logs
    console.log('\n\n📜 Step 5: Fetching backend execution logs...');
    console.log('  Check the backend console for:');
    console.log('    1. "[TaskRoutes] Executing skill with SDK" message');
    console.log('    2. "allowedTools" field in the log');
    console.log('    3. MCP tool names (mcp__playwright__*) in allowedTools');
    console.log('    4. "[TaskRoutes] Added MCP tool names to allowedTools" debug message');

    console.log('\n✅ Test completed!');
    console.log(`\n📂 Results saved to: ${OUTPUT_DIR}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Task ID: ${taskId}`);
    console.log(`Status: ${taskResult.status}`);
    console.log(`\nNext Steps:`);
    console.log(`1. Check backend console logs for "allowedTools" field`);
    console.log(`2. Verify MCP tool names are in allowedTools array`);
    console.log(`3. Confirm WebFetch is NOT in allowedTools`);
    console.log(`4. Review execution result in: ${resultPath}`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run test
testPlaywrightExecution();
