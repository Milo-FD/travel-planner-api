const express = require('express');
const router = express.Router();
const plansController = require('../controllers/plans.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody, schemas } = require('../utils/validate');

// All routes protected
router.use(authenticate);

router.post('/', validateBody(schemas.createPlan), plansController.createPlan);
router.get('/', plansController.getPlans);
router.get('/:id', plansController.getPlan);
router.delete('/:id', plansController.deletePlan);
router.get('/discovery/:city', plansController.getDiscovery);
router.delete('/:planId/days/:dayId/activities/:activityId', plansController.deleteActivity);
router.post('/:planId/days/:dayId/activities/regenerate', plansController.regenerateActivity);

module.exports = router;