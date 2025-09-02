#!/usr/bin/env node
/**
 * Dynamic Backstage starter with logging support
 * Usage: 
 *   yarn start              - Auto-detect context and start
 *   yarn start --log        - Auto-detect context and start with logging
 *   yarn start:log          - Same as yarn start --log
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check for --log flag
const withLogging = process.argv.includes('--log') || process.argv.includes('--with-log');

// Get current kubectl context
let context;
try {
  context = execSync('kubectl config current-context', { encoding: 'utf8' }).trim();
  console.log(`📍 Current kubectl context: ${context}`);
} catch (error) {
  console.log('⚠️  No kubectl context found, using defaults');
  context = null;
}

// Ensure we're in the right directory (app-portal root)
const appPortalRoot = __dirname;
process.chdir(appPortalRoot);
console.log(`📂 Working directory: ${process.cwd()}`);

// Build the backstage command
const backstageArgs = ['backstage-cli', 'repo', 'start'];

// Always add the base config with absolute path
const baseConfigPath = path.join(appPortalRoot, 'app-config.yaml');
if (!fs.existsSync(baseConfigPath)) {
  console.error(`❌ Error: Base config not found at ${baseConfigPath}`);
  process.exit(1);
}
backstageArgs.push('--config', baseConfigPath);

if (context) {
  const configFile = `app-config.${context}.local.yaml`;
  const configPath = path.join(appPortalRoot, configFile);
  
  if (fs.existsSync(configPath)) {
    console.log(`✅ Found config: ${configFile}`);
    backstageArgs.push('--config', configPath);
  } else {
    console.log(`⚠️  No config found for context: ${context}`);
    console.log(`    Expected: ${configFile}`);
    console.log('    Using base configuration only');
  }
}

// Prepare command and logging
let command, commandArgs, spawnOptions;

if (withLogging) {
  const logDir = process.env.BACKSTAGE_LOG_DIR || 'logs';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const logFile = path.join(logDir, `backstage-${timestamp}.log`);
  
  console.log(`📝 Logging enabled: ${logFile}`);
  
  // Create log directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Build the full command with logging using shell
  command = `yarn ${backstageArgs.join(' ')} 2>&1 | tee ${logFile}`;
  commandArgs = [];
  spawnOptions = { stdio: 'inherit', shell: true };
  console.log('🚀 Starting Backstage with logging...\n');
} else {
  // Simple command without logging
  command = 'yarn';
  commandArgs = backstageArgs;
  spawnOptions = { stdio: 'inherit', shell: true };
  console.log('🚀 Starting Backstage...\n');
}

// Start the process
const child = spawn(command, commandArgs, spawnOptions);

child.on('error', (error) => {
  console.error('Failed to start Backstage:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});