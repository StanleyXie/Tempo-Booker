# Changelog

All notable changes to the Tempo Booker CLI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2025-10-31

### Fixed

- **🔧 Backup File Path Resolution**: Fixed unreachable backup file path error when clearing worklogs
  - Updated `exportWorklogs()` to properly handle absolute file paths
  - Added automatic backup directory creation in clear worklogs flow
  - Backup files now correctly saved to workspace backup directory

- **📂 Config Loading Priority**: Fixed configuration loading to prioritize user's actual workspace
  - Now checks `~/Documents/tempo-workspace/config.yaml` first
  - Eliminated circular dependency in workspace directory resolution
  - Ensures correct config is loaded on every startup

- **🔄 Issue Resolver Cache**: Enhanced cache management for better config reload
  - Added static issue resolver cache clearing on application startup
  - Prevents stale issue mapping data after config changes
  - Ensures fresh issue mappings are loaded on every app restart

### Changed

- **📁 Path Handling**: Improved absolute vs relative path detection in export operations
- **🎯 Config Discovery**: Updated config file search order for better user experience
  - Priority: Documents workspace → Home workspace → Current directory → App directory
- **💾 Cache Management**: Enhanced startup initialization to clear all relevant caches

### Technical Details

- Fixed `src/controllers/timeTrackingController.js` - Smart path handling for exports
- Fixed `src/utils/cli.js` - Explicit backup directory creation before clear operations
- Fixed `src/utils/config.js` - Improved config loading priority logic
- Fixed `src/index.js` - Added issue resolver cache clearing on startup

## [1.1.3] - 2025-09-07

### Added

- **📋 Issue Reference Display**: Added issue mapping reference with summaries to time table for better user context
- **🔄 Config Cache Refresh**: Implemented config cache clearing on every application startup

### Fixed

- **🗂️ Proper Issue Filtering**: Updated detailed list to use issue key/ID filtering instead of description pattern matching
- **⚡ Fresh Config Loading**: Ensured config.yaml changes are immediately reflected without restart

### Changed

- **🎯 Enhanced User Experience**: Time table now shows issue summaries for easy reference
- **📊 Cleaner Data Model**: Removed dependency on description text parsing for issue identification

## [1.1.2] - 2025-09-07

### Fixed

- **📝 Detailed List Function**: Fixed "Failed to generate detailed list" error caused by undefined log variable
- **🔧 Logger Integration**: Properly integrated logger parameter in printDetailedList method

### Changed

- **Error Handling**: Improved error handling in detailed worklog list functionality

## [1.1.1] - 2025-09-07

### Fixed

- **📅 Week Consistency**: Fixed inconsistent week calculations between time table and import operations
- **🗓️ Monday-Sunday Standard**: All week operations now consistently use Monday-Sunday (ISO week) format
- **📋 Date Range Display**: Added actual date ranges to all week choice displays (e.g., "Current week (Sep 01 - Sep 07)")

### Changed

- **Time Table View**: Week ranges now align with import date scopes
- **Import Operations**: Consistent Monday-Sunday week calculation across all date scope options
- **User Interface**: Week choices show actual dates for better clarity and decision making

## [1.0.3] - 2025-09-02

### Fixed

- **🔧 Issue ID Resolution**: Fixed incorrect issue ID mapping for ITST-14455 (365400 → 365582)
- **📋 Configuration Management**: Resolved workspace-specific config file precedence issue
- **🧩 Cache Management**: Added proper cache clearing for static issue resolver
- **✅ Import Success**: Fixed CSV import failures due to cached incorrect issue IDs
- **🔍 Issue Discovery**: Enhanced issue ID discovery through existing worklog analysis

### Improved

- **Configuration System**: Better handling of multiple config file locations
- **Error Reporting**: More specific error messages during issue resolution
- **Debug Information**: Enhanced troubleshooting with clear issue ID resolution paths
- **Import Reliability**: More robust handling of issue ID validation and correction

### Technical Details

- Fixed workspace config (`/tempo-workspace/config.yaml`) taking precedence over project config
- Added cache invalidation for Node.js module system after config changes
- Improved issue ID discovery by analyzing existing worklog patterns
- Enhanced static issue resolver with better cache management

## [1.0.2] - 2025-09-01

### Added

