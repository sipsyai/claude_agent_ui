# Email to Anthropic - Bug Report

## 📧 Contact Details

**Primary Method:** Anthropic Help Center Support Chat
**URL:** https://support.anthropic.com
**Subject:** Bug Report: Claude Agent SDK --allowedTools Parameter Not Working

**Important Note:** Anthropic uses a chat-based support system (Fin AI assistant) rather than traditional email. Visit https://support.anthropic.com and click the chat bubble in the bottom-right corner to start your support request.

**Documentation Files to Share:**
1. BUG-REPORT-WEBFETCH-ISSUE.md
2. SOLUTION-REPORT-DISALLOWED-TOOLS.md
3. logs/f4f3e8a8-cd9f-4e58-864d-3065715d3f86.json (First test - showing WebFetch was used)
4. logs/d7180b10-5080-4e51-b343-ca48308ba4ae.json (Second test - showing disallowedTools works)

---

## 📝 Support Message Body

**Copy and paste this into the support chat at https://support.anthropic.com:**

```
Subject: Bug Report: Claude Agent SDK --allowedTools Parameter Not Working

Hello Anthropic Support Team,

I am writing to report a critical bug in the Claude Agent SDK (CLI version) regarding the --allowedTools parameter not being respected during execution.

SUMMARY:
The --allowedTools CLI parameter is ignored by the SDK, causing all available tools to be provided to Claude regardless of what is specified in the parameter. This breaks tool isolation for skills and allows unauthorized access to tools like WebFetch, WebSearch, Task, etc.

REPRODUCTION:
1. Execute skill using SDK CLI with --allowedTools parameter:

   node claude-agent-sdk/cli.js \
     --allowedTools Read,Write,Edit,Bash,mcp__playwright__* \
     --model claude-sonnet-4-5 \
     --permission-mode bypassPermissions

2. Check the execution log's "init" message to see available tools

3. Observe that ALL tools are available, not just the ones specified in --allowedTools

EXPECTED BEHAVIOR:
Only tools specified in --allowedTools should be available to Claude during execution.

ACTUAL BEHAVIOR:
All tools are available regardless of --allowedTools parameter. This includes:
- WebFetch (not in allowedTools, but available and used)
- WebSearch (not in allowedTools, but available)
- Task, TodoWrite, Skill, SlashCommand (not in allowedTools, but available)
- And many others

EVIDENCE:
I have attached comprehensive documentation including:
1. Full bug report with execution logs and payloads
2. Proof that WebFetch was used despite not being in allowedTools
3. Side-by-side comparison showing the issue
4. Backend logs showing correct parameters were passed to SDK

WORKAROUND DISCOVERED:
The --disallowedTools parameter DOES work and can be used to block specific tools. We are currently using this as a workaround, but it's not ideal because:
- It requires maintaining a deny-list instead of an allow-list
- New tools are available by default and need to be explicitly blocked
- It's counterintuitive compared to allowedTools

IMPACT:
- HIGH: Security/tool isolation issue
- Skills cannot be properly isolated
- Unauthorized tools can be accessed during execution
- This affects any application trying to limit tool access

ENVIRONMENT:
- SDK: @anthropic-ai/claude-agent-sdk (CLI)
- Model: claude-sonnet-4-5
- Platform: Windows (MSYS_NT-10.0-22631)
- Node.js: Latest version

REQUEST:
Please investigate and fix the --allowedTools parameter handling in the Claude Agent SDK. The parameter should filter available tools as documented.

I am available to provide additional information, test fixes, or answer any questions about this issue.

Attached files contain detailed evidence, execution logs, and step-by-step reproduction instructions.

Thank you for your attention to this matter.

Best regards,
Ali

---

Additional Contact Information:
- GitHub Issue: [If you have a public SDK repo, I can open an issue there as well]
- Available for follow-up questions
```

---

## 📎 How to Submit the Bug Report

### Step-by-Step Submission Process:

1. **Visit Support Portal:**
   - Go to: https://support.anthropic.com
   - Click the chat bubble in the bottom-right corner

2. **Start Conversation:**
   - Chat with Fin (Anthropic's AI support bot)
   - Type: "I need to report a bug with the Claude Agent SDK"

3. **Paste the Message:**
   - Copy the entire message body from the section above
   - Paste it into the chat

4. **Share Documentation:**
   - Upload files to cloud storage (Google Drive, Dropbox, etc.)
   - Share public links in the chat, or
   - Offer to email the files if support provides an address

5. **Request Escalation:**
   - If the bot cannot help, request to speak with a human support agent
   - Emphasize this is a technical SDK bug requiring engineering review

### Alternative Methods:

1. **API Console Support:**
   - Log into: https://platform.anthropic.com (or console.anthropic.com)
   - Navigate to Support section
   - Submit through console interface

2. **GitHub Issues (If Available):**
   - Search for: "anthropic/claude-agent-sdk" on GitHub
   - If public repo exists, open an issue with the bug report
   - Reference your support chat ticket number

3. **Enterprise Support (If Applicable):**
   - If you have Claude for Work Enterprise plan
   - Submit through Enterprise Support form
   - Reference the bug report documentation

---

## 📋 Pre-Submission Checklist

Before submitting the bug report:

- [ ] Visit https://support.anthropic.com
- [ ] Start chat with support bot (Fin)
- [ ] Copy the message body from above
- [ ] Prepare files for sharing:
  - [ ] Upload BUG-REPORT-WEBFETCH-ISSUE.md to cloud storage
  - [ ] Upload SOLUTION-REPORT-DISALLOWED-TOOLS.md to cloud storage
  - [ ] Create shareable links (set to "Anyone with link can view")
  - [ ] Keep execution logs available if requested
- [ ] Keep tone professional and constructive
- [ ] Include workaround (disallowedTools) so others can benefit
- [ ] Request escalation to human support if bot cannot process the report
- [ ] Save any ticket/case number provided for follow-up

---

## 🎯 Expected Response

Anthropic may:
1. Acknowledge the bug and add to their backlog
2. Request additional information or testing
3. Provide a timeline for a fix
4. Suggest alternative approaches
5. Confirm the workaround (disallowedTools) as the official solution

---

**Note:** The message is ready to submit. Visit https://support.anthropic.com, click the chat bubble, paste the message body, and provide the documentation files via cloud storage links when requested. Save your chat transcript or ticket number for future reference.
