# 🧪 User Testing Guide

This guide helps you test Tempo Booker with your specific user ID and environment setup.

## 🚀 Quick Tests

### 1. **Complete Environment Test**
```bash
node test-user-environment.js
```
This comprehensive test verifies:
- ✅ Your user configuration
- ✅ Keychain token access
- ✅ API authentication with your credentials
- ✅ Issue resolution with your mappings
- ✅ Recent worklogs access

### 2. **Security Status Check**
```bash
node src/index.js --security-status
```
Shows your token security status and storage method.

### 3. **Keychain Functionality**
```bash
node src/index.js --test-keychain
```
Tests macOS keychain integration with your system.

## 🎯 Functional Tests

### 4. **Quick Log Test**
```bash
# Test with an issue from your config.yaml
node src/index.js quick ITST-14440 0.1 "Testing my setup"
```
Replace `ITST-14440` with an issue key from your `config.yaml` issueMapping section.

### 5. **Interactive Mode Test**
```bash
npm start
```
Then try:
- 📅 View time table
- 📥 Import from your CSV file
- 📤 Export your worklogs

### 6. **CSV Import Test**
Create a test CSV file in your workspace directory:

```csv
date,startTime,endTime,issue,description
2025-09-02,09:00:00,09:15:00,ITST-14440,Testing CSV import
```

Then import:
```bash
node src/index.js import
```

## 🔧 Troubleshooting Tests

### 7. **Debug Your Configuration**
```bash
node -e "
const config = require('./src/utils/config');
console.log('User ID:', config.userAccountId);
console.log('Issues mapped:', Object.keys(config.issueMapping || {}));
console.log('JIRA URL:', config.jiraBaseUrl);
"
```

### 8. **Test Token Retrieval**
```bash
node -e "
const config = require('./src/utils/config');
config.getTempoToken().then(token => {
  console.log('Token length:', token ? token.length : 'Not found');
  console.log('Token preview:', token ? token.substring(0, 8) + '...' : 'None');
});
"
```

### 9. **Test API Connectivity**
```bash
node -e "
const api = require('./src/services/tempoApiService');
api.getAccounts().then(accounts => {
  console.log('Accounts found:', accounts ? accounts.length : 'Failed');
}).catch(err => console.log('API Error:', err.message));
"
```

### 10. **Test Issue Resolution**
```bash
node -e "
const resolver = require('./src/services/issueResolver');
resolver.resolveIssue('ITST-14440').then(result => {
  console.log('Resolution result:', result);
});
"
```

## 📊 Your Current Setup

Run this to see your current configuration:

```bash
node -e "
const config = require('./src/utils/config');
console.log('📋 Your Configuration:');
console.log('User:', config.userName || 'Unknown User');
console.log('Account ID:', config.userAccountId);
console.log('JIRA URL:', config.jiraBaseUrl);
console.log('Workspace:', config.yaml?.user?.workspaceDir);
console.log('Issues mapped:', Object.keys(config.issueMapping || {}).length);
console.log('Available issues:');
Object.keys(config.issueMapping || {}).forEach(key => {
  console.log('  -', key, '->', config.issueMapping[key].id);
});
"
```

## 🔍 Testing Different Scenarios

### Scenario A: Test with your most common issue
```bash
# Replace YOUR-COMMON-ISSUE with an issue you use frequently
node src/index.js quick YOUR-COMMON-ISSUE 0.25 "Testing my common issue"
```

### Scenario B: Test time table for your recent activity
```bash
echo "1" | echo "2025-08-01" | echo "2025-09-02" | node src/index.js
```

### Scenario C: Test with a new issue (not in config)
```bash
# This will test API fallback resolution
node src/index.js quick NEW-ISSUE-123 0.1 "Testing new issue resolution"
```

## 🆔 Finding Your User ID

If you need to verify or find your user ID:

### Method 1: From existing worklogs
```bash
node -e "
const api = require('./src/services/tempoApiService');
api.getWorklogs({limit: 1, expand: 'author'}).then(worklogs => {
  if (worklogs.results && worklogs.results[0]) {
    console.log('Your User ID:', worklogs.results[0].author?.accountId);
    console.log('Your Name:', worklogs.results[0].author?.displayName);
  }
});
"
```

### Method 2: From user endpoint
```bash
node -e "
const api = require('./src/services/tempoApiService');
api.getCurrentUser().then(user => {
  console.log('User details:', JSON.stringify(user, null, 2));
});
"
```

### Method 3: Run the account discovery script
```bash
node get-account-id.js
```

## 🎯 Success Criteria

Your setup is working correctly if:
- ✅ `test-user-environment.js` passes all tests
- ✅ You can log time entries successfully
- ✅ Time table shows your actual worklogs
- ✅ CSV import/export works with your data
- ✅ Issue resolution works for your projects

## 🚨 Common Issues & Solutions

### "Unauthorized" errors
- Run: `node src/index.js --security-status`
- Check if token is properly stored in keychain
- Verify token has the correct permissions in Tempo

### "Issue not found" errors
- Add the issue to your `config.yaml` issueMapping section
- Or set `issueResolution.useAPI: true` for automatic resolution

### "Account ID not found" errors
- Run: `node get-account-id.js` to discover your account ID
- Update `user.accountId` in `config.yaml`

### Performance issues
- Add frequently used issues to config mappings
- Set `issueResolution.useMCP: false` if you don't have MCP

## 📞 Getting Help

If tests fail, run this to gather debug information:
```bash
echo "=== Debug Information ===" > debug.log
node test-user-environment.js >> debug.log 2>&1
echo "" >> debug.log
node src/index.js --security-status >> debug.log 2>&1
echo "Debug info saved to debug.log"
```

This creates a debug.log file with all the information needed to troubleshoot issues.