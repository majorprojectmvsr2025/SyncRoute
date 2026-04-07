const mongoose = require("mongoose");
const User = require("./models/User");
const Ride = require("./models/Ride");
const axios = require("axios");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/syncroute";

// Sample users
const users = [
  {
    name: "John Doe",
    email: "john.doe@example.com",
    password: "password123",
    phone: "+1234567890",
    role: "driver",
    rating: 4.8,
    trips: 156,
    verified: true
  },
  {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    password: "password123",
    phone: "+1234567891",
    role: "passenger",
    rating: 4.9,
    trips: 89,
    verified: true
  },
  {
    name: "Marcus Chen",
    email: "marcus@syncroute.com",
    password: "password123",
    phone: "+49 170 1234567",
    role: "driver",
    rating: 4.9,
    trips: 342,
    verified: true
  },
  {
    name: "Sophia Andersen",
    email: "sophia@syncroute.com",
    password: "password123",
    phone: "+49 170 2345678",
    role: "driver",
    rating: 4.8,
    trips: 189,
    verified: true
  },
  {
    name: "Elena Volkov",
    email: "elena@syncroute.com",
    password: "password123",
    phone: "+49 170 3456789",
    role: "driver",
    rating: 5.0,
    trips: 512,
    verified: true
  },
  {
    name: "Test Passenger",
    email: "passenger@test.com",
    password: "password123",
    phone: "+49 170 9999999",
    role: "passenger",
    rating: 4.7,
    trips: 45,
    verified: false
  }
];

// Sample routes
const routes = [
  {
    from: { name: "Berlin Hauptbahnhof", lat: 52.5250, lng: 13.3694 },
    to: { name: "Munich Central", lat: 48.1402, lng: 11.5581 },
    departureTime: "06:30",
    price: 38,
    vehicleType: "Sedan",
    vehicleModel: "Tesla Model 3",
    stops: ["Leipzig", "Nuremberg"]
  },
  {
    from: { name: "Berlin Hauptbahnhof", lat: 52.5250, lng: 13.3694 },
    to: { name: "Munich Central", lat: 48.1402, lng: 11.5581 },
    departureTime: "08:00",
    price: 35,
    vehicleType: "SUV",
    vehicleModel: "BMW X3",
    stops: ["Nuremberg"]
  },
  {
    from: { name: "Hamburg Hbf", lat: 53.5528, lng: 10.0067 },
    to: { name: "Berlin Hauptbahnhof", lat: 52.5250, lng: 13.3694 },
    departureTime: "09:00",
    price: 28,
    vehicleType: "Sedan",
    vehicleModel: "Audi A4",
    stops: []
  },
  {
    from: { name: "Frankfurt am Main", lat: 50.1069, lng: 8.6617 },
    to: { name: "Stuttgart Hbf", lat: 48.7840, lng: 9.1829 },
    departureTime: "14:00",
    price: 22,
    vehicleType: "Compact",
    vehicleModel: "VW Golf",
    stops: []
  },
  {
    from: { name: "Berlin Hauptbahnhof", lat: 52.5250, lng: 13.3694 },
    to: { name: "Dresden", lat: 51.0407, lng: 13.7320 },
    departureTime: "11:30",
    price: 18,
    vehicleType: "Sedan",
    vehicleModel: "Mercedes C-Class",
    stops: []
  }
];

async function getRouteCoordinates(fromLng, fromLat, toLng, toLat) {
  try {
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const response = await axios.get(osrmUrl);
    
    if (response.data.routes && response.data.routes.length > 0) {
      return response.data.routes[0].geometry.coordinates;
    }
  } catch (error) {
    console.error("Error fetching route:", error.message);
  }
  return [[fromLng, fromLat], [toLng, toLat]];
}

async function seedDatabase() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    console.log("Clearing existing data...");
    await User.deleteMany({});
    await Ride.deleteMany({});
    console.log("Existing data cleared");

    // Create users
    console.log("Creating users...");
    const createdUsers = await User.create(users);
    console.log(`Created ${createdUsers.length} users`);

    // Create rides
    console.log("Creating rides...");
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const driver = createdUsers[i % 3]; // Rotate through first 3 users (drivers)

      console.log(`Fetching route for ${route.from.name} -> ${route.to.name}...`);
      const routeCoords = await getRouteCoordinates(
        route.from.lng,
        route.from.lat,
        route.to.lng,
        route.to.lat
      );

      const ride = await Ride.create({
        driver: driver._id,
        from: {
          name: route.from.name,
          location: {
            type: "Point",
            coordinates: [route.from.lng, route.from.lat]
          }
        },
        to: {
          name: route.to.name,
          location: {
            type: "Point",
            coordinates: [route.to.lng, route.to.lat]
          }
        },
        routePath: {
          type: "LineString",
          coordinates: routeCoords
        },
        departureTime: route.departureTime,
        date: dateStr,
        price: route.price,
        availableSeats: 4,
        totalSeats: 4,
        vehicleType: route.vehicleType,
        vehicleModel: route.vehicleModel,
        instantBooking: true,
        genderPreference: "any",
        stops: route.stops,
        status: "active"
      });

      console.log(`Created ride: ${ride.from.name} -> ${ride.to.name}`);
    }

    console.log("\n✅ Database seeded successfully!");
    console.log("\nTest Accounts:");
    console.log("================");
    users.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email} / password123`);
    });
    console.log("\nYou can now login with any of these accounts!");

  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  }
}

seedDatabase();
