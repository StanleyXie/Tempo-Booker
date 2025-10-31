# Configuration Management Guide

## 🎯 Overview

The Tempo CLI uses a comprehensive configuration system centered around `config.yaml` for user-specific settings, workspace management, and preferences.

## 🚀 First-Time Setup

### Automatic Setup (Recommended)

When you first run `tempo-booker`, the setup wizard will automatically launch:

```bash
npm install -g tempo-booker
tempo-booker  # First run triggers setup wizard
```

### Manual Setup

Run the setup wizard anytime:

```bash
tempo-booker --setup
```

## 📋 Setup Wizard Flow

### Step 1: API Configuration
- **Tempo API Token**: Your personal API token from Tempo
- **JIRA Base URL**: Your company's Atlassian instance (e.g., `https://company.atlassian.net`)
- **JIRA Credentials** (optional): For enhanced issue summaries

### Step 2: User Discovery
- Automatically discovers your user information from API
- Validates credentials and connection
- Confirms or allows manual entry of user details

### Step 3: Workspace Setup
- **Workspace Directory**: Where your files will be stored (default: `~/tempo-workspace`)
- **Import File**: Default CSV filename for worklogs
- **Date Scope**: Default import scope (current-week, last-7-days, etc.)
- **Beta Features**: Enable/disable advanced features

### Step 4: Configuration Saved
- Creates `config.yaml` with your settings
- Sets up workspace directory structure
- Creates sample files and folders

## 📁 Workspace Structure

After setup, your workspace directory will contain:

```
~/tempo-workspace/
├── my-worklogs.csv          # Default import file
├── exports/                 # Export files go here
├── backups/                 # Backup files from clear operations  
└── logs/                    # Application logs
    └── tempo-cli.log
```

## ⚙️ Configuration File Structure

### Complete config.yaml Example

```yaml
# API Configuration
api:
  tempoToken: "your_tempo_api_token"
  jiraBaseUrl: "https://your-company.atlassian.net"
  jiraEmail: "user@company.com"      # optional
  jiraToken: "your_jira_api_token"   # optional

# User Configuration
user:
  name: "John Doe" 
  accountId: "712020:xxx-xxx-xxx"
  workspaceDir: "/Users/john/tempo-workspace"

# File Management
files:
  importFile: "my-worklogs.csv"    # relative to workspaceDir
  exportDir: "exports"             # relative to workspaceDir
  backupDir: "backups"             # relative to workspaceDir

# Import Preferences  
import:
  defaultDateScope: "current-week"

# Issue Mappings (auto-populated)
issueMapping:
  "PROJECT-123":
    id: "12345"
    summary: "Sample Task"

# Atlassian Configuration
atlassian:
  cloudId: "auto-discovered"

# CLI Preferences
cli:
  function_beta: false
  colorOutput: true
  progressBars: true
  verboseLogging: false
  silentMode: false
  logToFile: true

# Logging Configuration
logging:
  enabled: true
  logFile: "logs/tempo-cli.log"
  maxFileSize: "10MB"
  maxFiles: 5
  level: "info"
  consoleLevel: "normal"
```

## 🔧 Configuration Sections Explained

### API Section
- **tempoToken**: Personal API token from Tempo settings
- **jiraBaseUrl**: Your Atlassian instance URL
- **jiraEmail/jiraToken**: Optional credentials for enhanced JIRA integration

### User Section  
- **name**: Display name for the user
- **accountId**: Atlassian account ID (auto-discovered)
- **workspaceDir**: Absolute path to your file workspace

### Files Section
All paths are relative to `workspaceDir` unless absolute:
- **importFile**: Default CSV file for imports
- **exportDir**: Where exported files are saved
- **backupDir**: Where backup files are stored during clear operations

### Import Section
- **defaultDateScope**: Default scope for import operations
  - `current-week`: Monday to Sunday of current week
  - `last-7-days`: Rolling 7-day window
  - `this-month`: Current calendar month  
  - `all`: All dates in file

### CLI Section
- **function_beta**: Show/hide beta features (advanced logging, reporting)
- **colorOutput**: Enable colored terminal output
- **progressBars**: Show progress indicators
- **verboseLogging**: Show detailed debug information
- **silentMode**: Minimize console output
- **logToFile**: Enable file logging

### Logging Section
- **enabled**: Enable/disable logging system
- **logFile**: Path to log file (relative to workspaceDir)
- **maxFileSize**: Maximum log file size before rotation
- **maxFiles**: Number of rotated log files to keep
- **level**: Minimum log level (debug, info, warn, error)
- **consoleLevel**: Console output level (normal, debug)

## 📦 Migration from Old Configuration

If you have an existing config.yaml from an older version:

1. **Automatic Migration**: Run `tempo-booker` and it will detect and offer to migrate your configuration

