const Joi = require('joi');
const AppError = require('./AppError');

const validateBody = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const message = error.details.map(d => d.message).join(' , ');
            return next(new AppError(message, 400));
        }
        next();
    };
};

// Schemas 
const schemas = {
    register: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    createPlan: Joi.object({
    location: Joi.string().min(2).required(),
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().required(),
    mood: Joi.string().valid(
        'dopamine_mode',
        'healing_era',
        'broke_mode',
        'hot_girl_walk',
        'romantic_mode',
        'social_battery_low',
        'chaos_mode',
        'solo_recharge'
    ).required(),
    isEmergency: Joi.boolean().default(false)
     })
};

module.exports = { validateBody, schemas };