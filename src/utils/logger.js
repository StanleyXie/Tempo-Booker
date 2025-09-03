const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class Logger {
  constructor(config) {
    this.config = config;
    this.logDir = path.dirname(config.logging?.logFile || 'logs/tempo-cli.log');
    this.logFile = config.logging?.logFile || 'logs/tempo-cli.log';
    this.silentMode = config.cli?.silentMode || false;
    this.logToFile = config.cli?.logToFile !== false; // default true
    this.consoleLevel = config.logging?.consoleLevel || 'normal'; // normal or debug
    
    // Ensure log directory exists
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // Internal method to write to log file
  _writeToFile(level, message, data = null) {
    if (!this.logToFile) return;
    
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(data && { data })
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      // Fail silently to avoid infinite loops
      console.error(chalk.red('Failed to write to log file:'), error.message);
    }
  }

  // Public logging methods
  info(message, data = null) {
    this._writeToFile('info', message, data);
    if (!this.silentMode) {
      console.log(message);
    }
  }

  success(message, data = null) {
    this._writeToFile('info', message, data);
    if (!this.silentMode) {
      console.log(chalk.green(message));
    }
  }

  warn(message, data = null) {
    this._writeToFile('warn', message, data);
    console.log(chalk.yellow(message)); // Always show warnings
  }

  error(message, data = null) {
    this._writeToFile('error', message, data);
    console.error(chalk.red(message)); // Always show errors
  }

  debug(message, data = null) {
    this._writeToFile('debug', message, data);
    if (this.config.cli?.verboseLogging) {
      console.log(chalk.gray(message));
    }
  }

  // Progress and status methods (only to file in silent mode)
  progress(message, data = null) {
    this._writeToFile('info', message, data);
    if (!this.silentMode) {
      console.log(chalk.blue(message));
    }
  }

  status(message, data = null) {
    this._writeToFile('info', message, data);
    if (!this.silentMode) {
      console.log(chalk.gray(message));
    }
  }

  // Special method for essential results that should always show
  result(message, data = null) {
    this._writeToFile('info', message, data);
    console.log(message); // Always show results
  }

  // New methods for different console log levels
  
  // Transaction-level logging (normal level) - shows key business operations
  transaction(message, data = null) {
    this._writeToFile('info', `[TRANSACTION] ${message}`, data);
    if (!this.silentMode) {
      console.log(chalk.blue(`📋 ${message}`));
    }
  }
  
  // System-level logging (debug level) - shows technical details
  system(message, data = null) {
    this._writeToFile('debug', `[SYSTEM] ${message}`, data);
    if (!this.silentMode && this.consoleLevel === 'debug') {
      console.log(chalk.gray(`🔧 ${message}`));
    }
  }
  
  // Keep original info method unchanged for backward compatibility

  // Method to clean up old log files based on config
  cleanup() {
    if (!this.logToFile) return;
    
    try {
      const maxFiles = this.config.logging?.maxFiles || 5;
      const logPattern = this.logFile.replace('.log', '*.log');
      
      // This would need glob to properly implement file cleanup
      // For now, just ensure the current log doesn't grow too large
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        const maxSize = this._parseSize(this.config.logging?.maxFileSize || '10MB');
        
        if (stats.size > maxSize) {
          // Rotate log file
          const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
          const rotatedFile = this.logFile.replace('.log', `-${timestamp}.log`);
          fs.renameSync(this.logFile, rotatedFile);
        }
      }
    } catch (error) {
      // Fail silently
    }
  }

  _parseSize(sizeStr) {
    const match = sizeStr.match(/(\d+)(MB|KB|GB)?/i);
    if (!match) return 10 * 1024 * 1024; // 10MB default
    
    const value = parseInt(match[1]);
    const unit = (match[2] || 'MB').toLowerCase();
    
    switch (unit) {
      case 'gb': return value * 1024 * 1024 * 1024;
      case 'mb': return value * 1024 * 1024;
      case 'kb': return value * 1024;
      default: return value;
    }
  }
}

module.exports = Logger;