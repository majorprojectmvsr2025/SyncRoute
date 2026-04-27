/**
 * Cancellation Policy System
 * Implements fair cancellation penalties to prevent abuse
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');

// Cancellation policy configuration
const CANCELLATION_CONFIG = {
  // Time-based penalties (hours before ride)
  timeBased: {
    moreThan24Hours: { penalty: 0, refund: 100 },      // Free cancellation
    between12And24Hours: { penalty: 10, refund: 90 },  // 10% penalty
    between6And12Hours: { penalty: 25, refund: 75 },   // 25% penalty
    between2And6Hours: { penalty: 50, refund: 50 },    // 50% penalty
    lessThan2Hours: { penalty: 75, refund: 25 },       // 75% penalty
    afterRideStart: { penalty: 100, refund: 0 }        // No refund
  },

  // Frequency-based penalties (increases with repeated cancellations)
  frequencyMultiplier: {
    first3Cancellations: 1.0,      // Normal penalty
    cancellations4to6: 1.2,        // 20% increase
    cancellations7to10: 1.5,       // 50% increase
    moreThan10: 2.0                // 100% increase (double penalty)
  },

  // Driver reliability impact
  driverPenalty: {
    firstCancellation: 5,          // -5 reliability points
    repeatedCancellation: 10,      // -10 reliability points
    lastMinuteCancellation: 15     // -15 reliability points
  },

  // Passenger impact
  passengerPenalty: {
    normalCancellation: 2,         // -2 trust score points
    repeatedCancellation: 5,       // -5 trust score points
    lastMinuteCancellation: 10     // -10 trust score points
  }
};

/**
 * Calculate hours until ride starts
 */
function getHoursUntilRide(ride) {
  const rideDateTime = new Date(`${ride.date}T${ride.departureTime}:00`);
  const now = new Date();
  const hoursUntil = (rideDateTime - now) / (1000 * 60 * 60);
  return hoursUntil;
}

/**
 * Get cancellation penalty tier based on time
 */
function getPenaltyTier(hoursUntilRide, rideStatus) {
  if (rideStatus === 'in-progress' || rideStatus === 'completed') {
    return CANCELLATION_CONFIG.timeBased.afterRideStart;
  }

  if (hoursUntilRide > 24) {
    return CANCELLATION_CONFIG.timeBased.moreThan24Hours;
  } else if (hoursUntilRide > 12) {
    return CANCELLATION_CONFIG.timeBased.between12And24Hours;
  } else if (hoursUntilRide > 6) {
    return CANCELLATION_CONFIG.timeBased.between6And12Hours;
  } else if (hoursUntilRide > 2) {
    return CANCELLATION_CONFIG.timeBased.between2And6Hours;
  } else if (hoursUntilRide > 0) {
    return CANCELLATION_CONFIG.timeBased.lessThan2Hours;
  } else {
    return CANCELLATION_CONFIG.timeBased.afterRideStart;
  }
}

/**
 * Get frequency multiplier based on user's cancellation history
 */
async function getFrequencyMultiplier(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentCancellations = await Booking.countDocuments({
    $or: [{ passenger: userId }, { driver: userId }],
    status: 'cancelled',
    'cancellationDetails.cancelledAt': { $gte: thirtyDaysAgo }
  });

  if (recentCancellations <= 3) {
    return CANCELLATION_CONFIG.frequencyMultiplier.first3Cancellations;
  } else if (recentCancellations <= 6) {
    return CANCELLATION_CONFIG.frequencyMultiplier.cancellations4to6;
  } else if (recentCancellations <= 10) {
    return CANCELLATION_CONFIG.frequencyMultiplier.cancellations7to10;
  } else {
    return CANCELLATION_CONFIG.frequencyMultiplier.moreThan10;
  }
}

/**
 * Calculate cancellation penalty for a booking
 */
