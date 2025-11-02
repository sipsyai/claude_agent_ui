#!/usr/bin/env tsx
/**
 * Migration Script: Import Training Agent to Strapi
 *
 * This script:
 * 1. Reads training-agent.md from .claude/agents/
 * 2. Parses frontmatter and content
 * 3. Creates agent in Strapi database
 * 4. Sets it as default training agent in config
 *
 * Usage:
 *   npm run import-training-agent
 */

import { ClaudeStructureParser } from '../src/services/claude-structure-parser.js';
import { strapiClient } from '../src/services/strapi-client.js';
import { ConfigService } from '../src/services/config-service.js';
import { createLogger } from '../src/services/logger.js';

const logger = createLogger('ImportTrainingAgent');

async function importTrainingAgent() {
  try {
    logger.info('🚀 Starting training agent import...');

    // Step 1: Parse local training agent
    logger.info('📂 Parsing local training-agent.md...');
    const parser = new ClaudeStructureParser();
    const projectPath = process.cwd();
    const agents = await parser.parseAgents(projectPath);
    const trainingAgent = agents.find(a => a.id === 'training-agent');

    if (!trainingAgent) {
      logger.error('❌ training-agent.md not found in .claude/agents/');
      console.error('ERROR: training-agent.md not found in .claude/agents/');
      console.error('Please ensure training-agent.md exists before running this script.');
      process.exit(1);
    }

    logger.info('✅ Training agent found', {
      id: trainingAgent.id,
      name: trainingAgent.name,
      description: trainingAgent.description
    });

    // Step 2: Check if agent already exists in Strapi
    logger.info('🔍 Checking if training agent already exists in Strapi...');
    const existingAgents = await strapiClient.getAllAgents();
    const existingAgent = existingAgents.find(a =>
      a.name === trainingAgent.name ||
      a.description === trainingAgent.description ||
      a.systemPrompt === trainingAgent.content
    );

    if (existingAgent) {
      logger.warn('⚠️  Training agent already exists in Strapi', {
        id: existingAgent.id,
        name: existingAgent.name
      });

      console.log(`\n⚠️  Training agent already exists in Strapi:`);
      console.log(`   ID: ${existingAgent.id}`);
      console.log(`   Name: ${existingAgent.name}`);
      console.log(`\nDo you want to use this existing agent as the default training agent? (y/n)`);

      // Simple readline for user confirmation
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('', (ans) => {
          rl.close();
          resolve(ans.toLowerCase());
        });
      });

      if (answer !== 'y' && answer !== 'yes') {
        logger.info('❌ Import cancelled by user');
        console.log('Import cancelled.');
        process.exit(0);
      }

      // Use existing agent
      const configService = ConfigService.getInstance();
      await configService.initialize();
      await configService.updateConfig({
        trainingAgentId: existingAgent.id
      });

      logger.info('✅ Existing training agent set as default', {
        id: existingAgent.id,
        name: existingAgent.name
      });

      console.log(`\n✅ Existing training agent set as default:`);
      console.log(`   ID: ${existingAgent.id}`);
      console.log(`   Name: ${existingAgent.name}`);
      console.log(`\n🎉 Import completed successfully!`);

      return;
    }

    // Step 3: Create agent in Strapi
    logger.info('📝 Creating training agent in Strapi...');

    const agentData = {
      name: trainingAgent.name,
      description: trainingAgent.description || 'Specialized agent for training and evaluating skills',
      systemPrompt: trainingAgent.content,
      tools: trainingAgent.metadata?.tools || trainingAgent.metadata?.allowedTools || [],
      disallowedTools: [],
      model: trainingAgent.metadata?.model || 'sonnet',
      enabled: true,
      metadata: {
        ...trainingAgent.metadata,
        isTrainingAgent: true, // Mark as training agent for UI filtering
        importedFrom: 'local-filesystem',
        importedAt: new Date().toISOString()
      }
    };

    const createdAgent = await strapiClient.createAgent(agentData as any);

    logger.info('✅ Training agent created in Strapi', {
      id: createdAgent.id,
      name: createdAgent.name
    });

    console.log(`\n✅ Training agent created in Strapi:`);
    console.log(`   ID: ${createdAgent.id}`);
    console.log(`   Name: ${createdAgent.name}`);
    console.log(`   Description: ${createdAgent.description}`);

    // Step 4: Set as default in config
    logger.info('⚙️  Setting as default training agent in config...');

    const configService = ConfigService.getInstance();
    await configService.initialize();
    await configService.updateConfig({
      trainingAgentId: createdAgent.id
    });

    logger.info('✅ Config updated', { trainingAgentId: createdAgent.id });

    console.log(`\n✅ Set as default training agent in config`);
    console.log(`\n🎉 Import completed successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  1. Restart the server: npm start`);
    console.log(`  2. Open Manager UI: http://localhost:3001/manager`);
    console.log(`  3. Go to Settings to verify training agent configuration`);

  } catch (error) {
    logger.error('❌ Import failed', error);
    console.error('\n❌ Import failed:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the migration
importTrainingAgent();
