/**
 * Migration: Update Skill schema for Claude Agent SDK compatibility
 *
 * Changes:
 * - Add new SDK fields (mode, model, disableModelInvocation, license, trainingHistory)
 * - Add MCP relations (mcpTools, mcpServers)
 * - Add additionalFiles component
 * - Update name maxLength constraint (100 -> 64)
 * - Validate existing data
 */

module.exports = {
  async up(knex, Strapi) {
    console.log('🚀 Starting Skill schema migration for Claude Agent SDK...');

    try {
      // Check if skills table exists
      const hasTable = await knex.schema.hasTable('skills');
      if (!hasTable) {
        console.log('ℹ️  Skills table does not exist yet. Skipping data migration.');
        return;
      }

      // Fetch all existing skills
      const skills = await knex('skills').select('*');
      console.log(`📊 Found ${skills.length} existing skill(s)`);

      let warnings = 0;
      let updates = 0;

      for (const skill of skills) {
        const updateData = {};
        let hasChanges = false;

        // 1. Check name length (new max is 64, old was 100)
        if (skill.name && skill.name.length > 64) {
          console.warn(`⚠️  WARNING: Skill "${skill.name}" exceeds 64 character limit (${skill.name.length} chars)`);
          console.warn(`   You must manually rename this skill before the schema is enforced.`);
          warnings++;
        }

        // 2. Initialize new fields with defaults if they don't exist
        if (skill.mode === undefined || skill.mode === null) {
          updateData.mode = false;
          hasChanges = true;
        }

        if (!skill.model) {
          updateData.model = 'inherit';
          hasChanges = true;
        }

        if (skill.disable_model_invocation === undefined || skill.disable_model_invocation === null) {
          updateData.disable_model_invocation = false;
          hasChanges = true;
        }

        if (!skill.training_history) {
          updateData.training_history = JSON.stringify([]);
          hasChanges = true;
        }

        // 3. Update skill if there are changes
        if (hasChanges) {
          await knex('skills')
            .where({ id: skill.id })
            .update(updateData);
          updates++;
          console.log(`✅ Updated skill: ${skill.name}`);
        }
      }

      console.log('\n📈 Migration Summary:');
      console.log(`   - Skills processed: ${skills.length}`);
      console.log(`   - Skills updated: ${updates}`);
      console.log(`   - Warnings: ${warnings}`);

      if (warnings > 0) {
        console.log('\n⚠️  ACTION REQUIRED:');
        console.log(`   ${warnings} skill(s) have names longer than 64 characters.`);
        console.log('   Please rename these skills before restarting Strapi.');
      }

      console.log('\n✅ Skill schema migration completed successfully!');
      console.log('ℹ️  Note: MCP relations will be empty by default.');
      console.log('   Use the Strapi admin panel to link skills to MCP Tools/Servers.');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(knex, Strapi) {
    console.log('⏪ Rolling back Skill schema migration...');

    try {
      const hasTable = await knex.schema.hasTable('skills');
      if (!hasTable) {
        console.log('ℹ️  Skills table does not exist. Nothing to rollback.');
        return;
      }

      // Rollback: Remove new fields (set to null or default)
      const skills = await knex('skills').select('id');

      for (const skill of skills) {
        await knex('skills')
          .where({ id: skill.id })
          .update({
            mode: null,
            model: null,
            disable_model_invocation: null,
            license: null,
            training_history: null
          });
      }

      console.log(`✅ Rolled back ${skills.length} skill(s)`);
      console.log('⚠️  Note: MCP relations must be manually cleared from admin panel');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
