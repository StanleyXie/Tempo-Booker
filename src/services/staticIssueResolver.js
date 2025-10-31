const config = require('../utils/config');

class StaticIssueResolver {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Resolve issue using only static config mappings
   */
  async resolveIssue(issueKey, silent = false) {
    if (!issueKey) {
      throw new Error('Issue key is required');
    }

    // Check cache first
    if (this.cache.has(issueKey)) {
      if (!silent) console.log(`💾 Using cached resolution for ${issueKey}`);
      return this.cache.get(issueKey);
    }

    if (!silent) console.log(`🔍 Resolving issue: ${issueKey}`);

    // Get issue mappings from config
    const knownIssues = config.issueMapping || {};
    
    if (knownIssues[issueKey]) {
      const issueInfo = knownIssues[issueKey];
      const result = {
        id: parseInt(issueInfo.id),
        key: issueKey,
        summary: issueInfo.summary,
        method: 'static'
      };
      
      if (!silent) console.log(`✅ Resolved: ${issueKey} -> ID ${issueInfo.id}`);
      
      // Cache the result
      this.cache.set(issueKey, result);
      return result;
    }

    if (!silent) {
      console.log(`❌ Unknown issue: ${issueKey}`);
      console.log(`💡 Add mapping for ${issueKey} to config.yaml under issueMapping section:`);
      console.log(`   "${issueKey}":`);
      console.log(`     id: "your_issue_id_here"`);
      console.log(`     summary: "Issue description"`);
    }
    
    return null;
  }

  /**
   * Get all available issue mappings
   */
  getAvailableIssues() {
    const knownIssues = config.issueMapping || {};
    return Object.keys(knownIssues).map(key => ({
      key,
      id: knownIssues[key].id,
      summary: knownIssues[key].summary
    }));
  }

  /**
   * Check if an issue exists in mappings
   */
  hasIssue(issueKey) {
    const knownIssues = config.issueMapping || {};
    return !!knownIssues[issueKey];
  }

  /**
   * Get resolution statistics
   */
  getStats() {
    const knownIssues = config.issueMapping || {};
    return {
      cacheSize: this.cache.size,
      totalMappings: Object.keys(knownIssues).length,
      availableIssues: Object.keys(knownIssues)
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new StaticIssueResolver();