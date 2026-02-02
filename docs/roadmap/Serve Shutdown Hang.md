---
id: Ykhb7wn9tS3a
title: Serve Shutdown Hang
tags:
  - roadmap
type: Enhancement
status: Proposed
priority: P2
effort: S
phase: Post-MVP
category: CLI & Visualization
---
# Serve Shutdown Hang

## Problem

When running `roux serve`, the "Shutting down..." message hangs the terminal instead of cleanly exiting.

## Expected Behavior

Clean shutdown with proper process exit.

## Investigation Needed

- Check if file watcher cleanup is blocking
- Check if MCP server cleanup is blocking
- Check for unclosed handles
