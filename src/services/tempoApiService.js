const axios = require('axios');
const config = require('../utils/config');

class TempoApiService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: config.tempoBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Don't set authorization header here - will be set dynamically per request
    // Token will be loaded from secure storage when needed

    this.apiClient.interceptors.response.use(
      response => response,
      error => {
        // Only log unexpected errors, not permission/auth issues
        // Silent mode is handled at the method level
        if (error.response?.status !== 403 && error.response?.status !== 401) {
          // Note: Silent mode will be checked in individual methods
          error._shouldLogError = true;
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Ensure authorization header is set with current token
   */
  async ensureAuthorization() {
    if (!this.apiClient.defaults.headers.common['Authorization']) {
      const token = await config.getTempoToken();
      if (token) {
        this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  /**
   * Query JIRA directly using the base URL and proper authentication
   */
  async queryJiraDirectly(issueKey, silent = false) {
    try {
      // Get JIRA base URL from config
      const jiraBaseUrl = config.yaml?.api?.jiraBaseUrl || 'https://witt-gruppe.atlassian.net';
      
      if (!silent) console.log(`🔍 Querying JIRA directly: ${jiraBaseUrl}/rest/api/3/issue/${issueKey}`);
      
      // Create a separate axios instance for JIRA calls
      const jiraClient = axios.create({
        baseURL: jiraBaseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Try different authentication methods
      const token = await config.getTempoToken();
      
      // Method 1: Try using Tempo token as Bearer (might work if Tempo has JIRA permissions)
      try {
        if (!silent) console.log(`🔐 Trying JIRA API with Tempo Bearer token...`);
        jiraClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        const response = await jiraClient.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: 'id,key,summary'
          }
        });
        
        if (response.data && response.data.id) {
          if (!silent) console.log(`✅ JIRA Direct API (Bearer): ${issueKey} -> ID ${response.data.id}`);
          return {
            id: parseInt(response.data.id),
            key: response.data.key,
            summary: response.data.fields?.summary || 'Retrieved via JIRA API'
          };
        }
      } catch (bearerError) {
        if (!silent) console.log(`⚠️ JIRA Bearer auth failed: ${bearerError.response?.status} ${bearerError.response?.statusText}`);
      }
      
      // Method 2: Try Basic auth if we have user credentials
      try {
        const userAccountId = config.yaml?.user?.accountId;
        if (userAccountId && token) {
          if (!silent) console.log(`🔐 Trying JIRA API with Basic auth using account ID...`);
          
          // Try using account ID and token as Basic auth
          const basicAuth = Buffer.from(`${userAccountId}:${token}`).toString('base64');
          jiraClient.defaults.headers.common['Authorization'] = `Basic ${basicAuth}`;
          
          const response = await jiraClient.get(`/rest/api/3/issue/${issueKey}`, {
            params: {
              fields: 'id,key,summary'
            }
          });
          
          if (response.data && response.data.id) {
            if (!silent) console.log(`✅ JIRA Direct API (Basic): ${issueKey} -> ID ${response.data.id}`);
            return {
              id: parseInt(response.data.id),
              key: response.data.key,
              summary: response.data.fields?.summary || 'Retrieved via JIRA API'
            };
          }
        }
      } catch (basicError) {
        if (!silent) console.log(`⚠️ JIRA Basic auth failed: ${basicError.response?.status} ${basicError.response?.statusText}`);
      }

      // Method 3: Try the search endpoint
      try {
        if (!silent) console.log(`🔍 Trying JIRA search endpoint for ${issueKey}...`);
        jiraClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        const searchResponse = await jiraClient.get('/rest/api/3/search', {
          params: {
            jql: `key = "${issueKey}"`,
            fields: 'id,key,summary',
            maxResults: 1
          }
        });
        
        if (searchResponse.data?.issues && searchResponse.data.issues.length > 0) {
          const issue = searchResponse.data.issues[0];
          if (!silent) console.log(`✅ JIRA Search API: ${issueKey} -> ID ${issue.id}`);
          return {
            id: parseInt(issue.id),
            key: issue.key,
            summary: issue.fields?.summary || 'Retrieved via JIRA Search API'
          };
        }
      } catch (searchError) {
        if (!silent) console.log(`⚠️ JIRA search failed: ${searchError.response?.status} ${searchError.response?.statusText}`);
        if (searchError.response?.data) {
          if (!silent) console.log(`JIRA Error Details:`, searchError.response.data);
        }
      }

      if (!silent) console.log(`❌ All JIRA direct query methods failed for ${issueKey}`);
      return null;
      
    } catch (error) {
      if (!silent) console.log(`💥 JIRA direct query error for ${issueKey}: ${error.message}`);
      return null;
    }
  }

  async createWorklog(worklogData, silent = false) {
    try {
      await this.ensureAuthorization();
      const response = await this.apiClient.post('/worklogs', worklogData);
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to create worklog: ${error.response?.data?.message || error.message}`);
    }
  }

  async getWorklogs(params = {}, silent = false) {
    try {
      await this.ensureAuthorization();
      
      // Apply aggressive server-side filtering to avoid downloading old data
      const queryParams = {
        ...params,
        expand: 'author,issue', // Expand both author and issue details
        limit: 1000, // Increase limit to get more recent entries
        offset: 0 // Start from beginning
      };
      
      // If no explicit date range, default to recent data only (avoid 2016-2017 worklogs)
      if (!queryParams.from && !queryParams.to) {
        const recentCutoff = new Date();
        recentCutoff.setFullYear(2025, 0, 1); // Start from 2025-01-01
        const today = new Date();
        queryParams.from = recentCutoff.toISOString().split('T')[0];
        queryParams.to = today.toISOString().split('T')[0]; // Add explicit end date
        if (!silent) console.log(`⚡ Applied automatic date filter: from ${queryParams.from} to ${queryParams.to} (avoiding old undeleteable worklogs)`);
      }
      
      const response = await this.apiClient.get('/worklogs', { params: queryParams });
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch worklogs: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateWorklog(worklogId, worklogData, silent = false) {
    try {
      await this.ensureAuthorization();
      const response = await this.apiClient.put(`/worklogs/${worklogId}`, worklogData);
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to update worklog: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteWorklog(worklogId, silent = false) {
    try {
      await this.ensureAuthorization();
      const response = await this.apiClient.delete(`/worklogs/${worklogId}`);
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to delete worklog: ${error.response?.data?.message || error.message}`);
    }
  }

  async getAccounts(silent = false) {
    try {
      await this.ensureAuthorization();
      const response = await this.apiClient.get('/accounts');
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch accounts: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCurrentUser(silent = false) {
    try {
      await this.ensureAuthorization();
      // Try the accounts endpoint first
      let response;
      try {
        response = await this.apiClient.get('/accounts/me');
        return response.data;
      } catch (meError) {
        // If /me fails, try getting accounts and find current user
        if (!silent) console.log('Trying alternative method to get current user...');
        response = await this.apiClient.get('/accounts');
        
        // Return the first account (assuming single-user token)
        if (response.data && response.data.results && response.data.results.length > 0) {
          return response.data.results[0];
        }
        throw meError;
      }
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch current user: ${error.response?.data?.message || error.message}`);
    }
  }

  async getIssueById(issueKey, silent = false) {
    try {
      await this.ensureAuthorization();
      
      if (!silent) console.log(`🔍 API: Resolving issue ${issueKey}...`);
      
      // Method 1: Direct JIRA API with proper authentication
      try {
        const jiraResult = await this.queryJiraDirectly(issueKey, silent);
        if (jiraResult) {
          return jiraResult;
        }
      } catch (jiraError) {
        if (!silent) console.log(`⚠️ API: Direct JIRA API failed for ${issueKey}, trying Tempo endpoints...`);
      }
      
      // Method 2: Tempo JIRA proxy endpoint
      try {
        const response = await this.apiClient.get(`/jira/issues/${issueKey}`);
        if (response.data && response.data.id) {
          if (!silent) console.log(`✅ API: Tempo JIRA proxy successful - ${issueKey} -> ID ${response.data.id}`);
          return {
            id: parseInt(response.data.id),
            key: issueKey,
            summary: response.data.summary || response.data.fields?.summary || 'No summary available'
          };
        }
      } catch (tempoJiraError) {
        if (!silent) console.log(`⚠️ API: Tempo JIRA proxy failed for ${issueKey}, trying worklog search...`);
      }
        
      // Method 2: Search existing worklogs for this issue (fallback)
      try {
        const worklogsResponse = await this.apiClient.get('/worklogs', {
          params: {
            limit: 1000, // Increased limit for better coverage
            expand: 'issue,author'
          }
        });
        
        if (worklogsResponse.data.results) {
          for (const worklog of worklogsResponse.data.results) {
            if (worklog.issue && worklog.issue.key === issueKey) {
              if (!silent) console.log(`✅ API: Found via worklog search - ${issueKey} -> ID ${worklog.issue.id}`);
              return {
                id: parseInt(worklog.issue.id),
                key: worklog.issue.key,
                summary: worklog.issue.summary || 'Found via worklog search'
                };
              }
            }
          }
          
          // Method 3: Try to find in description patterns (fallback for your data)
          if (!silent) console.log(`Direct search failed, checking descriptions for ${issueKey}...`);
          if (!silent) console.log(`Debug - Searching through ${worklogsResponse.data.results.length} worklogs for issue ${issueKey}`);
          
          // Debug: Show some sample descriptions
          if (!silent) {
            worklogsResponse.data.results.slice(0, 5).forEach((worklog, index) => {
              console.log(`  Sample ${index + 1}: "${worklog.description}" (Issue: ${worklog.issue?.key || worklog.issue?.id})`);
            });
          }
          
          for (const worklog of worklogsResponse.data.results) {
            if (worklog.description && worklog.description.includes(issueKey)) {
              if (!silent) console.log(`Found worklog mentioning ${issueKey} with issue ID ${worklog.issue?.id}`);
              if (worklog.issue?.id) {
                return {
                  id: worklog.issue.id,
                  key: issueKey,
                  summary: worklog.issue.summary || `Issue from worklog ${worklog.issue.id}`
                };
              }
            }
          }
        } catch (searchError) {
          if (!silent) console.log(`⚠️ API: Worklog search failed: ${searchError.message}`);
        }
        
        // Method 3: Enhanced pattern matching in descriptions
        if (!silent) console.log(`⚠️ API: Standard methods failed, trying description search for ${issueKey}...`);
        
        if (!silent) console.log(`❌ API: Could not resolve ${issueKey} via any method`);
        if (!silent) console.log(`💡 Suggestion: Add ${issueKey} to config.yaml issueMapping for faster resolution`);
        
        return null;
    } catch (error) {
      if (!silent) console.log(`Could not fetch issue details for ${issueKey}: ${error.message}`);
      return null;
    }
  }

  async getAuthorAccountIdFromWorklogs(silent = false) {
    try {
      await this.ensureAuthorization();
      if (!silent) console.log('Extracting author account ID from existing worklogs...');
      const worklogsResponse = await this.apiClient.get('/worklogs', {
        params: {
          limit: 20,
          expand: 'author,issue'
        }
      });
      
      if (!silent) console.log('Debug - Investigating issue ID patterns...');
      if (worklogsResponse.data.results && worklogsResponse.data.results.length > 0) {
        // Debug: Show more worklogs to understand issue ID patterns
        if (!silent) console.log(`Analyzing ${worklogsResponse.data.results.length} worklogs for patterns...`);
        
        const issueIdCounts = {};
        const dateRanges = {};
        
        worklogsResponse.data.results.forEach((worklog, index) => {
          if (index < 10 && !silent) { // Show first 10 for detailed analysis
            console.log(`  Worklog ${index + 1}:`, JSON.stringify({
              date: worklog.startDate,
              issueId: worklog.issue?.id,
              issueKey: worklog.issue?.key,
              description: worklog.description,
              author: worklog.author,
              tempoWorklogId: worklog.tempoWorklogId
            }, null, 2));
          }
          
          // Count issue ID occurrences
          const issueId = worklog.issue?.id;
          if (issueId) {
            issueIdCounts[issueId] = (issueIdCounts[issueId] || 0) + 1;
            if (!dateRanges[issueId]) {
              dateRanges[issueId] = { earliest: worklog.startDate, latest: worklog.startDate };
            } else {
              if (worklog.startDate < dateRanges[issueId].earliest) {
                dateRanges[issueId].earliest = worklog.startDate;
              }
              if (worklog.startDate > dateRanges[issueId].latest) {
                dateRanges[issueId].latest = worklog.startDate;
              }
            }
          }
        });
        
        if (!silent) {
          console.log('\\n📊 Issue ID Analysis:');
          Object.entries(issueIdCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([issueId, count]) => {
              const range = dateRanges[issueId];
              console.log(`  Issue ${issueId}: ${count} worklogs (${range.earliest} to ${range.latest})`);
            });
          
          console.log('\\n🤔 Issue ID Pattern Analysis:');
        }
        
        // Check for ANY worklogs from 2025 (much wider search)
        const recentWorklogs2025 = worklogsResponse.data.results
          .filter(w => w.startDate >= '2025-01-01')
          .slice(0, 10);
          
        if (recentWorklogs2025.length > 0) {
          if (!silent) console.log(`Recent worklogs from 2025:`);
          recentWorklogs2025.forEach((worklog, index) => {
            if (!silent) console.log(`  2025 ${index + 1}: Date=${worklog.startDate}, IssueId=${worklog.issue?.id}, IssueKey=${worklog.issue?.key}, Author=${worklog.author?.accountId}`);
          });
        } else {
          if (!silent) console.log('No worklogs found from 2025 at all');
          
          // Check the most recent worklogs regardless of date
          const mostRecent = worklogsResponse.data.results
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .slice(0, 3);
            
          if (!silent) console.log('Most recent worklogs (any date):');
          mostRecent.forEach((worklog, index) => {
            if (!silent) console.log(`  Most recent ${index + 1}: Date=${worklog.startDate}, IssueId=${worklog.issue?.id}, Author=${worklog.author?.accountId}`);
          });
        }
        
        const firstWorklog = worklogsResponse.data.results[0];
        if (firstWorklog.author && firstWorklog.author.accountId) {
          if (!silent) console.log(`\\nFound author account ID: ${firstWorklog.author.accountId} (${firstWorklog.author.displayName || firstWorklog.author.name || 'Unknown'})`);
          return firstWorklog.author.accountId;
        } else {
          if (!silent) console.log('Debug - First worklog structure (full):', JSON.stringify(firstWorklog, null, 2));
        }
      } else {
        if (!silent) console.log('Debug - No worklogs found or empty results');
      }
      
      if (!silent) console.log('Could not extract author account ID from existing worklogs');
      return null;
    } catch (error) {
      if (!silent) console.log(`Failed to get author account ID: ${error.message}`);
      return null;
    }
  }

  async createWorklogWithStatic(issueKey, hours, startDate, startTime, description, silent = false) {
    if (!silent) console.log(`🚀 Creating worklog with static mapping for ${issueKey}...`);
    
    // Use configurable User Account ID 
    const config = require('../utils/config');
    const authorAccountId = config.userAccountId;
    
    // Use static issue resolver to get the correct issue ID
    const staticIssueResolver = require('./staticIssueResolver');
    
    const issueDetails = await staticIssueResolver.resolveIssue(issueKey, silent);
    
    if (!issueDetails) {
      throw new Error(`Could not resolve issue ${issueKey} via static mapping`);
    }

    const payload = {
      issueId: issueDetails.id,
      timeSpentSeconds: Math.round(hours * 3600),
      startDate: startDate,
      startTime: startTime,
      description: description,
      authorAccountId: authorAccountId
    };

    if (!silent) console.log('🎯 Static-resolved payload:', JSON.stringify(payload, null, 2));
    
    try {
      const response = await this.apiClient.post('/worklogs', payload);
      if (!silent) console.log(`✅ Success! Created worklog for ${issueKey} (ID: ${issueDetails.id})`);
      return response.data;
    } catch (error) {
      if (!silent) console.log('❌ Static worklog creation failed:', error.response?.data);
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw error;
    }
  }

  async updateWorklogWithStatic(tempoWorklogId, issueKey, hours, startDate, startTime, description, silent = false) {
    if (!silent) console.log(`🔄 Updating worklog ${tempoWorklogId} with static mapping for ${issueKey}...`);
    
    // Use configurable User Account ID 
    const config = require('../utils/config');
    const authorAccountId = config.userAccountId;
    
    // Use static issue resolver to get the correct issue ID
    const staticIssueResolver = require('./staticIssueResolver');
    
    const issueDetails = await staticIssueResolver.resolveIssue(issueKey, silent);
    
    if (!issueDetails) {
      throw new Error(`Could not resolve issue ${issueKey} via static mapping`);
    }

    const payload = {
      issueId: issueDetails.id,
      timeSpentSeconds: Math.round(hours * 3600),
      startDate: startDate,
      startTime: startTime,
      description: description,
      authorAccountId: authorAccountId
    };

    if (!silent) console.log(`🎯 Updating worklog ${tempoWorklogId} with static-resolved payload:`, JSON.stringify(payload, null, 2));

    try {
      const response = await this.apiClient.put(`/worklogs/${tempoWorklogId}`, payload);
      if (!silent) console.log(`✅ Success! Updated worklog ${tempoWorklogId} for ${issueKey} (ID: ${issueDetails.id})`);
      return response.data;
    } catch (error) {
      if (!silent) console.log('❌ Static worklog update failed:', error.response?.data);
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw error;
    }
  }

  async findCurrentIssueId(issueKey, authorAccountId, silent = false) {
    if (!silent) console.log(`Querying current issue ID for issue key: ${issueKey} using static mappings`);
    
    try {
      // Use static issue resolver
      const staticIssueResolver = require('./staticIssueResolver');
      const issueDetails = await staticIssueResolver.resolveIssue(issueKey, silent);
      
      if (issueDetails) {
        if (!silent) console.log(`✅ Using static mapping: ${issueKey} -> ID ${issueDetails.id}`);
        return issueDetails.id;
      }
      
      if (!silent) console.log(`⚠️ No static mapping found for ${issueKey}`);
      if (!silent) console.log(`💡 Add mapping for ${issueKey} to config.yaml under issueMapping section`);
      return null;
    } catch (error) {
      if (!silent) console.log(`Issue ID resolution failed: ${error.message}`);
      return null;
    }
    
    // Strategy 4: Try generic issue resolution endpoint
    try {
      if (!silent) console.log(`Trying generic issue endpoint: /issues/${issueKey}`);
      const issueResponse = await this.apiClient.get(`/issues/${issueKey}`);
      
      if (issueResponse.data && issueResponse.data.id) {
        if (!silent) console.log(`✅ Generic issue endpoint succeeded: ${issueKey} -> ID ${issueResponse.data.id}`);
        return parseInt(issueResponse.data.id);
      }
    } catch (genericError) {
      if (!silent) console.log(`Generic issue endpoint failed: ${genericError.response?.status} - ${genericError.message}`);
    }
    
    if (!silent) console.log(`❌ All issue resolution methods failed for ${issueKey}`);
    return null;
  }

  async tryResolveIssueKeyToId(issueKey, silent = false) {
    if (!silent) console.log(`Attempting to resolve issue key ${issueKey} to numeric ID...`);
    
    // This is a challenging problem since we have:
    // - Issue keys like "ITST-14439" from your CSV
    // - Numeric issue IDs like 14791, 16190 from existing worklogs
    // - No clear mapping between them due to anonymization
    
    // Strategy: For now, we'll need to either:
    // 1. Use a manual mapping
    // 2. Ask user to provide issue IDs instead of keys
    // 3. Create worklogs with existing issue IDs as placeholders
    
    if (!silent) console.log('⚠️  Cannot reliably map issue keys to IDs in this anonymized environment');
    if (!silent) console.log('💡 Consider providing issue IDs directly in your CSV file instead of issue keys');
    
    return null;
  }

  async getProjects(silent = false) {
    try {
      const response = await this.apiClient.get('/projects');
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('Tempo API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch projects: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new TempoApiService();