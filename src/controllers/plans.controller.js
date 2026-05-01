const plansService = require('../services/plans.service');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const createPlan = catchAsync(async (req, res) => {
    const { location, startDate, endDate, mood, isEmergency } = req.body;

    if (!location || !startDate || !endDate || !mood) {
        throw new AppError('location, startDate, endDate and mood are required', 400);
    }

    const today = new Date();
    const start = new Date(startDate);
    const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));

    if (diffDays > 5) {
        throw new AppError('Start date must be within the next 5 days — we are all about spontaneity here 👀', 400);
    }

    const plan = await plansService.createPlan(req.userId, {
        location,
        startDate,
        endDate,
        mood,
        isEmergency: isEmergency || false
    });

    res.status(201).json(plan);
});

const getPlans = catchAsync(async (req, res) => {
  const plans = await plansService.getPlansByUser(req.userId);
  res.status(200).json(plans);
});

const getPlan = catchAsync(async (req, res) => {
  const plan = await plansService.getPlanById(req.params.id, req.userId);
  if (!plan) throw new AppError('Plan not found', 404);
  res.status(200).json(plan);
});

const deletePlan = catchAsync(async (req, res) => {
  const deleted = await plansService.deletePlan(req.params.id, req.userId);
  if (!deleted) throw new AppError('Plan not found', 404);
  res.status(200).json({ message: 'Plan deleted successfully' });
});

module.exports = { createPlan, getPlans, getPlan, deletePlan };