# Tempo Time Tracking CLI - Import Rules & Validation Guide

## 📋 Overview

This guide provides comprehensive documentation for CSV import rules, data validation requirements, and best practices for using the Tempo Time Tracking CLI. Understanding these rules ensures successful data imports and prevents common errors.

## 📄 CSV Format Requirements

### Standard CSV Format
```csv
date,startTime,endTime,issue,description
2025-08-25,09:00:00,11:00:00,ITST-14440,Working on feature implementation
2025-08-25,11:00:00,11:30:00,DAU-2655,Team daily standup
2025-08-25,13:00:00,17:00:00,ITST-14440,Bug fixing and testing
```

### Extended CSV Format (with Delete Operations)
```csv
date,startTime,endTime,issue,description,delete
2025-08-25,09:00:00,11:00:00,ITST-14440,Working on feature,
2025-08-25,11:00:00,11:30:00,DAU-2655,Team meeting,
2025-08-25,14:00:00,15:00:00,ITST-14439,Remove this entry,true
```

### Column Definitions

| Column | Required | Format | Description | Example |
|--------|----------|--------|-------------|---------|
| `date` | ✅ Yes | `YYYY-MM-DD` | Work date | `2025-08-25` |
| `startTime` | ✅ Yes | `HH:mm:ss` | Start time (24-hour format) | `09:00:00` |
| `endTime` | ✅ Yes | `HH:mm:ss` | End time (24-hour format) | `11:00:00` |
| `issue` | ✅ Yes | `PROJECT-NUMBER` | JIRA issue key | `ITST-14440` |
| `description` | ✅ Yes | Text | Work description | `Feature development` |
| `delete` | ❌ No | `true`/`false`/`1`/`0` | Mark for deletion | `true` |

## ✅ Data Validation Rules

### 1. Date Validation Rules

#### Valid Date Formats
- ✅ `2025-08-25` (ISO 8601 format)
- ✅ `2025-12-31` (Valid calendar date)
- ✅ `2024-02-29` (Valid leap year date)

#### Invalid Date Formats
- ❌ `25-08-2025` (Wrong order)
- ❌ `2025/08/25` (Wrong separators)  
- ❌ `2025-13-45` (Invalid month/day)
- ❌ `Aug 25, 2025` (Wrong format)

#### Date Range Validation
```javascript
// Date must be within reasonable bounds
const MIN_DATE = '2020-01-01';  // No entries before 2020
const MAX_DATE = '2030-12-31';  // No entries beyond 2030

// Warning for dates outside normal range
if (date < '2024-01-01') {
  console.warn('⚠️ Old date detected - verify accuracy');
}
```

### 2. Time Validation Rules

#### Valid Time Formats
- ✅ `09:00:00` (Standard format)
- ✅ `23:59:59` (End of day)
- ✅ `00:00:00` (Start of day)
- ✅ `12:30:45` (With seconds)

#### Invalid Time Formats
- ❌ `9:00:00` (Missing leading zero)
- ❌ `09:00` (Missing seconds)
- ❌ `25:00:00` (Invalid hour)
- ❌ `12:60:00` (Invalid minutes)
- ❌ `12:30:60` (Invalid seconds)

#### Time Range Validation
```javascript
// Time range validation rules
function validateTimeRange(startTime, endTime) {
  const rules = [
    {
      rule: 'Start time must be before end time',
      validate: (start, end) => start < end,
      error: 'End time must be after start time'
    },
    {
      rule: 'Maximum 24 hours per entry', 
      validate: (start, end) => calculateHours(start, end) <= 24,
      error: 'Single worklog cannot exceed 24 hours'
    },
    {
      rule: 'Minimum 15 minutes per entry',
      validate: (start, end) => calculateHours(start, end) >= 0.25,
      error: 'Minimum 15 minutes required per worklog'
    }
  ];
  
  return rules.map(r => r.validate(startTime, endTime) || r.error);
}
```

### 3. Issue Key Validation

#### Valid Issue Key Formats
- ✅ `ITST-14440` (Standard project-number format)
- ✅ `DAU-2655` (Different project)
- ✅ `ABC-123` (3+ letter project code)
- ✅ `MYPROJECT-999999` (Long project name)

#### Invalid Issue Key Formats
- ❌ `ITST14440` (Missing separator)
- ❌ `14440` (Missing project code)
- ❌ `ITST-` (Missing issue number)
- ❌ `IT-14440` (Too short project code)

