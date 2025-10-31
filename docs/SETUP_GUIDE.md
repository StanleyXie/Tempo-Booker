# Quick Setup Guide

## 🚀 First-Time Installation & Setup

### 1. Install the Package
```bash
npm install -g tempo-booker
```

### 2. First Run - Automatic Setup Wizard
```bash
tempo-booker
```
The setup wizard will automatically launch and guide you through:

### 3. Setup Wizard Steps

#### Step 1: API Token Acquisition 🎫
- **Guided Token Help**: Choose if you need help getting API tokens
- **Tempo API Token**: Get your token from Tempo Settings → API Integration
- **JIRA Base URL**: Enter your company's Atlassian instance
- **JIRA Credentials** (optional): Enhanced issue summaries
- **Live Validation**: Tokens are tested in real-time

#### Step 2: User Discovery 👤  
- **Auto-Discovery**: System finds your account ID and name from API
- **Confirmation**: Review and confirm your user information
- **Manual Override**: Enter details manually if auto-discovery fails

#### Step 3: Workspace Setup 📁
- **Workspace Directory**: Choose where to store your files (default: `~/tempo-workspace`)
- **File Preferences**: Set default import filename and date scope
- **Directory Creation**: Automatic creation of organized folder structure
- **Sample Files**: Template files to get you started

#### Step 4: MCP Integration 🔗
- **MCP Status**: Configure Model Context Protocol for enhanced JIRA integration  
- **Setup Assistance**: Guidance for connecting MCP-compatible AI assistants
- **Optional Enhancement**: Skip if not using AI assistants

### 4. Your Workspace Structure
After setup, you'll have:
```
~/tempo-workspace/
├── my-worklogs.csv          # Your import file (edit this!)
├── exports/                 # Export files saved here
├── backups/                 # Automatic backups
└── logs/                    # Application logs
    └── tempo-cli.log
```

### 5. Configuration Generated
The wizard creates `config.yaml` with:
- ✅ Your validated API tokens
- ✅ User information (auto-discovered)  
- ✅ Workspace paths configured
- ✅ Personalized preferences
- ✅ Ready-to-use setup

## 🔧 Token Acquisition Help

### Getting Your Tempo API Token
1. Go to Tempo in your Atlassian instance
2. Click **Settings** → **API integration**
3. Click **New Token**
4. Name: "CLI Access" (or similar)
5. Copy the token when generated

**Permissions needed:**
- View worklogs
- Create worklogs  
- Edit worklogs
- Delete worklogs

### Getting Your JIRA API Token (Optional)
1. Visit https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Label: "Tempo CLI" (or similar)
4. Copy the token when generated
5. Use with your Atlassian email address

## 🎯 Quick Start After Setup

### 1. Edit Your Import File
```bash
# Open your workspace
cd ~/tempo-workspace
# Edit the import file
code my-worklogs.csv  # or vim, nano, etc.
```

**CSV Format:**
```csv
date,startTime,endTime,issue,description
2025-01-15,09:00:00,10:30:00,PROJECT-123,Working on new feature
2025-01-15,10:30:00,12:00:00,PROJECT-124,Code review and testing
```

### 2. Import Your First Worklogs
```bash
tempo-booker import
```

### 3. View Your Time
```bash
tempo-booker
# Select "View time table" from menu
```

## 🛠️ Advanced Configuration

### Re-run Setup
```bash
tempo-booker --setup
```

### Manual Configuration
Edit `config.yaml` directly:
```yaml
api:
  tempoToken: "your_token"
  jiraBaseUrl: "https://company.atlassian.net"
  
user:
  name: "Your Name"
  accountId: "712020:xxx"
  workspaceDir: "/path/to/workspace"
```

### Workspace Migration
1. Update `user.workspaceDir` in config.yaml
2. Move files to new location
3. Test with `tempo-booker`

## 🔍 Troubleshooting Setup

### Setup Won't Start
```bash
# Check installation
tempo-booker --help

# Clear any partial config
rm config.yaml

# Try again
tempo-booker
```

### Token Validation Fails
- Double-check token from Tempo/JIRA settings
- Verify base URL format: `https://company.atlassian.net`
- Check token permissions in Tempo
- Try manual token entry

### Workspace Issues
- Ensure directory is writable
- Check disk space
- Verify path permissions
- Try default location: `~/tempo-workspace`

### MCP Setup Help
- Visit: https://modelcontextprotocol.io/
- Check AI assistant's MCP marketplace
- Use same JIRA credentials from setup
- MCP is optional - skip if not needed

## 💡 Pro Tips

### During Setup
- Have your API tokens ready beforehand
- Choose a workspace path you'll remember
- Enable beta features if you want advanced functionality
- Test MCP integration if you use AI assistants

### After Setup
- Keep `config.yaml` secure (contains API tokens)
- Backup your workspace directory regularly
- Edit config manually for fine-tuning
- Use `tempo-booker --help` to explore all options

### For Teams
- Share setup process documentation
- Don't share actual `config.yaml` files
- Provide team-specific issue key mappings
- Set up consistent workspace patterns

## 🔧 Troubleshooting Setup Issues (v1.0.3 Updates)

### Issue ID Resolution Problems
**Symptom**: CSV imports fail with 403 errors after setup, but web interface works

**Root Cause**: Issue ID mappings in config may be incorrect

**Solution**:
1. **Check your workspace config** (not the project config):
   ```bash
   cat ~/tempo-workspace/config.yaml
   ```

2. **Find correct issue IDs** from existing worklogs:
   ```bash
   # Look for worklogs mentioning your issue key
   node -e "
   const api = require('tempo-booker/src/services/tempoApiService.js');
   api.getWorklogs({from: '2025-01-01'}).then(data => {
     const matches = data.results?.filter(w => 
       w.description?.includes('YOUR-ISSUE-KEY')
     );
     if (matches.length) {
       console.log('Correct issue ID:', matches[0].issue.id);
     }
   });
   "
   ```

3. **Update workspace config** with correct issue ID:
   ```yaml
   issueMapping:
     "YOUR-ISSUE-KEY":
       id: "correct_issue_id_here"  # Use ID from step 2
       summary: "Your issue summary"
   ```

4. **Restart CLI** to clear cache:
   ```bash
   # Restart any running tempo-booker processes
   pkill -f tempo-booker 2>/dev/null || true
   ```

### Configuration File Conflicts (New in v1.0.3)
The system now properly handles multiple config files:

- **Project Config**: `./config.yaml` (in your project directory)
- **Workspace Config**: `~/tempo-workspace/config.yaml` (takes precedence)

**Always edit the workspace config** for user-specific settings.

### Cache Issues
If you update config but changes don't take effect:

```bash
# Clear Node.js module cache
rm -rf ~/.npm/_cacache 2>/dev/null || true

# Restart the CLI completely
pkill -f tempo-booker 2>/dev/null || true
tempo-booker
```

## 🎉 You're All Set!

After completing setup:
- Your API tokens are validated and saved
- Your workspace is organized and ready
- Your first import file is created
- Your preferences are configured
- You can start tracking time immediately

**New in v1.0.3**: Enhanced issue ID resolution and better error handling for import failures.

Welcome to professional time tracking with Tempo CLI! 🚀