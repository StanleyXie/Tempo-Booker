#!/usr/bin/env node

const chalk = require('chalk');
const inquirer = require('inquirer');
const TokenHelpers = require('./src/utils/tokenHelpers');

async function getAccountIdAutomatically() {
  console.log(chalk.blue.bold('\n🤖 Automatic Account ID Retrieval'));
  console.log(chalk.gray('This tool automatically finds your Account ID using your Tempo API token\n'));
  
  try {
    // Get Tempo API token and JIRA URL
    const config = await inquirer.prompt([
      {
        type: 'input',
        name: 'jiraBaseUrl',
        message: 'Enter your JIRA base URL (e.g., https://company.atlassian.net):',
        validate: (input) => {
          if (!input.trim()) return 'JIRA base URL is required';
          try {
            new URL(input.trim());
            return input.includes('atlassian.net') ? true : 'Please enter a valid Atlassian URL';
          } catch {
            return 'Please enter a valid URL';
          }
        },
        filter: (input) => input.trim().replace(/\/$/, '')
      },
      {
        type: 'password',
        name: 'tempoToken',
        message: 'Enter your Tempo API token:',
        mask: '*',
        validate: (input) => {
          if (!input.trim()) return 'Tempo API token is required';
          if (input.trim().length < 10) return 'Token seems too short - please check';
          return true;
        },
        filter: (input) => input.trim()
      }
    ]);

    // Validate token first
    console.log(chalk.blue('\n🔍 Validating Tempo API token...'));
    const validation = await TokenHelpers.validateTempoToken(config.tempoToken, config.jiraBaseUrl);
    
    if (!validation.valid) {
      console.log(chalk.red('\n❌ Token validation failed'));
      console.log(chalk.yellow('Please check your token and try again'));
      process.exit(1);
    }

    console.log(chalk.green('✅ Token validated successfully\n'));

    // Attempt automatic Account ID retrieval
    const result = await TokenHelpers.getAccountIdFromTempo(config.tempoToken, config.jiraBaseUrl);
    
    if (result.success) {
      console.log(chalk.green.bold('\n🎉 Account ID Retrieved Successfully!'));
      console.log(chalk.white(`Name: ${result.name}`));
      console.log(chalk.white(`Account ID: ${result.accountId}`));
      console.log(chalk.gray(`Detection Method: ${result.method}`));
      
      console.log(chalk.blue('\n📝 Next Steps:'));
      console.log(chalk.white('1. Save this Account ID for future reference'));
      console.log(chalk.white('2. Use it in your tempo CLI setup: tempo-booker --setup'));
      console.log(chalk.white('3. Or add it directly to your config.yaml file'));
      
      // Offer to save to a note file
      const { saveToFile } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveToFile',
          message: 'Would you like to save this information to a file?',
          default: true
        }
      ]);
      
      if (saveToFile) {
        const fs = require('fs');
        const accountInfo = `# Atlassian Account Information
# Retrieved on: ${new Date().toISOString()}
# JIRA Instance: ${config.jiraBaseUrl}

Name: ${result.name}
Account ID: ${result.accountId}
Detection Method: ${result.method}

# Use this Account ID in your Tempo CLI configuration
# config.yaml:
user:
  name: "${result.name}"
  accountId: "${result.accountId}"
`;
        
        fs.writeFileSync('my-account-info.txt', accountInfo);
        console.log(chalk.green('✅ Account information saved to my-account-info.txt'));
      }
      
    } else {
      console.log(chalk.yellow.bold('\n⚠️  Automatic Retrieval Failed'));
      console.log(chalk.white('Reason: ' + result.error));
      
      console.log(chalk.blue('\n🔍 Alternative Options:'));
      console.log(chalk.white('1. Use the manual discovery tool: node find-account-id.js'));
      console.log(chalk.white('2. Check if you have recent worklogs in Tempo'));
      console.log(chalk.white('3. Verify your API token has sufficient permissions'));
      console.log(chalk.white('4. Contact your IT administrator for assistance'));
      
      const { tryManual } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'tryManual',
          message: 'Would you like to try the manual discovery method?',
          default: true
        }
      ]);
      
      if (tryManual) {
        console.log(chalk.blue('\n🔍 Switching to manual discovery...'));
        const manualResult = await TokenHelpers.queryAccountIdInteractive();
        if (manualResult) {
          console.log(chalk.green(`\n✅ Manual discovery successful: ${manualResult}`));
        }
      }
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error during Account ID retrieval:'), error.message);
    console.log(chalk.yellow('\n💡 Try the manual method: node find-account-id.js'));
    process.exit(1);
  }
}

if (require.main === module) {
  getAccountIdAutomatically();
}

module.exports = { getAccountIdAutomatically };