#### Issue Resolution Process
```javascript
// Issue resolution workflow
async function resolveIssue(issueKey) {
  // Step 1: Check known mappings (fast)
  if (knownMappings.has(issueKey)) {
    return knownMappings.get(issueKey);
  }
  
  // Step 2: Query via MCP (reliable)
  try {
    const issue = await mcpService.getIssueDetails(issueKey);
    if (issue) {
      knownMappings.set(issueKey, issue);
      return issue;
    }
  } catch (error) {
    console.warn(`MCP lookup failed for ${issueKey}: ${error.message}`);
  }
  
  // Step 3: Validation failure
  throw new ValidationError(`Issue ${issueKey} not found or inaccessible`);
}
```

### 4. Description Validation

#### Valid Descriptions
- ✅ `Working on feature implementation` (Descriptive)
- ✅ `Bug fix for user authentication` (Specific)
- ✅ `Team daily standup meeting` (Clear purpose)
- ✅ `Code review and testing` (Multiple activities)

#### Description Best Practices
- **Minimum Length:** 5 characters
- **Maximum Length:** 1000 characters (API limit)
- **Content Guidelines:**
  - Be specific about work performed
  - Avoid sensitive information
  - Use professional language
  - Include relevant context

#### Auto-generated Descriptions
```javascript
// When description is minimal, auto-enhance if requested
function enhanceDescription(originalDesc, issueKey) {
  const templates = {
    development: `Working on ${issueKey}: ${originalDesc}`,
    meeting: `${originalDesc} (${issueKey} related)`,
    testing: `Testing and QA for ${issueKey}: ${originalDesc}`
  };
  
  // Pattern matching for auto-enhancement
  if (originalDesc.length < 10) {
    return templates.development;
  }
  
  return originalDesc;
}
```

## 🔍 Conflict Detection & Resolution

### Time Conflict Types

#### 1. Complete Overlap
```csv
date,startTime,endTime,issue,description
2025-08-25,09:00:00,11:00:00,ITST-14440,Work A
2025-08-25,09:00:00,11:00:00,ITST-14441,Work B  # ❌ Complete overlap
```

#### 2. Partial Overlap  
```csv
date,startTime,endTime,issue,description
2025-08-25,09:00:00,11:00:00,ITST-14440,Work A
2025-08-25,10:00:00,12:00:00,ITST-14441,Work B  # ❌ 1 hour overlap
```

#### 3. Adjacent Times (Valid)
```csv
date,startTime,endTime,issue,description
2025-08-25,09:00:00,11:00:00,ITST-14440,Work A
2025-08-25,11:00:00,12:00:00,ITST-14441,Work B  # ✅ No overlap
```

### Conflict Resolution Strategies

#### 1. Import Priority (Default)
- **Rule:** Import data always wins over existing data
- **Action:** Replace conflicting existing entries with import data
- **Use Case:** Correcting previously logged time

```javascript
// REPLACE operation example
{
  operation: 'REPLACE',
  import: { /* new worklog data */ },
  conflictingWorklogs: [ /* existing entries to delete */ ]
}
```

#### 2. Skip Conflicting Entries
- **Rule:** Skip import entries that conflict with existing data
- **Action:** Leave existing data unchanged
- **Use Case:** Avoiding accidental overwrites

#### 3. Manual Resolution Required
- **Rule:** Stop import and require user decision
- **Action:** Display conflicts and request user input
- **Use Case:** Critical data that needs review

### Perfect Match Detection

#### Exact Match Criteria
All fields must match exactly:
- ✅ Same date (`startDate`)
- ✅ Same start time (`startTime`) 
- ✅ Same duration (`hours` calculated from time range)
- ✅ Same issue key (`issueKey`)
- ✅ Same description (`description`)

#### Perfect Match Result
```javascript
// When perfect match is detected
{
  operation: 'NO_CHANGE',
  reason: 'perfect match',
  message: 'Entry already exists with identical values'
}
```

## 🚫 Data Quality Rules

### 1. Daily Time Limits

#### Reasonable Daily Hours
```javascript
const DAILY_LIMITS = {
  WARNING_THRESHOLD: 8,    // Warn if > 8 hours per day
  MAXIMUM_ALLOWED: 24,     // Hard limit: 24 hours per day
  TYPICAL_WORKDAY: 8       // Standard work day reference
};

function validateDailyHours(date, worklogs) {
  const dayTotal = worklogs
    .filter(w => w.startDate === date)
    .reduce((sum, w) => sum + w.hours, 0);
  
  if (dayTotal > DAILY_LIMITS.WARNING_THRESHOLD) {
    console.warn(`⚠️ ${dayTotal}h logged on ${date} - verify accuracy`);
  }
  
  if (dayTotal > DAILY_LIMITS.MAXIMUM_ALLOWED) {
    throw new ValidationError(`Daily limit exceeded: ${dayTotal}h on ${date}`);
  }
}
```

### 2. Issue Access Validation

