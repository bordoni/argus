#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { setupCommand } from './commands/setup';
import { conversationsCommand } from './commands/conversations';
import { existsSync } from 'fs';
import { join } from 'path';

config();

const program = new Command();

program
  .name('argus')
  .description('HelpScout CLI tool for downloading conversations')
  .version('1.0.0');

program
  .command('setup')
  .description('Interactive setup for HelpScout credentials')
  .action(setupCommand);

const conversations = program
  .command('conversations')
  .description('Manage HelpScout conversations');

conversations
  .command('download <link>')
  .description('Download a conversation and its attachments')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (link: string, options: { output?: string }) => {
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      console.log(chalk.yellow('⚠️  No .env file found. Please run "argus setup" first.'));
      process.exit(1);
    }
    
    // Use OUTPUT_DIR from .env if no -o option provided
    const defaultOutput = process.env.OUTPUT_DIR || './conversations';
    const finalOptions = {
      output: options.output || defaultOutput
    };
    
    const { downloadConversation } = await import('./commands/conversations');
    await downloadConversation(link, finalOptions);
  });

program.parse();