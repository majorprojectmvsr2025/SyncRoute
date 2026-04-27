/**
 * Concurrent Booking Handler
 * Prevents race conditions when multiple users book the same ride simultaneously
 * Uses MongoDB transactions and optimistic locking
 */

const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

/**
 * Create booking with transaction to prevent race conditions
 * @param {Object} bookingData - Booking details
 * @param {string} bookingData.rideId - Ride ID
 * @param {string} bookingData.passengerId - Passenger user ID
 * @param {number} bookingData.seats - Number of seats to book
 * @param {Object} bookingData.pickupLocation - Pickup location
 * @param {Object} bookingData.dropLocation - Drop location
 * @param {number} bookingData.totalPrice - Total price
 * @returns {Promise<Object>} Created booking or error
 */
async function createBookingWithTransaction(bookingData) {
  const session = await mongoose.startSession();
  
  try {
    // Start transaction
    session.startTransaction();

    const {
      rideId,
      passengerId,
      seats,
      pickupLocation,
      dropLocation,
      totalPrice
    } = bookingData;

    // Step 1: Find and lock the ride document
    const ride = await Ride.findById(rideId).session(session);

    if (!ride) {
      throw new Error('Ride not found');
    }

    // Step 2: Check ride status
    if (ride.status !== 'active') {
      throw new Error(`Ride is ${ride.status} and cannot be booked`);
    }

    // Step 3: Check if ride date is in the future
    const rideDateTime = new Date(`${ride.date}T${ride.departureTime}:00`);
    if (rideDateTime < new Date()) {
      throw new Error('Cannot book a ride that has already started or passed');
    }

    // Step 4: Check available seats (CRITICAL - prevents overbooking)
    if (ride.availableSeats < seats) {
      throw new Error(`Only ${ride.availableSeats} seat(s) available, but ${seats} requested`);
    }

    // Step 5: Check if passenger is not the driver
    if (ride.driver.toString() === passengerId.toString()) {
      throw new Error('Driver cannot book their own ride');
    }

    // Step 6: Check if passenger already has a booking for this ride
    const existingBooking = await Booking.findOne({
      ride: rideId,
      passenger: passengerId,
      status: { $in: ['pending', 'confirmed'] }
    }).session(session);

    if (existingBooking) {
      throw new Error('You already have a booking for this ride');
    }

    // Step 7: Update ride available seats atomically
    const updateResult = await Ride.updateOne(
      {
        _id: rideId,
        availableSeats: { $gte: seats }, // Double-check seats are still available
        status: 'active'
      },
      {
        $inc: { availableSeats: -seats }
      },
      { session }
    );

    // Check if update was successful
    if (updateResult.modifiedCount === 0) {
      throw new Error('Seats no longer available. Another user may have booked them.');
    }

    // Step 8: Create the booking
    const booking = new Booking({
      ride: rideId,
      passenger: passengerId,
      driver: ride.driver,
      seats,
      totalPrice,
      pickupLocation,
      dropLocation,
      status: 'confirmed', // Instant booking
      bookingMetadata: {
        ipAddress: bookingData.ipAddress || 'unknown',
        deviceId: bookingData.deviceId || 'unknown',
        userAgent: bookingData.userAgent || 'unknown',
        bookingSource: bookingData.bookingSource || 'web'
      }
    });

    await booking.save({ session });

    // Step 9: Commit transaction
    await session.commitTransaction();

    console.log(`[BOOKING] Successfully created booking ${booking._id} for ride ${rideId}`);

    return {
      success: true,
      booking: await Booking.findById(booking._id).populate('ride passenger driver'),
      message: 'Booking confirmed successfully'
    };

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    
    console.error('[BOOKING ERROR]', error.message);

    return {
      success: false,
      error: error.message,
      booking: null
    };
  } finally {
    // End session
    session.endSession();
  }
}

/**
 * Cancel booking with transaction
 * Ensures seat count is properly restored
 */
