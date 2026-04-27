const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/security');
const {
  calculateDriverSafetyScore,
  reportSafetyIncident,
  getUserSafetyStats,
  performPreRideSafetyCheck,
  handleEmergencySOS
} = require('../utils/safetySystem');
const SafetyIncident = require('../models/SafetyIncident');

/**
 * GET /api/safety/driver-score/:driverId
 * Get driver safety score
 */
router.get('/driver-score/:driverId', protect, async (req, res) => {
  try {
    const { driverId } = req.params;
    const safetyScore = await calculateDriverSafetyScore(driverId);
    
    res.json(safetyScore);
  } catch (error) {
    console.error('Error getting driver safety score:', error);
    res.status(500).json({ message: 'Error calculating safety score' });
  }
});

/**
 * POST /api/safety/report-incident
 * Report a safety incident
 */
router.post('/report-incident', protect, async (req, res) => {
  try {
    const incidentData = {
      ...req.body,
      reportedBy: req.user._id
    };

    const result = await reportSafetyIncident(incidentData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error reporting incident:', error);
    res.status(500).json({ message: 'Error reporting incident' });
  }
});

/**
 * GET /api/safety/user-stats
 * Get safety statistics for current user
 */
router.get('/user-stats', protect, async (req, res) => {
  try {
    const stats = await getUserSafetyStats(req.user._id);
    res.json(stats);
  } catch (error) {
    console.error('Error getting user safety stats:', error);
    res.status(500).json({ message: 'Error fetching safety statistics' });
  }
});

/**
 * GET /api/safety/pre-ride-check/:rideId
 * Perform pre-ride safety check
 */
router.get('/pre-ride-check/:rideId', protect, async (req, res) => {
  try {
    const { rideId } = req.params;
    const checkResult = await performPreRideSafetyCheck(rideId);
    
    res.json(checkResult);
  } catch (error) {
    console.error('Error performing pre-ride check:', error);
    res.status(500).json({ message: 'Error performing safety check' });
  }
});

/**
 * POST /api/safety/emergency-sos
 * Handle emergency SOS
 */
router.post('/emergency-sos', protect, async (req, res) => {
  try {
    const sosData = {
      ...req.body,
      userId: req.user._id
    };

    const result = await handleEmergencySOS(sosData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error handling emergency SOS:', error);
    res.status(500).json({ message: 'Error processing emergency request' });
  }
});

/**
 * GET /api/safety/incidents
 * Get user's incident history
 */
router.get('/incidents', protect, async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = {
      $or: [
        { reportedBy: req.user._id },
        { reportedAgainst: req.user._id }
      ]
    };

    if (type) query.type = type;
    if (status) query.status = status;

    const incidents = await SafetyIncident.find(query)
      .populate('reportedBy', 'name photo')
      .populate('reportedAgainst', 'name photo')
      .populate('ride', 'from to date')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ incidents });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ message: 'Error fetching incidents' });
  }
});

/**
 * GET /api/safety/incident/:incidentId
 * Get specific incident details
 */
router.get('/incident/:incidentId', protect, async (req, res) => {
  try {
    const { incidentId } = req.params;
    
    const incident = await SafetyIncident.findById(incidentId)
      .populate('reportedBy', 'name photo email phone')
      .populate('reportedAgainst', 'name photo email phone')
      .populate('ride')
      .populate('booking');

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check if user is authorized to view this incident
    const isInvolved = 
      incident.reportedBy._id.toString() === req.user._id.toString() ||
      incident.reportedAgainst?._id.toString() === req.user._id.toString();

    if (!isInvolved && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to view this incident' });
    }

    res.json({ incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ message: 'Error fetching incident details' });
  }
});

module.exports = router;
