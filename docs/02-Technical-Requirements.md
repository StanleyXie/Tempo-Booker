# Tempo Time Tracking CLI - Technical Requirements Definition

## 🛠️ Technical Overview

**System Architecture:** Node.js CLI Application with MCP Integration  
**Primary Technology Stack:** JavaScript (ES2020+), Node.js, Axios, Moment.js  
**Integration Pattern:** REST API + MCP Protocol  
**Deployment Model:** Local CLI tool with remote API dependencies  

## 🏗️ System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Interface │───▶│  Core Controller │───▶│  External APIs  │
│                 │    │                  │    │                 │
│ • Interactive   │    │ • Validation     │    │ • Tempo API     │
│ • File I/O      │    │ • Processing     │    │ • JIRA API      │
│ • Progress UI   │    │ • Error Handling │    │ • Atlassian MCP │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Data Models   │    │    Services      │    │  Configuration  │
│                 │    │                  │    │                 │
│ • Worklog       │    │ • TempoAPI       │    │ • API Keys      │
│ • TimeRange     │    │ • MCPJira        │    │ • Endpoints     │
│ • Operation     │    │ • FileHandler    │    │ • User Settings │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Component Architecture

#### 1. Presentation Layer
- **CLI Interface**: Interactive menu system using `inquirer`
- **Progress Indicators**: Real-time feedback for long operations
- **Error Display**: Formatted error messages with color coding
- **File I/O**: CSV reading/writing with validation

#### 2. Business Logic Layer
- **Time Tracking Controller**: Core orchestration logic
- **Validation Engine**: Time conflict and data integrity checks
- **Operation Categorizer**: Smart worklog operation classification
- **Conflict Resolver**: Priority-based conflict resolution

#### 3. Service Layer
- **Tempo API Service**: REST API integration with rate limiting
- **MCP JIRA Service**: Model Context Protocol for issue resolution
- **File Handler Service**: CSV parsing and data transformation
- **Configuration Manager**: Settings and credential management

#### 4. Data Layer
- **Worklog Models**: Data structures and validation
- **Time Utilities**: Time calculation and manipulation
- **API Mappers**: Data transformation between formats

## 🔧 Technical Specifications

### Runtime Requirements
- **Node.js Version:** >= 16.0.0 (LTS recommended)
- **NPM Version:** >= 8.0.0
- **Memory Requirements:** 512MB RAM minimum, 1GB recommended
- **Disk Space:** 100MB for application + logs
- **Network:** Internet connectivity for API access

### Core Dependencies
```json
{
  "dependencies": {
    "axios": "^1.4.0",           // HTTP client for API calls
    "moment": "^2.29.0",         // Time/date manipulation
    "inquirer": "^9.2.0",        // Interactive CLI prompts
    "chalk": "^5.3.0",           // Terminal coloring
    "csv-parser": "^3.0.0",      // CSV file processing
    "dotenv": "^16.3.0",         // Environment configuration
    "commander": "^11.0.0"       // CLI argument parsing
  },
  "devDependencies": {
    "jest": "^29.6.0",           // Testing framework
    "eslint": "^8.45.0",         // Code linting
    "nodemon": "^3.0.0"          // Development server
  }
}
```

### API Integration Specifications

#### Tempo API Integration
- **Base URL:** `https://api.tempo.io/4/`
- **Authentication:** Bearer Token (stored in .env)
- **Rate Limiting:** 300ms between requests
- **Timeout:** 30 seconds per request
- **Retry Policy:** 3 attempts with exponential backoff

```javascript
// API Client Configuration
const tempoClient = axios.create({
  baseURL: 'https://api.tempo.io/4/',
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${process.env.TEMPO_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});
```

#### MCP Integration
- **Protocol:** Model Context Protocol via Atlassian MCP
- **Authentication:** Handled by MCP client
- **Issue Resolution:** Real-time JIRA issue lookup
- **Fallback Strategy:** Known issue mappings + manual resolution

#### JIRA API (via MCP)
- **Issue Validation:** Verify issue existence and permissions
- **Metadata Retrieval:** Issue keys, summaries, project info
- **Permission Checking:** User access validation

## 📊 Data Models & Schemas

### Worklog Data Model
```typescript
interface Worklog {
  // Core fields
  startDate: string;          // YYYY-MM-DD format
  startTime: string;          // HH:mm:ss format
  endTime?: string;           // HH:mm:ss format (for auto-calc)
  hours: number;              // Calculated or explicit hours
  issueKey: string;           // JIRA issue key (e.g., ITST-14440)
  description: string;        // Work description
  
  // Optional fields
  shouldDelete?: boolean;     // Delete flag from CSV
  authorAccountId?: string;   // User account ID
  tempoWorklogId?: number;    // Existing worklog ID (for updates)
  
  // Validation flags
  validated?: boolean;        // Passed validation checks
  conflictsWith?: Worklog[];  // Conflicting entries
}
```

### CSV Schema Definition
```csv
# Required Columns
date,startTime,endTime,issue,description

# Optional Columns
date,startTime,endTime,issue,description,delete

# Example Row
2025-08-25,09:00:00,11:00:00,ITST-14440,Working on feature implementation
```

### API Response Models
```typescript
interface TempoWorklogResponse {
  self: string;
  tempoWorklogId: number;
  issue: {
    self: string;
    id: number;
    key?: string;
  };
  timeSpentSeconds: number;
  billableSeconds: number;
  startDate: string;
  startTime: string;
  startDateTimeUtc?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  author: {
    self: string;
    accountId: string;
    displayName?: string;
  };
  attributes: {
    self: string;
    values: any[];
  };
}
```

## 🔐 Security Requirements

