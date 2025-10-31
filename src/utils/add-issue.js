#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const inquirer = require('inquirer');
const chalk = require('chalk');

async function addIssueToMapping() {
  console.log(chalk.blue.bold('\n📝 Add Issue to Static Mapping'));
  console.log(chalk.gray('Add a new JIRA issue to your config.yaml mapping\n'));

  try {
    // Load current config
    const path = require('path');
    const configPath = path.join(__dirname, '../../config.yaml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);

    // Ensure issueMapping exists
    if (!config.issueMapping) {
      config.issueMapping = {};
    }

    // Get issue details
    const issueDetails = await inquirer.prompt([
      {
        type: 'input',
        name: 'issueKey',
        message: 'Enter JIRA issue key (e.g., PROJ-123):',
        validate: (input) => {
          if (!input.trim()) return 'Issue key is required';
          if (!/^[A-Z]+-\d+$/i.test(input.trim())) {
            return 'Issue key must be in format: PROJ-123';
          }
          if (config.issueMapping[input.trim()]) {
            return 'Issue already exists in mapping';
          }
          return true;
        },
        filter: (input) => input.trim().toUpperCase()
      },
      {
        type: 'input',
        name: 'issueId',
        message: 'Enter issue ID (numerical ID from JIRA):',
        validate: (input) => {
          if (!input.trim()) return 'Issue ID is required';
          if (!/^\d+$/.test(input.trim())) {
            return 'Issue ID should be numerical';
          }
          return true;
        },
        filter: (input) => input.trim()
      },
      {
        type: 'input',
        name: 'summary',
        message: 'Enter issue summary/description:',
        validate: (input) => input.trim() ? true : 'Summary is required',
        filter: (input) => input.trim()
      }
    ]);

    // Add to mapping
    config.issueMapping[issueDetails.issueKey] = {
      id: issueDetails.issueId,
      summary: issueDetails.summary
    };

    // Save back to file
    const updatedYaml = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noCompatMode: true
    });

    fs.writeFileSync(configPath, updatedYaml);

    console.log(chalk.green(`\n✅ Added ${issueDetails.issueKey} to issue mapping!`));
    console.log(chalk.white(`Issue ID: ${issueDetails.issueId}`));
    console.log(chalk.white(`Summary: ${issueDetails.summary}`));
    console.log(chalk.gray(`\nYou can now use ${issueDetails.issueKey} in your CSV imports.`));

  } catch (error) {
    console.error(chalk.red('Failed to add issue:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  addIssueToMapping();
}

module.exports = { addIssueToMapping };