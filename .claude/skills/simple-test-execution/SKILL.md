---
name: simple-test-execution
description: >-
  Simple test skill for execution process testing. Performs basic file
  operations and calculations.
allowed-tools: 'Read, Write, Bash'
version: 1.0.0
category: testing
---

# Simple Test Execution Skill

This skill performs simple operations to test the execution process.

## Instructions

1. Create a test file named `test-output.txt` in the current directory
2. Write the following content to it:
   - Current timestamp
   - A simple calculation: 42 * 99
   - A greeting message
3. Read the file back to verify
4. Report the results to the user

## Example

When executed, this skill will:
1. Use Write tool to create `test-output.txt`
2. Use Read tool to verify the content
3. Use Bash to calculate and display system info
4. Provide a summary of all operations