async function cancelBookingWithTransaction(bookingId, cancelledBy, reason) {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Find booking
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking already cancelled');
    }

    if (booking.status === 'completed') {
      throw new Error('Cannot cancel completed booking');
    }

    // Verify cancellation permission
    const isDriver = booking.driver.toString() === cancelledBy.toString();
    const isPassenger = booking.passenger.toString() === cancelledBy.toString();

    if (!isDriver && !isPassenger) {
      throw new Error('Unauthorized to cancel this booking');
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.cancellationDetails = {
      cancelledBy,
      cancelledAt: new Date(),
      reason
    };
    await booking.save({ session });

    // Restore seats to ride
    await Ride.updateOne(
      { _id: booking.ride },
      { $inc: { availableSeats: booking.seats } },
      { session }
    );

    await session.commitTransaction();

    console.log(`[BOOKING] Successfully cancelled booking ${bookingId}`);

    return {
      success: true,
      booking,
      message: 'Booking cancelled successfully'
    };

  } catch (error) {
    await session.abortTransaction();
    
    console.error('[CANCELLATION ERROR]', error.message);

    return {
      success: false,
      error: error.message
    };
  } finally {
    session.endSession();
  }
}

/**
 * Batch booking validation
 * Checks if multiple bookings can be made simultaneously
 */
async function validateBatchBookings(bookings) {
  const results = [];

  for (const bookingData of bookings) {
    try {
      const ride = await Ride.findById(bookingData.rideId);

      if (!ride) {
        results.push({
          rideId: bookingData.rideId,
          valid: false,
          reason: 'Ride not found'
        });
        continue;
      }

      if (ride.availableSeats < bookingData.seats) {
        results.push({
          rideId: bookingData.rideId,
          valid: false,
          reason: `Only ${ride.availableSeats} seats available`
        });
        continue;
      }

      results.push({
        rideId: bookingData.rideId,
        valid: true,
        availableSeats: ride.availableSeats
      });

    } catch (error) {
      results.push({
        rideId: bookingData.rideId,
        valid: false,
        reason: error.message
      });
    }
  }

  return results;
}

/**
 * Get booking statistics for monitoring
 */
async function getBookingStats(timeframe = '24h') {
  const timeMap = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  const startTime = new Date(Date.now() - timeMap[timeframe]);

  const [totalBookings, confirmedBookings, cancelledBookings, failedAttempts] = await Promise.all([
    Booking.countDocuments({ createdAt: { $gte: startTime } }),
    Booking.countDocuments({ createdAt: { $gte: startTime }, status: 'confirmed' }),
    Booking.countDocuments({ createdAt: { $gte: startTime }, status: 'cancelled' }),
    // Failed attempts would be tracked in a separate collection in production
    Promise.resolve(0)
  ]);

  return {
    timeframe,
    totalBookings,
    confirmedBookings,
    cancelledBookings,
    failedAttempts,
    successRate: totalBookings > 0 ? ((confirmedBookings / totalBookings) * 100).toFixed(2) : 0,
    cancellationRate: totalBookings > 0 ? ((cancelledBookings / totalBookings) * 100).toFixed(2) : 0
  };
}

/**
 * Retry mechanism for failed bookings
 * Attempts to rebook if seats become available
 */
async function retryFailedBooking(bookingData, maxRetries = 3, delayMs = 1000) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;

    console.log(`[BOOKING RETRY] Attempt ${attempt}/${maxRetries} for ride ${bookingData.rideId}`);

    const result = await createBookingWithTransaction(bookingData);

    if (result.success) {
      return result;
    }

    lastError = result.error;

    // Don't retry if error is not related to availability
    if (!result.error.includes('available') && !result.error.includes('booked')) {
      break;
    }

    // Wait before retrying
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  return {
    success: false,
    error: lastError || 'Booking failed after retries',
    attempts: attempt
  };
}

/**
 * Check for potential race conditions
 * Monitors concurrent booking attempts
 */
const bookingAttempts = new Map();

function trackBookingAttempt(rideId, userId) {
  const key = `${rideId}_${userId}`;
  const now = Date.now();

  if (bookingAttempts.has(key)) {
    const lastAttempt = bookingAttempts.get(key);
    
    // If attempt was less than 1 second ago, it's suspicious
    if (now - lastAttempt < 1000) {
      console.warn(`[RACE CONDITION] Rapid booking attempts detected: ${key}`);
      return false;
    }
  }

  bookingAttempts.set(key, now);

  // Clean up old entries (older than 5 minutes)
  for (const [k, timestamp] of bookingAttempts.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      bookingAttempts.delete(k);
    }
  }

  return true;
}

module.exports = {
  createBookingWithTransaction,
  cancelBookingWithTransaction,
  validateBatchBookings,
  getBookingStats,
  retryFailedBooking,
  trackBookingAttempt
};