2. **Manual Migration**: Run `tempo-booker --setup` to reconfigure from scratch

3. **Backup**: Original configuration is automatically backed up during migration

## 🎛️ File Path Management

The configuration system provides intelligent file path resolution:

### Path Types
- **Absolute paths**: Used as-is (e.g., `/Users/john/custom-location/file.csv`)
- **Relative paths**: Resolved relative to workspace directory
- **Type-specific paths**: Automatically placed in appropriate subdirectories

### Path Resolution Examples
```javascript
// Import file: workspace/my-worklogs.csv
config.defaultImportFile

// Export file: workspace/exports/export_2025-01-01.csv  
config.resolveFilePath('export_2025-01-01.csv', 'export')

// Backup file: workspace/backups/backup_2025-01-01.csv
config.resolveFilePath('backup_2025-01-01.csv', 'backup')
```

## 🔐 Security Considerations

### API Tokens
- Stored securely in macOS keychain (primary) or config.yaml (fallback)
- Configuration file is automatically excluded from version control
- Never share your configuration file or commit tokens to repositories

### File Permissions
- Workspace directory created with appropriate permissions
- Log files rotated to prevent disk space issues
- Backup files preserve original data during clear operations

## 🛠️ Customization

### Manual Editing
Edit `config.yaml` directly to customize:
```bash
# Open config in your editor
code config.yaml  # VS Code
vim config.yaml   # Vim
nano config.yaml  # Nano
```

### Re-running Setup
To reconfigure completely:
```bash
tempo-booker --setup
```

### Workspace Migration
To change workspace location:
1. Edit `user.workspaceDir` in config.yaml
2. Move existing files to new location
3. Update any absolute paths in configuration

## 📚 Command Line Integration

### Setup Commands
```bash
tempo-booker --setup           # Run setup wizard
tempo-booker --help            # Show help with setup info
```

### File Commands (Workspace-Aware)
```bash
tempo-booker import                    # Use default import file
tempo-booker import my-file.csv        # Use specific file (resolved to workspace)
tempo-booker export                    # Export to workspace/exports/
```

## 🔍 Troubleshooting

### Configuration Issues
```bash
# Check if config exists and is valid
ls -la config.yaml

# Re-run setup wizard
tempo-booker --setup

# Check logs for errors
cat ~/tempo-workspace/logs/tempo-cli.log
```

### Issue ID Resolution Problems (v1.0.3 Fixes)

**Problem**: CSV imports fail with 403 errors, but manual web interface creation works
**Solution**: Issue ID mapping is incorrect in config

```bash
# Step 1: Check your current workspace config
cat ~/tempo-workspace/config.yaml | grep -A3 "ISSUE-KEY"

# Step 2: Find the correct issue ID by checking existing worklogs
node -e "
const tempoApi = require('./src/services/tempoApiService.js');
tempoApi.getWorklogs({from: '2025-01-01'}).then(data => {
  const matching = data.results?.filter(w => w.description?.includes('ISSUE-KEY'));
  console.log(matching[0]?.issue?.id);
});
"

# Step 3: Update the workspace config (not project config)
# Edit ~/tempo-workspace/config.yaml with correct issue ID

# Step 4: Clear cache and test
rm -rf node_modules/.cache 2>/dev/null || true
```

**Key Points**:
- Workspace config (`~/tempo-workspace/config.yaml`) takes precedence over project config
- After updating issue IDs, restart the CLI to clear cached mappings
- Use existing worklog patterns to discover correct issue IDs

### Path Issues
- Ensure workspace directory exists and is writable
- Check that relative paths are correct
- Verify absolute paths point to valid locations

### Migration Issues
- Original config is backed up as `config.yaml.backup.TIMESTAMP`
- Manually restore backup if migration fails
- Re-run setup wizard for fresh configuration

### Multiple Config Files (New in v1.0.3)
The system now properly handles multiple config locations:

1. **Project Config**: `/path/to/tempo-project/config.yaml` 
2. **Workspace Config**: `~/tempo-workspace/config.yaml` (takes precedence)

**Resolution Steps**:
```bash
# Check which config is being used
tempo-booker --config-status

# Force refresh of config cache
tempo-booker --reload-config
```

## 📖 Best Practices

### For Individual Users
1. Use the setup wizard for initial configuration
2. Keep workspace directory organized
3. Regularly backup your workspace directory
4. Don't commit `config.yaml` to version control

### For Teams
1. Share `config.template.yaml` instead of actual config
2. Document team-specific API endpoints and setup steps
3. Use configuration templates with placeholders for shared settings
4. Provide team-specific issue mapping examples

### For Developers
1. Test configuration changes with `--setup`
2. Validate new configuration options thoroughly
3. Maintain backward compatibility during migrations
4. Document new configuration options in this file