#### Permission Checking
```javascript
async function validateIssueAccess(issueKey, userAccountId) {
  try {
    const issue = await mcpService.getIssueDetails(issueKey);
    
    // Check if user has permission to log work
    const hasAccess = await mcpService.checkWorklogPermission(
      issue.id, 
      userAccountId
    );
    
    if (!hasAccess) {
      throw new ValidationError(
        `No permission to log work on ${issueKey}`
      );
    }
    
    return issue;
  } catch (error) {
    throw new ValidationError(`Issue validation failed: ${error.message}`);
  }
}
```

### 3. Historical Data Validation

#### Age-based Restrictions
```javascript
const AGE_RESTRICTIONS = {
  MAX_DAYS_OLD: 90,        // Cannot modify entries older than 90 days
  WARNING_DAYS: 30,        // Warn for entries older than 30 days
  SYSTEM_PROTECTED: 365    // System entries protected after 1 year
};

function validateWorklogAge(startDate) {
  const age = moment().diff(moment(startDate), 'days');
  
  if (age > AGE_RESTRICTIONS.MAX_DAYS_OLD) {
    throw new ValidationError(
      `Cannot modify worklog older than ${AGE_RESTRICTIONS.MAX_DAYS_OLD} days`
    );
  }
  
  if (age > AGE_RESTRICTIONS.WARNING_DAYS) {
    console.warn(`⚠️ Modifying old worklog from ${startDate} (${age} days ago)`);
  }
}
```

## 📊 Import Operations Classification

### Operation Types

#### 1. ADD Operations
- **Trigger:** No existing worklog matches date+time+issue
- **Action:** Create new worklog entry
- **Validation:** Standard validation rules apply

```javascript
// ADD operation criteria
function isAddOperation(importEntry, existingWorklogs) {
  const key = `${importEntry.startDate}|${importEntry.startTime}|${importEntry.issueKey}`;
  return !existingWorklogs.has(key);
}
```

#### 2. UPDATE Operations  
- **Trigger:** Exact match found but values differ
- **Action:** Update existing worklog with new values
- **Validation:** Compare all fields for changes

```javascript
// UPDATE operation criteria
function isUpdateOperation(importEntry, existingEntry) {
  return (
    importEntry.hours !== existingEntry.timeSpentSeconds / 3600 ||
    importEntry.description !== existingEntry.description ||
    importEntry.startTime !== existingEntry.startTime
  );
}
```

#### 3. DELETE Operations
- **Trigger:** Delete flag set in CSV (`delete=true`)
- **Action:** Remove existing worklog entry
- **Validation:** Verify worklog exists and is deleteable

```javascript
// DELETE operation criteria
function isDeleteOperation(importEntry) {
  const deleteFlags = ['true', '1', 'yes', 'Y'];
  return deleteFlags.includes(String(importEntry.delete).toLowerCase());
}
```

#### 4. REPLACE Operations
- **Trigger:** Time conflicts with existing entries
- **Action:** Delete conflicting entries + create new entry
- **Validation:** Ensure conflicts are resolvable

```javascript
// REPLACE operation criteria  
function isReplaceOperation(importEntry, existingWorklogs) {
  const conflicts = findTimeConflicts(importEntry, existingWorklogs);
  return conflicts.length > 0;
}
```

#### 5. NO CHANGE Operations
- **Trigger:** Perfect match with existing worklog
- **Action:** Skip processing (no API calls needed)
- **Validation:** All field values identical

## 🔧 Advanced Validation Features

### 1. System Worklog Filtering

#### Automatic Exclusion Rules
```javascript
// System worklogs are automatically filtered out
const SYSTEM_FILTERS = [
  {
    field: 'author.accountId',
    value: '__tempo-io__unknown_user',
    action: 'exclude',
    reason: 'System generated worklog (undeleteable)'
  },
  {
    field: 'startDate', 
    operator: '<',
    value: '2025-01-01',
    action: 'exclude_unless_user_owned',
    reason: 'Old worklog with potential permission issues'
  }
];
```

#### Benefits of System Filtering
- ✅ **Performance:** Eliminates processing of undeleteable entries
- ✅ **Accuracy:** Prevents false conflict detection  
- ✅ **User Experience:** Cleaner operation summaries
- ✅ **API Efficiency:** Reduces unnecessary API calls

### 2. Smart Conflict Resolution

#### Priority-based Resolution
```javascript
const CONFLICT_RESOLUTION_PRIORITY = [
  {
    priority: 1,
    rule: 'Import data always wins',
    description: 'Replace existing data with import data'
  },
  {
    priority: 2, 
    rule: 'User-owned data takes precedence',
    description: 'Prefer data owned by current user'
  },
  {
    priority: 3,
    rule: 'Most recent data wins',
    description: 'Use most recently created/updated entry'
  }
];
```

