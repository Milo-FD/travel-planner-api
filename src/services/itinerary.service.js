const Anthropic = require('@anthropic-ai/sdk');
const AppError = require('../utils/AppError');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const generateItinerary = async (location, preferences, weatherDays) => {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    tools: [
        {
            type: 'web_search_20250305',
            name: 'web_search'
        }
    ],
    messages: [
      {
        role: 'user',
        content: `You are a travel planner. Create a detailed day-by-day itinerary for a trip to ${location}.

Trip preferences:
- Budget: ${preferences?.budget || 'medium'}
- Interests: ${preferences?.interests?.join(', ') || 'general sightseeing'}
- Pace: ${preferences?.pace || 'moderate'}

Weather forecast:
${weatherDays.map(d => `- ${d.date}: ${d.weather.condition}, High ${d.weather.tempHigh}°F, Low ${d.weather.tempLow}°F`).join('\n')}

Rules:
- Search for real events, festivals, markets, or special happenings in ${location} during those dates
- If rainy or stormy → prioritize indoor activities
- If hot (above 85°F) → avoid midday outdoor activities
- Match activities to interests and budget
- Each day should have morning, afternoon and evening activities


Respond ONLY with a valid JSON array, no explanation, no markdown, just raw JSON like this:
[
  {
    "date": "2026-05-01",
    "activities": [
      {
        "timeSlot": "morning",
        "title": "Activity name",
        "description": "Short description",
        "type": "outdoor or indoor",
        "reason": "Why this activity fits the weather and preferences"
      }
    ]
  }
]`

      }
    ]
  });

  // Handle response - Claude may use web search before responding
  const fullResponse = message.content
    .map(block => block.type === 'text' ? block.text : '')
    .filter(Boolean)
    .join('\n');

  console.log('Raw Claude response:', fullResponse.length);
  console.log('Last 100 chars:', fullResponse.slice(-100));

  // Extract just the JSON array from the response
  const match = fullResponse.match(/\[[\s\S]*\]/);
  if (!match) {
    // Retry with a stricter prompt
    throw new AppError('AI returned invalid response, please try again', 500);
  }

  return JSON.parse(match[0]);

};

module.exports = { generateItinerary };