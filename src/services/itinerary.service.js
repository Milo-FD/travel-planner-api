const Anthropic = require('@anthropic-ai/sdk');
const AppError = require('../utils/AppError');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const moodProfiles = {
  dopamine_mode: {
    budget: 'medium',
    pace: 'fast',
    vibe: 'fun, stimulating, social, exciting — places with energy and buzz',
    emoji: '💊'
  },
  healing_era: {
    budget: 'low',
    pace: 'relaxed',
    vibe: 'calm, cozy, restorative, gentle — places that feel like a warm hug',
    emoji: '🌿'
  },
  broke_mode: {
    budget: 'low',
    pace: 'relaxed',
    vibe: 'free or cheap, creative, resourceful — prove that fun doesnt cost money',
    emoji: '💸'
  },
  hot_girl_walk: {
    budget: 'low',
    pace: 'moderate',
    vibe: 'outdoor, aesthetic, confident, empowering — main character energy only',
    emoji: '👠'
  },
  romantic_mode: {
    budget: 'medium',
    pace: 'relaxed',
    vibe: 'intimate, beautiful, date-worthy, soft — places that feel like a movie scene',
    emoji: '🌹'
  },
  social_battery_low: {
    budget: 'low',
    pace: 'relaxed',
    vibe: 'solo, quiet, minimal human interaction — recharging without isolation',
    emoji: '🔋'
  },
  chaos_mode: {
    budget: 'any',
    pace: 'fast',
    vibe: 'unpredictable, adventurous, spontaneous — say yes to everything weird',
    emoji: '🌀'
  },
  solo_recharge: {
    budget: 'low',
    pace: 'relaxed',
    vibe: 'peaceful, self-care, intentional solitude — you are the main character today',
    emoji: '🧘'
  }
};

const generateItinerary = async (location, mood, weatherDays, isEmergency = false) => {
  const profile = moodProfiles[mood] || moodProfiles.dopamine_mode;

  const emergencyIntro = isEmergency
    ? `EMERGENCY SITUATION: The user's original plan just died. They need an instant backup plan RIGHT NOW. Be their chaotic supportive best friend who saves the day.`
    : '';

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
        content: `${emergencyIntro}

You are NOT a travel assistant. You are the user's witty, culturally aware, emotionally intelligent Gen Z best friend who happens to know everything about ${location}.

Current mood: ${profile.emoji} ${mood.replace(/_/g, ' ').toUpperCase()}
Vibe: ${profile.vibe}
Budget energy: ${profile.budget}

Weather situation:
${weatherDays.map(d => `- ${d.date}: ${d.weather.condition}, High ${d.weather.tempHigh}°F, Low ${d.weather.tempLow}°F`).join('\n')}

Rules for being a good friend:
- Search for real events, pop-ups, markets, hidden gems happening in ${location} during these dates
- If it's raining: lean into cozy indoor spots, coffee shops with atmosphere, galleries, bookstores
- If it's sunny: outdoor aesthetic spots, rooftops, parks with main character energy
- Match every activity to the current mood energy — not just practical but EMOTIONAL fit
- Activity titles should be fun and specific, not generic (NOT "visit a museum", YES "lose yourself in the Surrealism wing at SFMOMA")
- Descriptions should sound like a friend texting you, not a tour guide
- Reasons should validate the mood, not just describe the weather
- Each day needs morning, afternoon and evening
- Make it feel curated, spontaneous, and cinematic

IMPORTANT: Respond ONLY with a valid JSON array. Start with [ and end with ]. No other text.

[
  {
    "date": "2026-04-30",
    "activities": [
      {
        "timeSlot": "morning",
        "title": "Specific fun activity name",
        "description": "Sounds like a friend texting you about this place",
        "type": "outdoor or indoor",
        "reason": "Validates the mood emotionally, not just practically"
      }
    ]
  }
]`
      }
    ]
  });

  const fullResponse = message.content
    .map(block => block.type === 'text' ? block.text : '')
    .filter(Boolean)
    .join('\n');

  const start = fullResponse.indexOf('[');
  const end = fullResponse.lastIndexOf(']');

  if (start === -1 || end === -1) {
    throw new Error('Could not parse itinerary from AI response');
  }

  return JSON.parse(fullResponse.substring(start, end + 1));
};

module.exports = { generateItinerary, moodProfiles };