async function calculateCancellationPenalty(bookingId, cancelledBy) {
  try {
    const booking = await Booking.findById(bookingId).populate('ride');
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking already cancelled');
    }

    const ride = booking.ride;
    const hoursUntilRide = getHoursUntilRide(ride);
    
    // Get base penalty tier
    const penaltyTier = getPenaltyTier(hoursUntilRide, ride.status);
    
    // Get frequency multiplier
    const frequencyMultiplier = await getFrequencyMultiplier(cancelledBy);
    
    // Calculate penalty amount
    const basePrice = booking.totalPrice;
    const basePenalty = (basePrice * penaltyTier.penalty) / 100;
    const finalPenalty = Math.round(basePenalty * frequencyMultiplier);
    const refundAmount = basePrice - finalPenalty;

    // Determine if it's last minute
    const isLastMinute = hoursUntilRide < 2;
    const isDriverCancellation = cancelledBy.toString() === booking.driver.toString();

    return {
      bookingId: booking._id,
      basePrice,
      penaltyPercentage: penaltyTier.penalty,
      frequencyMultiplier,
      penaltyAmount: finalPenalty,
      refundAmount,
      refundPercentage: penaltyTier.refund,
      hoursUntilRide: Math.round(hoursUntilRide * 10) / 10,
      isLastMinute,
      isDriverCancellation,
      canCancel: true,
      message: this.getCancellationMessage(penaltyTier, frequencyMultiplier, isLastMinute)
    };
  } catch (error) {
    console.error('Error calculating cancellation penalty:', error);
    throw error;
  }
}

/**
 * Get user-friendly cancellation message
 */
function getCancellationMessage(penaltyTier, frequencyMultiplier, isLastMinute) {
  let message = `Cancellation will result in ${penaltyTier.penalty}% penalty (₹${penaltyTier.penalty} deducted).`;
  
  if (frequencyMultiplier > 1) {
    message += ` Due to recent cancellations, penalty is increased by ${Math.round((frequencyMultiplier - 1) * 100)}%.`;
  }
  
  if (isLastMinute) {
    message += ` This is a last-minute cancellation and will affect your reliability score.`;
  }
  
  if (penaltyTier.penalty === 0) {
    message = 'Free cancellation available. Full refund will be processed.';
  }
  
  return message;
}

/**
 * Process cancellation and apply penalties
 */
async function processCancellation(bookingId, cancelledBy, reason) {
  try {
    const booking = await Booking.findById(bookingId).populate('ride passenger driver');
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking already cancelled');
    }

    // Calculate penalty
    const penaltyDetails = await calculateCancellationPenalty(bookingId, cancelledBy);
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancellationDetails = {
      cancelledBy,
      cancelledAt: new Date(),
      reason,
      penaltyApplied: penaltyDetails.penaltyAmount > 0,
      penaltyAmount: penaltyDetails.penaltyAmount,
      refundAmount: penaltyDetails.refundAmount,
      hoursBeforeRide: penaltyDetails.hoursUntilRide
    };
    await booking.save();

    // Update ride available seats
    const ride = booking.ride;
    ride.availableSeats += booking.seats;
    await ride.save();

    // Update user reliability scores
    const isDriverCancellation = cancelledBy.toString() === booking.driver._id.toString();
    
    if (isDriverCancellation) {
      await updateDriverReliability(booking.driver._id, penaltyDetails.isLastMinute);
    } else {
      await updatePassengerTrustScore(booking.passenger._id, penaltyDetails.isLastMinute);
    }

    // Send notifications
    await sendCancellationNotifications(booking, penaltyDetails, isDriverCancellation);

    return {
      success: true,
      booking,
      penaltyDetails,
      message: 'Cancellation processed successfully'
    };
  } catch (error) {
    console.error('Error processing cancellation:', error);
    throw error;
  }
}

/**
 * Update driver reliability score after cancellation
 */
async function updateDriverReliability(driverId, isLastMinute) {
  try {
    const user = await User.findById(driverId);
    
    if (!user || !user.reliabilityScore) {
      return;
    }

    // Get recent cancellations count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCancellations = await Booking.countDocuments({
      driver: driverId,
      status: 'cancelled',
      'cancellationDetails.cancelledAt': { $gte: thirtyDaysAgo }
    });

    // Calculate penalty points
    let penaltyPoints;
    if (recentCancellations === 1) {
      penaltyPoints = CANCELLATION_CONFIG.driverPenalty.firstCancellation;
    } else if (isLastMinute) {
      penaltyPoints = CANCELLATION_CONFIG.driverPenalty.lastMinuteCancellation;
    } else {
      penaltyPoints = CANCELLATION_CONFIG.driverPenalty.repeatedCancellation;
    }

    // Update reliability score
    user.reliabilityScore.score = Math.max(0, user.reliabilityScore.score - penaltyPoints);
    user.reliabilityScore.cancellationRate = (recentCancellations / Math.max(1, user.rideStats.totalRidesAsDriver)) * 100;
    user.reliabilityScore.lastCalculatedAt = new Date();

    await user.save();

    console.log(`Driver ${driverId} reliability updated: -${penaltyPoints} points (now ${user.reliabilityScore.score})`);
  } catch (error) {
    console.error('Error updating driver reliability:', error);
  }
}

