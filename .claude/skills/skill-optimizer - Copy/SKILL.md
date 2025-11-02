---
name: skill-optimizer
description: Analyzes existing skills by executing them, examining execution logs, and optimizing them according to best practices. Use when you need to improve skill performance, identify bottlenecks, or refactor skills for better efficiency.
version: 1.0.0
category: development
---

# Skill Optimizer

Automatically optimizes existing Claude skills by running them, analyzing execution logs, and applying best practices to improve performance and reliability.

## Quick Start

```
Progress Checklist:
- [ ] Get target skill name from user
- [ ] Read current skill file
- [ ] Create and execute test task
- [ ] Analyze execution logs
- [ ] Identify bottlenecks and issues
- [ ] Generate optimized skill version
- [ ] Provide optimized skillmd for update
```

## Step 1: Get Target Skill

Ask the user which skill they want to optimize:
- Skill name (e.g., "rpa-challenge", "pdf-analyzer")
- Any specific test parameters or input needed

## Step 2: Read Current Skill

Read the current skill file from `.claude/skills/{skill-name}/SKILL.md`:

```bash
Read: .claude/skills/{skill-name}/SKILL.md
```

Parse the skill structure:
- Extract frontmatter (name, description, version, category)
- Extract skillmd content
- Note current version number for incrementing

## Step 3: Create Test Task via API

Create a new task to test the skill using the API:

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{skill-name}-optimization-test",
    "prompt": "{test-prompt}",
    "agentId": "{agent-id-for-skill}"
  }'
```

**Important:** Save the returned task ID for tracking.

## Step 4: Execute Task

Execute the created task:

```bash
curl -X POST http://localhost:3001/api/tasks/{task-id}/execute \
  -H "Content-Type: application/json" \
  --max-time 600
```

**Wait for completion.** Monitor the response or check task status periodically.

## Step 5: Analyze Execution Logs

Once task completes, read the execution logs from `logs/{task-id}.json` and `logs/{task-id}-sdk-payload.json`:

```bash
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\logs\{task-id}.json
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\logs\{task-id}-sdk-payload.json
```

### 5.1 Identify Performance Bottlenecks

Look for:
- **Tool usage patterns**: Repeated tool calls that could be batched
- **Task tool invocations**: Are sub-agents being used inefficiently?
- **Time-consuming operations**: Which tools/steps take the longest?
- **Trial-and-error patterns**: Multiple failed attempts before success
- **Redundant operations**: Same operation performed multiple times

### 5.2 Extract Key Metrics

From the logs, extract:
- Total execution time (duration field)
- Tool call counts and timings
- Error messages and failed attempts
- Success/failure rates
- Any screenshots or final outputs

### 5.3 Identify Issues

Common issues to look for:
- Vague instructions leading to trial-and-error
- Missing direct code/commands (forcing agent to figure it out)
- Inefficient tool usage (individual calls vs batch operations)
- Lack of error handling guidance
- Missing performance optimization tips
- Over-reliance on Task tool when direct tools would work

## Step 6: Read Best Practices

Read the best practices documentation to guide optimization:

```bash
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\claude_skill_best_practices\01_Core_Principles.md
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\claude_skill_best_practices\03_Workflows_Feedback_Loops.md
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\claude_skill_best_practices\07_Anti_Patterns.md
```

Key principles to apply:
1. **Concise and actionable** - Direct instructions, not essays
2. **Workflow patterns** - Step-by-step with checkboxes
3. **Progressive disclosure** - Brief intro, detailed sections
4. **Explicit tool guidance** - Show exact tool usage
5. **Error handling** - Common issues and solutions
6. **Performance optimization** - Batch operations, minimize snapshots

## Step 7: Generate Optimized Skill

Based on analysis and best practices, create optimized version:

### 7.1 Optimization Strategies

**If logs show Task tool overhead:**
- Replace with direct tool usage where possible
- Provide exact code/commands in skill instead of delegation
- Example: Instead of "Use Task tool to read Excel", provide HTML parser code

**If logs show repeated tool calls:**
- Add batch operation guidance
- Example: "Fill all 7 fields at once using browser_fill_form"

**If logs show trial-and-error:**
- Add explicit step-by-step instructions
- Provide exact tool names and parameters
- Include code snippets where applicable

**If logs show long execution time:**
- Identify slowest operations
- Add performance tips (e.g., "Single snapshot per form, not multiple")
- Eliminate unnecessary operations

### 7.2 Update Skill Structure

Create new skill with:
- **Incremented version** (e.g., 1.0.0 → 2.0.0 for major changes)
- **Improved description** reflecting new capabilities
- **Performance metrics** if applicable
- **Clearer workflow** with checkboxes
- **Embedded code** where it eliminates trial-and-error
- **Common issues section** based on log errors
- **Critical success factors** highlighting key optimizations

### 7.3 Write Optimized Skill

Write the new optimized skill content to a temporary file or provide to user:

```markdown
---
name: {skill-name}
description: {improved-description}
version: {incremented-version}
category: {category}
---

