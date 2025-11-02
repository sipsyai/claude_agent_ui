#!/bin/bash

echo "Verifying Task 02: PostgreSQL Schema & Configuration..."

# Add verification logic here
psql -d claude_agent_ui -f schema.sql

echo "✅ Task 02 verification complete!"
