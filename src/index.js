#!/usr/bin/env node

const chalk = require("chalk");
const config = require("./utils/config");
const cli = require("./utils/cli");
const Logger = require("./utils/logger");
const SetupWizard = require("./utils/setupWizard");

class TempoTimeTracker {
  constructor() {
    this.logger = new Logger(config);
  }

  // Clear all config-related caches to ensure fresh configuration
  clearConfigCache() {
    // Clear the main config module cache
    const configPath = require.resolve("./utils/config");
    delete require.cache[configPath];

    // Clear any yaml file caches that might be related
    Object.keys(require.cache).forEach((key) => {
      if (key.includes("config.yaml") || key.includes("config.yml")) {
        delete require.cache[key];
      }
    });
  }

  async initialize() {
    try {
      // Clear config cache to ensure fresh configuration on startup
      this.clearConfigCache();

      this.logger.info("🚀 Initializing Tempo Time Tracker...");

      // Load token from secure storage before validation
      await config.getTempoToken();
      this.logger.info("✓ Token loaded from secure storage");

      config.validate();
      this.logger.info("✓ Configuration validated");

      if (config.isOAuthMode) {
        this.logger.warn(
          "📝 OAuth mode detected - make sure to complete OAuth flow",
        );
      } else {
        this.logger.info("✓ API token authentication configured");
      }

      this.logger.info(`✓ User: ${config.userName} (${config.userAccountId})`);
      return true;
    } catch (error) {
      this.logger.error("✗ Initialization failed: " + error.message);
      console.log(chalk.yellow("\n📝 Setup instructions:"));
      console.log("1. Run: tempo-booker --setup");
      console.log("2. Follow the setup wizard to configure your credentials");
      console.log(
        "3. Or manually edit config.yaml in your workspace directory",
      );
      return false;
    }
  }

  async run() {
    const initialized = await this.initialize();
    if (!initialized) {
      process.exit(1);
    }

    console.log(chalk.green("✓ Ready to track time!"));

    while (true) {
      try {
        const action = await cli.showMainMenu();

        if (action === "exit") {
          console.log(chalk.blue("👋 Goodbye!"));
          process.exit(0);
        }

        switch (action) {
          case "timeTable":
            try {
              await cli.timeTableFlow();
            } catch (error) {
              if (error.name === "ExitPromptError") {
                continue;
              }
              throw error;
            }
            break;
          case "detailedList":
            try {
              await cli.detailedListFlow();
            } catch (error) {
              if (error.name === "ExitPromptError") {
                continue;
              }
              throw error;
            }
            break;
          case "importWorklogs":
            try {
              await cli.importWorklogsFlow();
            } catch (error) {
              if (error.name === "ExitPromptError") {
                continue;
              }
              throw error;
            }
            break;
          case "exportWorklogs":
            try {
              await cli.exportWorklogsFlow();
            } catch (error) {
              if (error.name === "ExitPromptError") {
                continue;
              }
              throw error;
            }
            break;
          case "clearWorklogs":
            try {
              await cli.clearWorklogsFlow();
            } catch (error) {
              if (error.name === "ExitPromptError") {
                continue;
              }
              throw error;
            }
            break;
        }

        // Removed cli.pressAnyKey() for smoother flow
      } catch (error) {
        if (error.name === "ExitPromptError") {
          console.log(chalk.blue("\n👋 Goodbye!"));
          process.exit(0);
        }
        console.error(chalk.red("An error occurred:"), error.message);
        // Removed cli.pressAnyKey() for smoother flow
      }
    }
  }

  static async quickLog(issueKey, hours, description = "") {
    try {
      const app = new TempoTimeTracker();
      const initialized = await app.initialize();

      if (!initialized) {
        process.exit(1);
      }

      const timeTrackingController = require("./controllers/timeTrackingController");
      await timeTrackingController.logTime({
        issueKey,
        hours: parseFloat(hours),
        description,
      });

      process.exit(0);
    } catch (error) {
      console.error(chalk.red("Quick log failed:"), error.message);
      process.exit(1);
    }
  }

