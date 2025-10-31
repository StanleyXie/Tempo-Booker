# Tempo Booker CLI

A simplified CLI tool for Tempo Booker with automatic Account ID discovery, static issue mapping, and streamlined setup for professional workflow management.

## 🚀 Features

- **🤖 Automatic Account ID Discovery**: Intelligent system finds your Atlassian Account ID using Tempo API only
- **⚡ Simplified Setup**: 3-step setup process with minimal configuration required  
- **📊 CSV Import with Auto-calculated Hours**: Import worklogs using time ranges instead of manual calculations
- **📝 Static Issue Mapping**: Version-controlled issue mappings perfect for teams
- **🔍 Multiple Discovery Methods**: Comprehensive Account ID discovery with fallbacks
- **⚙️ Time Conflict Validation**: Automatically detects overlapping time entries
- **🔒 Enhanced Security**: Native macOS keychain integration with 4-tier fallback system
- **🛠️ Utility Scripts**: Helper tools for account discovery and issue management
- **💻 Interactive CLI**: User-friendly interface with helpful guidance
- **📁 Smart Workspace**: Organized file structure with automatic management

## 🎯 Latest Updates - Version 1.0.3 (September 2025)

### ✅ Recent Fixes
- **🔧 Issue ID Resolution**: Fixed incorrect issue ID mappings causing import failures
- **📋 Configuration Management**: Resolved workspace-specific config file precedence issues
- **🧩 Cache Management**: Added proper cache clearing for static issue resolver
- **✅ Import Reliability**: Enhanced CSV import success rate with better error handling

### 🛠️ Technical Improvements
- Fixed workspace config taking precedence over project config
- Added cache invalidation for Node.js module system after config changes
- Improved issue ID discovery through existing worklog pattern analysis
- Enhanced static issue resolver with better cache management

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g tempo-booker
```

After installation, you can use the CLI anywhere:

```bash
tempo-booker
# or
tempo
```

### Local Installation

```bash
npm install tempo-booker
npx tempo-booker
```

## 🔧 Quick Start

### 1. Automatic Setup (Recommended)

```bash
tempo-booker --setup
```

The setup wizard will:
- ✅ Guide you through getting your Tempo API token
- 🤖 **Automatically discover your Account ID** using Tempo API
- 📁 Set up your workspace directory
- ⚙️ Configure preferences and defaults

### 2. Account ID Discovery (If Needed)

If automatic discovery fails, use our helper tools:

```bash
# Automatic retrieval (preferred)
node get-account-id.js

# Manual discovery with guidance
node find-account-id.js
```

### 3. Add Your Issues

```bash
# Add issues to your static mapping
node add-issue.js
```

**That's it!** No complex API token management or JIRA authentication needed.

## 🎯 Configuration

Your `config.yaml` will be automatically generated:

```yaml
user:
  name: "Your Name"
  accountId: "712020:xxx-xxx-xxx"  # Auto-discovered!

issueMapping:
  "PROJECT-123":
    id: "12345"
    summary: "Your Project Task"
```

## 🔒 Security & Token Management

Tempo Booker uses a **4-tier security system** for maximum token protection:

### macOS Enhanced Security
```bash
# Check your security status
tempo-booker --security-status

# Test keychain functionality  
tempo-booker --test-keychain

# Migrate from insecure config storage
tempo-booker --migrate-token
```

**Priority System:**
1. **🥇 macOS Native Keychain** - Uses macOS `security` command (most secure)
2. **🥈 Cross-platform Keychain** - Uses keytar library (secure)  
3. **🥉 Environment Variables** - `TEMPO_API_TOKEN` (moderately secure)
4. **🤝 Interactive Prompt** - Manual entry when needed (temporary)

**Security Benefits:**
- ✅ **Native OS encryption** - Your tokens are encrypted by macOS
- ✅ **User authentication required** - macOS prompts for permission
- ✅ **Cross-app protection** - Other applications cannot access your tokens
- ✅ **Automatic fallback** - Seamlessly handles system differences

## 🔧 Issue Resolution & MCP Compatibility

Tempo Booker supports **multiple issue resolution methods** with intelligent fallbacks:

### For Users WITH Atlassian MCP (Recommended)
```yaml
issueResolution:
  useMCP: true                     # Use MCP for live JIRA data (fastest)
  useConfigMappings: true          # Use static mappings (reliable)
  useAPI: true                     # API fallback (flexible)
  autoSuggestMappings: true        # Get mapping suggestions
```

### For Users WITHOUT Atlassian MCP
```yaml
issueResolution:
  useMCP: false                    # Skip MCP (not installed)
  useConfigMappings: true          # Use config mappings (fastest)
  useAPI: true                     # API fallback for new issues
  autoSuggestMappings: true        # Helpful suggestions

# Add your frequently used issues:
issueMapping:
  "PROJECT-123":
    id: "12345"
    summary: "Your Project Task"
  "MEETING-456":
    id: "67890"
    summary: "Team Meetings"
