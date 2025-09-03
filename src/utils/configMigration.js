const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const inquirer = require('inquirer');
const os = require('os');

class ConfigMigration {
  static async migrateConfig() {
    const configPath = path.join(process.cwd(), 'config.yaml');
    
    if (!fs.existsSync(configPath)) {
      return false; // No config to migrate
    }

    try {
      const existingConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));
      
      // Check if it's already in new format
      if (existingConfig.api && existingConfig.user?.workspaceDir) {
        return false; // Already migrated
      }

      console.log(chalk.yellow('\n🔄 Configuration Migration Needed'));
      console.log(chalk.gray('Your config.yaml needs to be updated to the new format\n'));

      const migrate = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Would you like to migrate your configuration now?',
          default: true
        }
      ]);

      if (!migrate.proceed) {
        console.log(chalk.yellow('Migration skipped. You can run --setup to reconfigure later.'));
        return false;
      }

      await this.performMigration(existingConfig, configPath);
      return true;

    } catch (error) {
      console.error(chalk.red('Migration failed:'), error.message);
      return false;
    }
  }

  static async performMigration(oldConfig, configPath) {
    console.log(chalk.blue('🔧 Migrating configuration...'));

    // Create backup
    const backupPath = configPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, fs.readFileSync(configPath));
    console.log(chalk.gray(`📋 Backup created: ${backupPath}`));

    // Build new config structure
    const newConfig = {};

    // Migrate API configuration from old structure only
    newConfig.api = {
      tempoToken: "your_tempo_api_token_here",
      jiraBaseUrl: oldConfig.jiraBaseUrl || "https://your-company.atlassian.net"
    };

    // Note: API tokens now managed through secure keychain storage

    // Migrate user configuration
    const defaultWorkspace = path.join(os.homedir(), 'tempo-workspace');
    const workspaceDir = await inquirer.prompt([
      {
        type: 'input',
        name: 'directory',
        message: 'Choose workspace directory for your files:',
        default: defaultWorkspace,
        validate: (input) => {
          try {
            const resolved = path.resolve(input.trim());
            return true;
          } catch {
            return 'Please enter a valid directory path';
          }
        },
        filter: (input) => path.resolve(input.trim())
      }
    ]);

    newConfig.user = {
      name: oldConfig.user?.name || "Your Name",
      accountId: oldConfig.user?.accountId || "your_account_id_here",
      workspaceDir: workspaceDir.directory
    };

    // Create workspace directory
    try {
      fs.mkdirSync(workspaceDir.directory, { recursive: true });
      fs.mkdirSync(path.join(workspaceDir.directory, 'exports'), { recursive: true });
      fs.mkdirSync(path.join(workspaceDir.directory, 'backups'), { recursive: true });
      fs.mkdirSync(path.join(workspaceDir.directory, 'logs'), { recursive: true });
      console.log(chalk.green(`✅ Created workspace: ${workspaceDir.directory}`));
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not create workspace directory: ${error.message}`));
    }

    // Migrate file configuration
    newConfig.files = {
      importFile: oldConfig.import?.defaultFile || "my-worklogs.csv",
      exportDir: "exports",
      backupDir: "backups"
    };

    // Migrate import configuration
    newConfig.import = {
      defaultDateScope: oldConfig.import?.defaultDateScope || "current-week"
    };

    // Migrate issue mapping
    newConfig.issueMapping = oldConfig.issueMapping || {};

    // Migrate Atlassian configuration
    newConfig.atlassian = {
      cloudId: oldConfig.atlassian?.cloudId || "auto-discovered"
    };

    // Migrate CLI configuration
    newConfig.cli = {
      function_beta: oldConfig.cli?.function_beta || false,
      colorOutput: oldConfig.cli?.colorOutput !== false,
      progressBars: oldConfig.cli?.progressBars !== false,
      verboseLogging: oldConfig.cli?.verboseLogging || false,
      silentMode: oldConfig.cli?.silentMode || false,
      logToFile: oldConfig.cli?.logToFile !== false
    };

    // Migrate logging configuration
    newConfig.logging = {
      enabled: oldConfig.logging?.enabled !== false,
      logFile: path.join(workspaceDir.directory, 'logs', 'tempo-cli.log'),
      maxFileSize: oldConfig.logging?.maxFileSize || "10MB",
      maxFiles: oldConfig.logging?.maxFiles || 5,
      level: oldConfig.logging?.level || "info",
      consoleLevel: oldConfig.logging?.consoleLevel || "normal"
    };

    // Write new configuration
    const header = `# Tempo CLI Configuration
# Migrated on ${new Date().toISOString().split('T')[0]}
# Original backed up to ${path.basename(backupPath)}

`;

    const yamlContent = yaml.dump(newConfig, {
      indent: 2,
      lineWidth: 120,
      noCompatMode: true
    });

    fs.writeFileSync(configPath, header + yamlContent);
    
    console.log(chalk.green('✅ Configuration migrated successfully!'));
    console.log(chalk.blue(`📁 Workspace: ${workspaceDir.directory}`));
    console.log(chalk.gray(`📋 Original config backed up: ${path.basename(backupPath)}`));

    // Migrate existing CSV file if it exists
    const oldImportFile = oldConfig.import?.defaultFile;
    if (oldImportFile && fs.existsSync(oldImportFile)) {
      const newImportFile = path.join(workspaceDir.directory, newConfig.files.importFile);
      try {
        fs.copyFileSync(oldImportFile, newImportFile);
        console.log(chalk.blue(`📝 Migrated import file: ${oldImportFile} → ${newImportFile}`));
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not migrate import file: ${error.message}`));
      }
    }

    console.log(chalk.yellow('\n💡 Next steps:'));
    console.log(chalk.white('1. Update API tokens in config.yaml if needed'));
    console.log(chalk.white('2. Your files are now organized in the workspace directory'));
    console.log(chalk.white('3. Run tempo-booker to start using the updated CLI'));
  }
}

module.exports = ConfigMigration;