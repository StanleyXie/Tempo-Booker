#!/usr/bin/env node

const chalk = require('chalk');
const SecureTokenManager = require('./src/utils/secureTokenManager');

async function migrateToken() {
  console.log(chalk.blue.bold('\n🔄 Token Migration Tool'));
  console.log(chalk.gray('Migrate your API token from insecure storage to system keychain\n'));

  try {
    const tokenManager = new SecureTokenManager();
    
    // Show current security status
    console.log(chalk.blue('📊 Current Security Status:'));
    await tokenManager.showSecurityStatus();
    
    // Perform migration
    const success = await tokenManager.migrateFromConfig();
    
    if (success) {
      console.log(chalk.green.bold('\n🎉 Migration Successful!'));
      console.log(chalk.white('Your token is now stored securely in the system keychain.'));
      
      console.log(chalk.yellow('\n⚠️  Next Steps:'));
      console.log(chalk.white('1. Remove the tempoToken line from config.yaml'));
      console.log(chalk.white('2. You can now safely commit config.yaml to version control'));
      console.log(chalk.white('3. Your token will be loaded automatically from keychain'));
      
      console.log(chalk.blue('\n🔒 Security Benefits:'));
      console.log(chalk.gray('• Token encrypted by operating system'));
      console.log(chalk.gray('• No accidental version control commits'));
      console.log(chalk.gray('• Automatic secure access management'));
      console.log(chalk.gray('• Cross-platform compatibility'));
      
    } else {
      console.log(chalk.yellow('\n⚠️  Migration not completed'));
      console.log(chalk.white('This may happen if:'));
      console.log(chalk.white('• No token found in config.yaml'));
      console.log(chalk.white('• Keychain is not available on this system'));
      console.log(chalk.white('• Token is already stored securely'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Migration failed:'), error.message);
    console.log(chalk.yellow('\n💡 Alternatives:'));
    console.log(chalk.white('• Use environment variables: export TEMPO_API_TOKEN="your_token"'));
    console.log(chalk.white('• Check keychain availability: tempo-booker --test-keychain'));
    process.exit(1);
  }
}

if (require.main === module) {
  migrateToken();
}

module.exports = { migrateToken };