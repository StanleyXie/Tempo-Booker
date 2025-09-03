#!/usr/bin/env node

const fs = require('fs');
const chalk = require('chalk');

/**
 * Simple script to toggle between MCP+Config mode and API-only mode
 */

function toggleAPIMode() {
  const path = require('path');
  const configPath = path.join(__dirname, '../../config.yaml');
  const config = fs.readFileSync(configPath, 'utf8');
  
  // Check current state
  const currentState = config.includes('useMCP: false') ? 'API-ONLY' : 'FULL-FEATURED';
  
  console.log(chalk.blue(`Current mode: ${currentState}`));
  
  if (currentState === 'API-ONLY') {
    // Switch to full-featured mode
    const newConfig = config
      .replace('useMCP: false # DISABLED for API-only testing', 'useMCP: true # Use MCP for issue resolution when available (fastest)')
      .replace('useConfigMappings: false # DISABLED to force API resolution', 'useConfigMappings: true # Use static config mappings (reliable)')
      .replace('useAPI: true # Use API-based resolution (primary method)', 'useAPI: true # Use API-based resolution as fallback (flexible)');
    
    fs.writeFileSync(configPath, newConfig);
    console.log(chalk.green('✅ Switched to FULL-FEATURED mode (MCP + Config + API)'));
    console.log(chalk.gray('   • MCP: enabled'));
    console.log(chalk.gray('   • Config mappings: enabled')); 
    console.log(chalk.gray('   • API fallback: enabled'));
    
  } else {
    // Switch to API-only mode
    const newConfig = config
      .replace('useMCP: true # Use MCP for issue resolution when available (fastest)', 'useMCP: false # DISABLED for API-only testing')
      .replace('useConfigMappings: true # Use static config mappings (reliable)', 'useConfigMappings: false # DISABLED to force API resolution')
      .replace('useAPI: true # Use API-based resolution as fallback (flexible)', 'useAPI: true # Use API-based resolution (primary method)');
    
    fs.writeFileSync(configPath, newConfig);
    console.log(chalk.yellow('✅ Switched to API-ONLY mode'));
    console.log(chalk.gray('   • MCP: disabled'));
    console.log(chalk.gray('   • Config mappings: disabled'));
    console.log(chalk.gray('   • API resolution: primary method'));
  }
  
  console.log(chalk.blue('\n🧪 Test the current mode:'));
  console.log(chalk.white('node src/index.js quick ITST-14440 0.1 "Testing current mode"'));
  
  console.log(chalk.blue('\n🔄 Switch back:'));
  console.log(chalk.white('node toggle-api-mode.js'));
}

if (require.main === module) {
  toggleAPIMode();
}

module.exports = { toggleAPIMode };