```

**Resolution Priority:**
1. **🚀 Config Mappings** (fastest - 0ms lookup)
2. **🔍 MCP Service** (live data - requires MCP)
3. **🌐 API Resolution** (fallback - works for everyone)

**Test Compatibility:**
```bash
# Test your setup
node test-non-mcp.js

# Full compatibility test
node test-compatibility.js
```

## 📊 CSV Format

```csv
date,startTime,endTime,issue,description,delete
2025-08-27,09:00:00,11:00:00,PROJECT-123,Working on feature,
2025-08-27,11:00:00,11:30:00,PROJECT-456,Team meeting,
2025-08-27,13:00:00,15:00:00,PROJECT-789,Bug fix,true
```

**Column Details:**
- `date`: YYYY-MM-DD format
- `startTime`/`endTime`: HH:mm:ss format (hours auto-calculated)
- `issue`: JIRA issue key (e.g., PROJECT-123)
- `description`: Work description
- `delete`: Optional. Set to `true`/`1`/`yes` to delete existing worklog

## 🎯 Usage

### Interactive Mode

```bash
tempo-booker
```

Provides a user-friendly menu with options to:
- 📅 View time table
- 📥 Import worklogs from file
- 📤 Export worklogs to file
- ✏️ Update a worklog
- And more...

### Quick Logging

```bash
tempo-booker quick PROJECT-123 2 "Bug fix work"
```

### Silent Import Mode

```bash
# Use defaults from config.yaml
tempo-booker import

# Import specific file
tempo-booker import my-worklogs.csv

# Import with date scope
tempo-booker import my-worklogs.csv current-week
```

**Date Scopes:**
- `current-week`
- `last-7-days` 
- `this-month`
- `all`

### Help

```bash
tempo-booker --help
```

## 🛠️ Utility Scripts

### Account ID Discovery

```bash
# Automatic Account ID retrieval (recommended)
node get-account-id.js

# Manual Account ID discovery with step-by-step guidance  
node find-account-id.js
```

### Issue Management

```bash
# Add new issues to your static mapping
node add-issue.js
```

### Setup Management

```bash
# Re-run the setup wizard
tempo-booker --setup
```

## 🔄 Workflow Operations

The tool automatically categorizes operations during import:

1. **ADD**: New worklogs not in Tempo
2. **UPDATE**: Existing worklogs with different hours/description
3. **DELETE**: Worklogs marked with delete=true
4. **NO CHANGE**: Existing worklogs that match exactly

## ⚙️ Configuration

### Logging Configuration

```yaml
cli:
  verboseLogging: false    # Show debug messages
  silentMode: false        # Minimal CLI output
  logToFile: true          # Enable file logging

logging:
  consoleLevel: "normal"   # "normal" or "debug"
  logFile: "logs/tempo-booker.log"
```

### Clean Output Modes

- **Normal Mode**: Clean transaction-level output
- **Debug Mode**: Detailed processing information  
- **Silent Mode**: Minimal output for automation

## 🚨 Requirements

- **Node.js**: >= 14.0.0
- **Tempo API Token**: Valid token with worklog permissions
- **Atlassian MCP**: Installed and authenticated
- **JIRA Access**: Permission to view and log work on target issues

## 📈 Example Workflow

1. **Setup**: Run `tempo-booker --setup` to configure API token and workspace
2. **Prepare CSV**: Create worklog entries with time ranges
3. **Import**: Run `tempo-booker import my-worklogs.csv`
4. **Review**: Check import results and time table
5. **Iterate**: Make adjustments and re-import as needed

## 🐛 Troubleshooting

### Common Issues

- **403 Permission Error**: User lacks permission to log work on the project
- **Issue Not Found**: Issue key not in configuration mappings  
- **Time Conflicts**: Overlapping time entries detected
- **Incorrect Issue ID**: If CSV imports fail with 403 errors but web interface works, the issue ID mapping may be incorrect
- **Configuration Cache**: After updating issue IDs, restart the CLI to clear cached mappings
- **Multiple Config Files**: Check both project and workspace config files for conflicting mappings

### Recently Fixed Issues (v1.0.3)

- **✅ Issue ID Resolution**: Fixed incorrect issue ID mappings causing import failures
- **✅ Config File Precedence**: Resolved workspace config overriding project config  
- **✅ Cache Invalidation**: Added proper cache clearing for updated configurations
- **✅ Error Messages**: Improved error reporting for issue resolution problems

### Debug Mode

Enable verbose logging to see detailed processing:

```yaml
cli:
  verboseLogging: true
```

Or check log files in `logs/tempo-booker.log`.

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🔗 Links

- [GitHub Repository](https://github.com/stanleyxie/tempo-booker)
- [Issue Tracker](https://github.com/stanleyxie/tempo-booker/issues)
- [NPM Package](https://www.npmjs.com/package/tempo-booker)

---

**Made with ❤️ for productivity and time tracking automation**