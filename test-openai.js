const { config } = require('dotenv');
const path = require('path');

// Load .env.local
config({ path: path.join(__dirname, '.env.local') });

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('Testing OpenAI API...');
  console.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND');
  
  if (!apiKey || apiKey === 'your-new-api-key-here') {
    console.error('❌ API key not properly set in .env.local');
    return;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (response.ok) {
      console.log('✅ API key is valid!');
      const data = await response.json();
      console.log('Available models:', data.data.slice(0, 3).map(m => m.id));
    } else {
      const error = await response.json();
      console.error('❌ API key is invalid:', error.error);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testOpenAI();