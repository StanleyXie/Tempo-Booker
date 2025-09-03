const axios = require('axios');
const config = require('../utils/config');

class JiraApiService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: `${config.jiraBaseUrl}/rest/api/3`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Use JIRA Basic Auth if available, otherwise try Tempo token
    if (config.hasJiraAuth) {
      const authString = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
      this.apiClient.defaults.headers.common['Authorization'] = `Basic ${authString}`;
    } else if (config.tempoApiToken) {
      this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${config.tempoApiToken}`;
    }

    this.apiClient.interceptors.response.use(
      response => response,
      error => {
        // Silent mode is handled at the method level
        error._shouldLogError = true;
        return Promise.reject(error);
      }
    );
  }

  async searchIssues(jql, fields = ['key', 'summary', 'status', 'assignee'], silent = false) {
    try {
      const response = await this.apiClient.post('/search', {
        jql,
        fields,
        maxResults: 50
      });
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('JIRA API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to search issues: ${error.response?.data?.errorMessages || error.message}`);
    }
  }

  async getIssue(issueKey, fields = ['key', 'summary', 'status', 'assignee', 'project'], silent = false) {
    try {
      const response = await this.apiClient.get(`/issue/${issueKey}`, {
        params: { fields: fields.join(',') }
      });
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('JIRA API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch issue ${issueKey}: ${error.response?.data?.errorMessages || error.message}`);
    }
  }

  async getCurrentUser(silent = false) {
    try {
      const response = await this.apiClient.get('/myself');
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('JIRA API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch current user: ${error.response?.data?.message || error.message}`);
    }
  }

  async getProjects(silent = false) {
    try {
      const response = await this.apiClient.get('/project');
      return response.data;
    } catch (error) {
      if (!silent && error._shouldLogError) {
        console.error('JIRA API Error:', error.response?.data || error.message);
      }
      throw new Error(`Failed to fetch projects: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new JiraApiService();