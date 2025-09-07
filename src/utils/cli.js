const inquirer = require("inquirer");
const moment = require("moment");
const chalk = require("chalk");
const timeTrackingController = require("../controllers/timeTrackingController");
const config = require("./config");
const Logger = require("./logger");

class CLI {
  constructor() {
    this.logger = new Logger(config);
    this.isInSubOperation = false;
    this.setupSignalHandlers();
    // Fix EventEmitter memory leak
    process.stdin.setMaxListeners(20);
  }

  setupSignalHandlers() {
    // We'll handle SIGINT at the operation level instead
  }

  // Helper methods to generate date range strings for week choices
  getWeekRangeString(startMoment, endMoment) {
    return `${startMoment.format("MMM DD")} - ${endMoment.format("MMM DD")}`;
  }

  getCurrentWeekRange() {
    const start = moment().startOf("isoWeek");
    const end = moment().endOf("isoWeek");
    return this.getWeekRangeString(start, end);
  }

  getLastWeekRange() {
    const start = moment().subtract(1, "week").startOf("isoWeek");
    const end = moment().subtract(1, "week").endOf("isoWeek");
    return this.getWeekRangeString(start, end);
  }

  // Helper to detect ESC key and handle cancellation
  handlePromptCancellation(error, operationName = "operation") {
    if (
      error.isTtyError ||
      error.name === "ExitPromptError" ||
      error.message.includes("User force closed") ||
      error.message.includes("canceled")
    ) {
      console.log(
        chalk.yellow(
          `\n⏸️  ${operationName} cancelled. Returning to main menu...`,
        ),
      );
      return true; // Cancelled
    }
    throw error; // Re-throw if it's a different error
  }