### Authentication & Authorization
- **API Token Storage:** Environment variables only (.env file)
- **Token Encryption:** Not stored in plaintext in logs
- **Permission Validation:** Verify user permissions before operations
- **Audit Trail:** Log all operations with user context

### Data Security
- **Input Sanitization:** All CSV and CLI inputs validated
- **SQL Injection Prevention:** Parameterized queries (if applicable)
- **File Access Control:** Restricted to specified directories
- **Sensitive Data Handling:** No API tokens or credentials in logs

### Network Security
- **HTTPS Only:** All API communications over TLS
- **Certificate Validation:** Verify SSL certificates
- **Rate Limiting Compliance:** Respect API rate limits
- **Timeout Configuration:** Prevent hanging connections

## ⚡ Performance Requirements

### Response Time Targets
- **CLI Startup:** < 2 seconds
- **File Validation:** < 5 seconds for 100 entries
- **API Operations:** < 30 seconds for 50 worklogs
- **Data Export:** < 10 seconds for monthly data

### Throughput Requirements
- **Concurrent API Calls:** Maximum 10 parallel requests
- **Rate Limiting:** 300ms between Tempo API calls
- **Memory Usage:** < 500MB during large imports
- **File Processing:** Support up to 1000 entries per CSV

### Optimization Strategies
- **API Batching:** Group similar operations
- **Caching:** Cache issue ID mappings during session
- **Streaming:** Process large files in chunks
- **Connection Pooling:** Reuse HTTP connections

## 🛡️ Error Handling & Resilience

### Error Categories
1. **Validation Errors:** Invalid data formats, conflicts
2. **API Errors:** Network issues, authentication failures
3. **Permission Errors:** Insufficient access rights
4. **System Errors:** File I/O issues, memory problems

### Error Handling Strategy
```javascript
class TempoError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Error Types
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  API: 'API_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  SYSTEM: 'SYSTEM_ERROR'
};
```

### Retry Mechanisms
- **API Failures:** 3 retries with exponential backoff
- **Network Issues:** Progressive timeout increases
- **Rate Limiting:** Automatic delay adjustment
- **Partial Failures:** Continue processing remaining items

### Logging Strategy
- **Debug Level:** Detailed API requests/responses
- **Info Level:** Operation summaries and progress
- **Warn Level:** Recoverable errors and conflicts
- **Error Level:** Critical failures requiring attention

## 🧪 Testing Requirements

### Unit Testing
- **Coverage Target:** > 90% code coverage
- **Framework:** Jest with mocking capabilities
- **Test Categories:**
  - Data validation functions
  - Time calculation utilities
  - API service methods
  - Error handling scenarios

### Integration Testing
- **API Integration:** Test with mock Tempo/JIRA APIs
- **File Processing:** Test with various CSV formats
- **End-to-End:** Complete import workflows
- **Performance Testing:** Large dataset processing

### Test Data Requirements
- **Sample CSV Files:** Various formats and edge cases
- **Mock API Responses:** Realistic Tempo/JIRA data
- **Error Scenarios:** Network failures, validation errors
- **Performance Data:** Large datasets for stress testing

## 🚀 Deployment & Operations

### Installation Requirements
```bash
# Prerequisites
node --version    # >= 16.0.0
npm --version     # >= 8.0.0

# Installation
npm install -g tempo-time-tracker-cli
# OR local installation
git clone <repository>
npm install
```

### Configuration Management
```bash
# Environment Configuration
TEMPO_API_TOKEN=your_tempo_api_token
TEMPO_BASE_URL=https://api.tempo.io/4
MCP_ENDPOINT=your_mcp_endpoint
LOG_LEVEL=info
MAX_RETRY_ATTEMPTS=3
```

### Monitoring & Maintenance
- **Log Rotation:** Daily log files with 30-day retention
- **Performance Monitoring:** API response times and success rates
- **Error Tracking:** Automated error reporting and alerting
- **Version Management:** Semantic versioning with update notifications

## 📱 Platform Compatibility

### Operating Systems
- **Windows:** 10+ (PowerShell, Command Prompt)
- **macOS:** 10.15+ (Terminal, iTerm2)
- **Linux:** Ubuntu 18+, CentOS 7+ (bash, zsh)

### Terminal Compatibility
- **Color Support:** 256-color terminals preferred
- **Unicode Support:** UTF-8 encoding required
- **Screen Size:** Minimum 80x24 characters
- **Interactive Features:** Keyboard input and cursor control

## 🔄 Integration Patterns

### API Communication Pattern
```javascript
// Standardized API call pattern
async function apiCall(endpoint, method, data = null) {
  try {
    const response = await httpClient.request({
      url: endpoint,
      method: method,
      data: data,
      timeout: 30000
    });
    
    await rateLimiter.wait(); // Enforce rate limiting
    return response.data;
    
  } catch (error) {
    if (error.response?.status === 429) {
      // Rate limit exceeded - wait and retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      return apiCall(endpoint, method, data);
    }
    throw new APIError(error.response?.status, error.message);
  }
}
```

### Data Transformation Pipeline
```javascript
// CSV → Internal Model → API Payload
const transformationPipeline = [
  validateCSVFormat,
  parseTimeRanges,
  calculateHours,
  resolveIssueKeys,
  detectConflicts,
  categorizeOperations,
  executeOperations
];
```

### Error Propagation Pattern
- **Service Layer:** Throw specific error types
- **Controller Layer:** Catch and log errors, transform for display
- **Presentation Layer:** Display user-friendly messages
- **Global Handler:** Catch unhandled errors, log and exit gracefully

---

**Document Version:** 1.0  
**Last Updated:** August 28, 2025  
**Next Review:** September 2025  
**Technical Reviewer:** Senior Developer, DevOps Team