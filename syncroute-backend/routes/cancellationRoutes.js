const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  calculateCancellationPenalty,
  processCancellation,
  getCancellationPolicyInfo
} = require('../utils/cancellationPolicy');

/**
 * GET /api/cancellation/policy
 * Get cancellation policy information
 */
router.get('/policy', (req, res) => {
  try {
    const policyInfo = getCancellationPolicyInfo();
    res.json(policyInfo);
  } catch (error) {
    console.error('Error getting cancellation policy:', error);
    res.status(500).json({ message: 'Error fetching cancellation policy' });
  }
});

/**
 * POST /api/cancellation/calculate-penalty
 * Calculate cancellation penalty for a booking
 */
router.post('/calculate-penalty', auth, async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    const penalty = await calculateCancellationPenalty(bookingId, req.user.userId);
    
    res.json(penalty);
  } catch (error) {
    console.error('Error calculating penalty:', error);
    res.status(500).json({ 
      message: error.message || 'Error calculating cancellation penalty' 
    });
  }
});

/**
 * POST /api/cancellation/cancel-booking
 * Cancel a booking with penalty
 */
router.post('/cancel-booking', auth, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ 
        message: 'Cancellation reason is required (minimum 5 characters)' 
      });
    }

    const result = await processCancellation(bookingId, req.user.userId, reason);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ 
      message: error.message || 'Error processing cancellation' 
    });
  }
});

module.exports = router;
