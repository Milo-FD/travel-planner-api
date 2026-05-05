const Anthropic = require('@anthropic-ai/sdk');
const AppError = require('../utils/AppError');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const stripCiteTags = (text) => {
  if (!text) return text;
  return text.replace(/<cite[^>]*>|<\/cite>/g, '');
};

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
- Make it feel curated, spontaneous, and cinematic

STRICT RULES — VIOLATIONS WILL BREAK THE APP:

1. EVERY day MUST have EXACTLY 3 activities: one "morning", one "afternoon", one "evening". No exceptions. No missing slots.

2. Each of the 3 activities MUST be at a COMPLETELY DIFFERENT venue/placeName. Never use the same event, venue, or location more than once per day — not even as a "lead up" or "vibe" activity. If there's a concert in the evening, the afternoon must be somewhere entirely unrelated.

3. Every "placeName" MUST be a real, specific, Google Maps-searchable venue in ${location}. Good examples: "Ferry Building Marketplace", "Dolores Park", "SFMOMA", "Tartine Bakery". NEVER use vague descriptions like "a local cafe", "downtown park", or "nearby restaurant" — these names get geocoded to coordinates and vague names break the app.

4. Respond ONLY with a valid JSON array. Start with [ and end with ]. No markdown, no explanation, no other text.

[
  {
    "date": "YYYY-MM-DD",
    "activities": [
      {
        "timeSlot": "morning",
        "title": "Specific fun activity name",
        "placeName": "Real, specific, Google Maps-searchable venue in ${location}",
        "description": "Sounds like a friend texting you about this place",
        "type": "outdoor or indoor",
        "reason": "Validates the mood emotionally, not just practically"
      },
      {
        "timeSlot": "afternoon",
        "title": "Specific fun activity name — DIFFERENT venue from morning",
        "placeName": "Real, specific venue in ${location} — DIFFERENT from morning's venue",
        "description": "Sounds like a friend texting you about this place",
        "type": "outdoor or indoor",
        "reason": "Validates the mood emotionally, not just practically"
      },
      {
        "timeSlot": "evening",
        "title": "Specific fun activity name — DIFFERENT venue from morning and afternoon",
        "placeName": "Real, specific venue in ${location} — DIFFERENT from morning and afternoon venues",
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

  const rawResponse = message.content
    .map(block => block.type === 'text' ? block.text : '')
    .filter(Boolean)
    .join('\n');

  const fullResponse = stripCiteTags(rawResponse);

  const start = fullResponse.indexOf('[');
  const end = fullResponse.lastIndexOf(']');

  if (start === -1 || end === -1) {
    throw new AppError('Could not parse itinerary from AI response', 500);
  }

  const itinerary = JSON.parse(fullResponse.substring(start, end + 1));

  // Post-parse validation: enforce exactly 3 unique time slots per day
  const requiredSlots = ['morning', 'afternoon', 'evening'];

  for (const day of itinerary) {
    // Deduplicate by timeSlot in case the model returned the same slot twice
    const seen = new Set();
    day.activities = day.activities.filter(a => {
      if (seen.has(a.timeSlot)) return false;
      seen.add(a.timeSlot);
      return true;
    });

    const presentSlots = day.activities.map(a => a.timeSlot);
    const missingSlots = requiredSlots.filter(s => !presentSlots.includes(s));

    if (missingSlots.length > 0) {
      throw new AppError(
        `AI returned incomplete itinerary for ${day.date} — missing slots: ${missingSlots.join(', ')}`,
        500
      );
    }
  }

  return itinerary;
};

module.exports = { generateItinerary, moodProfiles };