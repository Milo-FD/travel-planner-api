const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const register = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;
    const user = await authService.register(name, email, password);
    res.status(201).json({ message: 'User created successfully', user });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json(result);
});

const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.userId);
  if (!user) throw new AppError('User not found', 404);
  res.status(200).json(user);
});

module.exports = { register, login, getMe };