const { execSync, exec } = require('child_process');
const chalk = require('chalk');

class MacOSKeychain {
  constructor() {
    this.serviceName = 'tempo-booker';
    this.isMacOS = process.platform === 'darwin';
  }

  /**
   * Check if we're on macOS and keychain is available
   */
  isAvailable() {
    if (!this.isMacOS) {
      return false;
    }

    try {
      // Test if security command is available
      execSync('which security', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store token in macOS keychain using native security command
   */
  async storeToken(token, accountName = 'default') {
    if (!this.isAvailable()) {
      throw new Error('macOS keychain not available');
    }

    try {
      // First, try to update existing entry
      const updateCmd = `security add-generic-password -a "${accountName}" -s "${this.serviceName}" -w "${token}" -U`;
      
      try {
        execSync(updateCmd, { stdio: 'ignore' });
        console.log(chalk.green('✅ Token updated in macOS keychain'));
        return { success: true, action: 'updated' };
      } catch (updateError) {
        // If update fails, try to add new entry
        const addCmd = `security add-generic-password -a "${accountName}" -s "${this.serviceName}" -w "${token}"`;
        execSync(addCmd, { stdio: 'ignore' });
        console.log(chalk.green('✅ Token stored in macOS keychain'));
        return { success: true, action: 'added' };
      }
    } catch (error) {
      // Handle specific keychain errors
      if (error.message.includes('already exists')) {
        // Try to delete and re-add
        try {
          await this.deleteToken(accountName);
          const addCmd = `security add-generic-password -a "${accountName}" -s "${this.serviceName}" -w "${token}"`;
          execSync(addCmd, { stdio: 'ignore' });
          console.log(chalk.green('✅ Token replaced in macOS keychain'));
          return { success: true, action: 'replaced' };
        } catch (replaceError) {
          throw new Error(`Failed to replace token: ${replaceError.message}`);
        }
      }
      
      if (error.message.includes('user interaction is not allowed')) {
        throw new Error('Keychain access denied. Please grant permission in System Preferences > Security & Privacy');
      }
      
      throw new Error(`Keychain storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve token from macOS keychain
   */
  async getToken(accountName = 'default') {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const cmd = `security find-generic-password -a "${accountName}" -s "${this.serviceName}" -w`;
      const token = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      
      if (token) {
        return { token, method: 'macos_keychain' };
      }
      return null;
    } catch (error) {
      if (error.message.includes('could not be found')) {
        return null; // Token doesn't exist
      }
      
      if (error.message.includes('user interaction is not allowed')) {
        console.log(chalk.yellow('⚠️  Keychain access requires user permission'));
        return null;
      }
      
      // Log error but don't throw - allow fallback
      console.log(chalk.gray('• Keychain access failed, trying other methods...'));
      return null;
    }
  }

  /**
   * Delete token from macOS keychain
   */
  async deleteToken(accountName = 'default') {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const cmd = `security delete-generic-password -a "${accountName}" -s "${this.serviceName}"`;
      execSync(cmd, { stdio: 'ignore' });
      console.log(chalk.green('✅ Token removed from macOS keychain'));
      return true;
    } catch (error) {
      if (error.message.includes('could not be found')) {
        console.log(chalk.yellow('⚠️  Token not found in keychain'));
        return false;
      }
      
      console.log(chalk.red('❌ Failed to delete token from keychain:'), error.message);
      return false;
    }
  }

  /**
   * Check if token exists in keychain
   */
  async hasToken(accountName = 'default') {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const cmd = `security find-generic-password -a "${accountName}" -s "${this.serviceName}"`;
      execSync(cmd, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Setup keychain access permissions automatically
   */
  async setupKeychainAccess() {
    if (!this.isAvailable()) {
      return false;
    }

    console.log(chalk.blue('🔧 Setting up macOS keychain access...'));

    try {
      // Check if we can access keychain
      const testResult = await this.testAccess();
      
      if (testResult.success) {
        console.log(chalk.green('✅ Keychain access already configured'));
        return true;
      }

      // If access fails, provide user guidance
      console.log(chalk.yellow('🔐 Keychain Access Setup Required'));
      console.log(chalk.white('macOS requires permission to store secure tokens.'));
      console.log(chalk.white('\n📋 Setup Steps:'));
      console.log(chalk.white('1. When prompted, click "Always Allow" in the keychain dialog'));
      console.log(chalk.white('2. Or open Keychain Access > Preferences > Reset My Default Keychain'));
      console.log(chalk.white('3. Enter your login password when requested\n'));

      // Try a test operation to trigger permission dialog
      try {
        await this.storeToken('test-setup-token', 'setup-test');
        await this.deleteToken('setup-test');
        console.log(chalk.green('✅ Keychain access configured successfully'));
        return true;
      } catch (error) {
        console.log(chalk.red('❌ Keychain setup failed'));
        return false;
      }

    } catch (error) {
      console.log(chalk.red('❌ Keychain setup error:'), error.message);
      return false;
    }
  }

  /**
   * Test keychain access
   */
  async testAccess() {
    if (!this.isAvailable()) {
      return { success: false, error: 'Not available on this platform' };
    }

    try {
      const testToken = 'keychain-test-' + Date.now();
      const testAccount = 'test-access';

      // Test store
      await this.storeToken(testToken, testAccount);
      
      // Test retrieve
      const result = await this.getToken(testAccount);
      
      // Test delete
      await this.deleteToken(testAccount);

      const success = result && result.token === testToken;
      
      return {
        success,
        error: success ? null : 'Token storage/retrieval mismatch'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get detailed keychain information
   */
  async getKeychainInfo() {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Get keychain list
      const keychainList = execSync('security list-keychains', { encoding: 'utf8' });
      
      // Get default keychain
      const defaultKeychain = execSync('security default-keychain', { encoding: 'utf8' }).trim();
      
      // Check if our service exists
      const hasToken = await this.hasToken();

      return {
        available: true,
        keychains: keychainList.split('\n').filter(line => line.trim()),
        defaultKeychain: defaultKeychain.replace(/"/g, ''),
        hasToken,
        serviceName: this.serviceName
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Open Keychain Access app to show stored token
   */
  async openKeychainAccess() {
    if (!this.isMacOS) {
      return false;
    }

    try {
      execSync('open "/Applications/Utilities/Keychain Access.app"');
      console.log(chalk.green('✅ Opened Keychain Access'));
      console.log(chalk.gray(`Search for "${this.serviceName}" to find your stored token`));
      return true;
    } catch (error) {
      console.log(chalk.red('❌ Failed to open Keychain Access'));
      return false;
    }
  }

  /**
   * Auto-configure keychain with optimal settings
   */
  async autoConfigureKeychain() {
    console.log(chalk.blue('🚀 Auto-configuring macOS keychain...'));

    if (!this.isAvailable()) {
      console.log(chalk.red('❌ macOS keychain not available'));
      return false;
    }

    try {
      // Step 1: Test current access
      const accessTest = await this.testAccess();
      
      if (accessTest.success) {
        console.log(chalk.green('✅ Keychain already properly configured'));
        return true;
      }

      // Step 2: Setup permissions
      console.log(chalk.blue('🔐 Configuring keychain permissions...'));
      const setupResult = await this.setupKeychainAccess();
      
      if (!setupResult) {
        console.log(chalk.yellow('⚠️  Manual keychain setup may be required'));
        return false;
      }

      // Step 3: Verify configuration
      const verifyTest = await this.testAccess();
      
      if (verifyTest.success) {
        console.log(chalk.green('✅ macOS keychain auto-configuration complete'));
        return true;
      } else {
        console.log(chalk.red('❌ Auto-configuration failed:', verifyTest.error));
        return false;
      }

    } catch (error) {
      console.log(chalk.red('❌ Auto-configuration error:'), error.message);
      return false;
    }
  }

  /**
   * Show keychain status and recommendations
   */
  async showStatus() {
    console.log(chalk.blue('🍎 macOS Keychain Status'));

    if (!this.isMacOS) {
      console.log(chalk.gray('• Not running on macOS'));
      return;
    }

    const info = await this.getKeychainInfo();
    
    if (!info || !info.available) {
      console.log(chalk.red('❌ Keychain not available'));
      console.log(chalk.white('• Install Xcode Command Line Tools: xcode-select --install'));
      return;
    }

    console.log(chalk.green('✅ macOS keychain available'));
    console.log(chalk.white(`• Default keychain: ${info.defaultKeychain}`));
    console.log(chalk.white(`• Service name: ${info.serviceName}`));
    
    if (info.hasToken) {
      console.log(chalk.green('✅ Token stored in keychain'));
    } else {
      console.log(chalk.gray('○ No token stored yet'));
    }

    // Test access
    const accessTest = await this.testAccess();
    if (accessTest.success) {
      console.log(chalk.green('✅ Keychain access working properly'));
    } else {
      console.log(chalk.yellow('⚠️  Keychain access issue:'), accessTest.error);
      console.log(chalk.blue('💡 Fix: Run tempo-booker --setup-keychain'));
    }
  }
}

module.exports = MacOSKeychain;