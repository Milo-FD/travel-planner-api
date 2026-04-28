const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const AppError = require('../utils/AppError');

const register = async (email, password) => {
    // Check if user already exists.
    const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
    );

    if (existing.rows.length > 0) {
        throw new AppError('Email already in use');
    }

    // Hash the password (10 = how hard it is to crack, higer = sloer but safer)
    const password_hash = await bcrypt.hash(password, 10);

    // Save user to database
    const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email, password_hash]
    );

    return result.rows[0];
};

const login = async (email, password) => {
    // Find user by email
    const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );

    if (result.rows.length === 0) {
        throw new AppError('Invalid email or password');
    }

    const user = result.rows[0];

    // Compare password with hash
    const valid = await bcrypt.compare(password, user.password_hash);

    if(!valid) {
        throw new AppError('Invalid email or password');
    }

    //Create JWT TOken
    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d'}
    );

    return { token, user: { id: user.id, email: user.email } };
};

const getMe = async (userId) => {
    const result = await pool.query(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [userId]
    );

    return result.rows[0];
};

module.exports = {register, login, getMe};