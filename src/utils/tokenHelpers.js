const chalk = require('chalk');
const inquirer = require('inquirer');
const open = require('open');

class TokenHelpers {
  
  static async showTempoTokenInstructions() {
    console.log(chalk.blue.bold('\n🎫 Tempo API Token Setup Guide'));
    console.log(chalk.gray('Follow these steps to get your Tempo API token:\n'));

    console.log(chalk.yellow('Step 1: Open Tempo Settings'));
    console.log(chalk.white('• Go to your Tempo app in Atlassian'));
    console.log(chalk.white('• Click on "Settings" in the left sidebar'));
    console.log(chalk.white('• Navigate to "API integration"\n'));

    console.log(chalk.yellow('Step 2: Create API Token'));
    console.log(chalk.white('• Click "New Token"'));
    console.log(chalk.white('• Give it a name (e.g., "CLI Access")'));  
    console.log(chalk.white('• Copy the generated token\n'));

    console.log(chalk.yellow('Step 3: Token Permissions'));
    console.log(chalk.white('• Make sure the token has permissions for:'));
    console.log(chalk.gray('  - View worklogs'));
    console.log(chalk.gray('  - Create worklogs'));
    console.log(chalk.gray('  - Edit worklogs'));
    console.log(chalk.gray('  - Delete worklogs\n'));

    const { shouldOpenBrowser } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldOpenBrowser',
        message: 'Would you like me to open Tempo in your browser?',
        default: true
      }
    ]);

    if (shouldOpenBrowser) {
      try {
        await open('https://tempo.io/');
        console.log(chalk.green('✅ Opened Tempo in browser'));
        console.log(chalk.gray('Navigate to your instance and follow the steps above\n'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not open browser automatically'));
        console.log(chalk.white('Please manually visit: https://tempo.io/\n'));
      }
    }

    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter when you have your Tempo API token ready...'
      }
    ]);
  }

  static async showJiraTokenInstructions() {
    console.log(chalk.blue.bold('\n🔐 JIRA API Token Setup Guide'));
    console.log(chalk.gray('Optional: Get a JIRA API token for enhanced issue summaries:\n'));

    console.log(chalk.yellow('Step 1: Check API Token Permissions'));
    console.log(chalk.white('• Go to https://id.atlassian.com/manage-profile/security/api-tokens'));
    console.log(chalk.white('• Log in with your Atlassian account\n'));

    console.log(chalk.yellow('Step 2: Create API Token (if allowed)'));  
    console.log(chalk.white('• Click "Create API token"'));
    console.log(chalk.white('• Label: "Tempo CLI" (or similar)'));
    console.log(chalk.white('• Copy the generated token\n'));

    console.log(chalk.red('⚠️  Common Issue: API Token Blocked'));
    console.log(chalk.white('If you see "An admin blocked your tokens":'));
    console.log(chalk.white('• This is a common security policy in enterprises'));
    console.log(chalk.white('• Contact your IT admin for access'));
    console.log(chalk.white('• Consider using MCP integration instead\n'));

    const { shouldOpenJira } = await inquirer.prompt([
      {
        type: 'confirm', 
        name: 'shouldOpenJira',
        message: 'Would you like me to open Atlassian Account Settings to check?',
        default: true
      }
    ]);

    if (shouldOpenJira) {
      try {
        await open('https://id.atlassian.com/manage-profile/security/api-tokens');
        console.log(chalk.green('✅ Opened Atlassian Account Settings'));
        console.log(chalk.gray('Check if you can create tokens, or if they\'re blocked\n'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not open browser'));
        console.log(chalk.white('Please visit: https://id.atlassian.com/manage-profile/security/api-tokens\n'));
      }
    }
  }

  static async showMcpSetupInstructions() {
    console.log(chalk.blue.bold('\n🔗 MCP (Model Context Protocol) Setup Guide'));
    console.log(chalk.gray('MCP provides enhanced JIRA integration for issue resolution:\n'));

    console.log(chalk.yellow('Why MCP for Enterprise Environments?'));
    console.log(chalk.green('• ✅ No personal API tokens needed'));
    console.log(chalk.green('• ✅ Works through your AI assistant\'s connection'));
    console.log(chalk.green('• ✅ Bypasses enterprise API token restrictions'));
    console.log(chalk.green('• ✅ Real-time JIRA issue data and metadata'));
    console.log(chalk.green('• ✅ Enhanced issue key → issue ID resolution\n'));

    console.log(chalk.yellow('Perfect for Your Situation:'));
    console.log(chalk.white('• Your organization blocks API token creation'));
    console.log(chalk.white('• MCP provides JIRA access through AI assistant'));
    console.log(chalk.white('• No direct API credentials needed\n'));

    console.log(chalk.yellow('Setup Requirements:'));
    console.log(chalk.white('• MCP-compatible AI assistant (Claude, ChatGPT, etc.)'));
    console.log(chalk.white('• Atlassian MCP server installed and configured'));
    console.log(chalk.white('• AI assistant configured with your JIRA instance\n'));

    console.log(chalk.yellow('Installation Steps:'));
    console.log(chalk.white('1. Install Atlassian MCP server in your AI assistant'));
    console.log(chalk.white('2. Configure with your JIRA instance URL'));
    console.log(chalk.white('3. Test with: "Show me issue PROJECT-123"'));
    console.log(chalk.white('4. Tempo CLI will use MCP for issue resolution\n'));

    const { hasMcp } = await inquirer.prompt([
      {
        type: 'list',
        name: 'hasMcp',
        message: 'What is your MCP setup status?',
        choices: [
          { name: '✅ Already configured and working', value: 'configured' },
          { name: '🔧 Need help setting up MCP', value: 'needhelp' },
          { name: '🚫 Cannot access - API tokens blocked', value: 'blocked' },
          { name: '❌ Skip MCP setup for now', value: 'skip' }
        ]
      }
    ]);

    if (hasMcp === 'needhelp') {
      console.log(chalk.blue('\n📚 MCP Setup Resources:'));
      console.log(chalk.white('• MCP Documentation: https://modelcontextprotocol.io/'));
      console.log(chalk.white('• Atlassian MCP Server: Check your AI assistant\'s MCP marketplace'));
      console.log(chalk.white('• Configuration: Use your JIRA instance URL\n'));
      
      const { openMcpDocs } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'openMcpDocs',
          message: 'Open MCP documentation in browser?',
          default: false
        }
      ]);

      if (openMcpDocs) {
        try {
          await open('https://modelcontextprotocol.io/');
          console.log(chalk.green('✅ Opened MCP documentation'));
        } catch (error) {
          console.log(chalk.yellow('⚠️  Please visit: https://modelcontextprotocol.io/'));
        }
      }
    } else if (hasMcp === 'blocked') {
      console.log(chalk.blue('\n🛡️  Enterprise API Token Restrictions - MCP Solution:'));
      console.log(chalk.white('Since your organization blocks API tokens, MCP is the ideal solution:'));
      console.log(chalk.yellow('\n✅ Advantages of MCP in Your Situation:'));
      console.log(chalk.white('• No need to request API token permissions from IT'));
      console.log(chalk.white('• Works through your AI assistant\'s existing connection'));
      console.log(chalk.white('• Provides same JIRA integration capabilities'));
      console.log(chalk.white('• No security policy violations\n'));
      
      console.log(chalk.blue('🎯 Recommended Next Steps:'));
      console.log(chalk.white('1. Set up MCP in your AI assistant (Claude, etc.)'));
      console.log(chalk.white('2. Configure Atlassian MCP server with your JIRA URL'));
      console.log(chalk.white('3. Test issue queries in your AI assistant'));
      console.log(chalk.white('4. Use Tempo CLI with MCP-enhanced issue resolution'));
      
      console.log(chalk.green('\n💡 This approach respects your organization\'s security policies!'));
    }

    return hasMcp;
  }

  static async validateTempoToken(token, jiraBaseUrl) {
    console.log(chalk.blue('🔍 Validating Tempo API token...'));
    
    try {
      // Use direct axios call for validation instead of the service
      const axios = require('axios');
      
      const testParams = {
        from: new Date().toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      };
      
      const response = await axios.get('https://api.tempo.io/4/worklogs', {
        params: testParams,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(chalk.green('✅ Tempo API token validated successfully'));
      return { valid: true, result: response.data };
      
    } catch (error) {
      console.log(chalk.red('❌ Tempo API token validation failed'));
      console.log(chalk.yellow(`Error: ${error.message}`));
      
      if (error.response?.status === 401) {
        console.log(chalk.gray('• Check that your API token is correct'));
        console.log(chalk.gray('• Verify token has proper permissions'));
      } else if (error.response?.status === 403) {
        console.log(chalk.gray('• Token may lack required permissions'));
      } else if (error.response?.status === 404) {
        console.log(chalk.gray('• Check your JIRA base URL is correct'));
      } else if (error.code === 'ENOTFOUND') {
        console.log(chalk.gray('• Check your internet connection'));
        console.log(chalk.gray('• Verify the Tempo API is accessible'));
      }
      
      return { valid: false, error: error.message };
    }
  }

  static async getAccountIdFromTempo(token, jiraBaseUrl) {
    console.log(chalk.blue('🔍 Automatically retrieving Account ID from Tempo API...'));
    
    try {
      const axios = require('axios');
      
      // Try multiple approaches to get account ID
      let accountId = null;
      let userName = null;
      
      // Method 1: Get recent worklogs to find user info
      console.log(chalk.gray('• Checking recent worklogs for your Account ID...'));
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 90); // Last 90 days
      
      const worklogParams = {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      };
      
      const worklogResponse = await axios.get('https://api.tempo.io/4/worklogs', {
        params: worklogParams,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const worklogResult = worklogResponse.data;
      
      if (worklogResult && worklogResult.results && worklogResult.results.length > 0) {
        // Look for worklogs by the token owner (should be the user)
        const userWorklogs = worklogResult.results.filter(wl => 
          wl.author && 
          wl.author.accountId && 
          !wl.author.accountId.includes('unknown') &&
          wl.author.accountId !== '__tempo-io__unknown_user'
        );
        
        if (userWorklogs.length > 0) {
          // Get the most common account ID (should be the user's)
          const accountIdCounts = {};
          userWorklogs.forEach(wl => {
            const accId = wl.author.accountId;
            accountIdCounts[accId] = (accountIdCounts[accId] || 0) + 1;
          });
          
          // Get the account ID with the most worklogs (likely the token owner)
          const mostCommonAccountId = Object.entries(accountIdCounts)
            .sort(([,a], [,b]) => b - a)[0][0];
          
          const userWorklog = userWorklogs.find(wl => wl.author.accountId === mostCommonAccountId);
          if (userWorklog) {
            accountId = userWorklog.author.accountId;
            userName = userWorklog.author.displayName || userWorklog.author.name || 'Unknown User';
            console.log(chalk.green(`✅ Found Account ID from worklog data: ${accountId}`));
          }
        }
      }
      
      // Method 2: Try to get current user info via Tempo's user endpoint
      if (!accountId) {
        console.log(chalk.gray('• Trying Tempo user info endpoint...'));
        try {
          const https = require('https');
          const url = require('url');
          
          const tempoUserUrl = 'https://api.tempo.io/4/user/current';
          const parsedUrl = url.parse(tempoUserUrl);
          
          const userInfoResult = await new Promise((resolve, reject) => {
            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: parsedUrl.path,
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            };
            
            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                if (res.statusCode === 200) {
                  resolve(JSON.parse(data));
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              });
            });
            
            req.on('error', reject);
            req.setTimeout(10000, () => reject(new Error('Request timeout')));
            req.end();
          });
          
          if (userInfoResult && userInfoResult.accountId) {
            accountId = userInfoResult.accountId;
            userName = userInfoResult.displayName || userInfoResult.name || 'Unknown User';
            console.log(chalk.green(`✅ Found Account ID from user endpoint: ${accountId}`));
          }
        } catch (endpointError) {
          console.log(chalk.gray('• User endpoint not available, using worklog method'));
        }
      }
      
      // Method 3: Try teams endpoint (sometimes reveals user info)
      if (!accountId) {
        console.log(chalk.gray('• Checking team memberships...'));
        try {
          const https = require('https');
          const url = require('url');
          
          const teamsUrl = 'https://api.tempo.io/4/teams';
          const parsedUrl = url.parse(teamsUrl);
          
          const teamsResult = await new Promise((resolve, reject) => {
            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: parsedUrl.path,
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            };
            
            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                if (res.statusCode === 200) {
                  resolve(JSON.parse(data));
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              });
            });
            
            req.on('error', reject);
            req.setTimeout(10000, () => reject(new Error('Request timeout')));
            req.end();
          });
          
          if (teamsResult && teamsResult.results) {
            // Look for user in team members
            for (const team of teamsResult.results) {
              if (team.members) {
                for (const member of team.members) {
                  if (member.accountId && member.accountId.startsWith('712020:')) {
                    // This might be the token owner if they're a team lead/admin
                    accountId = member.accountId;
                    userName = member.displayName || member.name || 'Unknown User';
                    console.log(chalk.green(`✅ Found Account ID from team data: ${accountId}`));
                    break;
                  }
                }
                if (accountId) break;
              }
            }
          }
        } catch (teamsError) {
          console.log(chalk.gray('• Teams endpoint not accessible'));
        }
      }
      
      if (accountId) {
        return {
          success: true,
          accountId,
          name: userName,
          method: 'tempo_api'
        };
      } else {
        console.log(chalk.yellow('⚠️  Could not auto-retrieve Account ID from Tempo API'));
        console.log(chalk.gray('This might happen if:'));
        console.log(chalk.gray('• You have no recent worklogs in the system'));
        console.log(chalk.gray('• Your API token has limited permissions'));
        console.log(chalk.gray('• You\'re using a service account token'));
        return {
          success: false,
          error: 'No user data found in Tempo API responses'
        };
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Failed to retrieve Account ID automatically'));
      console.log(chalk.yellow(`Error: ${error.message}`));
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async validateJiraToken(email, token, jiraBaseUrl) {
    console.log(chalk.blue('🔍 Validating JIRA API token...'));
    
    try {
      // Simple test: try to access JIRA API
      const https = require('https');
      const url = require('url');
      
      const testUrl = `${jiraBaseUrl}/rest/api/2/myself`;
      const auth = Buffer.from(`${email}:${token}`).toString('base64');
      
      return new Promise((resolve) => {
        const parsedUrl = url.parse(testUrl);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log(chalk.green('✅ JIRA API token validated successfully'));
              const user = JSON.parse(data);
              resolve({ valid: true, user });
            } else {
              console.log(chalk.red('❌ JIRA API token validation failed'));
              console.log(chalk.yellow(`HTTP ${res.statusCode}: ${res.statusMessage}`));
              resolve({ valid: false, error: `HTTP ${res.statusCode}` });
            }
          });
        });

        req.on('error', (error) => {
          console.log(chalk.red('❌ JIRA API connection failed'));
          console.log(chalk.yellow(`Error: ${error.message}`));
          resolve({ valid: false, error: error.message });
        });

        req.setTimeout(10000, () => {
          console.log(chalk.red('❌ JIRA API request timeout'));
          resolve({ valid: false, error: 'Request timeout' });
        });

        req.end();
      });
      
    } catch (error) {
      console.log(chalk.red('❌ JIRA API validation error'));
      return { valid: false, error: error.message };
    }
  }

  static async discoverUserFromApi(tempoResult) {
    console.log(chalk.blue('🔍 Discovering user information...'));
    
    if (!tempoResult || !tempoResult.results) {
      return null;
    }

    // Look for user worklog to extract account info
    const userWorklog = tempoResult.results.find(wl => 
      wl.author && 
      wl.author.accountId && 
      !wl.author.accountId.includes('unknown') &&
      wl.author.accountId !== '__tempo-io__unknown_user'
    );

    if (userWorklog) {
      const user = {
        accountId: userWorklog.author.accountId,
        name: userWorklog.author.displayName || userWorklog.author.name || 'Unknown User',
        email: userWorklog.author.emailAddress || null
      };

      console.log(chalk.green(`✅ Discovered user: ${user.name} (${user.accountId})`));
      return user;
    }

    console.log(chalk.yellow('⚠️  Could not auto-discover user information'));
    return null;
  }

  static async discoverAtlassianCloudId(jiraBaseUrl) {
    console.log(chalk.blue('🔍 Discovering Atlassian Cloud ID...'));
    
    try {
      // Extract cloud ID from JIRA URL pattern
      const urlMatch = jiraBaseUrl.match(/https:\/\/([^.]+)\.atlassian\.net/);
      if (urlMatch) {
        // This is a simplified approach - in practice, you'd query the API
        console.log(chalk.green('✅ Using JIRA URL for cloud identification'));
        return `cloud-${urlMatch[1]}`;
      }
      
      console.log(chalk.yellow('⚠️  Could not auto-discover cloud ID'));
      return 'auto-discovered';
      
    } catch (error) {
      console.log(chalk.gray('Using placeholder cloud ID (will be resolved on first use)'));
      return 'auto-discovered';
    }
  }

  static async showAccountIdHelp() {
    const chalk = require('chalk');
    const inquirer = require('inquirer');
    const open = require('open');

    console.log(chalk.blue.bold('\n🔍 Finding Your Atlassian Account ID'));
    console.log(chalk.gray('Your Account ID is unique across all Atlassian products\n'));

    console.log(chalk.yellow('📋 Method 1: From JIRA Profile (Recommended)'));
    console.log(chalk.white('1. Log into your JIRA instance'));
    console.log(chalk.white('2. Click on your profile picture → "Profile"'));
    console.log(chalk.white('3. Check the URL for your Account ID'));
    console.log(chalk.gray('   Format: /people/712020:abc123-def4-5678-90ab-cdef12345678\n'));

    console.log(chalk.yellow('📋 Method 2: Using Browser Developer Tools'));
    console.log(chalk.white('1. Open JIRA/Tempo in your browser'));
    console.log(chalk.white('2. Press F12 → Network tab'));
    console.log(chalk.white('3. Refresh the page'));
    console.log(chalk.white('4. Search network requests for "accountId"'));
    console.log(chalk.gray('   Look for your Account ID in API responses\n'));

    console.log(chalk.yellow('📋 Method 3: From Tempo Worklog Data'));
    console.log(chalk.white('1. Open Tempo → "My Work"'));
    console.log(chalk.white('2. Right-click any worklog → "Inspect Element"'));
    console.log(chalk.white('3. Search HTML for "712020:" to find your Account ID'));
    console.log(chalk.gray('   Account IDs always start with "712020:"\n'));

    console.log(chalk.yellow('📋 Method 4: From Confluence (if available)'));
    console.log(chalk.white('1. Go to your Confluence instance'));
    console.log(chalk.white('2. Click on your profile → "View Profile"'));
    console.log(chalk.white('3. Account ID will be in the URL'));
    console.log(chalk.gray('   Same Account ID across all Atlassian products\n'));

    const { needBrowserHelp, jiraUrl } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'needBrowserHelp',
        message: 'Would you like help opening your JIRA profile?',
        default: false
      },
      {
        type: 'input',
        name: 'jiraUrl',
        message: 'Enter your JIRA URL (e.g., https://company.atlassian.net):',
        when: (answers) => answers.needBrowserHelp,
        validate: (input) => {
          try {
            new URL(input.trim());
            return input.includes('atlassian.net') ? true : 'Please enter a valid Atlassian URL';
          } catch {
            return 'Please enter a valid URL';
          }
        },
        filter: (input) => input.trim().replace(/\/$/, '')
      }
    ]);

    if (needBrowserHelp && jiraUrl) {
      const profileSearchUrl = `${jiraUrl}/jira/people/search`;
      try {
        await open(profileSearchUrl);
        console.log(chalk.green('✅ Opened JIRA people search'));
        console.log(chalk.gray('Search for your name and click your profile to see Account ID\n'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not open browser'));
        console.log(chalk.white(`Please visit: ${profileSearchUrl}\n`));
      }
    }

    console.log(chalk.blue('💡 Account ID Format:'));
    console.log(chalk.white('712020:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'));
    console.log(chalk.gray('• Always starts with "712020:"'));
    console.log(chalk.gray('• Followed by a UUID (universally unique identifier)'));
    console.log(chalk.gray('• Same across JIRA, Confluence, Tempo, etc.'));
    console.log(chalk.gray('• Cannot be changed - it\'s your permanent Atlassian identity\n'));

    console.log(chalk.green('✅ Once you find your Account ID, save it for future use!'));
    console.log(chalk.blue('You can use it to configure Tempo Booker and other Atlassian integrations.'));
  }

  static async queryAccountIdInteractive() {
    const chalk = require('chalk');
    const inquirer = require('inquirer');
    
    console.log(chalk.blue.bold('\n🔍 Account ID Discovery Tool'));
    console.log(chalk.gray('Let\'s find your Atlassian Account ID step by step\n'));

    await this.showAccountIdHelp();

    const { foundAccountId } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'foundAccountId',
        message: 'Did you find your Account ID?',
        default: false
      }
    ]);

    if (foundAccountId) {
      const { accountId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'accountId',
          message: 'Enter your Account ID:',
          validate: (input) => {
            if (!input.trim()) return 'Account ID is required';
            if (!input.includes(':')) return 'Account ID should contain ":"';
            if (!input.startsWith('712020:')) return 'Account ID should start with "712020:"';
            return true;
          },
          filter: (input) => input.trim()
        }
      ]);

      console.log(chalk.green(`\n✅ Account ID confirmed: ${accountId}`));
      console.log(chalk.blue('You can now use this in your Tempo Booker configuration.'));
      return accountId;
    } else {
      console.log(chalk.yellow('\n💡 Additional Help:'));
      console.log(chalk.white('• Contact your IT administrator'));
      console.log(chalk.white('• Check with a colleague who uses Atlassian tools'));
      console.log(chalk.white('• Try the browser developer tools method'));
      console.log(chalk.white('• Look at existing Tempo worklogs for your Account ID'));
      return null;
    }
  }
}

module.exports = TokenHelpers;