  static async silentImport(filePath, dateScope) {
    try {
      // Enable silent mode for clean CLI output
      const originalSilentMode = config.yaml?.cli?.silentMode;
      const originalSuppressLogs = config._suppressConfigLogs;

      if (config.yaml?.cli) {
        config.yaml.cli.silentMode = true;
      }
      config.setSuppressConfigLogs(true);

      const app = new TempoTimeTracker();
      const initialized = await app.initialize();

      if (!initialized) {
        process.exit(1);
      }

      const moment = require("moment");
      const timeTrackingController = require("./controllers/timeTrackingController");

      // Use config defaults if not provided
      const importFile = filePath || config.defaultImportFile;
      const scope = dateScope || config.defaultDateScope;

      app.logger.info(`📥 Importing from: ${importFile}`);
      app.logger.info(`📅 Date scope: ${scope}`);
      app.logger.info(`👤 User: ${config.userName} (${config.userAccountId})`);

      // Convert date scope string to date range object
      let dateFilter = null;
      if (scope && scope !== "all") {
        let dateFrom, dateTo;

        switch (scope) {
          case "current-week":
            dateFrom = moment().startOf("isoWeek").format("YYYY-MM-DD");
            dateTo = moment().endOf("isoWeek").format("YYYY-MM-DD");
            break;
          case "last-7-days":
            dateFrom = moment().subtract(6, "days").format("YYYY-MM-DD");
            dateTo = moment().format("YYYY-MM-DD");
            break;
          case "this-month":
            dateFrom = moment().startOf("month").format("YYYY-MM-DD");
            dateTo = moment().endOf("month").format("YYYY-MM-DD");
            break;
          default:
            app.logger.warn(
              `Unknown date scope: ${scope}, importing all entries`,
            );
        }

        if (dateFrom && dateTo) {
          dateFilter = { from: dateFrom, to: dateTo };
          app.logger.info(`Date filter: ${dateFrom} to ${dateTo}`);
        }
      }

      // Pass logger to controller for clean output
      await timeTrackingController.importWorklogs(
        importFile,
        dateFilter,
        app.logger,
      );

      app.logger.result("✅ Silent import completed successfully!");

      // Restore original settings
      if (config.yaml?.cli && originalSilentMode !== undefined) {
        config.yaml.cli.silentMode = originalSilentMode;
      }
      config.setSuppressConfigLogs(originalSuppressLogs);

      process.exit(0);
    } catch (error) {
      console.error(chalk.red("Silent import failed:"), error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  // Handle setup command - force setup wizard even if config exists
  if (args.includes("--setup") || args.includes("-s")) {
    console.log(chalk.blue("🔧 Running setup wizard..."));
    (async () => {
      try {
        const SetupWizard = require("./utils/setupWizard");
        const wizard = new SetupWizard();
        await wizard.run();
        console.log(
          chalk.green("✅ Setup completed! You can now use tempo-booker"),
        );
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Setup failed:"), error.message);
        process.exit(1);
      }
    })();
  } else {
    // Check for first-time setup before running any commands
    SetupWizard.checkAndRunSetup()
      .then((setupRan) => {
        if (setupRan) {
          console.log(
            chalk.green("\n✅ Setup completed! You can now use tempo-booker"),
          );
          process.exit(0);
        }

        // Continue with normal command processing
        processCommands(args).catch((error) => {
          console.error(chalk.red("Command processing failed:"), error.message);
          process.exit(1);
        });
      })
      .catch((error) => {
        console.error(chalk.red("Initialization failed:"), error.message);
        process.exit(1);
      });
  }
}

async function processCommands(args) {
  if (args.length >= 2 && args[0] === "quick") {
    // Quick log mode: node src/index.js quick ITST-14440 2 "Bug fix"
    const [, issueKey, hours, ...descriptionParts] = args;
    const description = descriptionParts.join(" ");
    TempoTimeTracker.quickLog(issueKey, hours, description);
  } else if (args.length >= 1 && args[0] === "import") {
    // Silent import mode: node src/index.js import [file] [scope]
    let filePath, dateScope;

    // Parse arguments
    const importArgs = args.slice(1);
    for (let i = 0; i < importArgs.length; i++) {
      if (!filePath) {
        filePath = importArgs[i];
      } else if (!dateScope) {
        dateScope = importArgs[i];
      }
    }

    TempoTimeTracker.silentImport(filePath, dateScope);
  } else if (args.includes("--migrate-token")) {
    // Migrate token from config to keychain
    const SecureTokenManager = require("./utils/secureTokenManager");
    const tokenManager = new SecureTokenManager();
    await tokenManager.migrateFromConfig();
    process.exit(0);
  } else if (args.includes("--security-status")) {
    // Show token security status
    const SecureTokenManager = require("./utils/secureTokenManager");
    const tokenManager = new SecureTokenManager();
    await tokenManager.showSecurityStatus();
    process.exit(0);
  } else if (args.includes("--delete-token")) {
    // Delete stored token
    const SecureTokenManager = require("./utils/secureTokenManager");
    const tokenManager = new SecureTokenManager();
    await tokenManager.deleteToken();
    process.exit(0);
  } else if (args.includes("--test-keychain")) {
    // Test keychain functionality
    const SecureTokenManager = require("./utils/secureTokenManager");
    const tokenManager = new SecureTokenManager();
    await tokenManager.testKeychain();
    process.exit(0);
  } else if (args.length >= 2 && args[0] === "manual-mapping") {
    // Manual mapping helper: node src/index.js manual-mapping ITST-14619
    const issueKey = args[1];
    const BrowserHelper = require("./services/browserHelper");
    const helper = new BrowserHelper();
    await helper.interactiveMapping(issueKey);
    process.exit(0);
  } else if (args.length >= 4 && args[0] === "add-mapping") {
    // Add mapping: node src/index.js add-mapping ITST-14619 123456 "Issue title"
    const [, issueKey, issueId, summary] = args;
    const BrowserHelper = require("./services/browserHelper");
    const helper = new BrowserHelper();
    const success = await helper.addMapping(issueKey, issueId, summary);
    process.exit(success ? 0 : 1);
  } else if (args.length >= 1 && args[0] === "list-mappings") {
    // List current mappings: node src/index.js list-mappings
    const BrowserHelper = require("./services/browserHelper");
    const helper = new BrowserHelper();
    helper.listMappings();
    process.exit(0);
  } else if (args.length >= 2 && args[0] === "validate-mapping") {
    // Validate mapping: node src/index.js validate-mapping ITST-14619
    const issueKey = args[1];
    const BrowserHelper = require("./services/browserHelper");
    const helper = new BrowserHelper();
    await helper.validateMapping(issueKey);
    process.exit(0);
  } else if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    // Show help
    console.log(chalk.blue.bold("\n🕒 Tempo Booker CLI\n"));
    console.log(chalk.white("Usage:"));
    console.log(
      chalk.green(
        "  tempo-booker                                         # Interactive mode",
      ),
    );
    console.log(
      chalk.green(
        "  tempo-booker --setup                                 # Run setup wizard",
      ),
    );
    console.log(
      chalk.green(
        "  tempo-booker quick <issue> <hours> [desc]           # Quick log",
      ),
    );
    console.log(
      chalk.green(
        "  tempo-booker import [file] [scope]                  # Silent import",
      ),
    );
    console.log(chalk.white("\nSetup & Configuration:"));
    console.log(
      chalk.yellow(
        "  tempo-booker --setup                                # First-time setup wizard",
      ),
    );
    console.log(
      chalk.yellow(
        "  node src/utils/get-account-id.js                    # Auto-retrieve your Account ID",
      ),
    );
    console.log(
      chalk.yellow(
        "  node src/utils/find-account-id.js                   # Manual Account ID discovery",
      ),
    );
    console.log(
      chalk.yellow(
        "  node src/utils/add-issue.js                         # Add issues to static mapping",
      ),
    );
    console.log(chalk.yellow("  Edit config.yaml to customize preferences"));
    console.log(chalk.white("\nSecurity & Token Management:"));
    console.log(
      chalk.cyan(
        "  tempo-booker --security-status                      # Check token security status",
      ),
    );
    console.log(
      chalk.cyan(
        "  tempo-booker --migrate-token                        # Migrate token to keychain",
      ),
    );
    console.log(
      chalk.cyan(
        "  tempo-booker --delete-token                         # Remove stored token",
      ),
    );
    console.log(
      chalk.cyan(
        "  tempo-booker --test-keychain                        # Test keychain functionality",
      ),
    );
    console.log(chalk.white("\nSilent Import Examples:"));
    console.log(
      chalk.gray(
        "  tempo-booker import                                  # Use defaults from config.yaml",
      ),
    );
    console.log(
      chalk.gray(
        "  tempo-booker import my-worklogs.csv                  # Import specific file",
      ),
    );
    console.log(
      chalk.gray(
        "  tempo-booker import worklogs.csv current-week        # Import with date scope",
      ),
    );
    console.log(chalk.white("\nIssue Mapping (Manual):"));
    console.log(
      chalk.magenta(
        "  tempo-booker manual-mapping <issue-key>             # Open browser for manual mapping",
      ),
    );
    console.log(
      chalk.magenta(
        '  tempo-booker add-mapping <key> <id> "<summary>"     # Add issue mapping',
      ),
    );
    console.log(
      chalk.magenta(
        "  tempo-booker list-mappings                          # Show current mappings",
      ),
    );
    console.log(
      chalk.magenta(
        "  tempo-booker validate-mapping <issue-key>           # Validate existing mapping",
      ),
    );
    console.log(
      chalk.white("\nBeta Features (enable with function_beta: true):"),
    );
    console.log(
      chalk.gray(
        "  node bulk-map-issues.js [keys]                       # Bulk issue key mapping (deprecated)",
      ),
    );
    console.log(chalk.white("\nDate Scopes:"));
    console.log(chalk.gray("  current-week, last-7-days, this-month, all"));
    process.exit(0);
  } else {
    // Interactive mode
    const app = new TempoTimeTracker();
    app.run().catch((error) => {
      console.error(chalk.red("Application error:"), error.message);
      process.exit(1);
    });
  }
}

module.exports = TempoTimeTracker;
