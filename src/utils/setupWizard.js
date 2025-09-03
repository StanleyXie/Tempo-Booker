const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const TokenHelpers = require('./tokenHelpers');

class SetupWizard {
  constructor() {
    this.config = {};
    this.tempoApiService = null;
  }

  async run() {
    console.log(chalk.blue.bold('\n🚀 Tempo Booker - First Time Setup'));
    console.log(chalk.gray('Let\'s configure your Tempo Booker for the best experience\n'));

    try {
      await this.chooseSetupMode();
      await this.runSimplifiedSetup();
    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error.message);
      console.log(chalk.yellow('You can run setup again anytime with: tempo-booker --setup'));
      process.exit(1);
    }
  }

  async chooseSetupMode() {
    console.log(chalk.blue('🎯 Tempo Booker Setup'));
    console.log(chalk.gray('Simple setup focused on what you actually need\n'));

    const { helpType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'helpType',
        message: 'Do you need help before we start?',
        choices: [
          { name: 'No, I\'m ready to start setup', value: 'none' },
          { name: '🎫 Help me get my Tempo API token', value: 'tempo_token' },
          { name: '🔍 Help me find my Account ID', value: 'account_id' },
          { name: '📖 Show me both (token + account ID)', value: 'both' }
        ]
      }
    ]);

    if (helpType === 'tempo_token' || helpType === 'both') {
      await TokenHelpers.showTempoTokenInstructions();
    }
    
    if (helpType === 'account_id' || helpType === 'both') {
      await TokenHelpers.showAccountIdHelp();
    }

    return 'simplified';
  }

  async runSimplifiedSetup() {
    await this.collectSimplifiedConfiguration();
    await this.setupWorkspace();
    await this.saveConfiguration();
    await this.showSetupComplete();
  }

  async collectSimplifiedConfiguration() {
    console.log(chalk.yellow('📡 Step 1: Essential Configuration'));
    console.log(chalk.gray('Just the basics - Tempo API token and your info\n'));

    // Collect JIRA base URL first
    const { jiraBaseUrl } = await inquirer.prompt([
      {
        type: 'input', 
        name: 'jiraBaseUrl',
        message: 'Enter your JIRA base URL (e.g., https://company.atlassian.net):',
        validate: (input) => {
          if (!input.trim()) return 'JIRA base URL is required';
          try {
            new URL(input.trim());
            if (!input.includes('atlassian.net')) {
              return 'Please enter a valid Atlassian JIRA URL';
            }
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
        filter: (input) => input.trim().replace(/\/$/, '')
      }
    ]);

    // Collect and validate Tempo token
    let tempoToken;
    let tempoValid = false;
    let attempts = 0;

    while (!tempoValid && attempts < 3) {
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: attempts === 0 ? 'Enter your Tempo API token:' : 'Please try again with a valid Tempo API token:',
          mask: '*',
          validate: (input) => {
            if (!input.trim()) return 'Tempo API token is required';
            if (input.trim().length < 10) return 'Token seems too short - please check';
            return true;
          },
          filter: (input) => input.trim()
        }
      ]);

      // Validate token
      const validation = await TokenHelpers.validateTempoToken(token, jiraBaseUrl);
      if (validation.valid) {
        tempoToken = token;
        tempoValid = true;
        this.tempoApiResult = validation.result;
        
        // Try automatic Account ID retrieval first
        console.log(chalk.blue('\n🤖 Attempting automatic user discovery...'));
        const autoAccountResult = await TokenHelpers.getAccountIdFromTempo(token, jiraBaseUrl);
        
        if (autoAccountResult.success) {
          this.config.user = {
            name: autoAccountResult.name,
            accountId: autoAccountResult.accountId
          };
          console.log(chalk.green(`✅ Auto-retrieved: ${autoAccountResult.name} (${autoAccountResult.accountId})`));
        } else {
          // Fallback to old method
          const discoveredUser = await TokenHelpers.discoverUserFromApi(validation.result);
          if (discoveredUser) {
            this.config.user = {
              name: discoveredUser.name,
              accountId: discoveredUser.accountId
            };
            console.log(chalk.green(`✅ Auto-discovered user: ${discoveredUser.name}`));
          }
        }
      } else {
        attempts++;
        if (attempts < 3) {
          console.log(chalk.red(`❌ Validation failed (attempt ${attempts}/3)`));
          
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: 'Would you like to try a different token?',
              default: true
            }
          ]);

          if (!retry) {
            throw new Error('Tempo API token validation failed');
          }
        } else {
          throw new Error('Tempo API token validation failed after 3 attempts');
        }
      }
    }

    // Store token securely
    const SecureTokenManager = require('./secureTokenManager');
    const tokenManager = new SecureTokenManager();
    await tokenManager.storeToken(tempoToken);
    
    this.config.api = {
      jiraBaseUrl: jiraBaseUrl
      // tempoToken is now stored securely, not in config file
    };

    // If user discovery failed, help user find their account ID
    if (!this.config.user) {
      console.log(chalk.yellow('\n👤 User Information'));
      console.log(chalk.gray('Could not auto-discover your user info from Tempo API\n'));

      // Offer help finding account ID
      const { needAccountIdHelp } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'needAccountIdHelp',
          message: 'Do you need help finding your Atlassian Account ID?',
          default: true
        }
      ]);

      if (needAccountIdHelp) {
        await this.showAccountIdHelp();
      }

      const userInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter your name:',
          validate: (input) => input.trim() ? true : 'Name is required',
          filter: (input) => input.trim()
        },
        {
          type: 'input',
          name: 'accountId',
          message: 'Enter your Atlassian Account ID (e.g., 712020:xxx-xxx-xxx):',
          validate: (input) => {
            if (!input.trim()) return 'Account ID is required for worklog attribution';
            if (!input.includes(':')) return 'Account ID should be in format: 712020:xxx-xxx-xxx';
            return true;
          },
          filter: (input) => input.trim()
        }
      ]);

      this.config.user = userInfo;
    }

    // Auto-discover cloud ID
    this.config.atlassian = {
      cloudId: await TokenHelpers.discoverAtlassianCloudId(jiraBaseUrl)
    };
    
    console.log(chalk.green('✅ Configuration complete - ready for workspace setup'));
  }

  async showAccountIdHelp() {
    console.log(chalk.blue.bold('\n🔍 Finding Your Atlassian Account ID'));
    console.log(chalk.gray('Your Account ID is needed to attribute worklogs to you correctly\n'));

    console.log(chalk.yellow('📋 Method 1: From JIRA Profile (Easiest)'));
    console.log(chalk.white('1. Go to your JIRA instance (e.g., company.atlassian.net)'));
    console.log(chalk.white('2. Click on your profile picture (top right)'));
    console.log(chalk.white('3. Select "Profile"'));
    console.log(chalk.white('4. Look at the URL - it contains your Account ID'));
    console.log(chalk.gray('   Example: /jira/people/712020:abc123def456 → Account ID: 712020:abc123def456\n'));

    console.log(chalk.yellow('📋 Method 2: From Tempo Worklogs'));
    console.log(chalk.white('1. Open Tempo in your browser'));
    console.log(chalk.white('2. Go to "My Work" or "Worklogs"'));
    console.log(chalk.white('3. Right-click → "Inspect Element" on any of your worklogs'));
    console.log(chalk.white('4. Look for data attributes containing your Account ID'));
    console.log(chalk.gray('   Search for "712020:" in the HTML\n'));

    console.log(chalk.yellow('📋 Method 3: From Browser Network Tab'));
    console.log(chalk.white('1. Open your JIRA/Tempo in browser'));
    console.log(chalk.white('2. Open Developer Tools (F12) → Network tab'));
    console.log(chalk.white('3. Navigate to any page or refresh'));
    console.log(chalk.white('4. Look for API calls containing "accountId"'));
    console.log(chalk.gray('   Account ID format: 712020:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\n'));

    console.log(chalk.yellow('📋 Method 4: Ask IT Admin'));
    console.log(chalk.white('Your IT administrator can provide your Atlassian Account ID'));
    console.log(chalk.gray('Especially helpful in enterprise environments\n'));

    const { shouldOpenBrowser } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldOpenBrowser',
        message: 'Would you like me to open your JIRA profile page?',
        default: true
      }
    ]);

    if (shouldOpenBrowser) {
      try {
        const profileUrl = `${this.config.api.jiraBaseUrl}/jira/people/search`;
        await require('open')(profileUrl);
        console.log(chalk.green('✅ Opened JIRA people search'));
        console.log(chalk.gray('Search for yourself and click on your profile to see your Account ID\n'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not open browser'));
        console.log(chalk.white(`Please manually visit: ${this.config.api.jiraBaseUrl}/jira/people/search\n`));
      }
    }

    console.log(chalk.blue('💡 Pro Tips:'));
    console.log(chalk.gray('• Account ID always starts with "712020:"'));
    console.log(chalk.gray('• The format is: 712020:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'));
    console.log(chalk.gray('• It\'s the same across all Atlassian products (JIRA, Confluence, Tempo)'));
    console.log(chalk.gray('• Once you find it, save it for future reference\n'));

    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter when you\'re ready to continue...'
      }
    ]);
  }

  async setupWorkspace() {
    console.log(chalk.yellow('\n📁 Step 2: Workspace Setup'));
    console.log(chalk.gray('Configure your file workspace and preferences\n'));

    const defaultWorkspace = path.join(os.homedir(), 'tempo-workspace');
    
    const workspaceConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'workspaceDir',
        message: 'Choose your workspace directory:',
        default: defaultWorkspace,
        validate: (input) => {
          try {
            const resolvedPath = path.resolve(input.trim());
            return true;
          } catch {
            return 'Please enter a valid directory path';
          }
        },
        filter: (input) => path.resolve(input.trim())
      },
      {
        type: 'input',
        name: 'importFile',
        message: 'Default import filename:',
        default: 'my-worklogs.csv',
        validate: (input) => {
          if (!input.trim()) return 'Import filename is required';
          if (!input.endsWith('.csv')) return 'Import file should be a .csv file';
          return true;
        }
      },
      {
        type: 'list',
        name: 'defaultDateScope',
        message: 'Default date scope for imports:',
        choices: [
          { name: 'Current week (Monday-Sunday)', value: 'current-week' },
          { name: 'Last 7 days', value: 'last-7-days' },
          { name: 'This month', value: 'this-month' },
          { name: 'All dates from file', value: 'all' }
        ],
        default: 'current-week'
      },
      {
        type: 'confirm',
        name: 'enableBetaFeatures',
        message: 'Enable beta features (advanced logging, reporting)?',
        default: false
      }
    ]);

    // Create workspace directory structure
    try {
      const workspaceDir = workspaceConfig.workspaceDir;
      const exportDir = path.join(workspaceDir, 'exports');
      const backupDir = path.join(workspaceDir, 'backups');
      const logsDir = path.join(workspaceDir, 'logs');

      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.mkdirSync(exportDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });
      fs.mkdirSync(logsDir, { recursive: true });

      console.log(chalk.green(`✅ Created workspace: ${workspaceDir}`));

      // Create sample import file template
      const sampleCsv = path.join(workspaceDir, workspaceConfig.importFile);
      const sampleContent = `date,startTime,endTime,issue,description
${new Date().toISOString().split('T')[0]},09:00:00,10:00:00,PROJECT-123,Sample work entry`;
      
      if (!fs.existsSync(sampleCsv)) {
        fs.writeFileSync(sampleCsv, sampleContent);
        console.log(chalk.blue(`📝 Created sample file: ${sampleCsv}`));
      }

    } catch (error) {
      throw new Error(`Failed to create workspace: ${error.message}`);
    }

    this.config.user.workspaceDir = workspaceConfig.workspaceDir;
    this.config.files = {
      importFile: workspaceConfig.importFile,
      exportDir: 'exports',
      backupDir: 'backups'
    };
    this.config.import = {
      defaultDateScope: workspaceConfig.defaultDateScope
    };
    this.config.cli = {
      function_beta: workspaceConfig.enableBetaFeatures,
      colorOutput: true,
      progressBars: true,
      verboseLogging: false,
      silentMode: false,
      logToFile: true
    };
    this.config.logging = {
      enabled: true,
      logFile: path.join(workspaceConfig.workspaceDir, 'logs', 'tempo-cli.log'),
      maxFileSize: '10MB',
      maxFiles: 5,
      level: 'info',
      consoleLevel: 'normal'
    };
    this.config.issueMapping = {};
  }

  async saveConfiguration() {
    console.log(chalk.yellow('\n💾 Step 3: Saving Configuration'));
    
    try {
      const configPath = path.join(process.cwd(), 'config.yaml');
      
      // Generate configuration from template with real values
      const configContent = this.generateSimplifiedConfigFromTemplate();
      
      fs.writeFileSync(configPath, configContent);
      console.log(chalk.green(`✅ Configuration saved to ${configPath}`));

      // Create .env file as backup
      const envPath = path.join(process.cwd(), '.env');
      if (!fs.existsSync(envPath)) {
        const envContent = `# Tempo CLI Environment Variables (Backup)
# Auto-generated on ${new Date().toISOString().split('T')[0]}
TEMPO_API_TOKEN=${this.config.api.tempoToken}
JIRA_BASE_URL=${this.config.api.jiraBaseUrl}
TEMPO_BASE_URL=https://api.tempo.io/4
NODE_ENV=production
`;

        fs.writeFileSync(envPath, envContent);
        console.log(chalk.blue('📋 Created .env backup file'));
      }

    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  generateSimplifiedConfigFromTemplate() {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Generate simplified config.yaml focused on static mapping
    return `# Tempo CLI Configuration
# Auto-generated by setup wizard on ${timestamp}
# Simplified setup focused on static issue mapping and workspace management

# API Configuration
api:
  # tempoToken: stored securely in system keychain
  jiraBaseUrl: "${this.config.api.jiraBaseUrl}"

# User Configuration
user:
  name: "${this.config.user.name}"
  accountId: "${this.config.user.accountId}"
  workspaceDir: "${this.config.user.workspaceDir}"

# File Management
files:
  importFile: "${this.config.files.importFile}"    # relative to workspaceDir
  exportDir: "${this.config.files.exportDir}"      # relative to workspaceDir
  backupDir: "${this.config.files.backupDir}"      # relative to workspaceDir

# Import Preferences
import:
  defaultDateScope: "${this.config.import.defaultDateScope}"  # options: current-week, last-7-days, this-month, all

# Issue Mappings - Add your JIRA issues here for CSV imports
# Use 'node add-issue.js' to easily add new issues
issueMapping:
  # Example entries - replace with your actual issues:
  # "PROJECT-123":
  #   id: "12345"
  #   summary: "Sample Project Task"
  # "MEETING-001":
  #   id: "67890"
  #   summary: "Team Meetings & Planning"

# Atlassian Configuration
atlassian:
  cloudId: "${this.config.atlassian.cloudId}"

# CLI Preferences
cli:
  function_beta: ${this.config.cli.function_beta}      # Show/hide beta functions
  colorOutput: ${this.config.cli.colorOutput}         # Enable colored terminal output
  progressBars: ${this.config.cli.progressBars}        # Show progress bars
  verboseLogging: ${this.config.cli.verboseLogging}     # Show detailed debug information
  silentMode: ${this.config.cli.silentMode}           # Minimize console output
  logToFile: ${this.config.cli.logToFile}             # Enable file logging

# Logging Configuration
logging:
  enabled: ${this.config.logging.enabled}
  logFile: "${this.config.logging.logFile}"
  maxFileSize: "${this.config.logging.maxFileSize}"
  maxFiles: ${this.config.logging.maxFiles}
  level: "${this.config.logging.level}"                  # debug, info, warn, error
  consoleLevel: "${this.config.logging.consoleLevel}"         # normal (transaction level), debug (system level)

# Setup Information
setup:
  version: "1.0"
  mode: "simplified"
  createdOn: "${timestamp}"
  wizard: true

# 📝 GETTING STARTED:
# 1. Add your JIRA issues to the issueMapping section above
# 2. Use 'node add-issue.js' to easily add new issues
# 3. Edit your CSV file at: ${this.config.user.workspaceDir}/${this.config.files.importFile}
# 4. Import your worklogs: tempo-booker import
#
# 🔍 NEED YOUR ACCOUNT ID?
# If Account ID discovery failed during setup:
# - Try automatic retrieval: node get-account-id.js
# - Or use manual discovery: node find-account-id.js
# - Then update the user.accountId field above
#
# 📖 For detailed setup instructions, see: docs/CONFIGURATION.md
`;
  }

  async showSetupComplete() {
    console.log(chalk.green.bold('\n🎉 Tempo Booker Setup Complete!'));
    console.log(chalk.gray('Your simplified Tempo Booker is ready for static issue mapping\n'));

    console.log(chalk.blue('📋 Configuration Summary:'));
    console.log(chalk.white(`• User: ${this.config.user.name} (${this.config.user.accountId})`));
    console.log(chalk.white(`• JIRA Instance: ${this.config.api.jiraBaseUrl}`));
    console.log(chalk.white(`• Workspace: ${this.config.user.workspaceDir}`));
    console.log(chalk.white(`• Import File: ${this.config.files.importFile}`));
    console.log(chalk.white(`• Beta Features: ${this.config.cli.function_beta ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.white(`• Configuration: Simplified (Static Mapping)`));

    console.log(chalk.yellow('\n🎫 Issue Mapping Setup:'));
    console.log(chalk.red('IMPORTANT: Add your JIRA issues before importing'));
    console.log(chalk.white('Method 1: Use the add-issue tool (recommended)'));
    console.log(chalk.gray('   node add-issue.js'));
    console.log(chalk.white('Method 2: Edit config.yaml manually'));
    console.log(chalk.gray('   Add entries under the issueMapping section'));

    console.log(chalk.yellow('\n🚀 Next Steps:'));
    console.log(chalk.white('1. Add your JIRA issues: node add-issue.js'));
    console.log(chalk.white(`2. Edit your import file: ${path.join(this.config.user.workspaceDir, this.config.files.importFile)}`));
    console.log(chalk.white('3. Test import: tempo-booker import'));
    console.log(chalk.white('4. Start interactive mode: tempo-booker'));

    console.log(chalk.blue('\n📁 Your Workspace:'));
    console.log(chalk.gray(`${this.config.user.workspaceDir}/`));
    console.log(chalk.gray(`├── ${this.config.files.importFile}     # Edit this to add your worklogs`));
    console.log(chalk.gray(`├── exports/        # Export files will be saved here`));
    console.log(chalk.gray(`├── backups/        # Automatic backups from clear operations`));
    console.log(chalk.gray(`└── logs/           # Application logs`));

    console.log(chalk.blue('\n📖 Documentation:'));
    console.log(chalk.white('• Static Issue Mapping Guide: docs/CONFIGURATION.md'));
    console.log(chalk.white('• CSV Format Examples: Sample file created in workspace'));
    console.log(chalk.white('• Command Help: tempo-booker --help'));

    console.log(chalk.gray('\n💡 Pro Tips:'));
    console.log(chalk.gray('• Use node add-issue.js to quickly add new JIRA issues'));
    console.log(chalk.gray('• Static mapping is perfect for regular issue sets'));
    console.log(chalk.gray('• Your data stays organized in the workspace directory'));
    console.log(chalk.gray('• Version control your issueMapping for team sharing'));

    console.log(chalk.green('\n✨ Happy time tracking with Tempo Booker!'));
    console.log(chalk.blue('Focus on what matters - your work, not complex configuration.'));
  }

  static async checkAndRunSetup() {
    const configPath = path.join(process.cwd(), 'config.yaml');
    
    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow('🔧 Configuration not found. Running first-time setup...'));
      const wizard = new SetupWizard();
      await wizard.run();
      return true; // Setup was run
    }
    
    // Check if existing config needs migration
    const ConfigMigration = require('./configMigration');
    const migrated = await ConfigMigration.migrateConfig();
    
    if (migrated) {
      console.log(chalk.green('\n✅ Configuration migrated successfully!'));
      return true; // Migration was run
    }
    
    return false; // No setup needed
  }
}

module.exports = SetupWizard;