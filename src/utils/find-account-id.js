#!/usr/bin/env node

const chalk = require('chalk');
const TokenHelpers = require('./src/utils/tokenHelpers');

async function findAccountId() {
  console.log(chalk.blue.bold('\n🔍 Atlassian Account ID Discovery Tool'));
  console.log(chalk.gray('This tool helps you find your Atlassian Account ID for Tempo CLI setup\n'));
  
  try {
    const accountId = await TokenHelpers.queryAccountIdInteractive();
    
    if (accountId) {
      console.log(chalk.green.bold('\n🎉 Success!'));
      console.log(chalk.white(`Your Account ID: ${accountId}`));
      console.log(chalk.gray('\n📝 Next steps:'));
      console.log(chalk.white('1. Save this Account ID for future reference'));
      console.log(chalk.white('2. Use it when running: tempo-booker --setup'));
      console.log(chalk.white('3. Or manually add it to your config.yaml file'));
    } else {
      console.log(chalk.yellow('\n⚠️  Account ID not found'));
      console.log(chalk.white('Try contacting your IT administrator or a colleague who uses Atlassian tools'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error finding Account ID:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  findAccountId();
}

module.exports = { findAccountId };