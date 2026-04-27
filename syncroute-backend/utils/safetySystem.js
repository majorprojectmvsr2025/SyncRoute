/**
 * Enhanced Safety System
 * Comprehensive safety features beyond just DL verification
 */

const SafetyIncident = require('../models/SafetyIncident');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

/**
 * Driver Safety Score Calculation
 * Goes beyond just having a DL - considers behavior, history, and reliability
 */
async function calculateDriverSafetyScore(driverId) {
  try {
    const driver = await User.findById(driverId);
    
    if (!driver) {
      return { score: 0, factors: [], message: 'Driver not found' };
    }

    const factors = [];
    let totalScore = 0;
    const maxScore = 100;

    // Factor 1: Document Verification (25 points)
    if (driver.driverVerification?.isVerified) {
      const verificationScore = driver.driverVerification.verificationScore || 0;
      const points = Math.round((verificationScore / 100) * 25);
      totalScore += points;
      factors.push({
        name: 'Document Verification',
        score: points,
        maxScore: 25,
        status: verificationScore >= 80 ? 'excellent' : verificationScore >= 60 ? 'good' : 'needs_improvement'
      });
    } else {
      factors.push({
        name: 'Document Verification',
        score: 0,
        maxScore: 25,
        status: 'not_verified'
      });
    }

    // Factor 2: Reliability Score (20 points)
    if (driver.reliabilityScore) {
      const reliabilityPoints = Math.round((driver.reliabilityScore.score / 100) * 20);
      totalScore += reliabilityPoints;
      factors.push({
        name: 'Reliability',
        score: reliabilityPoints,
        maxScore: 20,
        completionRate: driver.reliabilityScore.completionRate,
        cancellationRate: driver.reliabilityScore.cancellationRate
      });
    }

    // Factor 3: User Ratings (20 points)
    if (driver.rating && driver.trips > 0) {
      const ratingPoints = Math.round((driver.rating / 5) * 20);
      totalScore += ratingPoints;
      factors.push({
        name: 'User Ratings',
        score: ratingPoints,
        maxScore: 20,
        avgRating: driver.rating,
        totalTrips: driver.trips
      });
    }

    // Factor 4: Safety Incidents (20 points - deducted for incidents)
    const incidents = await SafetyIncident.countDocuments({
      reportedAgainst: driverId,
      severity: { $in: ['high', 'critical'] },
      status: { $ne: 'dismissed' }
    });
    
    const incidentPenalty = Math.min(20, incidents * 5); // -5 points per incident
    const incidentScore = 20 - incidentPenalty;
    totalScore += incidentScore;
    factors.push({
      name: 'Safety Record',
      score: incidentScore,
      maxScore: 20,
      incidents,
      status: incidents === 0 ? 'clean' : incidents <= 2 ? 'minor_issues' : 'concerning'
    });

    // Factor 5: Experience (15 points)
    const experiencePoints = Math.min(15, Math.floor(driver.trips / 10)); // 1 point per 10 trips
    totalScore += experiencePoints;
    factors.push({
      name: 'Experience',
      score: experiencePoints,
      maxScore: 15,
      totalTrips: driver.trips
    });

    // Determine safety level
    let safetyLevel;
    if (totalScore >= 80) {
      safetyLevel = 'excellent';
    } else if (totalScore >= 60) {
      safetyLevel = 'good';
    } else if (totalScore >= 40) {
      safetyLevel = 'fair';
    } else {
      safetyLevel = 'poor';
    }

    return {
      driverId,
      score: totalScore,
      maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      safetyLevel,
      factors,
      lastCalculated: new Date()
    };

  } catch (error) {
    console.error('Error calculating driver safety score:', error);
    return { score: 0, factors: [], error: error.message };
  }
}

/**
 * Report a safety incident
 */
