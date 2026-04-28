const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
    // Default to 500 if not status code
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Something went wrong';

    //Postgres errors
    if (err.code === '23505') {
        err = new AppError('A record with that value already exists', 409);
    }

    if (err.code === '23503') {
        err = new AppError('Referenced record not found', 404);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        err = new AppError('Invalid token', 401);
    }

    if (err.name === 'TokenExpiredError') {
        err = new AppError('Token expired, please log in again', 401);
    }

    // JSON parse errors
    if (err.type === 'entity.parse.failed') {
        err = new AppError('Invalid JSON in request body', 400);
    }

    console.error(`❌ ${err.statusCode} - ${err.message}`); 

    res.status(err.statusCode).json({
        status: 'error',
        message: err.message
    });
};

module.exports = errorHandler;