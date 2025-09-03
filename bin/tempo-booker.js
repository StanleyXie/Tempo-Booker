#!/usr/bin/env node

/**
 * Tempo Booker CLI
 * Entry point for npm global installation
 */

const path = require('path');

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  if (process.env.NODE_ENV === 'development') {
    console.error('Promise:', promise);
  }
  process.exit(1);
});

// Set the working directory to the package root
try {
  process.chdir(path.join(__dirname, '..'));
} catch (error) {
  console.error('❌ Failed to change working directory:', error.message);
  process.exit(1);
}

// Run the main application
try {
  const TempoTimeTracker = require('../src/index.js');
  
  // Simulate command-line execution since require.main won't be index.js
  const args = process.argv.slice(2);
  
  if (args.length >= 2 && args[0] === 'quick') {
    // Quick log mode: tempo-booker quick ITST-14440 2 "Bug fix"
    const [, issueKey, hours, ...descriptionParts] = args;
    const description = descriptionParts.join(' ');
    
    // Validate inputs
    if (!issueKey || !hours) {
      console.error('❌ Usage: tempo-booker quick <issue-key> <hours> [description]');
      console.error('   Example: tempo-booker quick ITST-14440 2 "Bug fix work"');
      process.exit(1);
    }
    
    if (isNaN(parseFloat(hours))) {
      console.error('❌ Hours must be a valid number');
      process.exit(1);
    }
    
    TempoTimeTracker.quickLog(issueKey, hours, description).catch((error) => {
      console.error('❌ Quick log failed:', error.message);
      process.exit(1);
    });
  } else if (args.length >= 1 && args[0] === 'import') {
    // Silent import mode: tempo-booker import [file] [scope]
    let filePath, dateScope;
    
    // Parse arguments
    const importArgs = args.slice(1);
    for (let i = 0; i < importArgs.length; i++) {
      if (!filePath) {
        filePath = importArgs[i];
      } else if (!dateScope) {
        dateScope = importArgs[i];
      }
    }
    
    // Validate date scope if provided
    if (dateScope && !['current-week', 'last-7-days', 'this-month', 'all'].includes(dateScope)) {
      console.error('❌ Invalid date scope. Use: current-week, last-7-days, this-month, or all');
      process.exit(1);
    }
    
    TempoTimeTracker.silentImport(filePath, dateScope).catch((error) => {
      console.error('❌ Import failed:', error.message);
      process.exit(1);
    });
  } else if (args.includes('--setup') || args.includes('-s')) {
    // Setup wizard
    const chalk = require('chalk');
    console.log(chalk.blue('🔧 Running setup wizard...'));
    (async () => {
      try {
        const SetupWizard = require('../src/utils/setupWizard');
        const wizard = new SetupWizard();
        await wizard.run();
        console.log(chalk.green('✅ Setup completed! You can now use tempo-booker'));
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('Setup failed:'), error.message);
        process.exit(1);
      }
    })();
  } else if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    // Show help
    const chalk = require('chalk');
    console.log(chalk.blue.bold('\n🕒 Tempo Time Tracker CLI\n'));
    console.log(chalk.white('Usage:'));
    console.log(chalk.green('  tempo-booker                                    # Interactive mode'));
    console.log(chalk.green('  tempo-booker --setup                           # Run setup wizard'));
    console.log(chalk.green('  tempo-booker quick <issue> <hours> [desc]      # Quick log'));
    console.log(chalk.green('  tempo-booker import [file] [scope]             # Silent import'));
    console.log(chalk.white('\nSilent Import Examples:'));
    console.log(chalk.yellow('  tempo-booker import                            # Use defaults from config.yaml'));
    console.log(chalk.yellow('  tempo-booker import tempo.csv                  # Import specific file'));
    console.log(chalk.yellow('  tempo-booker import tempo.csv current-week     # Import with date scope'));
    console.log(chalk.white('\nDate Scopes:'));
    console.log(chalk.gray('  current-week, last-7-days, this-month, all'));
    process.exit(0);
  } else {
    // Interactive mode
    try {
      const app = new TempoTimeTracker();
      app.run().catch((error) => {
        console.error('❌ Application error:', error.message);
        
        // Provide helpful error messages for common issues
        if (error.message.includes('TEMPO_API_TOKEN')) {
          console.error('💡 Make sure your API token is configured: run tempo-booker --setup');
        } else if (error.message.includes('JIRA_BASE_URL')) {
          console.error('💡 Make sure your JIRA base URL is configured in config.yaml');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          console.error('💡 Check your API token permissions or issue access rights');
        } else if (error.message.includes('ENOENT') || error.message.includes('file not found')) {
          console.error('💡 Check that the file path exists and is accessible');
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.error('Stack trace:', error.stack);
        }
        process.exit(1);
      });
    } catch (syncError) {
      console.error('❌ Failed to initialize application:', syncError.message);
      
      // Check for common initialization issues
      if (syncError.message.includes('Cannot find module')) {
        console.error('💡 Installation may be incomplete. Try reinstalling: npm install -g tempo-booker');
      } else if (syncError.message.includes('permission')) {
        console.error('💡 Permission denied. Try running with appropriate permissions');
      }
      
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Critical error:', error.message);
  
  // Provide context for critical errors
  if (error.message.includes('Cannot find module')) {
    console.error('💡 Missing dependencies. Try reinstalling: npm install -g tempo-booker');
  } else if (error.code === 'MODULE_NOT_FOUND') {
    console.error('💡 Module loading failed. Check your Node.js installation');
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye! Tempo Booker CLI shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Tempo Booker CLI terminated gracefully...');
  process.exit(0);
});