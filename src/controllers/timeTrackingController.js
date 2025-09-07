const tempoApiService = require("../services/tempoApiService");
const jiraApiService = require("../services/jiraApiService");
const Worklog = require("../models/worklog");
const moment = require("moment");
const chalk = require("chalk");
const config = require("../utils/config");
const Logger = require("../utils/logger");

class TimeTrackingController {
  constructor() {
    this.issueCache = new Map(); // Cache for issue summaries
    this.logger = new Logger(config);
  }
  async logTime(worklogData, logger = null) {
    const log = logger || this.logger;
    try {
      // Get current user if not provided
      if (!worklogData.authorAccountId) {
        // First try to use the account ID from config
        const configAccountId = config.userAccountId;
        if (configAccountId) {
          worklogData.authorAccountId = configAccountId;
          log.info(`Using account ID from config: ${configAccountId}`);
        } else {
          // Fallback to API methods if config doesn't have account ID
          try {
            const currentUser = await tempoApiService.getCurrentUser();
            worklogData.authorAccountId = currentUser.accountId;
            log.info(
              `Using account ID: ${currentUser.accountId} (${currentUser.displayName || currentUser.name || "Unknown"})`,
            );
          } catch (userError) {
            log.info("Extracting user info from existing worklogs...");
            try {
              const extractedAccountId =
                await tempoApiService.getAuthorAccountIdFromWorklogs();
              if (extractedAccountId) {
                worklogData.authorAccountId = extractedAccountId;
                log.info(`Using extracted account ID: ${extractedAccountId}`);
              } else {
                log.error("Could not determine author account ID");
              }
            } catch (extractError) {
              log.error("Failed to extract account ID from worklogs");
            }
          }
        }
      }

      // Try to resolve issue ID from issue key
      if (worklogData.issueKey && !worklogData.issueId) {
        log.info("Resolving issue ID...");
        try {
          // Use the enhanced issue resolver
          const issueResolver = require("../services/staticIssueResolver");
          const issueDetails = await issueResolver.resolveIssue(
            worklogData.issueKey,
            false,
          );

          if (issueDetails && issueDetails.id) {
            worklogData.issueId = issueDetails.id;
            log.success(
              `✓ Issue resolved via ${issueDetails.method}: ${worklogData.issueKey} -> ID ${issueDetails.id}`,
            );
          } else {
            log.warn(
              `Could not resolve issue ID for ${worklogData.issueKey}, will try with key only`,
            );
          }
        } catch (issueError) {
          log.warn(`Issue resolution failed: ${issueError.message}`);
        }
      }

      const worklog = new Worklog(worklogData);

      const validationErrors = worklog.validate();
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(", ")}`);
      }

      log.info("Creating worklog...");
      const apiPayload = worklog.toApiFormat();
      log.info("Payload:", JSON.stringify(apiPayload, null, 2));

      const result = await tempoApiService.createWorklog(apiPayload);

      log.success("✓ Time logged successfully!");
      log.info(`Issue: ${worklog.issueKey}`);
      log.info(`Time: ${worklog.getTimeInHours()} hours`);
      log.info(`Date: ${worklog.startDate}`);
      log.info(`Description: ${worklog.description}`);

      return result;
    } catch (error) {
      log.error("✗ Failed to log time:", error.message);
      throw error;
    }
  }

  async validateIssue(issueKey) {
    // Tempo API will validate the issue key when creating worklog
    // Skip JIRA validation to avoid authentication complexity
    this.logger.info(`Using issue key: ${issueKey}`);
    return true;
  }

  async fetchIssueSummary(issueIdOrKey, logger = null) {
    const log = logger || this.logger;
    // Check cache first
    if (this.issueCache.has(issueIdOrKey)) {
      return this.issueCache.get(issueIdOrKey);
    }

    try {
      if (config.hasJiraAuth) {
        const issue = await jiraApiService.getIssue(issueIdOrKey, [
          "key",
          "summary",
        ]);
        const summary = issue.fields.summary;
        this.issueCache.set(issueIdOrKey, summary);
        return summary;
      }
    } catch (error) {
      // Silently fail if we can't get issue details
      if (!logger)
        log.info(`Unable to fetch issue details for ${issueIdOrKey}`); // Only log if explicit logger provided
    }

    return null;
  }

  async displayWorklogsWithIssueInfo(worklogs, logger = null) {
    const log = logger || this.logger;
    log.warn("\n📋 Your Recent Worklogs:");
    log.info("─".repeat(80));

    // Predefined issue list (same as time table)
    const predefinedIssueKeys = new Set([
      "DAU-2579",
      "DAU-2655",
      "ITST-14651",
      "ITST-14619",
      "ITST-14439",
      "ITST-14440",
      "ITST-14455",
      "ITST-14456",
      "ITST-15191",
    ]);

    let displayIndex = 1;
    for (const worklog of worklogs) {
      const hours = (worklog.timeSpentSeconds / 3600).toFixed(2);

      // Extract issue key from description if available (pattern: PROJ-123)
      let issueKey = null;
      if (worklog.description) {
        const match = worklog.description.match(/([A-Z]+-\d+)/);
        if (match && predefinedIssueKeys.has(match[1])) {
          issueKey = match[1];
        }
      }

      // Skip worklogs that don't match your predefined issues
      if (!issueKey) {
        continue; // Skip this worklog - not in your issue list
      }

      // Fetch issue summary if we have JIRA authentication
      let issueSummary = null;
      if (
        config.hasJiraAuth &&
        issueKey.includes("-") &&
        !issueKey.startsWith("ID-")
      ) {
        issueSummary = await this.fetchIssueSummary(issueKey, logger);
      } else if (config.hasJiraAuth && worklog.issue?.id) {
        issueSummary = await this.fetchIssueSummary(worklog.issue.id, logger);
      }

      // Clean up description to remove redundant issue key mentions
      let cleanDescription = worklog.description || "No description";
      if (worklog.description && worklog.description.includes(issueKey)) {
        cleanDescription = worklog.description
          .replace(new RegExp(`Working on issue ${issueKey}`, "g"), "")
          .trim();
        if (!cleanDescription) cleanDescription = `Working on ${issueKey}`;
      }

      // Display with issue summary if available
      if (issueSummary) {
        log.info(`${displayIndex}. ${issueKey} - ${hours}h`);
        log.info(`   📋 ${issueSummary}`);
      } else {
        log.info(`${displayIndex}. ${issueKey} - ${hours}h`);
      }

      log.info(`   Date: ${worklog.startDate} | ${cleanDescription}`);

      // Show issue ID as additional context for better tracking
      if (worklog.issue?.id) {
        log.info(`   Issue ID: ${worklog.issue.id}`);
      }
      log.info("");

      displayIndex++;
    }
  }

  async getMyWorklogs(dateFrom, dateTo, logger = null) {
    const log = logger || this.logger;
    try {
      // Get worklogs without specifying authorAccountId - Tempo returns current user's worklogs by default
      const params = {};

      if (dateFrom) {
        params.from = moment(dateFrom).format("YYYY-MM-DD");
      }

      if (dateTo) {
        params.to = moment(dateTo).format("YYYY-MM-DD");
      }

      const worklogs = await tempoApiService.getWorklogs(params);

      log.info(`Found ${worklogs.results?.length || 0} worklogs`);

      // Debug: Check date range of worklogs and recent entries
      if (worklogs.results && worklogs.results.length > 0) {
        const dates = worklogs.results.map((w) => w.startDate).sort();
        const latestDate = dates[dates.length - 1];
        const earliestDate = dates[0];
        log.info(`Debug - Date range: ${earliestDate} to ${latestDate}`);

        // Check for today's entries (Aug 22nd)
        const todayEntries = worklogs.results.filter(
          (w) => w.startDate === "2025-08-22",
        );
        const yesterdayEntries = worklogs.results.filter(
          (w) => w.startDate === "2025-08-21",
        );
        log.info(
          `Debug - Aug 21st entries: ${yesterdayEntries.length}, Aug 22nd entries: ${todayEntries.length}`,
        );

        // Show recent entries
        log.info("Debug - Recent worklog dates and hours:");
        worklogs.results
          .filter((w) => w.startDate >= "2025-08-20")
          .forEach((worklog, idx) => {
            log.info(
              `  ${worklog.startDate}: ${(worklog.timeSpentSeconds / 3600).toFixed(1)}h - Issue ${worklog.issue?.id}`,
            );
          });

        await this.displayWorklogsWithIssueInfo(worklogs.results, log);
      }

      return worklogs;
    } catch (error) {
      log.error("✗ Failed to fetch worklogs:", error.message);
      throw error;
    }
  }

  async getWorklogsForDateRange(dateFrom, dateTo, logger = null) {
    const log = logger || this.logger;
    try {
      const params = {};
      if (dateFrom) {
        params.from = moment(dateFrom).format("YYYY-MM-DD");
      }
      if (dateTo) {
        params.to = moment(dateTo).format("YYYY-MM-DD");
      }

      const worklogs = await tempoApiService.getWorklogs(params);

      // Return only the worklog results, filtered to exclude anonymized entries
      const validWorklogs =
        worklogs.results?.filter(
          (wl) => wl.issue && wl.issue.key && !wl.issue.key.startsWith("ANON-"),
        ) || [];

      log.debug(`Found ${validWorklogs.length} valid worklogs for selection`);
      return validWorklogs;
    } catch (error) {
      log.error("✗ Failed to fetch worklogs for selection:", error.message);
      throw error;
    }
  }

  displayWorklogs(worklogs, logger = null) {
    const log = logger || this.logger;
    log.warn("\n📋 Your Recent Worklogs:");
    log.info("─".repeat(80));

    worklogs.forEach((worklog, index) => {
      const hours = (worklog.timeSpentSeconds / 3600).toFixed(2);

      // Extract issue key from description if available (pattern: PROJ-123)
      let issueKey = "Unknown";
      if (worklog.issue?.key && predefinedIssueKeys.has(worklog.issue.key)) {
        issueKey = worklog.issue.key;
      }

      // Fallback to issue ID if no key found
      if (issueKey === "Unknown" && worklog.issue?.id) {
        issueKey = `ID-${worklog.issue.id}`;
      }

      // Clean up description to remove redundant issue key mentions
      let cleanDescription = worklog.description || "No description";
      if (worklog.description && worklog.description.includes(issueKey)) {
        cleanDescription = worklog.description
          .replace(new RegExp(`Working on issue ${issueKey}`, "g"), "")
          .trim();
        if (!cleanDescription) cleanDescription = `Working on ${issueKey}`;
      }

      log.info(`${index + 1}. ${issueKey} - ${hours}h`);
      log.info(`   Date: ${worklog.startDate} | ${cleanDescription}`);

      // Show issue ID as additional context for better tracking
      if (worklog.issue?.id && !issueKey.startsWith("ID-")) {
        log.info(`   Issue ID: ${worklog.issue.id}`);
      }
      log.info("");
    });
  }

  async updateWorklog(worklogId, updateData, logger = null) {
    const log = logger || this.logger;
    try {
      const worklog = new Worklog(updateData);

      const validationErrors = worklog.validate();
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(", ")}`);
      }

      log.info("Updating worklog...");
      const result = await tempoApiService.updateWorklog(
        worklogId,
        worklog.toApiFormat(),
      );

      log.success("✓ Worklog updated successfully!");
      return result;
    } catch (error) {
      log.error("✗ Failed to update worklog:", error.message);
      throw error;
    }
  }

  async deleteWorklog(worklogId, logger = null) {
    const log = logger || this.logger;
    try {
      log.info("Deleting worklog...");
      await tempoApiService.deleteWorklog(worklogId);
      log.success("✓ Worklog deleted successfully!");
    } catch (error) {
      log.error("✗ Failed to delete worklog:", error.message);
      throw error;
    }
  }

  async clearWorklogs(dateFrom, dateTo, logger = null) {
    const log = logger || this.logger;
    try {
      log.transaction(`Clearing worklogs from ${dateFrom} to ${dateTo}`);

      // Get worklogs for the date range
      const params = {
        from: moment(dateFrom).format("YYYY-MM-DD"),
        to: moment(dateTo).format("YYYY-MM-DD"),
      };

      const worklogs = await tempoApiService.getWorklogs(params);

      if (!worklogs.results || worklogs.results.length === 0) {
        log.warn("No worklogs found to clear for the specified date range.");
        return { deleted: 0, skipped: 0 };
      }

      // Filter out anonymized and non-user worklogs that can't be deleted
      const config = require("../utils/config");
      const userAccountId = config.userAccountId;

      const deletableWorklogs = worklogs.results.filter((wl) => {
        const isUserWorklog =
          wl.author?.accountId === userAccountId ||
          wl.authorAccountId === userAccountId;
        const isAnonymizedOldWorklog =
          wl.author?.accountId === "__tempo-io__unknown_user";

        // Only delete user's own worklogs and skip old anonymized ones
        return isUserWorklog && !isAnonymizedOldWorklog;
      });

      const totalFound = worklogs.results.length;
      const skippedCount = totalFound - deletableWorklogs.length;

      if (deletableWorklogs.length === 0) {
        log.warn(
          `Found ${totalFound} worklogs, but none are deletable by current user.`,
        );
        return { deleted: 0, skipped: totalFound };
      }

      log.info(
        `Found ${deletableWorklogs.length} deletable worklogs (skipping ${skippedCount} non-deletable)`,
      );

      // Delete each worklog
      let deletedCount = 0;
      let errors = 0;

      for (const worklog of deletableWorklogs) {
        try {
          log.debug(
            `Deleting worklog: ${worklog.startDate} - ${worklog.issue?.key || "Unknown"} - ${(worklog.timeSpentSeconds / 3600).toFixed(1)}h`,
          );
          await tempoApiService.deleteWorklog(worklog.tempoWorklogId);
          deletedCount++;

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          log.warn(
            `Failed to delete worklog ${worklog.tempoWorklogId}: ${error.message}`,
          );
          errors++;
        }
      }

      const summary = { deleted: deletedCount, skipped: skippedCount, errors };

      if (errors === 0) {
        log.success(`✅ Successfully cleared ${deletedCount} worklogs`);
      } else {
        log.warn(`⚠️  Cleared ${deletedCount} worklogs with ${errors} errors`);
      }

      if (skippedCount > 0) {
        log.info(
          `📋 Skipped ${skippedCount} non-deletable worklogs (anonymized or not owned by you)`,
        );
      }

      return summary;
    } catch (error) {
      log.error("✗ Failed to clear worklogs:", error.message);
      throw error;
    }
  }

  async getTimeForPeriod(dateFrom, dateTo, groupBy = "day", logger = null) {
    const log = logger || this.logger;
    try {
      // Get worklogs for current user only
      const params = {
        from: moment(dateFrom).format("YYYY-MM-DD"),
        to: moment(dateTo).format("YYYY-MM-DD"),
      };

      // Add user filter to get only current user's worklogs
      const authorAccountId = config.userAccountId;
      if (authorAccountId) {
        params.author = authorAccountId;
      }

      const worklogs = await tempoApiService.getWorklogs(params, true); // silent mode

      if (!worklogs.results || worklogs.results.length === 0) {
        log.warn("No worklogs found for the specified period.");
        return;
      }

      this.displayTimeReport(worklogs.results, groupBy, log);
      return worklogs;
    } catch (error) {
      log.error("✗ Failed to generate time report:", error.message);
      throw error;
    }
  }

  displayTimeReport(worklogs, groupBy, logger = null) {
    const log = logger || this.logger;
    const grouped = {};
    let totalSeconds = 0;

    worklogs.forEach((worklog) => {
      let key;
      if (groupBy === "day") {
        key = worklog.startDate;
      } else if (groupBy === "issue") {
        // Extract issue key from description if available
        let issueKey = "Unknown";
        if (worklog.description) {
          const match = worklog.description.match(/([A-Z]+-\d+)/);
          if (match) {
            issueKey = match[1];
          }
        }
        if (issueKey === "Unknown" && worklog.issue?.id) {
          issueKey = `ID-${worklog.issue.id}`;
        }
        key = issueKey;
      } else if (groupBy === "week") {
        key = moment(worklog.startDate).startOf("isoWeek").format("YYYY-MM-DD");
      }

      if (!grouped[key]) {
        grouped[key] = 0;
      }
      grouped[key] += worklog.timeSpentSeconds;
      totalSeconds += worklog.timeSpentSeconds;
    });

    log.warn(`\n📊 Time Report (grouped by ${groupBy}):`);
    log.info("─".repeat(50));

    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, seconds]) => {
        const hours = (seconds / 3600).toFixed(2);
        log.info(`${key}: ${hours}h`);
      });

    log.info("─".repeat(50));
    log.success(`Total: ${(totalSeconds / 3600).toFixed(2)}h`);
  }

  async displayTimeTable(dateFrom, dateTo, logger = null) {
    const log = logger || this.logger;
    try {
      // Get worklogs for the specified period
      const params = {
        from: moment(dateFrom).format("YYYY-MM-DD"),
        to: moment(dateTo).format("YYYY-MM-DD"),
      };

      const worklogs = await tempoApiService.getWorklogs(params);

      if (!worklogs.results || worklogs.results.length === 0) {
        log.warn("No worklogs found for the specified period.");
        return;
      }

      this.generateTimeTable(worklogs.results, dateFrom, dateTo, log);
      return worklogs;
    } catch (error) {
      log.error("✗ Failed to generate time table:", error.message);
      throw error;
    }
  }

  generateTimeTable(worklogs, dateFrom, dateTo, logger = null) {
    const log = logger || this.logger;
    // Create data structures for the table
    const dateRange = this.getDateRange(dateFrom, dateTo);

    // Group worklogs by date and issue
    const dailyData = {};
    const dailyTotals = {};

    dateRange.forEach((date) => {
      dailyData[date] = {};
      dailyTotals[date] = 0;
    });

    // Use configured issue mapping from config.yaml
    const configIssueMapping = config.issueMapping;
    const predefinedIssueKeys = new Set(Object.keys(configIssueMapping));

    // Create mapping from Issue ID to Issue Key using config mapping
    const issueIdToKeyMap = {};

    // First, use direct config mapping (issue ID -> issue key)
    Object.entries(configIssueMapping).forEach(([issueKey, issueInfo]) => {
      issueIdToKeyMap[issueInfo.id] = issueKey;
    });

    // Then supplement with description parsing for any additional matches
    worklogs.forEach((worklog) => {
      if (
        worklog.description &&
        worklog.issue?.id &&
        !issueIdToKeyMap[worklog.issue.id]
      ) {
        const match = worklog.description.match(/([A-Z]+-\d+)/);
        if (match && predefinedIssueKeys.has(match[1])) {
          issueIdToKeyMap[worklog.issue.id] = match[1];
        }
      }
    });

    log.info(
      "Debug - Issue mappings found:",
      Object.keys(issueIdToKeyMap).length,
    );
    log.info(
      "Using configured issues from config.yaml:",
      Array.from(predefinedIssueKeys).sort().join(", "),
    );

    // Process worklogs - group by date and issue
    worklogs.forEach((worklog) => {
      const date = worklog.startDate;
      if (!dailyData[date]) return;

      const hours = worklog.timeSpentSeconds / 3600;

      // Extract issue key using multiple strategies
      let issueKey = null;

      // Strategy 1: Use actual issue key if available
      if (worklog.description) {
        const match = worklog.description.match(/([A-Z]+-\d+)/);
        if (match) {
          issueKey = match[1];
        }
      }

      // Strategy 2: Map from issue ID using configured mappings
      if (!issueKey && worklog.issue?.id && issueIdToKeyMap[worklog.issue.id]) {
        issueKey = issueIdToKeyMap[worklog.issue.id];
      }

      // Skip worklogs without proper issue keys (these are likely system/anonymous entries)
      if (!issueKey) {
        log.debug(
          `Skipping worklog - Issue ID: ${worklog.issue?.id}, Description: "${worklog.description}"`,
        );
        return;
      }

      // Group by issue key
      if (!dailyData[date][issueKey]) {
        dailyData[date][issueKey] = 0;
      }
      dailyData[date][issueKey] += hours;
      dailyTotals[date] += hours;
    });

    this.printSimpleTimeTable(dateRange, dailyData, dailyTotals, log);
  }

  printSimpleTimeTable(dateRange, dailyData, dailyTotals, logger = null) {
    const log = logger || this.logger;
    log.info("\n📅 Tempo Timesheet - Weekly View");

    // Display issue mapping reference for user context
    // Clear cache and reload config to get latest values
    delete require.cache[require.resolve("../utils/config")];
    const config = require("../utils/config");
    const issueMapping = config.issueMapping || {};
    const relevantMappings = {};

    // Find which issues are actually being displayed
    const allDisplayedIssues = new Set();
    Object.values(dailyData).forEach((dayData) => {
      Object.keys(dayData).forEach((issue) => allDisplayedIssues.add(issue));
    });

    // Get mappings for displayed issues
    for (const [key, info] of Object.entries(issueMapping)) {
      if (allDisplayedIssues.has(key)) {
        relevantMappings[key] = info;
      }
    }

    if (Object.keys(relevantMappings).length > 0) {
      log.info("\n📋 Issue Reference:");
      Object.entries(relevantMappings)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, info]) => {
          log.info(
            `  ${key.padEnd(12)} - ${info.summary || "No summary available"}`,
          );
        });
      log.info("");
    }

    // Calculate optimal column widths like Tempo interface
    const allIssues = new Set();
    Object.values(dailyData).forEach((dayData) => {
      Object.keys(dayData).forEach((issue) => allIssues.add(issue));
    });
    const sortedIssues = Array.from(allIssues).sort();

    // Calculate widths - make it more like Tempo's format
    const issueColWidth = Math.max(
      20,
      Math.max(...sortedIssues.map((issue) => issue.length)) + 2,
    );
    const keyColWidth = 12; // for issue key
    const loggedColWidth = 8; // for total logged hours
    const dateColWidth = 8; // for individual day hours

    const totalWidth =
      issueColWidth +
      keyColWidth +
      loggedColWidth +
      dateRange.length * dateColWidth +
      10;

    log.info("─".repeat(totalWidth));

    // Create header row like Tempo interface
    let headerLine1 = chalk.white("Issue".padEnd(issueColWidth));
    headerLine1 += chalk.white("Key".padEnd(keyColWidth));
    headerLine1 += chalk.white("Logged".padEnd(loggedColWidth));

    // Add date headers
    dateRange.forEach((date) => {
      const dayNum = moment(date).format("DD");
      headerLine1 += chalk.cyan(dayNum.padEnd(dateColWidth));
    });
    log.info(headerLine1);

    // Second header line with weekdays
    let headerLine2 = chalk.gray(
      " ".repeat(issueColWidth + keyColWidth + loggedColWidth),
    );
    dateRange.forEach((date) => {
      const weekday = moment(date).format("ddd").toUpperCase();
      headerLine2 += chalk.gray(weekday.padEnd(dateColWidth));
    });
    log.info(headerLine2);

    log.info("─".repeat(totalWidth));

    // Display each issue with its data like Tempo format
    sortedIssues.forEach((issueKey) => {
      // Calculate total logged hours for this issue
      const totalLogged = Object.values(dailyData).reduce((sum, dayData) => {
        return sum + (dayData[issueKey] || 0);
      }, 0);

      // Create issue name (since we filtered out ID- entries, this should be clean)
      let issueName = issueKey;
      if (issueName.length > issueColWidth - 2) {
        issueName = issueName.substring(0, issueColWidth - 5) + "...";
      }

      let row = chalk.yellow(issueName.padEnd(issueColWidth));
      row += chalk.cyan(issueKey.padEnd(keyColWidth));
      row += chalk.white(totalLogged.toFixed(1).padEnd(loggedColWidth));

      // Add daily hours
      dateRange.forEach((date) => {
        const hours = dailyData[date][issueKey] || 0;
        if (hours > 0) {
          row += chalk.green(hours.toFixed(1).padEnd(dateColWidth));
        } else {
          row += chalk.gray("─".padEnd(dateColWidth));
        }
      });

      log.info(row);
    });

    // Total row like Tempo interface
    log.info("─".repeat(totalWidth));
    const grandTotal = Object.values(dailyTotals).reduce(
      (sum, hours) => sum + hours,
      0,
    );

    let totalsRow = chalk.white.bold(
      "Total".padEnd(issueColWidth + keyColWidth),
    );
    totalsRow += chalk.green.bold(grandTotal.toFixed(1).padEnd(loggedColWidth));

    dateRange.forEach((date) => {
      const total = dailyTotals[date];
      if (total > 0) {
        totalsRow += chalk.green.bold(total.toFixed(1).padEnd(dateColWidth));
      } else {
        totalsRow += chalk.gray("0".padEnd(dateColWidth));
      }
    });
    log.info(totalsRow);

    // Summary footer
    log.info("─".repeat(totalWidth));
    const periodStart = moment(dateRange[0]).format("DD/MMM/YY");
    const periodEnd = moment(dateRange[dateRange.length - 1]).format(
      "DD/MMM/YY",
    );
    log.info(
      `📊 Period: ${periodStart} - ${periodEnd} | Total Hours: ${grandTotal.toFixed(1)}h`,
    );
  }

  async displayDetailedList(dateFrom, dateTo, logger = null) {
    const log = logger || this.logger;
    try {
      // Get worklogs for the specified period
      const params = {
        from: moment(dateFrom).format("YYYY-MM-DD"),
        to: moment(dateTo).format("YYYY-MM-DD"),
      };

      const worklogs = await tempoApiService.getWorklogs(params);

      if (!worklogs.results || worklogs.results.length === 0) {
        log.warn("No worklogs found for the specified period.");
        return;
      }

      this.printDetailedList(worklogs.results, dateFrom, dateTo, log);
      return worklogs;
    } catch (error) {
      log.error("✗ Failed to generate detailed list:", error.message);
      throw error;
    }
  }

  printDetailedList(worklogs, dateFrom, dateTo, log = null) {
    // Use provided logger or fallback to instance logger or console
    const logger = log || this.logger || console;

    // Predefined issue list for filtering
    const predefinedIssueKeys = new Set([
      "DAU-2579",
      "DAU-2655",
      "ITST-14651",
      "ITST-14619",
      "ITST-14439",
      "ITST-14440",
      "ITST-14455",
      "ITST-14456",
      "ITST-15191",
    ]);

    // Build issue ID to key mapping using configured mappings
    const config = require("../utils/config");
    const issueMapping = config.issueMapping || {};
    const issueIdToKeyMap = {};

    // Create reverse mapping from ID to key using configured mappings
    for (const [key, info] of Object.entries(issueMapping)) {
      if (predefinedIssueKeys.has(key)) {
        issueIdToKeyMap[info.id.toString()] = key;
      }
    }

    // Filter and process worklogs
    const filteredWorklogs = [];
    let totalSeconds = 0;

    worklogs.forEach((worklog) => {
      let issueKey = null;

      // Strategy 1: Extract from description if available
      if (worklog.description) {
        const match = worklog.description.match(/([A-Z]+-\d+)/);
        if (match) {
          issueKey = match[1];
        }
      }

      // Strategy 2: Use Issue ID mapping if we have it
      if (!issueKey && worklog.issue?.id && issueIdToKeyMap[worklog.issue.id]) {
        issueKey = issueIdToKeyMap[worklog.issue.id];
      }

      // Only include if we found a valid issue key that's in our predefined list
      if (issueKey && predefinedIssueKeys.has(issueKey)) {
        const startTime = worklog.startTime || "09:00:00";
        const hours = worklog.timeSpentSeconds / 3600;
        const endTime = this.calculateEndTime(startTime, hours);

        filteredWorklogs.push({
          date: worklog.startDate,
          startTime: startTime,
          endTime: endTime,
          hours: hours,
          issueKey: issueKey,
          description: this.getCleanDescription(worklog.description, issueKey),
        });
        totalSeconds += worklog.timeSpentSeconds;
      }
    });

    // Sort by date and time
    filteredWorklogs.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare === 0) {
        return a.startTime.localeCompare(b.startTime);
      }
      return dateCompare;
    });

    // Group by date for display
    logger.info("\n📋 Detailed Worklog List");
    const periodStart = moment(dateFrom).format("DD/MMM/YY");
    const periodEnd = moment(dateTo).format("DD/MMM/YY");
    logger.info(
      `📅 Period: ${periodStart} - ${periodEnd} | Total: ${(totalSeconds / 3600).toFixed(1)}h (${filteredWorklogs.length} entries)`,
    );
    logger.info("─".repeat(120));

    let currentDate = null;
    let dailyTotal = 0;

    filteredWorklogs.forEach((entry, index) => {
      if (currentDate !== entry.date) {
        // Print previous day total
        if (currentDate !== null) {
          logger.info(`   Daily Total: ${dailyTotal.toFixed(1)}h`);
          logger.info("─".repeat(120));
        }

        // Print new date header
        const dateFormatted = moment(entry.date).format("dddd, MMM DD YYYY");
        logger.info(`\n${dateFormatted}`);
        currentDate = entry.date;
        dailyTotal = 0;
      }

      dailyTotal += entry.hours;

      // Format entry: Issue | StartTime-EndTime | Hours | Description
      const startTimeStr = moment(entry.startTime, "HH:mm:ss").format("HH:mm");
      const endTimeStr = moment(entry.endTime, "HH:mm:ss").format("HH:mm");
      const timeScope = `${startTimeStr}-${endTimeStr}`;
      const hoursStr = `${entry.hours.toFixed(entry.hours % 1 === 0 ? 0 : 1)}h`;

      logger.info(
        `  ${entry.issueKey.padEnd(12)} ${timeScope.padEnd(11)} ${hoursStr.padStart(6)}  ${entry.description}`,
      );
    });

    // Final day total
    if (currentDate !== null) {
      logger.info(`   Daily Total: ${dailyTotal.toFixed(1)}h`);
    }

    logger.info("─".repeat(120));
    logger.success(`📊 Grand Total: ${(totalSeconds / 3600).toFixed(1)}h`);
  }

  getCleanDescription(description, issueKey) {
    if (!description || description === "worklog.description.anonymized") {
      return `Working on ${issueKey}`;
    }

    // Clean up description to remove redundant issue key mentions
    let cleanDescription = description
      .replace(new RegExp(`Working on issue ${issueKey}`, "g"), "")
      .trim();
    if (!cleanDescription) {
      cleanDescription = `Working on ${issueKey}`;
    }

    // Truncate if too long
    if (cleanDescription.length > 80) {
      cleanDescription = cleanDescription.substring(0, 77) + "...";
    }

    return cleanDescription;
  }

  async importWorklogs(filePath, dateFilter = null, logger = null) {
    const log = logger || this.logger;

    try {
      log.transaction(`Importing worklogs from: ${filePath}`);
      log.system(`User: ${config.userName} (${config.userAccountId})`);

      // Read and parse file
      const fs = require("fs");
      const path = require("path");

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      log.system(`Reading file: ${filePath}`);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const extension = path.extname(filePath).toLowerCase();

      let worklogsData = [];

      if (extension === ".json") {
        worklogsData = JSON.parse(fileContent);
        log.system(`Parsed JSON format with ${worklogsData.length} entries`);
      } else if (extension === ".csv") {
        worklogsData = this.parseCSV(fileContent, log);
        log.system(`Parsed CSV format with ${worklogsData.length} entries`);
      } else {
        throw new Error("Unsupported file format. Use .csv or .json");
      }

      // Apply date filter if provided
      if (dateFilter) {
        const originalCount = worklogsData.length;
        worklogsData = worklogsData.filter((worklog) => {
          const worklogDate = worklog.startDate || worklog.date;
          return worklogDate >= dateFilter.from && worklogDate <= dateFilter.to;
        });

        log.system(
          `Date filter applied: ${dateFilter.from} to ${dateFilter.to}`,
        );
        log.system(
          `Filtered from ${originalCount} to ${worklogsData.length} entries`,
        );

        if (worklogsData.length === 0) {
          log.result("No worklogs found in the specified date range.");
          return;
        }
      }

      log.transaction(
        `Found ${worklogsData.length} worklog entries to process`,
      );

      // Validate for conflicts and either proceed or quit with warnings
      const hasConflicts = await this.validateWorklogsForImport(
        worklogsData,
        log,
      );

      if (hasConflicts) {
        log.error(
          "❌ Import cancelled due to conflicts. Please resolve conflicts and try again.",
        );
        throw new Error("Import cancelled due to validation conflicts");
      }

      // No conflicts, proceed with import
      await this.executeWorklogOperations(worklogsData, log);
    } catch (error) {
      // Let the CLI handle error display to avoid duplicate messages
      throw error;
    }
  }

  parseCSV(csvContent, logger = null) {
    const log = logger || this.logger;
    const lines = csvContent.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    log.info("CSV Headers found:", headers);

    const worklogs = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const worklog = {};

      headers.forEach((header, index) => {
        worklog[header] = values[index] ? values[index].trim() : "";
      });

      // Convert to standard format
      const standardWorklog = this.normalizeWorklogData(worklog, logger);
      if (standardWorklog) {
        worklogs.push(standardWorklog);
      }
    }

    // Validate for time conflicts
    this.validateTimeConflicts(worklogs, logger);

    return worklogs;
  }

  normalizeWorklogData(data, logger = null) {
    const log = logger || this.logger;
    // Expected formats:
    // CSV: date, startTime, endTime, issue, description, [delete]
    // Legacy: date, issue, hours, description, startTime

    try {
      let hours = 0;
      let startTime = data.startTime || data.time || "09:00:00";

      // Check for delete operation
      const shouldDelete =
        data.delete === "true" || data.delete === "1" || data.delete === "yes";

      // Calculate hours from time range if both startTime and endTime provided
      if (data.startTime && data.endTime) {
        const start = moment(
          `${data.date} ${data.startTime}`,
          "YYYY-MM-DD HH:mm:ss",
        );
        const end = moment(
          `${data.date} ${data.endTime}`,
          "YYYY-MM-DD HH:mm:ss",
        );

        if (!start.isValid() || !end.isValid()) {
          log.warn(
            `Skipping entry with invalid time format: ${data.startTime} - ${data.endTime}`,
          );
          return null;
        }

        if (end.isSameOrBefore(start)) {
          log.warn(
            `Skipping entry with invalid time range: ${data.startTime} - ${data.endTime}`,
          );
          return null;
        }

        hours = end.diff(start, "hours", true); // true for precise decimal
        hours = Math.round(hours * 4) / 4; // Round to nearest 15 minutes
      } else {
        // Fallback to provided hours
        hours = parseFloat(data.hours || data.timeSpent || 0);
      }

      const normalized = {
        issueKey: data.issue || data.issueKey || data.key,
        hours: hours,
        description: data.description || data.comment || "",
        startDate: data.date || data.startDate,
        startTime: startTime,
        endTime: data.endTime,
        shouldDelete: shouldDelete,
      };

      // Validate required fields (skip hours validation for delete operations)
      if (
        !normalized.issueKey ||
        !normalized.startDate ||
        (!shouldDelete && normalized.hours <= 0)
      ) {
        log.warn(`Skipping invalid entry:`, JSON.stringify(data));
        return null;
      }

      // Validate date format
      if (!moment(normalized.startDate, "YYYY-MM-DD", true).isValid()) {
        log.warn(`Skipping entry with invalid date: ${normalized.startDate}`);
        return null;
      }

      return normalized;
    } catch (error) {
      log.warn(`Skipping malformed entry: ${error.message}`);
      return null;
    }
  }

  validateTimeConflicts(worklogs, logger = null) {
    const log = logger || this.logger;
    log.info(
      `🔍 Validating ${worklogs.length} entries for time conflicts and date consistency...`,
    );

    // First validate individual entries
    let invalidEntries = 0;
    worklogs.forEach((wl, index) => {
      // Validate date format
      if (!moment(wl.startDate, "YYYY-MM-DD", true).isValid()) {
        log.error(
          `❌ Entry ${index + 1}: Invalid date format "${wl.startDate}"`,
        );
        invalidEntries++;
      }

      // Validate time formats and logic
      if (wl.startTime && wl.endTime) {
        const start = moment(wl.startTime, "HH:mm:ss", true);
        const end = moment(wl.endTime, "HH:mm:ss", true);

        if (!start.isValid()) {
          log.error(
            `❌ Entry ${index + 1}: Invalid start time format "${wl.startTime}"`,
          );
          invalidEntries++;
        }
        if (!end.isValid()) {
          log.error(
            `❌ Entry ${index + 1}: Invalid end time format "${wl.endTime}"`,
          );
          invalidEntries++;
        }
        if (start.isValid() && end.isValid() && !end.isAfter(start)) {
          log.error(
            `❌ Entry ${index + 1}: End time must be after start time (${wl.startTime} - ${wl.endTime})`,
          );
          invalidEntries++;
        }

        // Check for unrealistic time spans (>24 hours)
        if (start.isValid() && end.isValid()) {
          const duration = end.diff(start, "hours");
          if (duration > 24) {
            log.warn(
              `⚠️  Entry ${index + 1}: Long work duration (${duration}h) - please verify`,
            );
          }
        }
      }
    });

    if (invalidEntries > 0) {
      throw new Error(`Found ${invalidEntries} invalid entries in CSV data`);
    }

    // Group by date for overlap checking
    const worklogsByDate = {};
    worklogs.forEach((wl) => {
      if (!wl.shouldDelete && wl.startTime && wl.endTime) {
        if (!worklogsByDate[wl.startDate]) {
          worklogsByDate[wl.startDate] = [];
        }
        worklogsByDate[wl.startDate].push(wl);
      }
    });

    let conflicts = 0;
    const conflictDetails = [];

    // Check each date for overlapping time ranges
    Object.entries(worklogsByDate).forEach(([date, dayWorklogs]) => {
      // Sort by start time for better conflict detection
      dayWorklogs.sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (let i = 0; i < dayWorklogs.length; i++) {
        for (let j = i + 1; j < dayWorklogs.length; j++) {
          const wl1 = dayWorklogs[i];
          const wl2 = dayWorklogs[j];

          const start1 = moment(
            `${date} ${wl1.startTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );
          const end1 = moment(`${date} ${wl1.endTime}`, "YYYY-MM-DD HH:mm:ss");
          const start2 = moment(
            `${date} ${wl2.startTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );
          const end2 = moment(`${date} ${wl2.endTime}`, "YYYY-MM-DD HH:mm:ss");

          // Check for overlap (start1 < end2 AND start2 < end1)
          if (start1.isBefore(end2) && start2.isBefore(end1)) {
            const overlapType = start1.isSame(start2)
              ? "exact same time"
              : "overlapping times";
            conflictDetails.push({
              date,
              wl1: `${wl1.issueKey}: ${wl1.startTime}-${wl1.endTime}`,
              wl2: `${wl2.issueKey}: ${wl2.startTime}-${wl2.endTime}`,
              type: overlapType,
            });
            conflicts++;
          }
        }
      }
    });

    if (conflicts > 0) {
      log.error(`❌ Found ${conflicts} time conflict(s):`);
      conflictDetails.forEach((conflict, index) => {
        log.error(`   ${index + 1}. ${conflict.date} - ${conflict.type}:`);
        log.error(`      ${conflict.wl1}`);
        log.error(`      ${conflict.wl2}`);
      });
      log.warn(
        `💡 Suggestion: Check for duplicate entries or adjust time ranges to avoid overlaps`,
      );
      throw new Error(`Found ${conflicts} time conflict(s) in CSV data`);
    }

    log.success(
      `✅ All ${worklogs.length} entries validated - no conflicts detected`,
    );
  }

  async validateWorklogsForImport(importWorklogs, logger = null) {
    const log = logger || this.logger;
    log.transaction("Validating import data for conflicts");

    try {
      // Get current user account ID
      let authorAccountId = config.userAccountId;
      if (!authorAccountId) {
        try {
          const currentUser = await tempoApiService.getCurrentUser(true); // silent mode
          authorAccountId = currentUser.accountId;
        } catch (userError) {
          authorAccountId =
            await tempoApiService.getAuthorAccountIdFromWorklogs(true); // silent mode
        }
      }

      // Get date range from import data
      const dates = importWorklogs.map((w) => w.startDate).sort();
      const dateFrom = dates[0];
      const dateTo = dates[dates.length - 1];

      // Get existing worklogs for the date range
      const params = {
        from: dateFrom,
        to: dateTo,
      };
      if (authorAccountId) {
        params.author = authorAccountId;
      }

      const allExistingWorklogs = await tempoApiService.getWorklogs(
        params,
        true,
      ); // silent mode

      // Filter to relevant recent worklogs only
      const currentYear = moment().year();
      const minimumYear = Math.max(currentYear - 1, 2025);
      const yearCutoff = `${minimumYear}-01-01`;

      const recentWorklogs = allExistingWorklogs.results.filter((w) => {
        const isSystemWorklog =
          w.author?.accountId === "__tempo-io__unknown_user";
        if (isSystemWorklog) return false;
        if (w.startDate < yearCutoff) return false;
        const isUserWorklog =
          w.author?.accountId === authorAccountId ||
          w.authorAccountId === authorAccountId;
        const isVeryRecent =
          w.startDate >= moment().subtract(3, "days").format("YYYY-MM-DD");
        return isUserWorklog || isVeryRecent;
      });

      log.system(
        `Found ${recentWorklogs.length} existing worklogs to check against`,
      );

      // Check for time conflicts between imports and existing worklogs
      const conflictAnalysis = await this.validateAgainstExistingWorklogs(
        importWorklogs,
        recentWorklogs,
        log,
      );

      if (conflictAnalysis && conflictAnalysis.length > 0) {
        log.error(`❌ Found ${conflictAnalysis.length} time conflict(s):`);
        conflictAnalysis.forEach((conflict, index) => {
          log.error(
            `   ${index + 1}. ${conflict.import} conflicts with ${conflict.existing}`,
          );
        });
        log.warn(
          "💡 Suggestion: Adjust time ranges in your import file to avoid overlaps with existing worklogs",
        );
        return true; // Has conflicts
      }

      log.transaction("Validation passed - ready to import");
      return false; // No conflicts
    } catch (error) {
      log.error(`✗ Validation failed: ${error.message}`);
      return true; // Treat validation errors as conflicts to be safe
    }
  }

  async validateAgainstExistingWorklogs(
    importWorklogs,
    existingWorklogs,
    logger = null,
  ) {
    const log = logger || this.logger;
    log.info(
      `🔍 Checking ${importWorklogs.length} import entries against ${existingWorklogs.length} existing worklogs for conflicts...`,
    );

    const conflicts = [];
    const overlaps = [];

    for (const importWL of importWorklogs) {
      if (importWL.shouldDelete) continue; // Skip delete operations

      for (const existingWL of existingWorklogs) {
        // Check if they're on the same date
        if (importWL.startDate === existingWL.startDate) {
          const importStart = moment(
            `${importWL.startDate} ${importWL.startTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );
          const importEnd = moment(
            `${importWL.startDate} ${importWL.endTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );

          // Convert existing worklog time to moment objects
          let existingStart, existingEnd;

          // Handle existing worklog time format
          if (existingWL.startTime) {
            existingStart = moment(
              `${existingWL.startDate} ${existingWL.startTime}`,
              "YYYY-MM-DD HH:mm:ss",
            );
            // Calculate end time from start time + duration
            const durationHours = existingWL.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          } else {
            // If no start time, use default and duration
            existingStart = moment(
              `${existingWL.startDate} 09:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = existingWL.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          }

          // Check for time overlap (regardless of issue key)
          if (
            importStart.isBefore(existingEnd) &&
            existingStart.isBefore(importEnd)
          ) {
            // Only skip if it's EXACTLY the same time and same issue (for updates)
            const isExactSameEntry =
              importStart.format("HH:mm:ss") ===
                existingStart.format("HH:mm:ss") &&
              importEnd.format("HH:mm:ss") === existingEnd.format("HH:mm:ss") &&
              importWL.issueKey === this.extractIssueKeyFromWorklog(existingWL);

            if (!isExactSameEntry) {
              // This is a time conflict - add to overlaps
              overlaps.push({
                import: `${importWL.startDate} ${importWL.startTime}-${importWL.endTime} ${importWL.issueKey}`,
                existing: `${existingWL.startDate} ${existingStart.format("HH:mm:ss")}-${existingEnd.format("HH:mm:ss")} ID:${existingWL.tempoWorklogId}`,
                resolution: "time_conflict",
              });
            }
          }
        }
      }
    }

    if (overlaps.length > 0) {
      log.warn(
        `\n⚠️  Found ${overlaps.length} potential time overlaps with existing worklogs:`,
      );
      overlaps.forEach((overlap, index) => {
        log.warn(`   ${index + 1}. Import: ${overlap.import}`);
        log.info(`      vs Existing: ${overlap.existing}`);
      });
      log.info(
        `\n💡 These overlaps will be handled by intelligent conflict resolution...`,
      );
    }

    return { overlaps, conflicts };
  }

  async cleanExistingWorklogs(
    existingWorklogs,
    authorAccountId,
    logger = null,
  ) {
    const log = logger || this.logger;
    log.info(
      `Analyzing ${existingWorklogs.length} existing worklogs for duplicates and conflicts...`,
    );

    // Filter to only user's own worklogs
    const userWorklogs = existingWorklogs.filter(
      (wl) =>
        wl.author?.accountId === authorAccountId ||
        wl.authorAccountId === authorAccountId,
    );

    log.info(`Found ${userWorklogs.length} worklogs belonging to current user`);

    // Group worklogs by date+time+issue for duplicate detection
    const worklogGroups = new Map();
    const duplicatesToRemove = [];

    userWorklogs.forEach((worklog) => {
      const issueKey = this.extractIssueKeyFromWorklog(worklog);
      const key = `${worklog.startDate}|${worklog.startTime || "09:00:00"}|${issueKey}`;

      if (!worklogGroups.has(key)) {
        worklogGroups.set(key, []);
      }
      worklogGroups.get(key).push(worklog);
    });

    // Identify duplicates and conflicts
    let duplicatesFound = 0;
    let conflictsResolved = 0;

    for (const [key, worklogs] of worklogGroups.entries()) {
      if (worklogs.length > 1) {
        log.warn(
          `📍 Found ${worklogs.length} duplicate/conflicting worklogs for: ${key}`,
        );

        // Sort by creation date (keep the most recent one)
        worklogs.sort(
          (a, b) =>
            new Date(b.created || b.createdAt || 0) -
            new Date(a.created || a.createdAt || 0),
        );

        // Keep the most recent one, mark others for deletion
        const keepWorklog = worklogs[0];
        const removeWorklogs = worklogs.slice(1);

        log.success(
          `  ✅ Keeping: ID ${keepWorklog.tempoWorklogId} (${keepWorklog.timeSpentSeconds / 3600}h) - most recent`,
        );

        removeWorklogs.forEach((wl) => {
          log.error(
            `  🗑️  Removing: ID ${wl.tempoWorklogId} (${wl.timeSpentSeconds / 3600}h) - duplicate`,
          );
          duplicatesToRemove.push(wl);
        });

        duplicatesFound += removeWorklogs.length;
        conflictsResolved++;
      }
    }

    // Execute removal of duplicates
    if (duplicatesToRemove.length > 0) {
      log.warn(
        `\n🧹 Removing ${duplicatesToRemove.length} duplicate worklogs...`,
      );

      let removedCount = 0;
      for (const duplicate of duplicatesToRemove) {
        try {
          await tempoApiService.deleteWorklog(duplicate.tempoWorklogId);
          log.success(
            `✅ Deleted duplicate worklog ID: ${duplicate.tempoWorklogId}`,
          );
          removedCount++;
          await new Promise((resolve) => setTimeout(resolve, 200)); // Rate limiting
        } catch (error) {
          if (
            error.message.includes("403") ||
            error.message.includes("permission")
          ) {
            log.info(
              `⚠️ Skipped ID ${duplicate.tempoWorklogId}: No permission (older worklog)`,
            );
          } else {
            log.error(
              `❌ Failed to delete worklog ID ${duplicate.tempoWorklogId}: ${error.message}`,
            );
          }
        }
      }

      if (removedCount === duplicatesToRemove.length) {
        log.info(
          `🎯 Cleanup: All ${removedCount} duplicates removed successfully`,
        );
      } else {
        log.info(
          `🎯 Cleanup: ${removedCount}/${duplicatesToRemove.length} duplicates removed (${duplicatesToRemove.length - removedCount} skipped due to permissions)`,
        );
      }
    } else {
      log.success(`✅ No duplicates found - existing worklogs are clean`);
    }

    // Return cleaned list (excluding removed duplicates)
    const cleanedWorklogs = userWorklogs.filter(
      (wl) =>
        !duplicatesToRemove.some(
          (dup) => dup.tempoWorklogId === wl.tempoWorklogId,
        ),
    );

    log.info(
      `📊 Final result: ${cleanedWorklogs.length} clean worklogs after duplicate removal`,
    );
    return cleanedWorklogs;
  }

  extractIssueKeyFromWorklog(worklog) {
    // Try to extract issue key from various sources
    if (worklog.issue && worklog.issue.key) {
      return worklog.issue.key;
    }

    // Try from description if not anonymized
    if (
      worklog.description &&
      worklog.description !== "worklog.description.anonymized"
    ) {
      const match = worklog.description.match(/([A-Z]+-\d+)/);
      if (match) return match[1];
    }

    // NEW: Try to map from issue ID if available using configurable mappings
    if (worklog.issue && worklog.issue.id) {
      const config = require("../utils/config");
      const issueMapping = config.issueMapping;

      // Create reverse mapping from ID to key
      for (const [key, info] of Object.entries(issueMapping)) {
        if (info.id === worklog.issue.id.toString()) {
          return key;
        }
      }
    }

    // ENHANCED: Pattern-based inference for specific cases
    if (worklog.description === "Team Daily") {
      // Recent Team Daily entries are likely DAU-2655
      return "DAU-2655";
    }

    // Try from tempoWorklogId mapping (fallback)
    return worklog.issueKey || "UNKNOWN";
  }

  async validateAndPreviewWorklogs(importWorklogs, logger = null) {
    const log = logger || this.logger;
    log.warn("\n🔍 Validating import data against existing worklogs...");

    try {
      // Try to get current user, fall back to extraction from worklogs
      let authorAccountId = null;

      try {
        const currentUser = await tempoApiService.getCurrentUser();
        authorAccountId = currentUser.accountId;
        log.info(
          `✓ Authenticated as: ${currentUser.displayName || "User"} (${currentUser.accountId})`,
        );
      } catch (userError) {
        log.info("Extracting user info from existing worklogs...");
        try {
          authorAccountId =
            await tempoApiService.getAuthorAccountIdFromWorklogs();
          if (authorAccountId) {
            log.info(`✓ Using account ID: ${authorAccountId}`);
          } else {
            log.warn(
              "⚠️ Could not determine user account, proceeding with all worklogs",
            );
          }
        } catch (extractError) {
          log.error(`Failed to extract account ID: ${extractError.message}`);
        }
      }

      // Get date range from import data
      const dates = importWorklogs.map((w) => w.startDate).sort();
      const dateFrom = dates[0];
      const dateTo = dates[dates.length - 1];

      // Get existing worklogs for the date range
      const params = {
        from: dateFrom,
        to: dateTo,
      };
      if (authorAccountId) {
        params.author = authorAccountId;
      }

      const allExistingWorklogs = await tempoApiService.getWorklogs(params);

      // ULTRA-AGGRESSIVE filtering: Only keep worklogs from current year + user's own worklogs
      // Based on analysis: old worklogs (2016-2017) have __tempo-io__unknown_user authors and can't be deleted
      const currentYear = moment().year();
      const minimumYear = Math.max(currentYear - 1, 2025); // Never go earlier than 2025
      const yearCutoff = `${minimumYear}-01-01`;

      const recentWorklogs = allExistingWorklogs.results.filter((w) => {
        // FIRST FILTER: Immediately exclude system/anonymized worklogs
        const isSystemWorklog =
          w.author?.accountId === "__tempo-io__unknown_user";
        if (isSystemWorklog) {
          return false; // Skip all system worklogs upfront
        }

        // Second filter: Only keep worklogs from recent years (2025+)
        if (w.startDate < yearCutoff) {
          return false;
        }

        // Third filter: Only keep user's own worklogs (deleteable) + very recent ones
        const isUserWorklog =
          w.author?.accountId === authorAccountId ||
          w.authorAccountId === authorAccountId;
        const isVeryRecent =
          w.startDate >= moment().subtract(3, "days").format("YYYY-MM-DD");

        // Keep user's own worklogs or very recent ones that might be relevant
        return isUserWorklog || isVeryRecent;
      });

      const existingWorklogs = {
        ...allExistingWorklogs,
        results: recentWorklogs,
      };

      log.info(
        `Filtered ${allExistingWorklogs.results.length} → ${recentWorklogs.length} recent actionable worklogs`,
      );
      if (allExistingWorklogs.results.length - recentWorklogs.length > 0) {
        log.info(
          `⚡ Skipped ${allExistingWorklogs.results.length - recentWorklogs.length} older worklogs to optimize performance`,
        );
      }

      // Step 1: Clean existing worklogs by removing duplicates
      log.info("🧹 Cleaning existing worklogs - removing duplicates...");
      const cleanedExistingWorklogs = await this.cleanExistingWorklogs(
        existingWorklogs.results,
        authorAccountId,
        log,
      );

      // Step 2: Check for conflicts between imports and cleaned existing worklogs
      const conflictAnalysis = await this.validateAgainstExistingWorklogs(
        importWorklogs,
        cleanedExistingWorklogs,
        log,
      );

      // Step 3: Compare and categorize operations with conflict resolution (imports take priority)
      const operations = await this.categorizeWorklogOperations(
        importWorklogs,
        cleanedExistingWorklogs,
        authorAccountId,
        conflictAnalysis,
        log,
      );

      this.previewWorklogOperations(operations);
    } catch (error) {
      log.error("✗ Validation failed:", error.message);
      log.warn("Falling back to simple preview...");
      this.previewWorklogs(importWorklogs);
    }
  }

  async categorizeWorklogOperations(
    importWorklogs,
    existingWorklogs,
    authorAccountId,
    conflictAnalysis = null,
    logger = null,
  ) {
    const log = logger || this.logger;
    const operations = {
      add: [],
      update: [],
      delete: [],
      replace: [], // New: for delete-and-create operations
      noChange: [],
    };

    log.info(
      `Categorizing operations for ${importWorklogs.length} import entries against ${existingWorklogs.length} existing worklogs...`,
    );

    // Create a map of existing worklogs by date+time+issue for quick lookup
    const existingMap = new Map();
    log.debug("Analyzing existing worklogs for duplicates...");

    existingWorklogs.forEach((worklog, index) => {
      // CRITICAL: Skip undeleteable worklogs from conflict detection entirely
      const isUserWorklog =
        worklog.author?.accountId === authorAccountId ||
        worklog.authorAccountId === authorAccountId;
      const isAnonymizedOldWorklog =
        worklog.author?.accountId === "__tempo-io__unknown_user";

      // Skip old anonymized worklogs that can't be deleted - don't include in conflict detection
      if (
        isAnonymizedOldWorklog ||
        (!isUserWorklog && worklog.startDate < "2025-01-01")
      ) {
        return;
      }

      // Use the enhanced extraction method instead of inline logic
      const issueKey = this.extractIssueKeyFromWorklog(worklog);

      // Show only entries with extracted issue keys for debugging
      if (issueKey && issueKey !== "UNKNOWN") {
        log.debug(
          `  Found matching entry: ${worklog.startDate} ${worklog.startTime} ${issueKey}`,
        );
        const key = `${worklog.startDate}|${worklog.startTime}|${issueKey}`;
        existingMap.set(key, worklog);
      }
    });

    if (existingMap.size > 0) {
      log.info(
        `Found ${existingMap.size} existing worklogs to check for duplicates`,
      );
    }

    // Create overlap detection map for smart conflict resolution
    const overlappingWorklogs = new Map();
    if (conflictAnalysis && conflictAnalysis.overlaps) {
      conflictAnalysis.overlaps.forEach((overlap) => {
        const importKey =
          overlap.import.split(" ")[0] +
          "|" +
          overlap.import.split(" ")[1].split("-")[0];
        overlappingWorklogs.set(importKey, overlap);
      });
    }

    // Categorize each import worklog with intelligent conflict resolution
    for (const [index, importWL] of importWorklogs.entries()) {
      log.debug(
        `Processing ${index + 1}/${importWorklogs.length}: ${importWL.issueKey}`,
      );

      const key = `${importWL.startDate}|${importWL.startTime}|${importWL.issueKey}`;
      const existing = existingMap.get(key);

      // Enhanced worklog with metadata
      const enhancedWorklog = {
        ...importWL,
        authorAccountId,
      };

      // Handle delete operations
      if (importWL.shouldDelete) {
        if (existing) {
          operations.delete.push({
            ...enhancedWorklog,
            tempoWorklogId: existing.tempoWorklogId,
          });
          log.error(`    -> DELETE operation`);
        } else {
          log.warn(`    -> DELETE operation skipped (not found)`);
        }
        continue;
      }

      // Check for overlapping worklogs that need intelligent resolution
      const overlapKey = `${importWL.startDate}|${importWL.startTime}`;
      const overlappingWorklog = overlappingWorklogs.get(overlapKey);

      if (overlappingWorklog && !existing) {
        // Find the conflicting existing worklog(s) - SKIP UNDELETEABLE ONES
        const conflictingWorklogs = existingWorklogs.filter((ewl) => {
          if (ewl.startDate !== importWL.startDate) return false;

          // CRITICAL: Skip undeleteable worklogs from conflict resolution
          const isUserWorklog =
            ewl.author?.accountId === authorAccountId ||
            ewl.authorAccountId === authorAccountId;
          const isAnonymizedOldWorklog =
            ewl.author?.accountId === "__tempo-io__unknown_user";

          if (
            isAnonymizedOldWorklog ||
            (!isUserWorklog && ewl.startDate < "2025-01-01")
          ) {
            return false; // Skip undeleteable worklogs
          }

          const importStart = moment(
            `${importWL.startDate} ${importWL.startTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );
          const importEnd = moment(
            `${importWL.startDate} ${importWL.endTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );

          let existingStart, existingEnd;
          if (ewl.startTime) {
            existingStart = moment(
              `${ewl.startDate} ${ewl.startTime}`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = ewl.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          } else {
            existingStart = moment(
              `${ewl.startDate} 09:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = ewl.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          }

          return (
            importStart.isBefore(existingEnd) &&
            existingStart.isBefore(importEnd)
          );
        });

        if (conflictingWorklogs.length > 0) {
          // Strategy: Delete conflicting worklogs and create new one (REPLACE operation)
          operations.replace.push({
            import: enhancedWorklog,
            conflictingWorklogs: conflictingWorklogs.map((cwl) => ({
              tempoWorklogId: cwl.tempoWorklogId,
              description: cwl.description,
              hours: cwl.timeSpentSeconds / 3600,
              startTime: cwl.startTime || "09:00:00",
            })),
          });
          log.info(
            `    -> REPLACE operation (delete ${conflictingWorklogs.length} + create 1)`,
          );
          continue;
        }
      }

      // Enhanced conflict resolution: prioritize imports over existing records
      if (!existing) {
        // No exact match - check for any overlapping/conflicting records - SKIP UNDELETEABLE ONES
        const conflictingRecords = existingWorklogs.filter((ewl) => {
          if (ewl.startDate !== importWL.startDate) return false;

          // CRITICAL: Skip undeleteable worklogs from conflict resolution
          const isUserWorklog =
            ewl.author?.accountId === authorAccountId ||
            ewl.authorAccountId === authorAccountId;
          const isAnonymizedOldWorklog =
            ewl.author?.accountId === "__tempo-io__unknown_user";

          if (
            isAnonymizedOldWorklog ||
            (!isUserWorklog && ewl.startDate < "2025-01-01")
          ) {
            return false; // Skip undeleteable worklogs
          }

          const importStart = moment(
            `${importWL.startDate} ${importWL.startTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );
          const importEnd = moment(
            `${importWL.startDate} ${importWL.endTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );

          let existingStart, existingEnd;
          if (ewl.startTime) {
            existingStart = moment(
              `${ewl.startDate} ${ewl.startTime}`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = ewl.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          } else {
            existingStart = moment(
              `${ewl.startDate} 09:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = ewl.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          }

          // Check for any time overlap
          return (
            importStart.isBefore(existingEnd) &&
            existingStart.isBefore(importEnd)
          );
        });

        if (conflictingRecords.length > 0) {
          // Import has priority - replace conflicting records
          operations.replace.push({
            import: enhancedWorklog,
            conflictingWorklogs: conflictingRecords.map((cwl) => ({
              tempoWorklogId: cwl.tempoWorklogId,
              description: cwl.description,
              hours: cwl.timeSpentSeconds / 3600,
              startTime: cwl.startTime || "09:00:00",
              issueKey: this.extractIssueKeyFromWorklog(cwl),
            })),
          });
          log.info(
            `    -> REPLACE operation (import priority: remove ${conflictingRecords.length}, add 1)`,
          );
        } else {
          operations.add.push(enhancedWorklog);
          log.debug(`    -> ADD operation`);
        }
      } else {
        // Exact match found - but still need to check for overlapping conflicts

        // First, check for ANY overlapping worklogs (even when exact match exists)
        const conflictingRecords = existingWorklogs.filter((ewl) => {
          if (ewl.startDate !== importWL.startDate) return false;
          if (ewl.tempoWorklogId === existing.tempoWorklogId) return false; // Skip the exact match

          const importStart = moment(
            `${importWL.startDate} ${importWL.startTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );
          const importEnd = moment(
            `${importWL.startDate} ${importWL.endTime}`,
            "YYYY-MM-DD HH:mm:ss",
          );

          let existingStart, existingEnd;
          if (ewl.startTime) {
            existingStart = moment(
              `${ewl.startDate} ${ewl.startTime}`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = ewl.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          } else {
            existingStart = moment(
              `${ewl.startDate} 09:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            );
            const durationHours = ewl.timeSpentSeconds / 3600;
            existingEnd = existingStart.clone().add(durationHours, "hours");
          }

          // Check for any time overlap
          return (
            importStart.isBefore(existingEnd) &&
            existingStart.isBefore(importEnd)
          );
        });

        if (conflictingRecords.length > 0) {
          // Even with exact match, there are conflicts - need REPLACE operation
          // Include the exact match in the worklogs to replace
          operations.replace.push({
            import: enhancedWorklog,
            conflictingWorklogs: [...conflictingRecords, existing].map(
              (cwl) => ({
                tempoWorklogId: cwl.tempoWorklogId,
                description: cwl.description,
                hours: cwl.timeSpentSeconds / 3600,
                startTime: cwl.startTime || "09:00:00",
                issueKey: this.extractIssueKeyFromWorklog(cwl),
              }),
            ),
          });
          log.warn(
            `    -> REPLACE operation (exact match + ${conflictingRecords.length} conflicts)`,
          );
        } else {
          // EXACT MATCHING VALIDATION: Compare all key values
          const importHours = Math.round(importWL.hours * 3600);
          const existingHours = existing.timeSpentSeconds;
          const importStartTime = importWL.startTime || "09:00:00";
          const existingStartTime = existing.startTime || "09:00:00";

          // Compare all relevant fields for exact matching
          const hoursMatch = importHours === existingHours;
          const descriptionMatch =
            importWL.description === existing.description;
          const startTimeMatch = importStartTime === existingStartTime;
          const dateMatch = importWL.startDate === existing.startDate;

          // Additional validation for issue matching
          const existingIssueKey = this.extractIssueKeyFromWorklog(existing);
          const issueMatch = importWL.issueKey === existingIssueKey;

          if (
            hoursMatch &&
            descriptionMatch &&
            startTimeMatch &&
            dateMatch &&
            issueMatch
          ) {
            // PERFECT MATCH - no action needed
            operations.noChange.push(enhancedWorklog);
            log.debug(`    -> NO CHANGE (perfect match)`);
          } else {
            // Some values differ - update needed
            operations.update.push({
              ...enhancedWorklog,
              tempoWorklogId: existing.tempoWorklogId,
              existingHours: existingHours / 3600,
              existingDescription: existing.description,
            });

            // Show what's different for debugging
            const differences = [];
            if (!hoursMatch)
              differences.push(
                `hours: ${existingHours / 3600}h -> ${importWL.hours}h`,
              );
            if (!descriptionMatch)
              differences.push(
                `description: "${existing.description}" -> "${importWL.description}"`,
              );
            if (!startTimeMatch)
              differences.push(
                `time: ${existingStartTime} -> ${importStartTime}`,
              );
            if (!issueMatch)
              differences.push(
                `issue: ${existingIssueKey} -> ${importWL.issueKey}`,
              );

            log.warn(`    -> UPDATE operation (${differences.join(", ")})`);
          }
        }
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return operations;
  }

  previewWorklogOperations(operations) {
    log.warn("\n📋 Import Preview with Validation");
    log.info("═".repeat(100));

    // Show ADD operations
    if (operations.add.length > 0) {
      log.success(`\n➕ ADD Operations (${operations.add.length} entries):`);
      log.info("─".repeat(80));
      operations.add.forEach((worklog, index) => {
        const endTime = this.calculateEndTime(worklog.startTime, worklog.hours);
        const status = worklog.validated ? "✅" : "❌";
        log.info(
          `  ${(index + 1).toString().padStart(2)}. ${worklog.startDate} ${worklog.startTime}-${endTime} ${status}`,
        );
        log.warn(
          `      ${worklog.issueKey.padEnd(12)} ${worklog.hours.toFixed(1)}h - ${worklog.description}`,
        );
        if (!worklog.validated) {
          log.error(`      ⚠️  Issue validation failed`);
        }
      });
    }

    // Show UPDATE operations
    if (operations.update.length > 0) {
      log.info(
        `\n✏️  UPDATE Operations (${operations.update.length} entries):`,
      );
      log.info("─".repeat(80));
      operations.update.forEach((worklog, index) => {
        const endTime = this.calculateEndTime(worklog.startTime, worklog.hours);
        const status = worklog.validated ? "✅" : "❌";
        log.info(
          `  ${(index + 1).toString().padStart(2)}. ${worklog.startDate} ${worklog.startTime}-${endTime} ${status}`,
        );
        log.warn(
          `      ${worklog.issueKey.padEnd(12)} ${worklog.existingHours.toFixed(1)}h → ${worklog.hours.toFixed(1)}h`,
        );
        log.info(
          `      "${worklog.existingDescription}" → "${worklog.description}"`,
        );
      });
    }

    // Show DELETE operations
    if (operations.delete.length > 0) {
      log.warn(
        `\n🗑️  DELETE Operations (${operations.delete.length} entries):`,
      );
      log.info("─".repeat(80));
      operations.delete.forEach((worklog, index) => {
        log.info(
          `  ${(index + 1).toString().padStart(2)}. ${worklog.startDate} ${worklog.startTime}`,
        );
        log.error(
          `      ${worklog.issueKey.padEnd(12)} ${worklog.hours.toFixed(1)}h - ${worklog.description}`,
        );
      });
    }

    // Show REPLACE operations
    if (operations.replace.length > 0) {
      log.info(
        `\n🔄 REPLACE Operations (${operations.replace.length} entries):`,
      );
      log.info("─".repeat(80));
      operations.replace.forEach((replaceOp, index) => {
        const worklog = replaceOp.worklogData || replaceOp.import;
        if (!worklog || !worklog.startTime) {
          log.error(
            `⚠️ Invalid worklog data in REPLACE operation ${index + 1}`,
          );
          log.info("Debug - replaceOp:", JSON.stringify(replaceOp, null, 2));
          return;
        }
        const endTime = this.calculateEndTime(worklog.startTime, worklog.hours);
        log.info(
          `  ${(index + 1).toString().padStart(2)}. ${worklog.startDate} ${worklog.startTime}-${endTime}`,
        );
        log.info(
          `      NEW: ${worklog.issueKey.padEnd(12)} ${worklog.hours.toFixed(1)}h - ${worklog.description}`,
        );
        log.info(
          `      REMOVES: ${replaceOp.conflictingWorklogs.length} conflicting worklog(s)`,
        );
        replaceOp.conflictingWorklogs.forEach((conflict, i) => {
          const hours = conflict.hours ? conflict.hours.toFixed(1) : "0.0";
          log.info(
            `         ${i + 1}. ID:${conflict.tempoWorklogId} ${hours}h`,
          );
        });
      });
    }

    // Show NO CHANGE
    if (operations.noChange.length > 0) {
      log.info(
        `\n👌 NO CHANGE (${operations.noChange.length} entries) - Already up to date`,
      );
    }

    // Summary
    log.info("═".repeat(100));
    const totalAdd = operations.add.length;
    const totalUpdate = operations.update.length;
    const totalDelete = operations.delete.length;
    const totalReplace = operations.replace.length;
    const totalNoChange = operations.noChange.length;
    const totalHours = [
      ...operations.add,
      ...operations.update,
      ...(operations.replace || []).map((r) => r.import),
    ].reduce((sum, w) => sum + w.hours, 0);
    const validationErrors = [
      ...operations.add,
      ...operations.update,
      ...(operations.replace || []).map((r) => r.import),
    ].filter((w) => !w.validated).length;

    log.info(
      `📊 Summary: ${totalAdd} ADD + ${totalUpdate} UPDATE + ${totalDelete} DELETE + ${totalReplace} REPLACE + ${totalNoChange} NO CHANGE = ${totalAdd + totalUpdate + totalDelete + totalReplace + totalNoChange} total`,
    );
    log.info(`⏱️  Total time to be logged: ${totalHours.toFixed(1)}h`);

    if (validationErrors > 0) {
      log.error(`⚠️  ${validationErrors} validation errors detected`);
    }

    log.success(
      "\n✅ Preview completed. Run again with dry run = false to execute operations.",
    );
  }

  previewWorklogs(worklogs, logger = null) {
    const log = logger || this.logger;
    log.warn("\n📋 Import Preview (Dry Run)");
    log.info("─".repeat(80));

    let totalHours = 0;
    const issueStats = {};

    worklogs.forEach((worklog, index) => {
      totalHours += worklog.hours;
      issueStats[worklog.issueKey] =
        (issueStats[worklog.issueKey] || 0) + worklog.hours;

      const endTime = this.calculateEndTime(worklog.startTime, worklog.hours);
      log.info(
        `${(index + 1).toString().padStart(3)}. ${worklog.startDate} ${worklog.startTime} - ${endTime}`,
      );
      log.warn(
        `     ${worklog.issueKey.padEnd(12)} ${worklog.hours.toFixed(1)}h - ${worklog.description}`,
      );
    });

    log.info("─".repeat(80));
    log.info(
      `📊 Summary: ${worklogs.length} entries, ${totalHours.toFixed(1)}h total`,
    );

    log.info("\nIssue breakdown:");
    Object.entries(issueStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([issue, hours]) => {
        log.info(`  ${issue}: ${hours.toFixed(1)}h`);
      });

    log.success(
      "\n✅ Preview completed. Run again with dry run = false to actually create worklogs.",
    );
  }

  async executeWorklogOperations(importWorklogs, logger = null) {
    const log = logger || this.logger;
    log.info("\n🔄 Executing worklog operations...");

    try {
      // Try to get current user, fall back to extraction from worklogs
      let authorAccountId = null;

      try {
        const currentUser = await tempoApiService.getCurrentUser();
        authorAccountId = currentUser.accountId;
        log.info(
          `✓ Authenticated as: ${currentUser.displayName || "User"} (${currentUser.accountId})`,
        );
      } catch (userError) {
        log.info("Extracting user info from existing worklogs...");
        authorAccountId =
          await tempoApiService.getAuthorAccountIdFromWorklogs();
        if (authorAccountId) {
          log.info(`Using extracted account ID: ${authorAccountId}`);
        } else {
          log.error(
            "Could not determine author account ID, will proceed with bulk creation",
          );
          throw new Error("Cannot determine author account ID");
        }
      }

      const dates = importWorklogs.map((w) => w.startDate).sort();
      const dateFrom = dates[0];
      const dateTo = dates[dates.length - 1];

      const params = {
        from: dateFrom,
        to: dateTo,
      };
      if (authorAccountId) {
        params.author = authorAccountId;
      }

      const allExistingWorklogs = await tempoApiService.getWorklogs(params);

      // ULTRA-AGGRESSIVE filtering (same logic as preview): Only keep worklogs from current year + user's own worklogs
      // Based on analysis: old worklogs (2016-2017) have __tempo-io__unknown_user authors and can't be deleted
      const currentYear = moment().year();
      const minimumYear = Math.max(currentYear - 1, 2025); // Never go earlier than 2025
      const yearCutoff = `${minimumYear}-01-01`;

      const recentWorklogs = allExistingWorklogs.results.filter((w) => {
        // FIRST FILTER: Immediately exclude system/anonymized worklogs
        const isSystemWorklog =
          w.author?.accountId === "__tempo-io__unknown_user";
        if (isSystemWorklog) {
          return false; // Skip all system worklogs upfront
        }

        // Second filter: Only keep worklogs from recent years (2025+)
        if (w.startDate < yearCutoff) {
          return false;
        }

        // Third filter: Only keep user's own worklogs (deleteable) + very recent ones
        const isUserWorklog =
          w.author?.accountId === authorAccountId ||
          w.authorAccountId === authorAccountId;
        const isVeryRecent =
          w.startDate >= moment().subtract(3, "days").format("YYYY-MM-DD");

        // Keep user's own worklogs or very recent ones that might be relevant
        return isUserWorklog || isVeryRecent;
      });

      const existingWorklogs = {
        ...allExistingWorklogs,
        results: recentWorklogs,
      };

      log.info(
        `Filtered ${allExistingWorklogs.results.length} → ${recentWorklogs.length} recent actionable worklogs`,
      );
      if (allExistingWorklogs.results.length - recentWorklogs.length > 0) {
        log.info(
          `⚡ Skipped ${allExistingWorklogs.results.length - recentWorklogs.length} older worklogs to optimize performance`,
        );
      }

      // Categorize operations
      const operations = await this.categorizeWorklogOperations(
        importWorklogs,
        existingWorklogs.results,
        authorAccountId,
        null,
        log,
      );

      // Execute DELETE operations first
      await this.executeDeleteOperations(operations.delete, log);

      // Execute REPLACE operations (delete conflicting + create new)
      await this.executeReplaceOperations(operations.replace || [], log);

      // Execute ADD operations
      await this.executeAddOperations(operations.add, log);

      // Execute UPDATE operations
      await this.executeUpdateOperations(operations.update, log);
    } catch (error) {
      log.error("✗ Operation execution failed:", error.message);
      log.warn("Falling back to minimal approach bulk creation...");
      await this.bulkCreateWorklogs(importWorklogs);
    }
  }

  async executeAddOperations(addOperations, logger = null) {
    const log = logger || this.logger;
    if (addOperations.length === 0) {
      log.info("No ADD operations to execute.");
      return;
    }

    log.success(`\n➕ Executing ${addOperations.length} ADD operations...`);

    let successCount = 0;
    let failureCount = 0;

    for (const [index, worklogData] of addOperations.entries()) {
      try {
        log.info(
          `Adding ${index + 1}/${addOperations.length}: ${worklogData.issueKey} ${worklogData.hours}h`,
        );

        // Create worklog with MCP integration
        await tempoApiService.createWorklogWithStatic(
          worklogData.issueKey,
          worklogData.hours,
          worklogData.startDate,
          worklogData.startTime,
          worklogData.description,
        );

        log.success(`✅ Added: ${worklogData.issueKey} ${worklogData.hours}h`);
        successCount++;

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        log.error(`✗ Failed to add worklog ${index + 1}:`, error.message);
        failureCount++;
      }
    }

    log.info(`ADD Results: ${successCount} successful, ${failureCount} failed`);
  }

  async executeUpdateOperations(updateOperations, logger = null) {
    const log = logger || this.logger;
    if (updateOperations.length === 0) {
      log.info("No UPDATE operations to execute.");
      return;
    }

    log.info(`\n✏️  Executing ${updateOperations.length} UPDATE operations...`);

    let successCount = 0;
    let failureCount = 0;

    for (const [index, worklogData] of updateOperations.entries()) {
      try {
        log.info(
          `Updating ${index + 1}/${updateOperations.length}: ${worklogData.issueKey} ${worklogData.existingHours}h → ${worklogData.hours}h`,
        );

        // Update worklog using MCP-based approach
        await tempoApiService.updateWorklogWithStatic(
          worklogData.tempoWorklogId,
          worklogData.issueKey,
          worklogData.hours,
          worklogData.startDate,
          worklogData.startTime,
          worklogData.description,
        );
        log.success(
          `✅ Updated: ${worklogData.issueKey} ${worklogData.existingHours}h → ${worklogData.hours}h`,
        );
        successCount++;

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        log.error(`✗ Failed to update worklog ${index + 1}:`, error.message);
        failureCount++;
      }
    }

    log.info(
      `UPDATE Results: ${successCount} successful, ${failureCount} failed`,
    );
  }

  async executeDeleteOperations(deleteOperations, logger = null) {
    const log = logger || this.logger;
    if (deleteOperations.length === 0) {
      log.info("No DELETE operations to execute.");
      return;
    }

    log.warn(`\n🗑️  Executing ${deleteOperations.length} DELETE operations...`);

    let successCount = 0;
    let failureCount = 0;

    for (const [index, worklogData] of deleteOperations.entries()) {
      try {
        log.info(
          `Deleting ${index + 1}/${deleteOperations.length}: ${worklogData.issueKey} ${worklogData.hours}h`,
        );

        await tempoApiService.deleteWorklog(worklogData.tempoWorklogId);
        log.success(
          `✅ Deleted: ${worklogData.issueKey} ${worklogData.hours}h`,
        );
        successCount++;

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        log.error(`✗ Failed to delete worklog ${index + 1}:`, error.message);
        failureCount++;
      }
    }

    log.info(
      `DELETE Results: ${successCount} successful, ${failureCount} failed`,
    );
  }

  async executeReplaceOperations(replaceOperations, logger = null) {
    const log = logger || this.logger;
    if (replaceOperations.length === 0) {
      log.info("No REPLACE operations to execute.");
      return;
    }

    log.info(
      `\n🔄 Executing ${replaceOperations.length} REPLACE operations...`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (const [index, replaceOp] of replaceOperations.entries()) {
      const worklogData = replaceOp.worklogData || replaceOp.import;
      const conflictingWorklogs = replaceOp.conflictingWorklogs;

      try {
        log.info(
          `Replacing ${index + 1}/${replaceOperations.length}: ${worklogData.issueKey} ${worklogData.hours}h`,
        );
        log.info(
          `  Deleting ${conflictingWorklogs.length} conflicting worklog(s)...`,
        );

        // Step 1: Delete all conflicting worklogs - BUT FIRST FILTER OUT UNDELETEABLE ONES
        const config = require("../utils/config");
        const authorAccountId = config.userAccountId;

        // FINAL SAFETY FILTER: Remove undeleteable worklogs before attempting deletion
        const deleteableWorklogs = conflictingWorklogs.filter(
          (conflictingWL) => {
            // Skip if we know it's undeleteable based on common patterns
            const worklogId = conflictingWL.tempoWorklogId;

            // These are the ID ranges we know are old and undeleteable based on the logs
            // IDs like 1371089, 1371452, 1372657, etc. (older worklogs from previous runs)
            if (worklogId < 1374000) {
              log.info(
                `    🚫 Skipped ID:${worklogId}: Known undeleteable worklog (< 1374000)`,
              );
              return false;
            }

            return true; // Keep this worklog for deletion attempt
          },
        );

        log.info(
          `    Pre-filtered: ${conflictingWorklogs.length} → ${deleteableWorklogs.length} deleteable worklogs`,
        );

        let deletedCount = 0;
        for (const conflictingWL of deleteableWorklogs) {
          try {
            await tempoApiService.deleteWorklog(conflictingWL.tempoWorklogId);
            deletedCount++;
            log.warn(
              `    ✓ Deleted conflicting worklog ID:${conflictingWL.tempoWorklogId}`,
            );
          } catch (deleteError) {
            if (
              deleteError.message.includes("403") ||
              deleteError.message.includes("permission")
            ) {
              log.info(
                `    ⚠️ Skipped ID:${conflictingWL.tempoWorklogId}: No permission (older worklog)`,
              );
            } else {
              log.error(
                `    ✗ Failed to delete worklog ID:${conflictingWL.tempoWorklogId}: ${deleteError.message}`,
              );
            }
            // Continue with other deletions
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Step 2: Create the new worklog
        log.info(
          `  Creating new worklog: ${worklogData.issueKey} ${worklogData.hours}h`,
        );
        await tempoApiService.createWorklogWithStatic(
          worklogData.issueKey,
          worklogData.hours,
          worklogData.startDate,
          worklogData.startTime,
          worklogData.description,
        );

        if (
          deletedCount === deleteableWorklogs.length &&
          deleteableWorklogs.length > 0
        ) {
          log.success(
            `✅ Replaced: All ${deletedCount} deleteable conflicts removed + Created ${worklogData.issueKey} ${worklogData.hours}h`,
          );
        } else if (deleteableWorklogs.length > 0) {
          log.success(
            `✅ Replaced: Removed ${deletedCount}/${deleteableWorklogs.length} deleteable conflicts + Created ${worklogData.issueKey} ${worklogData.hours}h`,
          );
        } else {
          log.success(
            `✅ Created: ${worklogData.issueKey} ${worklogData.hours}h (no deleteable conflicts)`,
          );
        }
        successCount++;

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        log.error(`✗ Failed to replace worklog ${index + 1}:`, error.message);
        failureCount++;
      }
    }

    log.info(
      `REPLACE Results: ${successCount} successful, ${failureCount} failed`,
    );
  }

  async bulkCreateWorklogs(worklogs, logger = null) {
    const log = logger || this.logger;
    log.info("\n📝 Creating worklogs with minimal approach...");

    let successCount = 0;
    let failureCount = 0;

    for (const [index, worklogData] of worklogs.entries()) {
      try {
        log.debug(
          `Processing ${index + 1}/${worklogs.length}: ${worklogData.issueKey} ${worklogData.hours}h`,
        );

        // Try the minimal approach first
        await tempoApiService.createWorklogWithStatic(
          worklogData.issueKey,
          worklogData.hours,
          worklogData.startDate || worklogData.date,
          worklogData.startTime || "09:00:00",
          worklogData.description || `Working on ${worklogData.issueKey}`,
        );

        log.success(
          `✅ Created: ${worklogData.issueKey} ${worklogData.hours}h`,
        );
        successCount++;

        // Rate limiting - wait 1 second between requests
        if (index < worklogs.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        log.error(`✗ Failed to create worklog ${index + 1}:`, error.message);
        failureCount++;
      }
    }

    log.info("─".repeat(80));
    log.success(
      `✅ Import completed: ${successCount} successful, ${failureCount} failed`,
    );
  }

  async exportWorklogs(
    dateFrom,
    dateTo,
    format = "csv",
    fileName = null,
    logger = null,
  ) {
    const log = logger || this.logger;
    try {
      log.transaction(
        `Exporting worklogs from ${dateFrom} to ${dateTo} in ${format.toUpperCase()} format`,
      );

      // Get worklogs for the specified period
      const params = {
        from: moment(dateFrom).format("YYYY-MM-DD"),
        to: moment(dateTo).format("YYYY-MM-DD"),
      };

      const worklogs = await tempoApiService.getWorklogs(params, true); // silent mode

      if (!worklogs.results || worklogs.results.length === 0) {
        log.warn("No worklogs found for the specified period.");
        return;
      }

      // Filter and format worklogs
      const exportData = this.prepareExportData(worklogs.results);

      if (exportData.length === 0) {
        log.warn("No matching worklogs found for your issues.");
        return;
      }

      // Generate filename if not provided - use config default name
      if (!fileName) {
        const dateStr = moment().format("YYYY-MM-DD");
        const periodStr = `${moment(dateFrom).format("MM-DD")}_to_${moment(dateTo).format("MM-DD")}`;
        // Use config default file name if available, otherwise generate one
        fileName =
          config.defaultImportFile ||
          `${config.userName.toLowerCase()}_export_${periodStr}.${format}`;
      }

      // Export in specified format
      const fs = require("fs");
      let fileContent;

      if (format === "csv") {
        fileContent = this.generateCSV(exportData);
      } else if (format === "json") {
        fileContent = JSON.stringify(exportData, null, 2);
      } else {
        throw new Error("Unsupported format. Use csv or json");
      }

      // Resolve file path to export directory
      const path = require("path");
      const exportPath = path.join(config.exportDir, fileName);

      // Ensure export directory exists
      if (!fs.existsSync(config.exportDir)) {
        fs.mkdirSync(config.exportDir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(exportPath, fileContent, "utf8");

      log.transaction(`Export completed: ${exportPath}`);
      log.transaction(`Exported ${exportData.length} worklog entries`);

      // Show summary
      this.displayExportSummary(exportData, log);

      log.result(
        '\n💡 Usage: Edit the exported file and use "node src/index.js import" to upload changes',
      );

      return exportPath;
    } catch (error) {
      log.error(`✗ Export failed: ${error.message}`);
      throw error;
    }
  }

  prepareExportData(worklogs) {
    // Use configurable issue mappings for filtering
    const issueMapping = config.issueMapping;
    const predefinedIssueKeys = new Set(Object.keys(issueMapping));

    const exportData = [];

    worklogs.forEach((worklog) => {
      // Use the same issue extraction logic as import for consistency
      const issueKey = this.extractIssueKeyFromWorklog(worklog);

      if (issueKey && predefinedIssueKeys.has(issueKey)) {
        const hours = worklog.timeSpentSeconds / 3600;
        const startTime = worklog.startTime || "09:00:00";
        const endTime = this.calculateEndTime(startTime, hours);

        exportData.push({
          date: worklog.startDate,
          startTime: startTime,
          endTime: endTime,
          issue: issueKey,
          description: this.getCleanDescription(worklog.description, issueKey),
          delete: "", // Empty delete column for import compatibility
        });
      }
    });

    // Sort by date and time
    exportData.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare === 0) {
        return a.startTime.localeCompare(b.startTime);
      }
      return dateCompare;
    });

    return exportData;
  }

  calculateEndTime(startTime, hours) {
    try {
      const startMoment = moment(startTime, "HH:mm:ss");
      const endMoment = startMoment.clone().add(hours, "hours");
      return endMoment.format("HH:mm:ss");
    } catch (error) {
      // Fallback: assume 8-hour workday if calculation fails
      return "17:00:00";
    }
  }

  generateCSV(data) {
    if (data.length === 0) return "";

    // CSV Headers - match import format exactly: date,startTime,endTime,issue,description,delete
    const headers = [
      "date",
      "startTime",
      "endTime",
      "issue",
      "description",
      "delete",
    ];
    let csv = headers.join(",") + "\n";

    // CSV Data
    data.forEach((row) => {
      const csvRow = headers
        .map((header) => {
          let value = row[header] || "";
          // Escape quotes and wrap in quotes if contains comma
          if (
            typeof value === "string" &&
            (value.includes(",") || value.includes('"'))
          ) {
            value = '"' + value.replace(/"/g, '""') + '"';
          }
          return value;
        })
        .join(",");

      csv += csvRow + "\n";
    });

    return csv;
  }

  displayExportSummary(exportData, logger = null) {
    const log = logger || this.logger;
    log.transaction("\n📋 Export Summary:");

    const issueStats = {};
    const dateStats = {};
    let totalHours = 0;

    exportData.forEach((entry) => {
      // Calculate hours from time range for summary
      const start = moment(
        `${entry.date} ${entry.startTime}`,
        "YYYY-MM-DD HH:mm:ss",
      );
      const end = moment(
        `${entry.date} ${entry.endTime}`,
        "YYYY-MM-DD HH:mm:ss",
      );
      const hours = end.diff(start, "hours", true);

      issueStats[entry.issue] = (issueStats[entry.issue] || 0) + hours;
      dateStats[entry.date] = (dateStats[entry.date] || 0) + hours;
      totalHours += hours;
    });

    log.system("By Issue:");
    Object.entries(issueStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([issue, hours]) => {
        log.system(`  ${issue}: ${hours.toFixed(1)}h`);
      });

    log.system("By Date:");
    Object.entries(dateStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, hours]) => {
        const weekday = moment(date).format("ddd");
        log.system(`  ${date} ${weekday}: ${hours.toFixed(1)}h`);
      });

    log.transaction(
      `Total: ${totalHours.toFixed(1)}h across ${Object.keys(dateStats).length} days`,
    );
  }

  getDateRange(dateFrom, dateTo) {
    const dates = [];
    const start = moment(dateFrom);
    const end = moment(dateTo);

    while (start.isSameOrBefore(end)) {
      dates.push(start.format("YYYY-MM-DD"));
      start.add(1, "day");
    }
    return dates;
  }
}

module.exports = new TimeTrackingController();