### 3. Validation Performance Optimization

#### Multi-stage Validation Pipeline
```javascript
const VALIDATION_PIPELINE = [
  // Stage 1: Format validation (fast)
  validateCSVFormat,
  validateDateFormats,  
  validateTimeFormats,
  validateRequiredFields,
  
  // Stage 2: Business rules (medium)
  validateTimeRanges,
  calculateWorklogHours,
  detectInternalConflicts,
  
  // Stage 3: External validation (slow)
  resolveIssueKeys,
  validatePermissions,
  detectExternalConflicts,
  
  // Stage 4: Final preparation
  categorizeOperations,
  generateExecutionPlan
];
```

## 📋 Best Practices & Recommendations

### CSV File Preparation

#### 1. Data Organization
- **Sort by date and time** for easier review
- **Group related work** by issue when possible
- **Use consistent descriptions** for similar work
- **Include all required columns** in correct order

#### 2. Quality Checks Before Import
```bash
# Pre-import checklist
□ All dates in YYYY-MM-DD format
□ All times in HH:mm:ss format (24-hour)
□ All issue keys valid and accessible
□ No overlapping time ranges
□ Descriptions meaningful and appropriate
□ Total daily hours reasonable (< 12h typically)
```

#### 3. File Size Recommendations
- **Optimal:** 50-100 entries per file
- **Maximum:** 1000 entries per file
- **Split large datasets** by week or month
- **Use consistent naming** (e.g., `tempo-2025-week-34.csv`)

### Error Prevention Strategies

#### 1. Incremental Imports
```javascript
// Import strategy for large datasets
const IMPORT_STRATEGY = {
  smallBatch: '1-10 entries: Direct import',
  mediumBatch: '11-50 entries: Review preview first', 
  largeBatch: '51+ entries: Split into weekly chunks',
  hugeBatch: '500+ entries: Daily chunks + validation breaks'
};
```

#### 2. Dry Run Practice
- **Always preview first** with new data sources
- **Verify operation counts** match expectations
- **Check conflict resolution** is appropriate
- **Confirm issue key resolution** works correctly

#### 3. Backup Strategy
- **Export existing data** before large imports
- **Keep original CSV files** as backup
- **Document changes made** for audit trail
- **Test restore procedures** regularly

### Performance Optimization Tips

#### 1. API Efficiency
- **Batch similar operations** when possible
- **Respect rate limiting** (300ms between calls)
- **Use date filtering** to limit data scope
- **Cache issue resolutions** during session

#### 2. Memory Management
- **Process large files in chunks** (100-entry batches)
- **Clear processed data** from memory
- **Monitor memory usage** during imports
- **Restart application** for very large operations

#### 3. Network Optimization
- **Stable internet connection** required
- **Avoid peak usage times** if possible
- **Use wired connection** for large imports
- **Have retry strategy** for network issues

---

## 🚨 Common Issues & Troubleshooting

### Frequent Error Scenarios

#### 1. Time Format Issues
```
❌ Error: Invalid time format '9:00:00'
✅ Solution: Use '09:00:00' (leading zeros required)

❌ Error: End time before start time
✅ Solution: Check time order, consider cross-midnight ranges

❌ Error: Invalid time range
✅ Solution: Verify HH:mm:ss format for both start and end times
```

#### 2. Issue Resolution Failures
```
❌ Error: Issue 'ITST-99999' not found
✅ Solution: Verify issue exists and you have access

❌ Error: MCP lookup failed
✅ Solution: Check network connection and MCP service status

❌ Error: No permission to log work
✅ Solution: Confirm project access and worklog permissions
```

#### 3. Conflict Resolution Issues
```
❌ Error: Overlapping time ranges detected
✅ Solution: Review conflicts and choose resolution strategy

❌ Error: Cannot delete existing worklog
✅ Solution: Check worklog age and deletion permissions

❌ Error: Daily hour limit exceeded
✅ Solution: Review daily totals and split if necessary
```

### Debugging Tools

#### 1. Verbose Logging
```bash
# Enable detailed logging for troubleshooting
LOG_LEVEL=debug node src/index.js

# Check log files for detailed error information
tail -f logs/tempo-cli.log
```

#### 2. Validation-only Mode
```javascript
// Test data validation without making changes
await controller.importWorklogs('test.csv', true); // dryRun = true
```

#### 3. API Response Inspection
```javascript
// Enable API response logging for debugging
DEBUG_API=true node src/index.js
```

---

**Document Version:** 1.0  
**Last Updated:** August 28, 2025  
**Validation Coverage:** All rules implemented and tested  
**Next Review:** September 2025  
**Status:** ✅ Production Ready