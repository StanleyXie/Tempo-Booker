const { exec } = require('child_process');
const config = require('../utils/config');
const fs = require('fs');
const yaml = require('js-yaml');

class BrowserHelper {
  constructor() {
    this.jiraBaseUrl = config.yaml?.api?.jiraBaseUrl || 'https://witt-gruppe.atlassian.net';
  }

  /**
   * Open browser to JIRA endpoints for manual issue mapping
   */
  async openJiraEndpoints(issueKey) {
    console.log(`🌐 Opening JIRA endpoints for ${issueKey}...`);
    
    const urls = {
      browse: `${this.jiraBaseUrl}/browse/${issueKey}`,
      restApi: `${this.jiraBaseUrl}/rest/api/3/issue/${issueKey}`,
      search: `${this.jiraBaseUrl}/rest/api/3/search?jql=key="${issueKey}"&fields=id,key,summary`
    };

    console.log(`\n📋 JIRA URLs for ${issueKey}:`);
    console.log(`   Browse Issue: ${urls.browse}`);
    console.log(`   REST API: ${urls.restApi}`);
    console.log(`   Search API: ${urls.search}`);
    
    // Try to open the browse URL first (most user-friendly)
    try {
      await this.openUrl(urls.browse);
      console.log(`✅ Opened browser to: ${urls.browse}`);
      
      console.log(`\n📝 Manual Steps:`);
      console.log(`   1. Check if the issue exists and note the details`);
      console.log(`   2. If it exists, copy the issue ID from the page or URL`);
      console.log(`   3. For REST API data, visit: ${urls.restApi}`);
      console.log(`   4. Look for the "id" field in the JSON response`);
      console.log(`   5. Come back here and add the mapping using:`);
      console.log(`      npm start add-mapping ${issueKey} <issue-id> "<summary>"`);
      
    } catch (error) {
      console.log(`⚠️ Could not open browser: ${error.message}`);
      console.log(`📋 Please manually visit these URLs:`);
      console.log(`   ${urls.browse}`);
      console.log(`   ${urls.restApi}`);
    }

    return urls;
  }

  /**
   * Open URL in default browser (cross-platform)
   */
  async openUrl(url) {
    return new Promise((resolve, reject) => {
      let command;
      
      switch (process.platform) {
        case 'darwin': // macOS
          command = `open "${url}"`;
          break;
        case 'win32': // Windows
          command = `start "" "${url}"`;
          break;
        default: // Linux and others
          command = `xdg-open "${url}"`;
          break;
      }
      
      exec(command, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Add new issue mapping to config.yaml
   */
  async addMapping(issueKey, issueId, summary) {
    try {
      console.log(`📝 Adding mapping: ${issueKey} -> ${issueId}`);
      
      const configPath = config.getConfigPath();
      
      if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
      }
      
      // Read current config
      const configContent = fs.readFileSync(configPath, 'utf8');
      const configData = yaml.load(configContent);
      
      // Initialize issueMapping if it doesn't exist
      if (!configData.issueMapping) {
        configData.issueMapping = {};
      }
      
      // Add the new mapping
      configData.issueMapping[issueKey] = {
        id: String(issueId),
        summary: summary
      };
      
      // Write back to config
      const newConfigContent = yaml.dump(configData, {
        indent: 2,
        quotingType: '"',
        forceQuotes: false
      });
      
      fs.writeFileSync(configPath, newConfigContent, 'utf8');
      
      console.log(`✅ Added mapping to ${configPath}:`);
      console.log(`   ${issueKey}:`);
      console.log(`     id: "${issueId}"`);
      console.log(`     summary: "${summary}"`);
      
      // Reload config
      config.reload();
      
      return true;
    } catch (error) {
      console.log(`❌ Failed to add mapping: ${error.message}`);
      return false;
    }
  }

  /**
   * Interactive workflow for adding issue mapping
   */
  async interactiveMapping(issueKey) {
    console.log(`\n🎯 Interactive Mapping for ${issueKey}`);
    console.log('=' + '='.repeat(50));
    
    // Step 1: Open browser
    await this.openJiraEndpoints(issueKey);
    
    console.log(`\n⏳ Waiting for you to gather issue information...`);
    console.log(`   Visit the opened JIRA page and note:`);
    console.log(`   - Issue ID (numeric, e.g. 365350)`);
    console.log(`   - Issue Summary/Title`);
    
    // For now, just provide instructions
    // In a real CLI, you'd prompt for input here
    console.log(`\n➡️  Once you have the information, run:`);
    console.log(`   npm start add-mapping ${issueKey} <issue-id> "<summary>"`);
    console.log(`   Example: npm start add-mapping ${issueKey} 123456 "Issue title here"`);
    
    return true;
  }

  /**
   * List current mappings
   */
  listMappings() {
    const mappings = config.issueMapping || {};
    const count = Object.keys(mappings).length;
    
    console.log(`\n📋 Current Issue Mappings (${count} total):`);
    console.log('=' + '='.repeat(50));
    
    if (count === 0) {
      console.log('   No mappings configured yet');
      return;
    }
    
    Object.entries(mappings).forEach(([key, mapping]) => {
      console.log(`   ${key}:`);
      if (mapping && mapping.id) {
        console.log(`     id: "${mapping.id}"`);
        console.log(`     summary: "${mapping.summary}"`);
      } else {
        console.log(`     status: null (needs mapping)`);
      }
      console.log('');
    });
  }

  /**
   * Validate an existing mapping by opening its JIRA page
   */
  async validateMapping(issueKey) {
    const mappings = config.issueMapping || {};
    
    if (!mappings[issueKey]) {
      console.log(`❌ No mapping found for ${issueKey}`);
      return false;
    }
    
    const mapping = mappings[issueKey];
    console.log(`\n🔍 Validating mapping for ${issueKey}:`);
    console.log(`   Current: ID ${mapping.id} - "${mapping.summary}"`);
    
    await this.openJiraEndpoints(issueKey);
    
    console.log(`\n✅ Browser opened for validation`);
    console.log(`   Compare the web page with the stored mapping`);
    console.log(`   If different, use: npm start add-mapping ${issueKey} <new-id> "<new-summary>"`);
    
    return true;
  }
}

module.exports = BrowserHelper;