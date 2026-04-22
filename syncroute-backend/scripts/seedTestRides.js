/**
 * Seed script to add test rides to the database
 * Run with: node scripts/seedTestRides.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const User = require('../models/User');

// Hyderabad location coordinates (approximate)
const LOCATIONS = {
  'Balapur': { lat: 17.3180, lng: 78.4890 },
  'LB Nagar': { lat: 17.3457, lng: 78.5522 },
  'MVSR Engineering College': { lat: 17.3284, lng: 78.5382 },
  'Vanasthalipuram': { lat: 17.3279, lng: 78.5456 },
  'Dilsukhnagar': { lat: 17.3688, lng: 78.5247 },
  'Gachibowli': { lat: 17.4401, lng: 78.3489 },
  'HITEC City': { lat: 17.4486, lng: 78.3908 },
  'Miyapur': { lat: 17.4969, lng: 78.3548 },
  'Secunderabad': { lat: 17.4399, lng: 78.4983 },
  'Shamshabad Airport': { lat: 17.2403, lng: 78.4294 },
  'Uppal': { lat: 17.4065, lng: 78.5596 },
  'Kukatpally': { lat: 17.4947, lng: 78.3996 },
  'Financial District': { lat: 17.4239, lng: 78.3424 },
  'Banjara Hills': { lat: 17.4138, lng: 78.4461 },
  'Charminar': { lat: 17.3616, lng: 78.4747 },
  'Mehdipatnam': { lat: 17.3950, lng: 78.4423 },
  'Tolichowki': { lat: 17.4043, lng: 78.4121 },
  'Ameerpet': { lat: 17.4375, lng: 78.4483 },
  'Jubilee Hills': { lat: 17.4326, lng: 78.4071 },
  'Raidurg': { lat: 17.4268, lng: 78.3828 },
  'Shamshabad': { lat: 17.2403, lng: 78.4294 },
};

// Generate route coordinates between two points (simple linear interpolation)
function generateRouteCoordinates(from, to) {
  const steps = 10;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const lng = from.lng + (to.lng - from.lng) * (i / steps);
    const lat = from.lat + (to.lat - from.lat) * (i / steps);
    coords.push([lng, lat]);
  }
  return coords;
}

const TEST_RIDES = [
  { from: 'Balapur', to: 'LB Nagar', date: '2026-04-10', time: '8:15 AM', vehicle: 'Compact', seats: 3 },
  { from: 'LB Nagar', to: 'MVSR Engineering College', date: '2026-04-10', time: '9:00 AM', vehicle: 'Sedan', seats: 3, instant: true, style: 'chatty' },
  { from: 'Vanasthalipuram', to: 'Dilsukhnagar', date: '2026-04-10', time: '6:30 PM', vehicle: 'Compact', seats: 3, style: 'quiet' },
  { from: 'MVSR Engineering College', to: 'Balapur', date: '2026-04-10', time: '4:45 PM', vehicle: 'SUV', seats: 5, women: true },
  { from: 'Gachibowli', to: 'HITEC City', date: '2026-04-11', time: '9:15 AM', vehicle: 'Compact', seats: 3, style: 'chatty' },
  { from: 'Miyapur', to: 'Secunderabad', date: '2026-04-11', time: '8:00 AM', vehicle: 'SUV', seats: 5 },
  { from: 'Balapur', to: 'Shamshabad Airport', date: '2026-04-11', time: '5:00 AM', vehicle: 'Sedan', seats: 3, instant: true },
  { from: 'Uppal', to: 'MVSR Engineering College', date: '2026-04-11', time: '9:10 AM', vehicle: 'Van', seats: 7, style: 'flexible' },
  { from: 'MVSR Engineering College', to: 'Dilsukhnagar', date: '2026-04-11', time: '5:15 PM', vehicle: 'Compact', seats: 3 },
  { from: 'Kukatpally', to: 'Financial District', date: '2026-04-12', time: '8:45 AM', vehicle: 'SUV', seats: 5, instant: true, style: 'chatty' },
  { from: 'Banjara Hills', to: 'Charminar', date: '2026-04-12', time: '6:00 PM', vehicle: 'Sedan', seats: 3 },
  { from: 'Mehdipatnam', to: 'Tolichowki', date: '2026-04-12', time: '7:30 PM', vehicle: 'Compact', seats: 3, women: true },
  { from: 'Secunderabad', to: 'Shamshabad Airport', date: '2026-04-13', time: '4:30 AM', vehicle: 'Van', seats: 7 },
  { from: 'LB Nagar', to: 'Gachibowli', date: '2026-04-13', time: '9:00 AM', vehicle: 'SUV', seats: 5, style: 'chatty' },
  { from: 'MVSR Engineering College', to: 'Vanasthalipuram', date: '2026-04-13', time: '4:50 PM', vehicle: 'Compact', seats: 3, style: 'quiet' },
  { from: 'Ameerpet', to: 'Jubilee Hills', date: '2026-04-14', time: '10:30 AM', vehicle: 'Sedan', seats: 3 },
  { from: 'Balapur', to: 'MVSR Engineering College', date: '2026-04-14', time: '8:40 AM', vehicle: 'Compact', seats: 3, women: true, style: 'chatty' },
  { from: 'Raidurg', to: 'Uppal', date: '2026-04-14', time: '6:30 PM', vehicle: 'SUV', seats: 5 },
  { from: 'Shamshabad', to: 'Banjara Hills', date: '2026-04-15', time: '7:15 AM', vehicle: 'Sedan', seats: 3, instant: true },
  { from: 'Dilsukhnagar', to: 'MVSR Engineering College', date: '2026-04-15', time: '9:05 AM', vehicle: 'Compact', seats: 3, style: 'flexible' },
];

async function seedRides() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/syncroute');
    console.log('Connected to MongoDB');

    // Find a test user to use as driver (or create one)
    let testDriver = await User.findOne({ email: 'testdriver@syncroute.com' });
    
    if (!testDriver) {
      console.log('Creating test driver user...');
      testDriver = await User.create({
        name: 'Test Driver',
        email: 'testdriver@syncroute.com',
        password: 'hashedpassword123',
        phone: '9876543210',
        isVerified: true,
        isDriver: true,
        dateOfBirth: new Date('1995-05-15'),
      });
      console.log('Created test driver:', testDriver._id);
    } else {
      console.log('Using existing test driver:', testDriver._id);
    }

    // Clear existing test rides from this driver
    const deleted = await Ride.deleteMany({ driver: testDriver._id });
    console.log(`Deleted ${deleted.deletedCount} existing test rides`);

    // Create rides
    const ridesToCreate = [];
    
    for (const ride of TEST_RIDES) {
      const fromLoc = LOCATIONS[ride.from];
      const toLoc = LOCATIONS[ride.to];
      
      if (!fromLoc || !toLoc) {
        console.warn(`Skipping ride: Unknown location ${ride.from} or ${ride.to}`);
        continue;
      }

      const routeCoords = generateRouteCoordinates(fromLoc, toLoc);
      
      // Calculate approximate price based on distance
      const distance = Math.sqrt(
        Math.pow((toLoc.lat - fromLoc.lat) * 111, 2) + 
        Math.pow((toLoc.lng - fromLoc.lng) * 85, 2)
      );
      const price = Math.round(distance * 15 + 50); // ₹15/km + ₹50 base

      ridesToCreate.push({
        driver: testDriver._id,
        from: {
          name: ride.from,
          location: {
            type: 'Point',
            coordinates: [fromLoc.lng, fromLoc.lat]
          }
        },
        to: {
          name: ride.to,
          location: {
            type: 'Point',
            coordinates: [toLoc.lng, toLoc.lat]
          }
        },
        routePath: {
          type: 'LineString',
          coordinates: routeCoords
        },
        date: ride.date,
        departureTime: ride.time,
        price: price,
        availableSeats: ride.seats,
        totalSeats: ride.seats,
        vehicleType: ride.vehicle,
        instantBooking: ride.instant || false,
        genderPreference: ride.women ? 'women-only' : 'any',
        conversationStyle: ride.style || 'flexible',
        musicPreference: Math.random() > 0.5 ? 'any' : 'soft',
        smokingAllowed: false,
        estimatedDistance: Math.round(distance * 1000),
        estimatedDuration: Math.round(distance * 2.5 * 60), // ~2.5 min per km
        status: 'active'
      });
    }

    const created = await Ride.insertMany(ridesToCreate);
    console.log(`\n✓ Created ${created.length} test rides successfully!\n`);
    
    // Show summary
    console.log('Rides created:');
    for (const ride of created) {
      console.log(`  • ${ride.from.name} → ${ride.to.name} | ${ride.date} ${ride.departureTime} | ${ride.vehicleType} | ₹${ride.price}`);
    }

    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding rides:', error);
    process.exit(1);
  }
}

seedRides();