- **🤖 Automatic Account ID Retrieval**: New intelligent system to automatically discover your Atlassian Account ID using Tempo API
- **🔍 Enhanced Account ID Discovery**: Multiple discovery methods with comprehensive guidance
- **📝 Static Issue Mapping Guide**: Complete documentation for managing issue mappings without API complexity
- **⚡ Simplified Setup Wizard**: Streamlined setup process focused on essential configuration only
- **🛠️ New Utility Scripts**:
  - `get-account-id.js` - Automatic Account ID retrieval
  - `find-account-id.js` - Manual Account ID discovery
  - Enhanced `add-issue.js` - Static issue mapping management

### Improved

- **Setup Process**: Removed complex JIRA API token requirements - now uses Tempo token only
- **User Discovery**: Multi-method approach for finding Account ID (worklogs, user endpoint, teams)
- **Error Handling**: Better feedback and guidance when automatic discovery fails
- **Configuration Templates**: Enhanced config.yaml with better guidance and examples
- **Help System**: Updated help text with new utility commands and workflows

### Simplified

- **API Requirements**: No JIRA API tokens needed - Tempo token only
- **Setup Flow**: 3-step setup instead of complex multi-mode configuration
- **User Experience**: Clearer guidance and fewer confusing options
- **Documentation**: Focused on static mapping approach with version control support

### Technical Improvements

- **Account ID Discovery**: Three-tier discovery system (worklogs analysis, user endpoint, team membership)
- **API Optimization**: Smarter API usage with better error handling
- **Fallback Systems**: Comprehensive fallback chain for edge cases
- **File Management**: Option to save discovered account information

### Breaking Changes

- Removed complex setup mode selections - now single simplified flow
- Eliminated JIRA API token complexity from setup wizard
- Streamlined configuration structure focused on static mapping

## [1.0.1] - 2025-08-30

### Fixed

- Package configuration for NPM publication
- Security sanitization of configuration templates

## [1.0.0] - 2025-08-30

### Added

- **Initial Release**: Complete CLI tool for Tempo time tracking
- **CSV Import**: Import worklogs with auto-calculated hours from time ranges
- **Time Conflict Validation**: Automatically detects overlapping time entries
- **MCP Integration**: Dynamic JIRA issue ID resolution using Atlassian MCP
- **CRUD Operations**: Create, Read, Update, Delete worklogs with duplicate detection
- **Delete Operations**: Mark entries for deletion using a `delete` column
- **Clean CLI Output**: Multi-level logging system with configurable verbosity
- **Silent Mode**: Command-line automation support with date scope filtering
- **Configuration System**: YAML-based configuration for user settings and issue mappings
- **Interactive CLI**: User-friendly menu-driven interface
- **Quick Logging**: Fast command-line time logging
- **Time Table View**: Comprehensive time tracking visualization
- **Export Functionality**: Export worklogs to CSV format

### Features

- **CSV Format**: `date,startTime,endTime,issue,description,delete`
- **Auto-calculated Hours**: No manual hour calculations needed
- **Date Scopes**: Support for current-week, last-7-days, this-month, all
- **Error Handling**: Comprehensive error reporting and recovery
- **Rate Limiting**: Built-in API rate limiting protection
- **Logging**: File-based logging with clean console output
- **Cross-platform**: Works on Windows, macOS, and Linux

### Technical Implementation

- **Node.js CLI**: Production-ready command-line interface
- **Tempo API Integration**: Full Tempo REST API support
- **MCP Protocol**: Model Context Protocol for issue resolution
- **Moment.js**: Date and time manipulation
- **Inquirer.js**: Interactive CLI prompts
- **Chalk**: Colored console output
- **YAML Configuration**: Human-readable configuration files
- **Axios**: HTTP client with error handling

### Configuration

- **Multi-level Logging**: error, warn, info, debug, transaction, system levels
- **Output Control**: Normal, debug, and silent output modes
- **User Settings**: Configurable user account and preferences
- **Issue Mappings**: Dynamic JIRA issue key to ID mapping

### Requirements

- Node.js >= 14.0.0
- Valid Tempo API token
- Atlassian MCP installed and authenticated
- JIRA access permissions for target issues

### CLI Commands

- `tempo-booker` - Interactive mode
- `tempo-booker quick <issue> <hours> [description]` - Quick logging
- `tempo-booker import [file] [scope]` - Silent import
- `tempo-booker --help` - Show help information

### Workflow Operations

- **ADD**: New worklogs not in Tempo
- **UPDATE**: Existing worklogs with different hours/description
- **DELETE**: Worklogs marked with delete=true
- **NO CHANGE**: Existing worklogs that match exactly

---

**Note**: This is the first public release of Tempo Booker CLI. The project has been in development and testing since August 2025, with comprehensive feature development and troubleshooting completed.
