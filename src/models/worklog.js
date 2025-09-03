const moment = require('moment');

class Worklog {
  constructor(data = {}) {
    this.issueKey = data.issueKey;
    this.issueId = data.issueId;
    this.timeSpentSeconds = data.timeSpentSeconds || this.convertHoursToSeconds(data.hours || 0);
    this.description = data.description || '';
    this.startDate = data.startDate || moment().format('YYYY-MM-DD');
    this.startTime = data.startTime || '09:00:00';
    this.authorAccountId = data.authorAccountId;
    this.billingKey = data.billingKey;
    this.attributes = data.attributes || [];
  }

  convertHoursToSeconds(hours) {
    return Math.round(hours * 3600);
  }

  convertSecondsToHours(seconds) {
    return seconds / 3600;
  }

  setTimeInHours(hours) {
    this.timeSpentSeconds = this.convertHoursToSeconds(hours);
  }

  getTimeInHours() {
    return this.convertSecondsToHours(this.timeSpentSeconds);
  }

  validate() {
    const errors = [];

    if (!this.issueKey) {
      errors.push('Issue key is required');
    }

    if (!this.timeSpentSeconds || this.timeSpentSeconds <= 0) {
      errors.push('Time spent must be greater than 0');
    }

    if (!this.startDate) {
      errors.push('Start date is required');
    }

    if (!moment(this.startDate, 'YYYY-MM-DD', true).isValid()) {
      errors.push('Start date must be in YYYY-MM-DD format');
    }

    if (!this.startTime) {
      errors.push('Start time is required');
    }

    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(this.startTime)) {
      errors.push('Start time must be in HH:MM:SS format');
    }

    return errors;
  }

  toApiFormat() {
    const payload = {
      timeSpentSeconds: this.timeSpentSeconds,
      description: this.description,
      startDate: this.startDate,
      startTime: this.startTime
    };
    
    // Include authorAccountId only if available
    if (this.authorAccountId) {
      payload.authorAccountId = this.authorAccountId;
    }
    
    // Include issueId if available, otherwise issueKey
    if (this.issueId) {
      payload.issueId = this.issueId;
    } else if (this.issueKey) {
      payload.issueKey = this.issueKey;
    }
    
    if (this.billingKey) {
      payload.billingKey = this.billingKey;
    }
    
    if (this.attributes && this.attributes.length > 0) {
      payload.attributes = this.attributes;
    }
    
    return payload;
  }

  static fromApiResponse(data) {
    return new Worklog({
      issueKey: data.issue?.key,
      timeSpentSeconds: data.timeSpentSeconds,
      description: data.description,
      startDate: data.startDate,
      startTime: data.startTime,
      authorAccountId: data.author?.accountId,
      billingKey: data.billableSeconds ? 'BILLABLE' : 'NON_BILLABLE',
      attributes: data.attributes || []
    });
  }
}

module.exports = Worklog;