## 🎫 Static Issue Mapping Guide

### Overview

The `issueMapping` section in your `config.yaml` provides a local cache of JIRA issue keys mapped to their internal IDs. This enables faster issue resolution and works as a fallback when MCP (Model Context Protocol) integration is unavailable.

### Why Use Static Issue Mapping?

**Benefits:**
- **Performance**: Instant issue resolution without API calls
- **Reliability**: Works when JIRA API or MCP services are unavailable
- **Offline Support**: Import CSV files without internet connectivity
- **Enterprise Friendly**: No external API dependencies

**When You Need It:**
- Your organization restricts API token access
- MCP integration is not available or configured
- Working with frequently used issues
- Batch processing large CSV imports

### Basic Issue Mapping Structure

```yaml
issueMapping:
  "PROJECT-123":
    id: "12345"
    summary: "Feature Development Task"
  "PROJECT-124":
    id: "12346"
    summary: "Bug Fix - Login Issue"
  "SUPPORT-001":
    id: "78901"
    summary: "Customer Support Ticket"
```

### Finding Issue IDs

#### Method 1: Using the Add Issue Tool

The quickest way to add new issues to your mapping:

```bash
node add-issue.js
```

**Interactive Process:**
1. Enter JIRA issue key (e.g., `PROJ-123`)
2. Enter the numerical issue ID from JIRA
3. Enter a brief summary/description
4. Tool automatically updates your `config.yaml`

#### Method 2: Finding IDs Manually

**From JIRA Web Interface:**
1. Open the issue in JIRA (e.g., `https://company.atlassian.net/browse/PROJ-123`)
2. Check the URL or page source for the internal ID
3. Look for patterns like `issueId=12345` or `data-issue-id="12345"`

**From JIRA API:**
```bash
# Using curl with your JIRA credentials
curl -u "email@company.com:api_token" \
  "https://company.atlassian.net/rest/api/2/issue/PROJ-123" | \
  jq '.id'
```

#### Method 3: MCP-Assisted Discovery

If you have MCP configured, ask your AI assistant:
- "What is the issue ID for PROJ-123?"
- "Show me details for issue PROJ-123 including its internal ID"

### Common Issue Mapping Patterns

#### Project-Based Organization

```yaml
issueMapping:
  # Development Team Issues
  "DEV-001":
    id: "100001"
    summary: "Sprint Planning Task"
  "DEV-002":
    id: "100002"
    summary: "Code Review Process"
  
  # Operations Team Issues
  "OPS-001":
    id: "200001"
    summary: "Infrastructure Maintenance"
  "OPS-002":
    id: "200002"
    summary: "Monitoring Setup"
  
  # Support Team Issues  
  "SUP-001":
    id: "300001"
    summary: "Customer Issue Resolution"
```

#### Time-Based Organization

```yaml
issueMapping:
  # Q1 2025 Sprint Issues
  "SPRINT-Q1-001":
    id: "400001"
    summary: "Q1 Feature Development"
  "SPRINT-Q1-002":
    id: "400002"
    summary: "Q1 Testing & QA"
  
  # Ongoing Maintenance
  "MAINT-DAILY":
    id: "500001"
    summary: "Daily Operations & Maintenance"
  "MAINT-WEEKLY":
    id: "500002"
    summary: "Weekly Team Meetings"
```

### Advanced Mapping Features

#### Rich Summaries

Include detailed information for better worklog context:

```yaml
issueMapping:
  "PROJ-123":
    id: "12345"
    summary: "Azure Cloud Migration - Phase 2: Database Migration"
    project: "Azure Migration Project"
    type: "Epic"
    priority: "High"
    assignee: "John Doe"
```

#### Team-Specific Issues

Organize by team or functional area:

```yaml
issueMapping:
  # Backend Development
  "API-001":
    id: "600001"
    summary: "REST API Development"
  "API-002":
    id: "600002"
    summary: "Database Integration"
  
  # Frontend Development
  "UI-001":
    id: "700001"
    summary: "User Interface Design"
  "UI-002":
    id: "700002"
    summary: "React Component Library"
  
  # DevOps & Infrastructure
  "INFRA-001":
    id: "800001"
    summary: "CI/CD Pipeline Setup"
  "INFRA-002":
    id: "800002"
    summary: "Production Deployment"
```

### Issue Mapping Best Practices

#### 1. Consistent Naming Conventions

Use consistent patterns for issue keys:
- `TEAM-NUMBER`: `DEV-001`, `QA-002`, `OPS-003`
- `PROJECT-TYPE-NUMBER`: `AZURE-FEAT-001`, `AZURE-BUG-002`
- `CATEGORY-PRIORITY-NUMBER`: `CRITICAL-001`, `FEATURE-001`

