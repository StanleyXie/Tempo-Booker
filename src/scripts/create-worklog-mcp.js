// Simple MCP-based worklog creation script
const axios = require('axios');
const config = require('../utils/config');

async function createWorklogWithCorrectIssueId() {
  console.log('🚀 Creating worklog with MCP-resolved issue ID...');
  
  // Data from your tempo.csv: 2025-08-25,ITST-14439,09:00:00,10:00:00,1,Working on ITST-14439
  const worklogData = {
    issueId: 365350, // From MCP: ITST-14439 -> 365350
    timeSpentSeconds: 3600, // 1 hour
    startDate: '2025-08-25',
    startTime: '09:00:00', 
    description: 'Working on ITST-14439',
    authorAccountId: '712020:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' // Your account ID
  };

  console.log('📋 Worklog payload:', JSON.stringify(worklogData, null, 2));

  try {
    const response = await axios.post('https://api.tempo.io/4/worklogs', worklogData, {
      headers: {
        'Authorization': `Bearer ${config.tempoApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ SUCCESS! Worklog created:');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.log('❌ Failed to create worklog:');
    console.log('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run the function
createWorklogWithCorrectIssueId()
  .then(() => {
    console.log('\n🎉 Worklog creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n💥 Worklog creation failed!');
    process.exit(1);
  });