/**
 * Update passenger trust score after cancellation
 */
async function updatePassengerTrustScore(passengerId, isLastMinute) {
  try {
    const user = await User.findById(passengerId);
    
    if (!user) {
      return;
    }

    // Initialize trust score if not exists
    if (!user.trustScore) {
      user.trustScore = { score: 100, lastUpdated: new Date() };
    }

    // Get recent cancellations count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCancellations = await Booking.countDocuments({
      passenger: passengerId,
      status: 'cancelled',
      'cancellationDetails.cancelledAt': { $gte: thirtyDaysAgo }
    });

    // Calculate penalty points
    let penaltyPoints;
    if (recentCancellations === 1) {
      penaltyPoints = CANCELLATION_CONFIG.passengerPenalty.normalCancellation;
    } else if (isLastMinute) {
      penaltyPoints = CANCELLATION_CONFIG.passengerPenalty.lastMinuteCancellation;
    } else {
      penaltyPoints = CANCELLATION_CONFIG.passengerPenalty.repeatedCancellation;
    }

    // Update trust score
    user.trustScore.score = Math.max(0, user.trustScore.score - penaltyPoints);
    user.trustScore.lastUpdated = new Date();

    await user.save();

    console.log(`Passenger ${passengerId} trust score updated: -${penaltyPoints} points (now ${user.trustScore.score})`);
  } catch (error) {
    console.error('Error updating passenger trust score:', error);
  }
}

/**
 * Send cancellation notifications to affected parties
 */
async function sendCancellationNotifications(booking, penaltyDetails, isDriverCancellation) {
  try {
    // This will be integrated with your notification system
    const notificationData = {
      bookingId: booking._id,
      rideId: booking.ride._id,
      cancelledBy: isDriverCancellation ? 'driver' : 'passenger',
      penaltyAmount: penaltyDetails.penaltyAmount,
      refundAmount: penaltyDetails.refundAmount
    };

    // Notify the other party
    if (isDriverCancellation) {
      // Notify passenger about driver cancellation
      console.log(`Notifying passenger ${booking.passenger._id} about driver cancellation`);
      // TODO: Send push notification to passenger
    } else {
      // Notify driver about passenger cancellation
      console.log(`Notifying driver ${booking.driver._id} about passenger cancellation`);
      // TODO: Send push notification to driver
    }
  } catch (error) {
    console.error('Error sending cancellation notifications:', error);
  }
}

/**
 * Get cancellation policy info for display
 */
function getCancellationPolicyInfo() {
  return {
    title: 'Cancellation Policy',
    description: 'Fair cancellation policy to protect both drivers and passengers',
    tiers: [
      {
        timeframe: 'More than 24 hours before ride',
        penalty: '0%',
        refund: '100%',
        description: 'Free cancellation with full refund'
      },
      {
        timeframe: '12-24 hours before ride',
        penalty: '10%',
        refund: '90%',
        description: 'Small penalty applies'
      },
      {
        timeframe: '6-12 hours before ride',
        penalty: '25%',
        refund: '75%',
        description: 'Moderate penalty applies'
      },
      {
        timeframe: '2-6 hours before ride',
        penalty: '50%',
        refund: '50%',
        description: 'Significant penalty applies'
      },
      {
        timeframe: 'Less than 2 hours before ride',
        penalty: '75%',
        refund: '25%',
        description: 'High penalty for last-minute cancellation'
      },
      {
        timeframe: 'After ride starts',
        penalty: '100%',
        refund: '0%',
        description: 'No refund after ride begins'
      }
    ],
    notes: [
      'Repeated cancellations may result in increased penalties',
      'Cancellations affect your reliability/trust score',
      'Drivers with low reliability scores may have reduced visibility',
      'Passengers with low trust scores may face booking restrictions'
    ]
  };
}

module.exports = {
  calculateCancellationPenalty,
  processCancellation,
  getCancellationPolicyInfo,
  CANCELLATION_CONFIG
};
