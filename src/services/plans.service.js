const pool = require('../db/pool');
const { getWeatherForTrip } = require('./weather.service');
const { generateItinerary } = require('./itinerary.service');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { geocodePlace } = require('./geocoding.service');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Internal - no userId filter, used right after creation
const getFullPlanById = async (planId) => {
    const result = await pool.query(
        `SELECT
            p.*,
            json_agg(
                json_build_object(
                    'id', pd.id,
                    'date', pd.date,
                    'weather', pd.weather,
                    'activities', (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'timeSlot', a.time_slot,
                                'title', a.title,
                                'description', a.description,
                                'type', a.type,
                                'reason', a.reason,
                                'placeName', a.place_name,
                                'lat', a.lat,
                                'lng', a.lng
                            )
                        )
                        FROM activities a
                        WHERE a.plan_day_id = pd.id
                    )
                ) ORDER BY pd.date
            ) AS days
        FROM plans p
        LEFT JOIN plan_days pd ON pd.plan_id = p.id
        WHERE p.id = $1
        GROUP BY p.id`,
        [planId]
    );
    return result.rows[0];
};

// Public - checks ownership
const getPlanById = async (planId, userId) => {
    const result = await pool.query(
        `SELECT
            p.*,
            json_agg(
                json_build_object(
                    'id', pd.id,
                    'date', pd.date,
                    'weather', pd.weather,
                    'activities', (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'timeSlot', a.time_slot,
                                'title', a.title,
                                'description', a.description,
                                'type', a.type,
                                'reason', a.reason,
                                'placeName', a.place_name,
                                'lat', a.lat,
                                'lng', a.lng
                            )
                        )
                        FROM activities a
                        WHERE a.plan_day_id = pd.id
                    )
                ) ORDER BY pd.date
            ) AS days
        FROM plans p
        LEFT JOIN plan_days pd ON pd.plan_id = p.id
        WHERE p.id = $1 AND p.user_id = $2
        GROUP BY p.id`,
        [planId, userId]
    );
    return result.rows[0];
};

// FIX: Instead of skipping activities that fail geocoding (which caused missing
// morning/afternoon/evening slots), fall back to the city center coordinates.
// This guarantees all 3 activities always save, and the map pin just lands
// in the general area rather than disappearing entirely.
const geocodeWithFallback = async (placeName, location) => {
    try {
        const coords = await geocodePlace(placeName, location);
        if (coords?.lat && coords?.lng) return coords;
    } catch (err) {
        console.warn(`Geocoding failed for "${placeName}": ${err.message}`);
    }

    // Fallback: geocode the city itself
    console.warn(`Falling back to city center coordinates for "${placeName}" in ${location}`);
    try {
        const fallback = await geocodePlace(location, location);
        if (fallback?.lat && fallback?.lng) return fallback;
    } catch (err) {
        console.warn(`City center fallback also failed for ${location}: ${err.message}`);
    }

    return { lat: null, lng: null };
};

const createPlan = async (userId, { location, startDate, endDate, mood, isEmergency = false }) => {
    // Step 1: Create the plan in DB with status 'pending'
    const planResult = await pool.query(
        `INSERT INTO plans (user_id, location, start_date, end_date, preferences, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [userId, location, startDate, endDate, JSON.stringify({ mood, isEmergency })]
    );

    const plan = planResult.rows[0];

    // Step 2: Fetch weather
    const weatherData = await getWeatherForTrip(location, startDate, endDate);

    // Step 3: Generate itinerary with Claude
    const itinerary = await generateItinerary(location, mood, weatherData, isEmergency);

    // Step 4: Save each day and its activities to DB
    for (const day of itinerary) {
        const weatherForDay = weatherData.find(w => w.date === day.date);

        const dayResult = await pool.query(
            'INSERT INTO plan_days (plan_id, date, weather) VALUES ($1, $2, $3) RETURNING id',
            [plan.id, day.date, JSON.stringify(weatherForDay?.weather || {})]
        );

        const planDayId = dayResult.rows[0].id;

        for (const activity of day.activities) {
            await sleep(1100);

            // Use fallback instead of skipping — keeps all 3 time slots intact
            const { lat, lng } = await geocodeWithFallback(activity.placeName, location);

            await pool.query(
                `INSERT INTO activities 
                 (plan_day_id, time_slot, title, description, type, reason, place_name, lat, lng)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    planDayId,
                    activity.timeSlot,
                    activity.title,
                    activity.description,
                    activity.type,
                    activity.reason,
                    activity.placeName,
                    lat,
                    lng
                ]
            );
        }
    }

    // Step 5: Update plan status to 'ready'
    await pool.query(
        `UPDATE plans SET status = 'ready' WHERE id = $1`,
        [plan.id]
    );

    // Step 6: Return the full plan with days and activities
    return getFullPlanById(plan.id);
};

