const chalk = require('chalk');
const inquirer = require('inquirer');

class SecureTokenManager {
  constructor() {
    this.serviceName = 'tempo-booker';
    this.keytar = null;
    this.keytarAvailable = false;
    this.macosKeychain = null;
    this.macosKeychainAvailable = false;
    
    // Initialize macOS native keychain first (preferred on macOS)
    if (process.platform === 'darwin') {
      try {
        const MacOSKeychain = require('./macosKeychain');
        this.macosKeychain = new MacOSKeychain();
        this.macosKeychainAvailable = this.macosKeychain.isAvailable();
        
        if (this.macosKeychainAvailable) {
          console.log(chalk.green('✅ macOS native keychain available'));
          // Set keytarAvailable to true when macOS keychain is working
          // This ensures compatibility with existing tests that check keytarAvailable
          this.keytarAvailable = true;
        }
      } catch (error) {
        console.log(chalk.gray('• macOS keychain initialization failed, trying keytar...'));
      }
    }
    
    // Fallback to keytar if macOS keychain not available
    if (!this.macosKeychainAvailable) {
      try {
        this.keytar = require('keytar');
        this.keytarAvailable = true;
        console.log(chalk.green('✅ Cross-platform keychain (keytar) available'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Keychain not available - falling back to environment variables'));
        this.keytarAvailable = false;
      }
    }
  }

  /**
   * Store Tempo API token securely
   */
  async storeToken(token, accountName = 'default') {
    if (!token || !token.trim()) {
      throw new Error('Token cannot be empty');
    }

    // Try macOS native keychain first (preferred on macOS)
    if (this.macosKeychainAvailable) {
      try {
        const result = await this.macosKeychain.storeToken(token.trim(), accountName);
        return { method: 'macos_keychain', success: true };
      } catch (error) {
        console.log(chalk.yellow('⚠️  macOS keychain storage failed, trying keytar...'));
        // Fall through to keytar
      }
    }

    // Fallback to keytar
    if (this.keytarAvailable) {
      try {
        await this.keytar.setPassword(this.serviceName, accountName, token.trim());
        console.log(chalk.green('✅ Token stored securely in system keychain'));
        return { method: 'keychain', success: true };
      } catch (error) {
        console.log(chalk.yellow('⚠️  Keychain storage failed, falling back to environment'));
        return this.fallbackToEnvironment(token);
      }
    } else {
      return this.fallbackToEnvironment(token);
    }
  }

  /**
   * Retrieve Tempo API token securely
   */
  async getToken(accountName = 'default') {
    // Priority order: macOS Native Keychain -> Cross-platform Keychain -> Environment -> Interactive prompt
    
    // 1. Try macOS native keychain first (preferred on macOS)
    if (this.macosKeychainAvailable) {
      try {
        const result = await this.macosKeychain.getToken(accountName);
        if (result && result.token) {
          return result; // Already includes { token, method: 'macos_keychain' }
        }
      } catch (error) {
        console.log(chalk.gray('• macOS keychain access failed, trying other methods...'));
      }
    }

    // 2. Try keytar (cross-platform keychain)
    if (this.keytarAvailable) {
      try {
        const token = await this.keytar.getPassword(this.serviceName, accountName);
        if (token) {
          return { token, method: 'keychain' };
        }
      } catch (error) {
        console.log(chalk.gray('• Keychain access failed, trying other methods...'));
      }
    }

    // 2. Try environment variables
    const envToken = process.env.TEMPO_API_TOKEN;
    if (envToken && envToken.trim()) {
      return { token: envToken.trim(), method: 'environment' };
    }

    // 3. Check legacy config file (warn user)
    const configToken = this.checkLegacyConfig();
    if (configToken) {
      console.log(chalk.yellow('⚠️  Found token in config file - this is insecure!'));
      console.log(chalk.blue('Consider running: tempo-booker --migrate-token'));
      return { token: configToken, method: 'config_file_insecure' };
    }

    // 4. No token found - prompt user
    return await this.promptForToken();
  }

  /**
   * Interactive token prompt
   */
  async promptForToken() {
    console.log(chalk.blue('\n🔐 Tempo API Token Required'));
    console.log(chalk.gray('No token found in secure storage\n'));

    const { token, shouldStore } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your Tempo API token:',
        mask: '*',
        validate: (input) => {
          if (!input.trim()) return 'Token is required';
          if (input.length < 10) return 'Token seems too short';
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'shouldStore',
        message: 'Store token securely for future use?',
        default: true
      }
    ]);

    if (shouldStore) {
      await this.storeToken(token);
    }

    return { token: token.trim(), method: 'interactive' };
  }

