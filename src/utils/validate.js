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
        preferences: Joi.object({
            budget: Joi.string().valid('low', 'medium', 'high').default('medium'),
            interests: Joi.array().items(Joi.string()).default([]),
            pace: Joi.string().valid('relaxed', 'moderate', 'fast').default('moderate')
        }).default()
    })
};

module.exports = { validateBody, schemas };