const getPlansByUser = async (userId) => {
    const result = await pool.query(
        'SELECT * FROM plans WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
};

const deletePlan = async (planId, userId) => {
    const result = await pool.query(
        'DELETE FROM plans WHERE id = $1 AND user_id = $2 RETURNING id',
        [planId, userId]
    );
    return result.rows[0];
};

const getDiscovery = async (city) => {
    const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
            role: 'user',
            content: `You are a witty Gen Z local guide for ${city}. Generate 4 daily discovery cards for today. Be specific, fun, and emotionally aware.

Return ONLY a JSON array with exactly 4 items. No markdown, no explanation, just the raw JSON array:
[
  {
    "type": "random_plan",
    "emoji": "🎲",
    "title": "Today's Random Plan",
    "content": "specific fun activity happening or available today in ${city}",
    "cta": "let's do it"
  },
  {
    "type": "secret_spot",
    "emoji": "📍",
    "title": "Secret Local Spot",
    "content": "a hidden gem in ${city} most tourists don't know about",
    "cta": "take me there"
  },
  {
    "type": "sunset_score",
    "emoji": "🌅",
    "title": "Sunset Score Today",
    "content": "rate today's sunset potential in ${city} and where to watch it",
    "cta": "catch it"
  },
  {
    "type": "cafe_pick",
    "emoji": "☕",
    "title": "Romanticize Your Breakdown",
    "content": "the perfect cafe in ${city} to sit, overthink, and look cute doing it",
    "cta": "i need this"
  }
]`
        }]
    });

    const rawResponse = message.content
        .map(block => block.type === 'text' ? block.text : '')
        .filter(Boolean)
        .join('\n');

    // Strip cite tags from discovery responses too
    const fullResponse = rawResponse.replace(/<cite[^>]*>|<\/cite>/g, '');

    const start = fullResponse.indexOf('[');
    const end = fullResponse.lastIndexOf(']');

    if (start === -1 || end === -1) {
        throw new Error('Could not generate discovery content');
    }

    return JSON.parse(fullResponse.substring(start, end + 1));
};

const deleteActivity = async (planId, dayId, activityId, userId) => {
    // Verify the plan belongs to the user first
    const planCheck = await pool.query(
        'SELECT id FROM plans WHERE id = $1 AND user_id = $2',
        [planId, userId]
    );
    if (!planCheck.rows[0]) return null;

    const result = await pool.query(
        `DELETE FROM activities 
         WHERE id = $1 
         AND plan_day_id = $2
         RETURNING id`,
        [activityId, dayId]
    );
    return result.rows[0];
};

const regenerateActivity = async (planId, dayId, timeSlot, userId) => {
    const plan = await getPlanById(planId, userId);
    if (!plan) return null;

    const day = plan.days?.find(d => d.id === dayId);
    if (!day) return null;

    const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
            role: 'user',
            content: `Generate a single ${timeSlot} activity for a trip to ${plan.location} on ${day.date}.
The mood/vibe is: ${plan.preferences?.mood}.
Weather: ${JSON.stringify(day.weather)}.

CRITICAL: "placeName" must be a real, specific, Google Maps-searchable venue in ${plan.location}.
Good: "Tartine Bakery", "Alamo Square Park", "The Interval at Long Now".
Bad: "a local cafe", "nice park", "trendy restaurant".

Return ONLY a JSON object with no markdown or extra text:
{
  "timeSlot": "${timeSlot}",
  "title": "activity title",
  "placeName": "Real, specific venue name in ${plan.location}",
  "description": "2 sentence description",
  "type": "indoor or outdoor",
  "reason": "why this fits the vibe"
}`
        }]
    });

    const text = message.content.find(b => b.type === 'text')?.text || '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const activity = JSON.parse(text.substring(start, end + 1));

    // Use fallback here too for consistency
    const { lat, lng } = await geocodeWithFallback(activity.placeName, plan.location);

    const result = await pool.query(
        `INSERT INTO activities (plan_day_id, time_slot, title, description, type, reason, place_name, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [dayId, activity.timeSlot, activity.title, activity.description, activity.type, activity.reason, activity.placeName, lat, lng]
    );

    return { id: result.rows[0].id, ...activity, lat, lng };
};

module.exports = { createPlan, getPlansByUser, getPlanById, deletePlan, getDiscovery, deleteActivity, regenerateActivity };