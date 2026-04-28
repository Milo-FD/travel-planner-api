const pool = require('../db/pool');
const { getWeatherForTrip } = require('./weather.service');
const { generateItinerary } = require('./itinerary.service');

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
                                'reason', a.reason
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
                                'reason', a.reason
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

const createPlan = async (userId, { location, startDate, endDate, preferences }) => {
    // Step 1: Create the plan in DB with status 'pending'
    const planResult = await pool.query(
        `INSERT INTO plans (user_id, location, start_date, end_date, preferences, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [userId, location, startDate, endDate, JSON.stringify(preferences)]
    );

    const plan = planResult.rows[0];

    // Step 2: Fetch weather
    const weatherData = await getWeatherForTrip(location, startDate, endDate);

    // Step 3: Generate itinerary with Claude
    const itinerary = await generateItinerary(location, preferences, weatherData);

    // Step 4: Save each day and its activities to DB
    for (const day of itinerary) {
        const weatherForDay = weatherData.find(w => w.date === day.date);

        const dayResult = await pool.query(
            'INSERT INTO plan_days (plan_id, date, weather) VALUES ($1, $2, $3) RETURNING id',
            [plan.id, day.date, JSON.stringify(weatherForDay?.weather || {})]
        );

        const planDayId = dayResult.rows[0].id;

        for (const activity of day.activities) {
            await pool.query(
                'INSERT INTO activities (plan_day_id, time_slot, title, description, type, reason) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    planDayId,
                    activity.timeSlot,
                    activity.title,
                    activity.description,
                    activity.type,
                    activity.reason
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

module.exports = { createPlan, getPlansByUser, getPlanById, deletePlan };