/**
 * Agent Data Migration Script
 *
 * This script migrates existing Agent data from the old schema to the new component-based schema.
 *
 * Old Schema (JSON fields):
 * - tools (JSON)
 * - disallowedTools (JSON)
 * - model (enum)
 * - metadata (JSON)
 * - executionCount, lastExecutedAt, averageExecutionTime (flat fields)
 *
 * New Schema (Components):
 * - toolConfig (component: agent.tool-configuration)
 * - modelConfig (component: agent.model-configuration)
 * - analytics (component: agent.analytics)
 * - metadata (component: shared.metadata, repeatable)
 * - slug (new UID field)
 *
 * Usage:
 * node scripts/migrate-agent-data.js
 *
 * Or from Strapi:
 * npm run strapi script migrate-agent-data.js
 */

const Strapi = require('@strapi/strapi');

/**
 * Generate slug from name
 */
function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Convert old metadata JSON to new metadata component array
 */
function convertMetadata(oldMetadata) {
  if (!oldMetadata || typeof oldMetadata !== 'object') {
    return [];
  }

  return Object.entries(oldMetadata).map(([key, value]) => {
    let type = 'string';
    let stringValue = String(value);

    // Detect type
    if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    } else if (value instanceof Date) {
      type = 'date';
      stringValue = value.toISOString();
    } else if (typeof value === 'object') {
      type = 'json';
      stringValue = JSON.stringify(value);
    }

    return {
      key,
      value: stringValue,
      type,
      description: `Migrated from old metadata field`,
    };
  });
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting Agent data migration...\n');

  const strapi = await Strapi().load();
  let migratedCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    // Fetch all existing agents with raw database query to get old schema data
    // Note: This bypasses Strapi's entity service to get the old structure
    const db = strapi.db.connection;
    const oldAgents = await db('agents').select('*');

    console.log(`Found ${oldAgents.length} agents to migrate\n`);

    for (const oldAgent of oldAgents) {
      try {
        console.log(`Migrating: ${oldAgent.name} (ID: ${oldAgent.id})`);

        // Generate slug
        const slug = oldAgent.slug || generateSlug(oldAgent.name);

        // Prepare new agent data
        const newAgentData = {
          // Basic fields (no change)
          name: oldAgent.name,
          slug: slug,
          description: oldAgent.description,
          systemPrompt: oldAgent.system_prompt,
          enabled: oldAgent.enabled ?? true,

          // Tool configuration component
          toolConfig: {
            allowedTools: oldAgent.tools || [],
            disallowedTools: oldAgent.disallowed_tools || [],
            toolPermissions: {},
            inheritFromParent: true,
          },

          // Model configuration component
          modelConfig: {
            model: oldAgent.model || 'sonnet',
            temperature: 1.0,
            timeout: 300000,
            stopSequences: [],
          },

          // Analytics component
          analytics: {
            executionCount: oldAgent.execution_count || 0,
            lastExecutedAt: oldAgent.last_executed_at || null,
            averageExecutionTime: parseInt(oldAgent.average_execution_time || 0),
            totalExecutionTime: '0',
            successCount: 0,
            failureCount: 0,
            successRate: 0,
            lastCalculatedAt: new Date(),
          },

          // Metadata component (convert from JSON to repeatable component)
          metadata: convertMetadata(oldAgent.metadata),
        };

        // Update agent using Strapi entity service
        await strapi.entityService.update('api::agent.agent', oldAgent.id, {
          data: newAgentData,
        });

        console.log(`✅ Successfully migrated: ${oldAgent.name}\n`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating agent ${oldAgent.name}:`, error.message);
        errors.push({
          agent: oldAgent.name,
          id: oldAgent.id,
          error: error.message,
        });
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total: ${oldAgents.length}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.agent} (ID: ${err.id}): ${err.error}`);
      });
    }

    console.log('\n✨ Migration completed!\n');

    // Verify migration
    console.log('Verifying migration...');
    const verifiedAgents = await strapi.entityService.findMany('api::agent.agent', {
      populate: {
        toolConfig: true,
        modelConfig: true,
        analytics: true,
        metadata: true,
      },
    });

    console.log(`Verified ${verifiedAgents.length} agents with new schema`);

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  } finally {
    await strapi.destroy();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('🎉 Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
