const { execSync } = require('child_process');
const axios = require('axios');
const config = require('../utils/config');

class MCPJiraService {
  constructor() {
    this.cloudId = config.atlassianCloudId;
    this.cache = new Map(); // Cache resolved issues
  }

  async getIssueDetails(issueKey, silent = false) {
    if (!silent) console.log(`🔍 MCP: Resolving issue: ${issueKey}`);
    
    // Check cache first
    if (this.cache.has(issueKey)) {
      if (!silent) console.log(`💾 MCP: Using cached resolution for ${issueKey}`);
      return this.cache.get(issueKey);
    }

    // Method 1: Use configurable issue mappings from config.yaml (fastest)
    const knownIssues = config.issueMapping;
    if (knownIssues[issueKey]) {
      const issueInfo = knownIssues[issueKey];
      if (!silent) console.log(`✅ MCP: Config mapping: ${issueKey} -> ID ${issueInfo.id}`);
      const result = {
        id: parseInt(issueInfo.id),
        key: issueKey,
        summary: issueInfo.summary
      };
      this.cache.set(issueKey, result);
      return result;
    }

    // Method 2: Try MCP-based JIRA API call
    try {
      const mcpResult = await this.queryJiraViaMCP(issueKey, silent);
      if (mcpResult) {
        this.cache.set(issueKey, mcpResult);
        return mcpResult;
      }
    } catch (mcpError) {
      if (!silent) console.log(`⚠️ MCP: API call failed - ${mcpError.message}`);
    }

    // Method 3: Try direct JIRA REST API as fallback
    try {
      const jiraResult = await this.queryJiraDirectly(issueKey, silent);
      if (jiraResult) {
        this.cache.set(issueKey, jiraResult);
        
        // Suggest adding to config for future use
        if (!silent) {
          console.log(`💡 Suggestion: Add ${issueKey} to config.yaml for faster future resolution:`);
          console.log(`   ${issueKey}:`);
          console.log(`     id: "${jiraResult.id}"`);
          console.log(`     summary: "${jiraResult.summary}"`);
        }
        
        return jiraResult;
      }
    } catch (jiraError) {
      if (!silent) console.log(`⚠️ MCP: Direct JIRA call failed - ${jiraError.message}`);
    }

    if (!silent) console.log(`❌ MCP: Could not resolve ${issueKey} using any method`);
    if (!silent) console.log(`💡 Add mapping for ${issueKey} to config.yaml under issueMapping section`);
    return null;
  }

  /**
   * Query JIRA through MCP (Model Context Protocol)
   * This tries to use the Atlassian MCP if available
   */
  async queryJiraViaMCP(issueKey, silent = false) {
    try {
      if (!silent) console.log(`🤖 MCP: Attempting MCP-based JIRA query for ${issueKey}...`);
      
      // Try to execute MCP command to get issue details
      // This assumes the Atlassian MCP is properly configured and authenticated
      const mcpCommand = `mcp call atlassian get_issue --issue-key "${issueKey}"`;
      
      try {
        const result = execSync(mcpCommand, { 
          encoding: 'utf8', 
          timeout: 10000,
          stdio: 'pipe'
        });
        
        const issueData = JSON.parse(result);
        if (issueData && issueData.id) {
          if (!silent) console.log(`✅ MCP: Successfully resolved ${issueKey} via MCP -> ID ${issueData.id}`);
          return {
            id: parseInt(issueData.id),
            key: issueData.key || issueKey,
            summary: issueData.fields?.summary || issueData.summary || 'Retrieved via MCP'
          };
        }
      } catch (mcpExecError) {
        if (!silent) console.log(`⚠️ MCP: Command execution failed - ${mcpExecError.message}`);
        throw mcpExecError;
      }
      
      return null;
    } catch (error) {
      if (!silent) console.log(`💥 MCP: Query failed for ${issueKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Query JIRA directly using REST API as fallback
   */
  async queryJiraDirectly(issueKey, silent = false) {
    try {
      if (!silent) console.log(`🔗 MCP: Direct JIRA API fallback for ${issueKey}...`);
      
      const jiraBaseUrl = config.yaml?.api?.jiraBaseUrl || 'https://witt-gruppe.atlassian.net';
      const token = await config.getTempoToken();
      
      if (!token) {
        if (!silent) console.log(`⚠️ MCP: No authentication token available`);
        return null;
      }
      
      const jiraClient = axios.create({
        baseURL: jiraBaseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      // Try JIRA REST API v3
      try {
        const response = await jiraClient.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: 'id,key,summary'
          }
        });
        
        if (response.data && response.data.id) {
          if (!silent) console.log(`✅ MCP: Direct JIRA API successful - ${issueKey} -> ID ${response.data.id}`);
          return {
            id: parseInt(response.data.id),
            key: response.data.key,
            summary: response.data.fields?.summary || 'Retrieved via MCP JIRA API'
          };
        }
      } catch (apiError) {
        if (!silent) console.log(`⚠️ MCP: JIRA API call failed: ${apiError.response?.status} ${apiError.response?.statusText}`);
        
        // Try search as fallback
        try {
          const searchResponse = await jiraClient.get('/rest/api/3/search', {
            params: {
              jql: `key = "${issueKey}"`,
              fields: 'id,key,summary',
              maxResults: 1
            }
          });
          
          if (searchResponse.data?.issues && searchResponse.data.issues.length > 0) {
            const issue = searchResponse.data.issues[0];
            if (!silent) console.log(`✅ MCP: JIRA Search API successful - ${issueKey} -> ID ${issue.id}`);
            return {
              id: parseInt(issue.id),
              key: issue.key,
              summary: issue.fields?.summary || 'Retrieved via MCP JIRA Search'
            };
          }
        } catch (searchError) {
          if (!silent) console.log(`⚠️ MCP: JIRA search also failed: ${searchError.response?.status} ${searchError.response?.statusText}`);
        }
      }
      
      return null;
    } catch (error) {
      if (!silent) console.log(`💥 MCP: Direct JIRA query error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

module.exports = MCPJiraService;