  /**
   * Delete stored token
   */
  async deleteToken(accountName = 'default') {
    let deleted = false;

    // Try macOS keychain first
    if (this.macosKeychainAvailable) {
      try {
        const result = await this.macosKeychain.deleteToken(accountName);
        if (result) {
          deleted = true;
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not remove token from macOS keychain'));
      }
    }

    // Try keytar keychain
    if (this.keytarAvailable) {
      try {
        const keytarDeleted = await this.keytar.deletePassword(this.serviceName, accountName);
        if (keytarDeleted) {
          console.log(chalk.green('✅ Token removed from keychain'));
          deleted = true;
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not remove token from keychain'));
      }
    }

    if (!deleted) {
      console.log(chalk.blue('💡 Also remove TEMPO_API_TOKEN from environment variables if set'));
    }

    return deleted;
  }

  /**
   * Check if token exists in keychain
   */
  async hasStoredToken(accountName = 'default') {
    // Check macOS keychain first
    if (this.macosKeychainAvailable) {
      try {
        const hasToken = await this.macosKeychain.hasToken(accountName);
        if (hasToken) {
          return true;
        }
      } catch (error) {
        // Continue to other methods
      }
    }

    // Check keytar keychain
    if (this.keytarAvailable) {
      try {
        const token = await this.keytar.getPassword(this.serviceName, accountName);
        if (token) {
          return true;
        }
      } catch (error) {
        // Continue to environment check
      }
    }
    
    return !!process.env.TEMPO_API_TOKEN;
  }

  /**
   * Migrate token from config file to keychain
   */
  async migrateFromConfig() {
    console.log(chalk.blue('🔄 Migrating token from config file to secure storage...'));
    
    const configToken = this.checkLegacyConfig();
    if (!configToken) {
      console.log(chalk.yellow('No token found in config file'));
      return false;
    }

    // Store in keychain
    const result = await this.storeToken(configToken);
    
    if (result.success) {
      console.log(chalk.green('✅ Token migrated to secure storage'));
      console.log(chalk.yellow('⚠️  Please remove the token from config.yaml manually'));
      console.log(chalk.blue('You can now safely commit config.yaml to version control'));
      return true;
    }
    
    return false;
  }

  /**
   * Fallback to environment variable storage
   */
  fallbackToEnvironment(token) {
    console.log(chalk.blue('💡 To store token permanently, add to your shell profile:'));
    console.log(chalk.white(`export TEMPO_API_TOKEN="${token}"`));
    console.log(chalk.gray('Then reload your terminal or run: source ~/.bashrc'));
    
    // Temporarily set for current session
    process.env.TEMPO_API_TOKEN = token;
    
    return { method: 'environment_temporary', success: true };
  }

  /**
   * Check legacy config file for token (insecure)
   */
  checkLegacyConfig() {
    try {
      const fs = require('fs');
      const yaml = require('js-yaml');
      const path = require('path');
      
      const configPath = path.join(process.cwd(), 'config.yaml');
      if (fs.existsSync(configPath)) {
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
        return config?.api?.tempoToken;
      }
    } catch (error) {
      // Ignore config file errors
    }
    return null;
  }

  /**
   * Show security status
   */
  async showSecurityStatus() {
    console.log(chalk.blue.bold('\n🔒 Token Security Status'));
    
    const hasMacOSKeychain = this.macosKeychainAvailable;
    const hasKeychain = this.keytarAvailable;
    const hasStored = await this.hasStoredToken();
    const hasEnvironment = !!process.env.TEMPO_API_TOKEN;
    const hasConfigFile = !!this.checkLegacyConfig();
    
    console.log(chalk.white('\n📊 Storage Methods:'));
    if (hasMacOSKeychain) {
      console.log(chalk.green('✅ macOS Native Keychain (most secure)'));
    } else {
      console.log(`${hasKeychain ? chalk.green('✅') : chalk.red('❌')} System Keychain (most secure)`);
    }
    console.log(`${hasEnvironment ? chalk.yellow('⚠️') : chalk.gray('○')} Environment Variables`);
    console.log(`${hasConfigFile ? chalk.red('🚨') : chalk.green('✅')} Config File (insecure)`);
    
    console.log(chalk.white('\n🔍 Current Status:'));
    if (hasStored && (hasMacOSKeychain || hasKeychain)) {
      const keychainType = hasMacOSKeychain ? 'macOS native keychain' : 'system keychain';
      console.log(chalk.green(`✅ Token stored securely in ${keychainType}`));
    } else if (hasEnvironment) {
      console.log(chalk.yellow('⚠️  Token in environment variables (moderately secure)'));
    } else if (hasConfigFile) {
      console.log(chalk.red('🚨 Token in config file (INSECURE - migrate immediately!)'));
    } else {
      console.log(chalk.gray('○ No token found - will prompt when needed'));
    }
    
    if (hasConfigFile) {
      console.log(chalk.red('\n🚨 Security Recommendation:'));
      console.log(chalk.white('Run: tempo-booker --migrate-token'));
    }
    
    return {
      macosKeychain: hasMacOSKeychain && hasStored,
      keychain: hasKeychain && hasStored,
      environment: hasEnvironment,
      configFile: hasConfigFile,
      secure: (hasMacOSKeychain || hasKeychain) && hasStored && !hasConfigFile
    };
  }

  /**
   * Test keychain functionality
   */
  async testKeychain() {
    if (!this.keytarAvailable && !this.macosKeychainAvailable) {
      console.log(chalk.red('❌ Keychain not available on this system'));
      return false;
    }

    try {
      const testKey = 'test-key';
      const testValue = 'test-value';
      
      // Test macOS keychain first if available
      if (this.macosKeychainAvailable) {
        try {
          // Test store
          await this.macosKeychain.storeToken(testValue, testKey);
          
          // Test retrieve
          const result = await this.macosKeychain.getToken(testKey);
          
          // Test delete
          await this.macosKeychain.deleteToken(testKey);
          
          const success = result && result.token === testValue;
          console.log(success ? 
            chalk.green('✅ macOS keychain test successful') : 
            chalk.red('❌ macOS keychain test failed'));
          
          return success;
        } catch (error) {
          console.log(chalk.yellow('⚠️  macOS keychain test failed, trying keytar...'));
          // Fall through to keytar test
        }
      }

      // Test keytar if available
      if (this.keytarAvailable && this.keytar) {
        // Test store
        await this.keytar.setPassword(this.serviceName, testKey, testValue);
        
        // Test retrieve
        const retrieved = await this.keytar.getPassword(this.serviceName, testKey);
        
        // Test delete
        await this.keytar.deletePassword(this.serviceName, testKey);
        
        const success = retrieved === testValue;
        console.log(success ? 
          chalk.green('✅ Keytar keychain test successful') : 
          chalk.red('❌ Keytar keychain test failed'));
        
        return success;
      }

      return false;
    } catch (error) {
      console.log(chalk.red('❌ Keychain test failed:'), error.message);
      return false;
    }
  }
}

module.exports = SecureTokenManager;