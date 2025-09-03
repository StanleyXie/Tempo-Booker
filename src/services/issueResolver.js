const config = require('../utils/config');

class IssueResolver {
  constructor() {
    this.mcpService = null;
    this.apiService = null;
    this.cache = new Map(); // Simple in-memory cache for resolved issues
  }

  /**
   * MCP service is deprecated - removed to avoid dependency
   */
  getMCPService() {
    return null;
  }

  /**
   * Get API service instance (lazy loading)
   */
  getAPIService() {
    if (!this.apiService) {
      this.apiService = require('./tempoApiService');
    }
    return this.apiService;
  }

  /**
   * Enhanced issue resolution with multiple fallback methods
   */
  async resolveIssue(issueKey, silent = false) {
    if (!issueKey) {
      throw new Error('Issue key is required');
    }

    // Check cache first
    if (this.cache.has(issueKey)) {
      if (!silent) console.log(`💾 Cache: Using cached resolution for ${issueKey}`);
      return this.cache.get(issueKey);
    }

    const resolverConfig = config.yaml?.issueResolution || {
      useConfigMappings: true,
      useManualMappingHelper: true,
      autoSuggestMappings: true
    };

    if (!silent) console.log(`🔍 Resolving issue: ${issueKey} (Config: ${resolverConfig.useConfigMappings}, ManualHelper: ${resolverConfig.useManualMappingHelper})`);

    // Method 1: Config mappings (fastest and most reliable)
    if (resolverConfig.useConfigMappings) {
      const configResult = this.resolveFromConfig(issueKey, silent);
      if (configResult) {
        this.cache.set(issueKey, configResult);
        return configResult;
      }
    }

    // Method 2: Manual mapping helper (if enabled)
    if (resolverConfig.useManualMappingHelper) {
      if (!silent) {
        console.log(`❌ Issue ${issueKey} not found in config mappings`);
        console.log(`🌐 Use manual helper to get mapping information:`);
        console.log(`   Run: npm start manual-mapping ${issueKey}`);
        console.log(`   Or: node src/index.js manual-mapping ${issueKey}`);
      }
      return null;
    }

    if (!silent) console.log(`❌ Could not resolve ${issueKey} using any available method`);
    return null;
  }

  /**
   * Resolve from config mappings
   */
  resolveFromConfig(issueKey, silent = false) {
    const knownIssues = config.issueMapping || {};
    
    if (knownIssues[issueKey]) {
      const issueInfo = knownIssues[issueKey];
      if (!silent) console.log(`✅ Config: ${issueKey} -> ID ${issueInfo.id}`);
      return {
        id: parseInt(issueInfo.id),
        key: issueKey,
        summary: issueInfo.summary,
        method: 'config'
      };
    }
    
    return null;
  }

  /**
   * Open browser helper for manual issue mapping
   */
  openManualMappingHelper(issueKey, silent = false) {
    const jiraBaseUrl = config.yaml?.api?.jiraBaseUrl || 'https://witt-gruppe.atlassian.net';
    const urls = {
      issue: `${jiraBaseUrl}/rest/api/3/issue/${issueKey}`,
      browse: `${jiraBaseUrl}/browse/${issueKey}`,
      search: `${jiraBaseUrl}/rest/api/3/search?jql=key="${issueKey}"&fields=id,key,summary`
    };

    if (!silent) {
      console.log(`🌐 Opening JIRA API endpoints for ${issueKey}:`);
      console.log(`   Issue API: ${urls.issue}`);
      console.log(`   Browse: ${urls.browse}`);
      console.log(`   Search API: ${urls.search}`);
    }

    return urls;
  }

  /**
   * Suggest adding successful API resolution to config
   */
  suggestConfigMapping(issueKey, issueDetails) {
    console.log(`💡 Suggestion: Add ${issueKey} to config.yaml for faster future resolution:`);
    console.log(`   ${issueKey}:`);
    console.log(`     id: "${issueDetails.id}"`);
    console.log(`     summary: "${issueDetails.summary}"`);
  }

  /**
   * Get resolution statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      configMappings: Object.keys(config.issueMapping || {}).length,
      manualHelperAvailable: true
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new IssueResolver();