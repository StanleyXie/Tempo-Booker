// Configuration now loaded entirely from config.yaml and secure keychain
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

class Config {
  constructor() {
    // Initialize with defaults - all values loaded from config.yaml
    this.tempoApiToken = null; // Will be loaded from secure storage
    this.tempoBaseUrl = "https://api.tempo.io/4";
    // jiraBaseUrl is loaded via getter from yaml.api.jiraBaseUrl
    this.jiraEmail = null;
    this.jiraApiToken = null;
    this.tempoClientId = null;
    this.tempoClientSecret = null;
    this.authorAccountId = null;
    this.port = 3000;
    this.nodeEnv = "production";
    this._suppressConfigLogs = false;
    this._tokenManager = null;

    // Load YAML configuration
    this.loadYamlConfig();
  }

  /**
   * Get secure token manager instance
   */
  getTokenManager() {
    if (!this._tokenManager) {
      const SecureTokenManager = require('./secureTokenManager');
      this._tokenManager = new SecureTokenManager();
    }
    return this._tokenManager;
  }

  /**
   * Get Tempo API token from secure storage
   */
  async getTempoToken() {
    if (this.tempoApiToken) {
      return this.tempoApiToken;
    }

    const tokenManager = this.getTokenManager();
    const result = await tokenManager.getToken();
    this.tempoApiToken = result.token;
    
    return this.tempoApiToken;
  }

  /**
   * Store Tempo API token securely
   */
  async storeTempoToken(token) {
    const tokenManager = this.getTokenManager();
    await tokenManager.storeToken(token);
    this.tempoApiToken = token;
  }

