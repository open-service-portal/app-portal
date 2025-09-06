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

// Increase max listeners to handle multiple config files without warnings
require('events').EventEmitter.defaultMaxListeners = 20;

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

// Read includes from app-config.yaml
let configFilesToLoad = [];

try {
  const yaml = require('js-yaml');
  const configContent = fs.readFileSync(baseConfigPath, 'utf8');
  const configData = yaml.load(configContent);
  
  if (configData && configData.includes && Array.isArray(configData.includes)) {
    configFilesToLoad = configData.includes;
    console.log(`📋 Loading includes from app-config.yaml`);
  }
} catch (error) {
  // If js-yaml is not installed or parsing fails, fall back to auto-discovery
  console.warn(`⚠️  Could not parse app-config.yaml for includes: ${error.message}`);
  console.log(`    Falling back to auto-discovery`);
}

// If no includes in config or parsing failed, auto-discover config files
if (configFilesToLoad.length === 0) {
  // Try app-config/ first, then fall back to config/ for backwards compatibility
  const configDirs = ['app-config', 'config'];
  for (const dirName of configDirs) {
    const configDir = path.join(appPortalRoot, dirName);
    if (fs.existsSync(configDir)) {
      configFilesToLoad = fs.readdirSync(configDir)
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .sort() // Sort for consistent loading order
        .map(file => path.join(dirName, file));
      
      if (configFilesToLoad.length > 0) {
        console.log(`📁 Auto-discovering config files from ${dirName}/ directory`);
        break; // Use the first directory that exists and has files
      }
    }
  }
}

// Load the config files
if (configFilesToLoad.length > 0) {
  console.log(`📚 Loading configuration files:`);
  const loadedConfigs = [];
  configFilesToLoad.forEach(file => {
    const configPath = path.isAbsolute(file) ? file : path.join(appPortalRoot, file);
    
    if (fs.existsSync(configPath)) {
      const displayName = path.relative(appPortalRoot, configPath);
      console.log(`   ✅ ${displayName}`);
      loadedConfigs.push(path.basename(displayName, '.yaml'));
      backstageArgs.push('--config', configPath);
    } else {
      console.log(`   ⚠️  ${file} (not found, skipping)`);
    }
  });
  
  // Show a clean summary of what will be loaded
  console.log(`\n📋 Config loading order: ${loadedConfigs.join(' → ')}\n`);
}

// Load context-specific config if available
if (context) {
  const configFile = `app-config.${context}.local.yaml`;
  const configPath = path.join(appPortalRoot, configFile);
  
  if (fs.existsSync(configPath)) {
    console.log(`✅ Found context config: ${configFile}`);
    backstageArgs.push('--config', configPath);
  } else {
    console.log(`⚠️  No config found for context: ${context}`);
    console.log(`    Expected: ${configFile}`);
  }
}

// Prepare command and logging
let command, commandArgs, spawnOptions;

// Set Node options for better performance
const nodeOptions = '--max-old-space-size=4096';
const currentNodeOptions = process.env.NODE_OPTIONS || '';
const envWithNodeOptions = {
  ...process.env,
  NODE_OPTIONS: `${currentNodeOptions} ${nodeOptions}`.trim(),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'  // Control Backstage logging verbosity
  // Note: MaxListenersExceededWarning is harmless with multiple config files
  // We don't suppress it to ensure other warnings are still visible
};

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
  spawnOptions = { stdio: 'inherit', shell: true, env: envWithNodeOptions };
  console.log('🚀 Starting Backstage with logging...\n');
} else {
  // Simple command without logging
  command = 'yarn';
  commandArgs = backstageArgs;
  spawnOptions = { stdio: 'inherit', shell: true, env: envWithNodeOptions };
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