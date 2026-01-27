#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { serveCommand } from './commands/serve.js';
import { vizCommand } from './commands/viz.js';
import { VERSION } from '../index.js';

const program = new Command();

program
  .name('roux')
  .description('Graph Programming Interface for knowledge bases')
  .version(VERSION);

program
  .command('init')
  .description('Initialize Roux in a directory')
  .argument('[directory]', 'Directory to initialize', '.')
  .action(async (directory: string) => {
    const resolvedDir = resolve(directory);
    const result = await initCommand(resolvedDir);

    if (result.created) {
      console.log(`Initialized Roux in ${resolvedDir}`);
      console.log(`  Config: ${result.configPath}`);
      if (result.hooksInstalled) {
        console.log(`  Claude hooks: installed`);
      }
    } else {
      if (result.hooksInstalled) {
        console.log(`Upgraded Roux in ${resolvedDir}`);
        console.log(`  Claude hooks: installed`);
      } else {
        console.log(`Already initialized: ${result.configPath}`);
      }
    }
  });

program
  .command('status')
  .description('Show graph statistics')
  .argument('[directory]', 'Directory to check', '.')
  .action(async (directory: string) => {
    const resolvedDir = resolve(directory);

    try {
      const result = await statusCommand(resolvedDir);
      console.log('Graph Status:');
      console.log(`  Nodes: ${result.nodeCount}`);
      console.log(`  Edges: ${result.edgeCount}`);
      console.log(`  Embeddings: ${result.embeddingCount}/${result.nodeCount}`);
      console.log(
        `  Coverage: ${(result.embeddingCoverage * 100).toFixed(1)}%`
      );
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start MCP server with file watching')
  .argument('[directory]', 'Directory to serve', '.')
  .option('--no-watch', 'Disable file watching')
  .action(async (directory: string, options: { watch: boolean }) => {
    const resolvedDir = resolve(directory);

    try {
      console.log('Starting Roux server...');

      const handle = await serveCommand(resolvedDir, {
        watch: options.watch,
        onProgress: (current, total) => {
          process.stdout.write(
            `\r[${current}/${total}] Generating embeddings...`
          );
          if (current === total) {
            console.log(' Done.');
          }
        },
      });

      console.log(`Serving ${handle.nodeCount} nodes`);
      if (handle.isWatching) {
        console.log('Watching for file changes...');
      }

      // Graceful shutdown
      const shutdown = async () => {
        console.log('\nShutting down...');
        await handle.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

program
  .command('viz')
  .description('Generate graph visualization')
  .argument('[directory]', 'Directory to visualize', '.')
  .option('-o, --output <path>', 'Output file path')
  .option('--open', 'Open in browser after generation')
  .action(
    async (directory: string, options: { output?: string; open?: boolean }) => {
      const resolvedDir = resolve(directory);

      try {
        const result = await vizCommand(resolvedDir, {
          output: options.output,
          open: options.open,
        });

        console.log(
          `Generated visualization: ${result.nodeCount} nodes, ${result.edgeCount} edges`
        );
        console.log(`  Output: ${result.outputPath}`);

        if (result.shouldOpen) {
          const openCmd =
            process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
                ? 'start'
                : 'xdg-open';
          execFile(openCmd, [result.outputPath]);
        }
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    }
  );

program.parse();