  loadYamlConfig() {
    // Priority order for config.yaml location:
    // 1. User's tempo-workspace directory (preferred)
    // 2. Current working directory (fallback)
    // 3. Application root directory (legacy)
    
    const possiblePaths = [];
    
    // Get workspace directory from existing config or default
    const workspaceDir = this.yaml?.user?.workspaceDir || 
                        path.join(require('os').homedir(), 'tempo-workspace');
    
    possiblePaths.push(path.join(workspaceDir, 'config.yaml'));
    possiblePaths.push(path.join(process.cwd(), 'config.yaml'));
    possiblePaths.push(path.join(__dirname, '../../config.yaml'));

    let configPath = null;
    let configSource = '';

    // Find the first existing config file
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        configPath = testPath;
        if (testPath.includes('tempo-workspace')) {
          configSource = 'tempo-workspace';
        } else if (testPath === path.join(process.cwd(), 'config.yaml')) {
          configSource = 'current directory';
        } else {
          configSource = 'application directory';
        }
        break;
      }
    }

    try {
      if (configPath) {
        const yamlContent = fs.readFileSync(configPath, "utf8");
        this.yaml = yaml.load(yamlContent);

        // Store the config path for future reference
        this.configPath = configPath;

        // Override with YAML config if available
        if (this.yaml.user?.accountId && !this.authorAccountId) {
          this.authorAccountId = this.yaml.user.accountId;
        }

        if (!this._suppressConfigLogs) {
          console.log(`✅ Loaded configuration from ${configSource}`);
        }
      } else {
        // Create default config in tempo-workspace
        const defaultConfigPath = possiblePaths[0]; // workspace path
        this.createDefaultConfig(defaultConfigPath);
      }
    } catch (error) {
      console.error(`❌ Error loading config.yaml: ${error.message}`);
      this.yaml = {};
    }
  }

  /**
   * Create default configuration file in tempo-workspace
   */
  createDefaultConfig(configPath) {
    try {
      // Ensure workspace directory exists
      const workspaceDir = path.dirname(configPath);
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
        console.log(`📁 Created workspace directory: ${workspaceDir}`);
      }

      const defaultConfig = `# Tempo CLI Configuration
# Auto-generated configuration file
# Location: ${configPath}

# User Configuration
user:
  name: "Your Name"
  accountId: "your_atlassian_account_id_here"
  workspaceDir: "${workspaceDir}"

# API Configuration
api:
  # tempoToken stored securely in keychain
  jiraBaseUrl: "https://your-company.atlassian.net"

# Issue Resolution Preferences
issueResolution:
  useMCP: false                    # Use MCP for issue resolution when available
  useConfigMappings: true          # Use static config mappings (recommended)
  useAPI: true                     # Use API-based resolution as fallback
  autoSuggestMappings: true        # Suggest adding successful API resolutions to config

# Issue Mappings - Add your JIRA issues here
issueMapping:
  # Example entries - replace with your actual issues:
  # "PROJECT-123":
  #   id: "12345"
  #   summary: "Your Project Task"

# File Management
files:
  importFile: "worklogs.csv"      # relative to workspaceDir
  exportDir: "exports"            # relative to workspaceDir
  backupDir: "backups"           # relative to workspaceDir

# Import Preferences
import:
  defaultDateScope: "current-week"

# CLI Preferences
cli:
  colorOutput: true
  progressBars: true
  verboseLogging: false
  silentMode: false
  logToFile: true

# Logging Configuration
logging:
  enabled: true
  logFile: "${path.join(workspaceDir, 'logs', 'tempo-cli.log')}"
  maxFileSize: "10MB"
  maxFiles: 5
  level: "info"
  consoleLevel: "normal"
`;

      fs.writeFileSync(configPath, defaultConfig);
      this.yaml = yaml.load(defaultConfig);
      this.configPath = configPath;
      
      console.log(`✅ Created default configuration at: ${configPath}`);
      console.log(`📝 Please edit the config file to add your details`);
      
    } catch (error) {
      console.error(`❌ Error creating default config: ${error.message}`);
      this.yaml = {};
    }
  }

  // API configuration getters
  get jiraBaseUrl() {
    return this.yaml?.api?.jiraBaseUrl;
  }

  // User configuration getters
  get userName() {
    return this.yaml.user?.name || "Unknown User";
  }

  get userAccountId() {
    return this.authorAccountId || this.yaml.user?.accountId;
  }

  // Import configuration getters
  get defaultImportFile() {
    const fileName = this.yaml.files?.importFile || this.yaml.import?.defaultFile || "tempo.csv";
    const workspaceDir = this.yaml.user?.workspaceDir;
    
    if (workspaceDir && !path.isAbsolute(fileName)) {
      return path.join(workspaceDir, fileName);
    }
    return fileName;
  }

  get defaultDateScope() {
    return this.yaml.import?.defaultDateScope || "current-week";
  }

  // File path management
  get workspaceDir() {
    return this.yaml.user?.workspaceDir || process.cwd();
  }

  get exportDir() {
    const exportDir = this.yaml.files?.exportDir || 'exports';
    const workspaceDir = this.workspaceDir;
    
    if (!path.isAbsolute(exportDir)) {
      return path.join(workspaceDir, exportDir);
    }
    return exportDir;
  }

  get backupDir() {
    const backupDir = this.yaml.files?.backupDir || 'backups';
    const workspaceDir = this.workspaceDir;
    
    if (!path.isAbsolute(backupDir)) {
      return path.join(workspaceDir, backupDir);
    }
    return backupDir;
  }

  resolveFilePath(fileName, type = 'default') {
    const workspaceDir = this.workspaceDir;
    
    if (path.isAbsolute(fileName)) {
      return fileName;
    }
    
    switch (type) {
      case 'export':
        return path.join(this.exportDir, fileName);
      case 'backup':
        return path.join(this.backupDir, fileName);
      case 'import':
      case 'default':
      default:
        return path.join(workspaceDir, fileName);
    }
  }

  // CLI configuration getters
  get functionBeta() {
    return this.yaml.cli?.function_beta === true; // default to false if not specified
  }

  // Issue mapping getters
  get issueMapping() {
    return this.yaml.issueMapping || {};
  }

  // Atlassian configuration getters
  get atlassianCloudId() {
    return (
      this.yaml.atlassian?.cloudId || "0223d842-80ae-41bf-b1db-20bb8ce6b6fd"
    );
  }

  // CLI configuration getters
  get colorOutput() {
    return this.yaml.cli?.colorOutput !== false; // default to true
  }

  get progressBars() {
    return this.yaml.cli?.progressBars !== false; // default to true
  }

  get verboseLogging() {
    return this.yaml.cli?.verboseLogging === true; // default to false
  }

  get silentMode() {
    return this.yaml.cli?.silentMode === true; // default to false
  }

  get logToFile() {
    return this.yaml.cli?.logToFile !== false; // default to true
  }

  // Logging configuration getters
  get logging() {
    const defaultLogFile = path.join(this.workspaceDir, "logs", "tempo-cli.log");
    const config = this.yaml.logging || {
      enabled: true,
      logFile: defaultLogFile,
      maxFileSize: "10MB",
      maxFiles: 5,
      level: "info",
      consoleLevel: "normal"
    };

    // Resolve log file path relative to workspace if not absolute
    if (!path.isAbsolute(config.logFile)) {
      config.logFile = path.join(this.workspaceDir, config.logFile);
    }

    return config;
  }

  validate() {
    if (
      !this.tempoApiToken &&
      (!this.tempoClientId || !this.tempoClientSecret)
    ) {
      throw new Error(
        "Either TEMPO_API_TOKEN or TEMPO_CLIENT_ID/TEMPO_CLIENT_SECRET must be provided",
      );
    }

    if (!this.jiraBaseUrl) {
      throw new Error("JIRA_BASE_URL is required");
    }
  }

  get isOAuthMode() {
    return !!(this.tempoClientId && this.tempoClientSecret);
  }

  get hasJiraAuth() {
    return !!(this.jiraEmail && this.jiraApiToken);
  }

  setSuppressConfigLogs(suppress = true) {
    this._suppressConfigLogs = suppress;
  }

  /**
   * Get the path to the current config.yaml file
   */
  getConfigPath() {
    const possiblePaths = [];
    
    // Get workspace directory from existing config or default
    const workspaceDir = this.yaml?.user?.workspaceDir || 
                        path.join(require('os').homedir(), 'tempo-workspace');
    
    possiblePaths.push(path.join(workspaceDir, 'config.yaml'));
    possiblePaths.push(path.join(process.cwd(), 'config.yaml'));
    possiblePaths.push(path.join(__dirname, '../../config.yaml'));

    // Find the first existing config file
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }

    // If no config exists, return the preferred location (tempo-workspace)
    return possiblePaths[0];
  }

  /**
   * Reload configuration from file
   */
  reload() {
    this.loadYamlConfig();
  }
}

module.exports = new Config();