#### 2. Meaningful Summaries

Write clear, descriptive summaries:
```yaml
# Good Examples
"DEV-001":
  id: "12345"
  summary: "Implement user authentication with OAuth 2.0"

"BUG-001": 
  id: "12346"
  summary: "Fix memory leak in data processing module"

# Avoid Generic Descriptions
"DEV-001":
  id: "12345"
  summary: "Development work"  # Too vague
```

#### 3. Regular Maintenance

Keep your issue mapping current:
- Remove completed/closed issues periodically
- Add new issues as you encounter them
- Update summaries if issue scope changes
- Validate issue IDs remain correct

#### 4. Team Coordination

For team environments:
- Share common issues through `config.template.yaml`
- Document team-specific issue conventions
- Use version control for template files (exclude personal configs)
- Establish processes for adding new shared issues

### Automated Issue Management

#### Using the Add Issue Script

Streamline adding new issues:

```bash
# Interactive mode
node add-issue.js

# Example interaction:
# ? Enter JIRA issue key (e.g., PROJ-123): DEV-456
# ? Enter issue ID (numerical ID from JIRA): 98765
# ? Enter issue summary/description: Implement new reporting feature
# ✅ Added DEV-456 to issue mapping!
```

#### Bulk Import from CSV

Create a CSV file with your issues and import them:

```csv
issueKey,issueId,summary
DEV-001,12345,User Authentication System
DEV-002,12346,Payment Processing Module  
DEV-003,12347,Admin Dashboard Development
```

### Troubleshooting Issue Mapping

#### Issue Not Found Errors

```bash
Error: Issue 'PROJ-999' not found in mapping
```

**Solutions:**
1. Add the issue using `node add-issue.js`
2. Manually add to `config.yaml`
3. Verify the issue key exists in JIRA
4. Check for typos in the issue key

#### Invalid Issue ID Errors

```bash
Error: Issue ID '99999' is invalid or inaccessible
```

**Solutions:**
1. Verify the issue ID in JIRA
2. Check if you have permission to access the issue
3. Confirm the issue hasn't been moved/deleted
4. Test with JIRA API to validate the ID

#### Mapping Sync Issues

If your local mapping gets out of sync:
1. Use MCP integration to verify current issue details
2. Re-run `node add-issue.js` for problem issues
3. Compare with JIRA web interface
4. Consider regenerating mapping for frequently changing issues

### Enterprise Configuration Examples

#### Large Organization Setup

```yaml
issueMapping:
  # Strategic Initiatives
  "STRAT-Q1-2025":
    id: "1000001"
    summary: "Q1 2025 Strategic Goals & Planning"
  "STRAT-CLOUD":
    id: "1000002" 
    summary: "Cloud Migration Initiative"
  
  # Department Operations
  "IT-OPS-DAILY":
    id: "2000001"
    summary: "IT Operations - Daily Activities"
  "HR-ADMIN":
    id: "3000001"
    summary: "HR Administrative Tasks"
  "FINANCE-MONTHLY":
    id: "4000001"
    summary: "Monthly Financial Reporting"
  
  # Project-Specific Work
  "PROJ-AZURE-001":
    id: "5000001"
    summary: "Azure Migration - Infrastructure Setup"
  "PROJ-AZURE-002":
    id: "5000002"
    summary: "Azure Migration - Application Migration"
```

#### Small Team Setup  

```yaml
issueMapping:
  # Regular Work Categories
  "DEVELOPMENT":
    id: "10001"
    summary: "General Development Work"
  "MEETINGS":
    id: "10002"
    summary: "Team Meetings & Planning"
  "SUPPORT":
    id: "10003"
    summary: "Customer Support Activities"
  "ADMIN":
    id: "10004"
    summary: "Administrative Tasks"
  
  # Specific Projects
  "WEBSITE-REDESIGN":
    id: "20001"
    summary: "Company Website Redesign Project"
  "MOBILE-APP":
    id: "20002"
    summary: "Mobile Application Development"
```

### Integration with Import Process

When importing CSV files, the system resolves issues in this order:

1. **Static Mapping**: Check `config.yaml` issueMapping first
2. **MCP Integration**: Query AI assistant if mapping not found
3. **API Fallback**: Direct JIRA API call (if credentials available)
4. **Error**: Report issue as unresolvable

**CSV Import Example:**
```csv
date,startTime,endTime,issue,description
2025-01-15,09:00:00,11:00:00,DEV-001,Implementing OAuth integration
2025-01-15,11:00:00,12:00:00,MEETINGS,Daily standup meeting
2025-01-15,13:00:00,17:00:00,DEV-002,Payment gateway development
```

All issues (`DEV-001`, `MEETINGS`, `DEV-002`) will be resolved using your static mapping for fast, reliable processing.