# {Skill Title} - Optimized

{Brief description highlighting improvements}

## Performance Optimization

{If applicable, describe performance improvements:}
- Previous execution time: X seconds
- Target execution time: Y seconds
- Key optimizations: {list}

## Quick Start

```
Progress Checklist:
- [ ] {Step 1}
- [ ] {Step 2}
...
```

## Step 1: {First Step}

{Clear, actionable instructions}

{If code/commands needed, provide them directly:}

```{language}
{exact code}
```

...

## Common Issues

**{Issue 1}:** {Description from logs}
- **Fix:** {Solution}

## Critical Success Factors

1. {Key optimization 1}
2. {Key optimization 2}
...
```

## Step 8: Provide Results to User

Present optimization results:

1. **Analysis Summary:**
   - Original execution time vs optimized target
   - Key bottlenecks identified
   - Optimization strategies applied

2. **Optimized Skillmd:**
   - Provide complete new skill content
   - User can manually update in Strapi

3. **Test Recommendation:**
   - Suggest testing the optimized version
   - Provide API call to re-run with new skill

## Performance Optimization Tips

**For Skills Using Browser Automation:**
- Minimize snapshots (only when needed for next action)
- Batch form fills instead of individual field typing
- Avoid unnecessary waits or delays

**For Skills Using File Operations:**
- Provide exact code for complex operations (Excel parsing, PDF reading)
- Avoid Task tool delegation when direct code works
- Use specialized tools (Read, Write) instead of Bash cat/echo

**For Skills Using External APIs:**
- Batch requests where possible
- Provide exact curl/fetch examples
- Include error handling for common API failures

**General:**
- Embed solutions that work, eliminating trial-and-error
- One snapshot/check before action, not after
- Clear success criteria for each step

## Common Bottlenecks

**Task Tool Overhead (8+ minutes):**
- **Cause:** Delegating to sub-agent when direct solution exists
- **Fix:** Embed the working solution directly in skill

**Multiple Failed Attempts:**
- **Cause:** Vague instructions forcing agent to guess
- **Fix:** Provide exact tool names, parameters, code

**Repeated Snapshots:**
- **Cause:** No guidance on when to snapshot
- **Fix:** "Take single snapshot before filling, not after submitting"

**Long File Operations:**
- **Cause:** Using inefficient tools (Task tool for Excel)
- **Fix:** Provide efficient direct method (HTML parser with XLSX.js)

## Example Workflow

```
User: Optimize my rpa-challenge skill
Assistant:
1. Reading current skill... ✓
2. Creating test task via API... ✓
3. Executing task... (waiting)
4. Task completed in 673 seconds
5. Analyzing logs...
   - Found: 4 Task tool calls taking 513 seconds
   - Found: Excel reading trial-and-error
6. Applying optimizations...
   - Embedding HTML parser code
   - Adding single-snapshot strategy
   - Batch form filling guidance
7. New version created (v2.0.0)
   - Target: <180 seconds (73% improvement)
   - Key change: Direct browser-based Excel parsing

Here's the optimized skillmd for you to update in Strapi...
```

## Best Practices Checklist

Before finalizing optimization, verify:
- [ ] Version number incremented appropriately
- [ ] Description updated to reflect improvements
- [ ] Workflow has progress checkboxes
- [ ] Exact tool usage shown where needed
- [ ] Performance metrics included if applicable
- [ ] Common issues section based on logs
- [ ] Critical success factors highlighted
- [ ] No vague instructions requiring guesswork
- [ ] Error handling guidance provided
- [ ] Code snippets included where they eliminate trial-and-error
