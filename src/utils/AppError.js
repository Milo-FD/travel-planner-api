class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // means we threw it on purpose
    }
}

module.exports = AppError; 