  // Enhanced prompt wrapper with ESC key cancellation
  async promptWithCancel(questions, operationName = "operation") {
    // Set flag that we're in a sub-operation
    this.isInSubOperation = true;

    // Check if operation was already cancelled
    if (this.operationCancelled) {
      this.isInSubOperation = false;
      return null;
    }

    try {
      // Add 'Back to Main Menu' option to list prompts
      const modifiedQuestions = questions.map((question) => {
        if (question.type === "list") {
          return {
            ...question,
            choices: [
              ...question.choices,
              new inquirer.Separator(),
              { name: "↩️  Back to Main Menu", value: "__CANCEL__" },
            ],
          };
        }
        return question;
      });

      // Set up ESC key detection with Promise race
      let escPressed = false;

      // Enable keypress events if not already enabled
      if (process.stdin.setRawMode && !process.stdin.isRaw) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      const escPromise = new Promise((resolve) => {
        const onKeypress = (chunk, key) => {
          if (key && key.name === "escape") {
            escPressed = true;
            this.operationCancelled = true;
            console.log(
              chalk.yellow(
                `\n⏸️  ${operationName} cancelled. Returning to main menu...`,
              ),
            );

            // Cleanup keypress listener
            process.stdin.removeListener("keypress", onKeypress);
            if (process.stdin.setRawMode) {
              process.stdin.setRawMode(false);
            }

            resolve(null); // Resolve with cancellation
          }
        };

        process.stdin.on("keypress", onKeypress);
      });

      // Race between inquirer prompt and ESC key
      const promptPromise = inquirer.prompt(modifiedQuestions);
      const result = await Promise.race([promptPromise, escPromise]);

      // Cleanup
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      this.isInSubOperation = false;

      // Return null if cancelled by ESC
      if (escPressed || this.operationCancelled || !result) {
        return null;
      }

      // Check if any answer was the cancel option
      for (const [key, value] of Object.entries(result)) {
        if (value === "__CANCEL__") {
          console.log(
            chalk.yellow(
              `\n⏸️  ${operationName} cancelled. Returning to main menu...`,
            ),
          );
          this.operationCancelled = true; // Set flag to cancel subsequent prompts
          return null;
        }
      }

      return result;
    } catch (error) {
      // Cleanup on error
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      this.isInSubOperation = false;

      // Handle other errors
      if (this.handlePromptCancellation(error, operationName)) {
        return null; // Indicate cancellation
      }
    }
  }
  async showMainMenu() {
    console.log(chalk.blue.bold("\n🕒 Tempo Time Tracker"));
    console.log(chalk.gray("─".repeat(30)));

    // Build menu choices based on beta function visibility
    const choices = [];

    // Always available functions
    choices.push({ name: "📅 View time table", value: "timeTable" });

    // Beta function - only show if function_beta is enabled
    if (config.functionBeta) {
      choices.push({ name: "📝 View detailed list", value: "detailedList" });
    }

    // Always available functions
    choices.push(
      { name: "📥 Import worklogs from file", value: "importWorklogs" },
      { name: "📤 Export worklogs to file", value: "exportWorklogs" },
      { name: "🗑️  Clear booked worklog", value: "clearWorklogs" },
    );

    // Always available
    choices.push({ name: "🚪 Exit", value: "exit" });

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: choices,
      },
    ]);

    return action;
  }

  async timeTableFlow() {
    console.log(chalk.yellow("\n📅 Time Table View"));
    console.log(chalk.gray("(Press ESC to cancel and return to main menu)\n"));

    // Reset cancellation flag for new operation
    this.operationCancelled = false;

    // Ask for date from
    const fromDateAnswer = await this.promptWithCancel(
      [
        {
          type: "input",
          name: "dateFrom",
          message: "From date (YYYY-MM-DD):",
          default: moment().startOf("isoWeek").format("YYYY-MM-DD"),
          validate: (input) =>
            moment(input, "YYYY-MM-DD", true).isValid() ||
            "Invalid date format",
        },
      ],
      "Time Table View",
    );

    if (!fromDateAnswer || this.operationCancelled) return; // User cancelled

    // Ask for date to
    const toDateAnswer = await this.promptWithCancel(
      [
        {
          type: "input",
          name: "dateTo",
          message: "To date (YYYY-MM-DD):",
          default: moment().endOf("isoWeek").format("YYYY-MM-DD"),
          validate: (input) =>
            moment(input, "YYYY-MM-DD", true).isValid() ||
            "Invalid date format",
        },
      ],
      "Time Table View",
    );

    if (!toDateAnswer || this.operationCancelled) return; // User cancelled

    const answers = {
      dateFrom: fromDateAnswer.dateFrom,
      dateTo: toDateAnswer.dateTo,
    };

    try {
      await timeTrackingController.displayTimeTable(
        answers.dateFrom,
        answers.dateTo,
      );
    } catch (error) {
      console.error(chalk.red("✗ Failed to generate time table:"));
      console.error(chalk.red(error.message));
      if (config.verboseLogging) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  async detailedListFlow() {
    console.log(chalk.yellow("\n📝 Detailed Worklog List"));

    // Reset cancellation flag for new operation
    this.operationCancelled = false;

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "dateFrom",
        message: "From date (YYYY-MM-DD):",
        default: moment().startOf("isoWeek").format("YYYY-MM-DD"),
        validate: (input) =>
          moment(input, "YYYY-MM-DD", true).isValid() || "Invalid date format",
      },
      {
        type: "input",
        name: "dateTo",
        message: "To date (YYYY-MM-DD):",
        default: moment().endOf("isoWeek").format("YYYY-MM-DD"),
        validate: (input) =>
          moment(input, "YYYY-MM-DD", true).isValid() || "Invalid date format",
      },
    ]);

    try {
      await timeTrackingController.displayDetailedList(
        answers.dateFrom,
        answers.dateTo,
      );
    } catch (error) {
      console.error(chalk.red("Failed to generate detailed list."));
    }
  }

  async importWorklogsFlow() {
    console.log(chalk.yellow("\n📥 Import Worklogs from File"));
    console.log(
      chalk.gray(
        "(Press ESC to cancel, or select 'Back to Main Menu' option)\n",
      ),
    );

    // Reset cancellation flag for new operation
    this.operationCancelled = false;

    const answers = await this.promptWithCancel(
      [
        {
          type: "input",
          name: "filePath",
          message: "Enter path to worklog file (CSV/JSON):",
          default: config.defaultImportFile,
          validate: (input) => {
            if (!input.trim()) {
              return "File path is required";
            }
            return true;
          },
        },
        {
          type: "list",
          name: "dateScope",
          message: "Select date scope for import:",
          choices: [
            {
              name: `Current week (${this.getCurrentWeekRange()})`,
              value: "currentWeek",
            },
            {
              name: `Last week (${this.getLastWeekRange()})`,
              value: "lastWeek",
            },
            { name: "This month", value: "thisMonth" },
            { name: "Last month", value: "lastMonth" },
            { name: "Custom date range", value: "custom" },
            { name: "All dates from file", value: "all" },
          ],
          default: this.getDefaultDateScopeValue(config.defaultDateScope),
        },
      ],
      "Import Worklogs",
    );

    if (!answers) return; // User cancelled

    let dateFilter = null;

    if (answers.dateScope === "currentWeek") {
      dateFilter = {
        from: moment().startOf("isoWeek").format("YYYY-MM-DD"),
        to: moment().endOf("isoWeek").format("YYYY-MM-DD"),
      };
    } else if (answers.dateScope === "lastWeek") {
      dateFilter = {
        from: moment()
          .subtract(1, "week")
          .startOf("isoWeek")
          .format("YYYY-MM-DD"),
        to: moment().subtract(1, "week").endOf("isoWeek").format("YYYY-MM-DD"),
      };
    } else if (answers.dateScope === "thisMonth") {
      dateFilter = {
        from: moment().startOf("month").format("YYYY-MM-DD"),
        to: moment().endOf("month").format("YYYY-MM-DD"),
      };
    } else if (answers.dateScope === "lastMonth") {
      dateFilter = {
        from: moment()
          .subtract(1, "month")
          .startOf("month")
          .format("YYYY-MM-DD"),
        to: moment().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
      };
    } else if (answers.dateScope === "custom") {
      const customDates = await this.promptWithCancel(
        [
          {
            type: "input",
            name: "from",
            message: "From date (YYYY-MM-DD):",
            validate: (input) =>
              moment(input, "YYYY-MM-DD", true).isValid() ||
              "Invalid date format",
          },
          {
            type: "input",
            name: "to",
            message: "To date (YYYY-MM-DD):",
            validate: (input) =>
              moment(input, "YYYY-MM-DD", true).isValid() ||
              "Invalid date format",
          },
        ],
        "Custom Date Range",
      );

      if (!customDates) return; // User cancelled custom date input

      dateFilter = {
        from: customDates.from,
        to: customDates.to,
      };
    }

    if (dateFilter) {
      console.log(
        chalk.blue(`📅 Import scope: ${dateFilter.from} to ${dateFilter.to}`),
      );
    }

    try {
      await timeTrackingController.importWorklogs(
        answers.filePath,
        dateFilter,
        this.logger,
      );
    } catch (error) {
      console.error(chalk.red("Failed to import worklogs:"), error.message);
      if (error.stack && config.verboseLogging) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  async exportWorklogsFlow() {
    console.log(chalk.yellow("\n📤 Export Worklogs to File"));
    console.log(
      chalk.gray(
        "(Press ESC to cancel, or select 'Back to Main Menu' option)\n",
      ),
    );

    // Reset cancellation flag for new operation
    this.operationCancelled = false;

    const answers = await this.promptWithCancel(
      [
        {
          type: "input",
          name: "dateFrom",
          message: "From date (YYYY-MM-DD):",
          default: moment().startOf("isoWeek").format("YYYY-MM-DD"),
          validate: (input) =>
            moment(input, "YYYY-MM-DD", true).isValid() ||
            "Invalid date format",
        },
        {
          type: "input",
          name: "dateTo",
          message: "To date (YYYY-MM-DD):",
          default: moment().endOf("isoWeek").format("YYYY-MM-DD"),
          validate: (input) =>
            moment(input, "YYYY-MM-DD", true).isValid() ||
            "Invalid date format",
        },
        {
          type: "list",
          name: "format",
          message: "Export format:",
          choices: [
            { name: "CSV", value: "csv" },
            { name: "JSON", value: "json" },
          ],
          default: "csv",
        },
        {
          type: "input",
          name: "fileName",
          message: "File name (optional, will auto-generate if empty):",
          default: "",
        },
      ],
      "Export Worklogs",
    );

    if (!answers) return; // User cancelled

    try {
      await timeTrackingController.exportWorklogs(
        answers.dateFrom,
        answers.dateTo,
        answers.format,
        answers.fileName || null,
        this.logger, // Pass logger for silent mode
      );
    } catch (error) {
      console.error(chalk.red("✗ Failed to export worklogs:"));
      console.error(chalk.red(error.message));
      if (config.verboseLogging) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  async clearWorklogsFlow() {
    console.log(chalk.yellow("\n🗑️  Clear Booked Worklog"));
    console.log(
      chalk.gray(
        "(Press ESC to cancel, or select 'Back to Main Menu' option)\n",
      ),
    );

    // Reset cancellation flag for new operation
    this.operationCancelled = false;

    const answers = await this.promptWithCancel(
      [
        {
          type: "list",
          name: "dateScope",
          message: "Select date scope to clear worklogs:",
          choices: [
            {
              name: `Current week (${this.getCurrentWeekRange()})`,
              value: "currentWeek",
            },
            {
              name: `Last week (${this.getLastWeekRange()})`,
              value: "lastWeek",
            },
            { name: "This month", value: "thisMonth" },
            { name: "Last month", value: "lastMonth" },
            { name: "Today", value: "today" },
            { name: "Custom date range", value: "custom" },
          ],
          default: "currentWeek",
        },
      ],
      "Clear Booked Worklog",
    );

    if (!answers || this.operationCancelled) return; // User cancelled

    let dateFrom, dateTo;

    // Calculate date range based on selection
    if (answers.dateScope === "currentWeek") {
      dateFrom = moment().startOf("isoWeek").format("YYYY-MM-DD");
      dateTo = moment().endOf("isoWeek").format("YYYY-MM-DD");
    } else if (answers.dateScope === "lastWeek") {
      dateFrom = moment()
        .subtract(1, "week")
        .startOf("isoWeek")
        .format("YYYY-MM-DD");
      dateTo = moment()
        .subtract(1, "week")
        .endOf("isoWeek")
        .format("YYYY-MM-DD");
    } else if (answers.dateScope === "thisMonth") {
      dateFrom = moment().startOf("month").format("YYYY-MM-DD");
      dateTo = moment().endOf("month").format("YYYY-MM-DD");
    } else if (answers.dateScope === "lastMonth") {
      dateFrom = moment()
        .subtract(1, "month")
        .startOf("month")
        .format("YYYY-MM-DD");
      dateTo = moment()
        .subtract(1, "month")
        .endOf("month")
        .format("YYYY-MM-DD");
    } else if (answers.dateScope === "today") {
      dateFrom = dateTo = moment().format("YYYY-MM-DD");
    } else if (answers.dateScope === "custom") {
      const customDates = await this.promptWithCancel(
        [
          {
            type: "input",
            name: "from",
            message: "From date (YYYY-MM-DD):",
            validate: (input) =>
              moment(input, "YYYY-MM-DD", true).isValid() ||
              "Invalid date format",
          },
          {
            type: "input",
            name: "to",
            message: "To date (YYYY-MM-DD):",
            validate: (input) =>
              moment(input, "YYYY-MM-DD", true).isValid() ||
              "Invalid date format",
          },
        ],
        "Custom Date Range",
      );

      if (!customDates || this.operationCancelled) return; // User cancelled

      dateFrom = customDates.from;
      dateTo = customDates.to;
    }

    console.log(chalk.blue(`📅 Clear scope: ${dateFrom} to ${dateTo}`));

    // Confirmation prompt with backup option
    const confirmation = await this.confirmAction(
      `This will CLEAR ALL worklogs between ${dateFrom} and ${dateTo}. A backup will be created automatically before deletion. Continue?`,
    );

    if (!confirmation) {
      console.log(chalk.yellow("Clear operation cancelled."));
      return;
    }

    try {
      // First create a backup
      console.log(chalk.blue("📦 Creating backup before clearing..."));
      const backupFileName = `backup_worklogs_${dateFrom}_to_${dateTo}_${moment().format("YYYYMMDD_HHmmss")}.csv`;
      const config = require("./config");
      const backupFilePath = config.resolveFilePath(backupFileName, "backup");

      await timeTrackingController.exportWorklogs(
        dateFrom,
        dateTo,
        "csv",
        backupFilePath,
        this.logger,
      );

      console.log(chalk.green(`✅ Backup created: ${backupFileName}`));

      // Then proceed with clearing
      console.log(chalk.yellow("🗑️  Clearing worklogs..."));
      await timeTrackingController.clearWorklogs(dateFrom, dateTo, this.logger);

      console.log(
        chalk.green(
          `✅ Worklogs cleared successfully from ${dateFrom} to ${dateTo}`,
        ),
      );
      console.log(chalk.blue(`📦 Backup saved as: ${backupFileName}`));
    } catch (error) {
      console.error(chalk.red("Failed to clear worklogs:"), error.message);
    }
  }

  getDefaultDateScopeValue(configScope) {
    const mapping = {
      "current-week": "currentWeek",
      "last-week": "lastWeek",
      "this-month": "thisMonth",
      "last-month": "lastMonth",
      custom: "custom",
      all: "all",
    };
    return mapping[configScope] || "currentWeek";
  }

  async confirmAction(message) {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message,
        default: false,
      },
    ]);
    return confirmed;
  }

  async pressAnyKey() {
    await inquirer.prompt([
      {
        type: "input",
        name: "continue",
        message: "Press Enter to continue...",
      },
    ]);
  }
}

module.exports = new CLI();