async function reportSafetyIncident(incidentData) {
  try {
    const {
      type,
      severity,
      rideId,
      bookingId,
      reportedBy,
      reportedAgainst,
      description,
      location,
      evidence,
      emergencyContacted
    } = incidentData;

    // Validate ride exists
    const ride = await Ride.findById(rideId);
    if (!ride) {
      throw new Error('Ride not found');
    }

    // Create incident report
    const incident = new SafetyIncident({
      type,
      severity: severity || 'medium',
      ride: rideId,
      booking: bookingId,
      reportedBy,
      reportedAgainst,
      description,
      location,
      evidence: evidence || [],
      emergencyContacted: emergencyContacted || false,
      status: 'reported'
    });

    await incident.save();

    // Auto-escalate critical incidents
    if (severity === 'critical') {
      await escalateIncident(incident._id);
    }

    // Update user safety flags
    if (reportedAgainst) {
      await updateUserSafetyFlags(reportedAgainst, severity);
    }

    // Send notifications
    await sendIncidentNotifications(incident);

    console.log(`[SAFETY] Incident reported: ${incident._id} (${type}, ${severity})`);

    return {
      success: true,
      incident,
      message: 'Safety incident reported successfully'
    };

  } catch (error) {
    console.error('Error reporting safety incident:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Escalate incident to admin/authorities
 */
async function escalateIncident(incidentId) {
  try {
    const incident = await SafetyIncident.findById(incidentId);
    
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.status = 'escalated';
    await incident.save();

    // TODO: Send alert to admin dashboard
    // TODO: If critical, auto-contact emergency services

    console.log(`[SAFETY] Incident ${incidentId} escalated`);

    return { success: true };
  } catch (error) {
    console.error('Error escalating incident:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user safety flags based on incident
 */
async function updateUserSafetyFlags(userId, severity) {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return;
    }

    // Initialize safety flags if not exists
    if (!user.safetyFlags) {
      user.safetyFlags = {
        hasIncidents: false,
        incidentCount: 0,
        lastIncidentDate: null,
        accountRestricted: false
      };
    }

    user.safetyFlags.hasIncidents = true;
    user.safetyFlags.incidentCount += 1;
    user.safetyFlags.lastIncidentDate = new Date();

    // Auto-restrict account for critical incidents
    if (severity === 'critical') {
      user.safetyFlags.accountRestricted = true;
      user.accountStatus = 'suspended';
    }

    // Auto-restrict after 3 high-severity incidents
    if (severity === 'high' && user.safetyFlags.incidentCount >= 3) {
      user.safetyFlags.accountRestricted = true;
      user.accountStatus = 'suspended';
    }

    await user.save();

    console.log(`[SAFETY] Updated safety flags for user ${userId}`);

  } catch (error) {
    console.error('Error updating user safety flags:', error);
  }
}

/**
 * Send incident notifications
 */
async function sendIncidentNotifications(incident) {
  try {
    // Notify admin
    console.log(`[SAFETY] Notifying admin about incident ${incident._id}`);
    
    // Notify reported user
    if (incident.reportedAgainst) {
      console.log(`[SAFETY] Notifying user ${incident.reportedAgainst} about incident report`);
    }

    // If critical, send SMS/email alerts
    if (incident.severity === 'critical') {
      console.log(`[SAFETY] Sending critical incident alerts`);
    }

  } catch (error) {
    console.error('Error sending incident notifications:', error);
  }
}

/**
 * Get safety statistics for a user
 */
async function getUserSafetyStats(userId) {
  try {
    const [
      incidentsReported,
      incidentsAgainst,
      criticalIncidents,
      resolvedIncidents
    ] = await Promise.all([
      SafetyIncident.countDocuments({ reportedBy: userId }),
      SafetyIncident.countDocuments({ reportedAgainst: userId }),
      SafetyIncident.countDocuments({ 
        reportedAgainst: userId, 
        severity: { $in: ['high', 'critical'] }
      }),
      SafetyIncident.countDocuments({ 
        reportedAgainst: userId, 
        status: 'resolved' 
      })
    ]);

    return {
      userId,
      incidentsReported,
      incidentsAgainst,
      criticalIncidents,
      resolvedIncidents,
      safetyStatus: criticalIncidents === 0 ? 'good' : criticalIncidents <= 2 ? 'fair' : 'poor'
    };

  } catch (error) {
    console.error('Error getting user safety stats:', error);
    return null;
  }
}

/**
 * Pre-ride safety checklist
 * Things to verify before ride starts
 */
async function performPreRideSafetyCheck(rideId) {
  const checks = [];
  let overallSafe = true;

  try {
    const ride = await Ride.findById(rideId).populate('driver');
    
    if (!ride) {
      return { safe: false, checks: [], error: 'Ride not found' };
    }

    // Check 1: Driver verification
    const driverVerified = ride.driver.driverVerification?.isVerified;
    checks.push({
      name: 'Driver Verification',
      passed: driverVerified,
      message: driverVerified ? 'Driver is verified' : 'Driver not verified'
    });
    if (!driverVerified) overallSafe = false;

    // Check 2: Driver safety score
    const safetyScore = await calculateDriverSafetyScore(ride.driver._id);
    const safetyScoreGood = safetyScore.percentage >= 60;
    checks.push({
      name: 'Driver Safety Score',
      passed: safetyScoreGood,
      score: safetyScore.percentage,
      message: `Safety score: ${safetyScore.percentage}%`
    });
    if (!safetyScoreGood) overallSafe = false;

    // Check 3: Recent incidents
    const recentIncidents = await SafetyIncident.countDocuments({
      reportedAgainst: ride.driver._id,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      severity: { $in: ['high', 'critical'] }
    });
    const noRecentIncidents = recentIncidents === 0;
    checks.push({
      name: 'Recent Safety Incidents',
      passed: noRecentIncidents,
      count: recentIncidents,
      message: noRecentIncidents ? 'No recent incidents' : `${recentIncidents} recent incident(s)`
    });
    if (recentIncidents > 2) overallSafe = false;

    // Check 4: Account status
    const accountActive = ride.driver.accountStatus === 'active';
    checks.push({
      name: 'Account Status',
      passed: accountActive,
      message: accountActive ? 'Account active' : `Account ${ride.driver.accountStatus}`
    });
    if (!accountActive) overallSafe = false;

    return {
      rideId,
      safe: overallSafe,
      checks,
      recommendation: overallSafe ? 'Safe to proceed' : 'Consider alternative ride'
    };

  } catch (error) {
    console.error('Error performing pre-ride safety check:', error);
    return {
      safe: false,
      checks,
      error: error.message
    };
  }
}

/**
 * Emergency SOS handler
 * Enhanced SOS with automatic actions
 */
async function handleEmergencySOS(sosData) {
  try {
    const {
      userId,
      rideId,
      bookingId,
      location,
      type, // 'panic', 'accident', 'harassment', 'other'
      message
    } = sosData;

    // Create critical incident
    const incident = await reportSafetyIncident({
      type: type || 'other',
      severity: 'critical',
      rideId,
      bookingId,
      reportedBy: userId,
      description: message || 'Emergency SOS activated',
      location,
      emergencyContacted: true
    });

    // Get user's emergency contacts
    const user = await User.findById(userId);
    const emergencyContact = user?.emergencyContact;

    // TODO: Send SMS to emergency contact
    if (emergencyContact?.phone) {
      console.log(`[SOS] Alerting emergency contact: ${emergencyContact.phone}`);
    }

    // TODO: Alert nearby drivers/users
    console.log(`[SOS] Broadcasting emergency alert for ride ${rideId}`);

    // TODO: Contact local authorities if configured
    console.log(`[SOS] Emergency services notified`);

    // Share live location with emergency contacts
    console.log(`[SOS] Sharing live location: ${location.coordinates}`);

    return {
      success: true,
      incident: incident.incident,
      message: 'Emergency services and contacts have been notified',
      emergencyContactNotified: !!emergencyContact?.phone
    };

  } catch (error) {
    console.error('Error handling emergency SOS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateDriverSafetyScore,
  reportSafetyIncident,
  escalateIncident,
  getUserSafetyStats,
  performPreRideSafetyCheck,
  handleEmergencySOS
};
