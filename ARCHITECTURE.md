# SyncRoute System Architecture Documentation

## Overview

SyncRoute is a modern carpooling platform built with a microservices-oriented architecture, featuring real-time communication, ML-powered recommendations, and advanced ride matching algorithms.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Web Client    │  │  Mobile Client  │  │   Admin Panel   │              │
│  │  (React + TS)   │  │   (Future)      │  │   (Future)      │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                        │
│           └────────────────────┼────────────────────┘                        │
│                                │                                             │
│                    ┌───────────▼───────────┐                                 │
│                    │   API Gateway Layer   │                                 │
│                    │  (Express + Socket.io)│                                 │
│                    └───────────┬───────────┘                                 │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│                         BACKEND SERVICES                                     │
├────────────────────────────────┼────────────────────────────────────────────┤
│                                │                                             │
│  ┌─────────────────────────────▼─────────────────────────────────────┐      │
│  │                        EXPRESS SERVER                              │      │
│  │  ┌──────────────┬──────────────┬──────────────┬──────────────┐    │      │
│  │  │   Auth API   │   Ride API   │  Booking API │  Message API │    │      │
│  │  └──────────────┴──────────────┴──────────────┴──────────────┘    │      │
│  │  ┌──────────────┬──────────────┬──────────────┬──────────────┐    │      │
│  │  │  Review API  │   SOS API    │ Tracking API │ Advanced API │    │      │
│  │  └──────────────┴──────────────┴──────────────┴──────────────┘    │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                 │                                            │
│  ┌──────────────────────────────┼──────────────────────────────────────┐    │
│  │                    UTILITY MODULES                                   │    │
│  │  ┌────────────────┬────────────────┬────────────────┐               │    │
│  │  │ Graph Matching │ Dynamic Pricing│ Search Cache   │               │    │
│  │  │  (A* Search)   │ (Demand-based) │ (LRU + TTL)    │               │    │
│  │  └────────────────┴────────────────┴────────────────┘               │    │
│  │  ┌────────────────┬────────────────┬────────────────┐               │    │
│  │  │ Fraud Detection│ Carbon Impact  │ Demand Forecast│               │    │
│  │  │ (5 Analyzers)  │ (CO2/Fuel)     │ (Time-series)  │               │    │
│  │  └────────────────┴────────────────┴────────────────┘               │    │
│  │  ┌────────────────┬────────────────┬────────────────┐               │    │
│  │  │ PRIE System    │ Smart Notify   │ Notification Q │               │    │
│  │  │ (ML Scoring)   │ (Cooldowns)    │ (Priority Q)   │               │    │
│  │  └────────────────┴────────────────┴────────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                 │                                            │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────────────┐
│                          DATA LAYER                                          │
├─────────────────────────────────┼────────────────────────────────────────────┤
│  ┌──────────────────────────────▼──────────────────────────────────────┐    │
│  │                         MONGODB                                      │    │
│  │  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐      │    │
│  │  │  Users  │  Rides  │Bookings │Messages │ Reviews │  SOS    │      │    │
│  │  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘      │    │
│  │  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐      │    │
│  │  │Tracking │Waitlist │Behavior │Preference│Notif.  │Documents│      │    │
│  │  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐                       │
│  │   In-Memory Cache     │  │   Session Store       │                       │
│  │   (LRU + TTL)         │  │   (Rate Limits)       │                       │
│  └───────────────────────┘  └───────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RIDE BOOKING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐                                              ┌──────────┐
     │  User    │                                              │  Driver  │
     └────┬─────┘                                              └────┬─────┘
          │                                                         │
          │ 1. Search Rides                                         │
          │────────────────────────────────────────────────────────▶│
          │                                                         │
     ┌────▼─────┐                                                   │
     │  Search  │ 2. Check Cache                                    │
     │  Cache   │◄──────────────────┐                               │
     └────┬─────┘                   │                               │
          │                         │                               │
          │ 3. Cache Miss ──────────┘                               │
          │                                                         │
     ┌────▼─────┐                                                   │
     │ Graph    │ 4. Calculate Route Overlap                        │
     │ Matching │─────────────────────────────────────────────────▶│
     └────┬─────┘                                                   │
          │                                                         │
     ┌────▼─────┐                                                   │
     │ PRIE     │ 5. Personalized Scoring                           │
     │ Scorer   │─────────────────────────────────────────────────▶│
     └────┬─────┘                                                   │
          │                                                         │
     ┌────▼─────┐                                                   │
     │ Dynamic  │ 6. Calculate Price                                │
     │ Pricing  │─────────────────────────────────────────────────▶│
     └────┬─────┘                                                   │
          │                                                         │
          │ 7. Return Ranked Results                                │
          │◄────────────────────────────────────────────────────────│
          │                                                         │
          │ 8. Create Booking                                       │
          │────────────────────────────────────────────────────────▶│
          │                                                         │
     ┌────▼─────┐                                                   │
     │ Notif.   │ 9. Queue Notification                             │
     │ Queue    │─────────────────────────────────────────────────▶│
     └────┬─────┘                                                   │
          │                                                         │
     ┌────▼─────┐                                                   │
     │ Behavior │ 10. Track Behavior                                │
     │ Tracker  │─────────────────────────────────────────────────▶│
     └──────────┘                                                   │
```

## Real-Time Tracking Sequence Diagram

```
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│ Driver  │          │ Server  │          │Socket.io│          │Passenger│
└────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │                    │
     │ 1. Start Tracking  │                    │                    │
     │───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Create Token    │                    │
     │                    │───────────────────▶│                    │
     │                    │                    │                    │
     │◄───────────────────│ 3. Return Token    │                    │
     │                    │                    │                    │
     │                    │                    │ 4. Join Room       │
     │                    │                    │◄───────────────────│
     │                    │                    │                    │
     │ 5. GPS Update      │                    │                    │
     │───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 6. Throttle Check  │                    │
     │                    │──────────┐         │                    │
     │                    │          │         │                    │
     │                    │◄─────────┘         │                    │
     │                    │                    │                    │
     │                    │ 7. Broadcast       │                    │
     │                    │───────────────────▶│                    │
     │                    │                    │                    │
     │                    │                    │ 8. Location Event  │
     │                    │                    │───────────────────▶│
     │                    │                    │                    │
     │ 9. Deviation Check │                    │                    │
     │───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 10. SOS Alert      │                    │
     │                    │───────────────────▶│                    │
     │                    │                    │                    │
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND COMPONENTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │     PAGES       │  │   COMPONENTS    │  │    CONTEXTS     │              │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤              │
│  │ • Home          │  │ • RideCard      │  │ • AuthContext   │              │
│  │ • SearchResults │  │ • RideSearch    │  │ • SocketContext │              │
│  │ • RideDetails   │  │ • DynamicPricing│  │ • ThemeContext  │              │
│  │ • PostRide      │  │ • CarbonDashbd  │  │                 │              │
│  │ • Profile       │  │ • ChatLocation  │  │                 │              │
│  │ • Chat          │  │ • Navbar        │  │                 │              │
│  │ • LiveTrack     │  │ • Notifications │  │                 │              │
│  │ • Dashboard     │  │ • MapDisplay    │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND COMPONENTS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │     ROUTES      │  │     MODELS      │  │    UTILITIES    │              │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤              │
│  │ • authRoutes    │  │ • User          │  │ • graphMatching │              │
│  │ • rideRoutes    │  │ • Ride          │  │ • dynamicPricing│              │
│  │ • bookingRoutes │  │ • Booking       │  │ • searchCache   │              │
│  │ • messageRoutes │  │ • Message       │  │ • fraudDetection│              │
│  │ • reviewRoutes  │  │ • Review        │  │ • carbonImpact  │              │
│  │ • trackingRoutes│  │ • LiveTracking  │  │ • demandForecast│              │
│  │ • sosRoutes     │  │ • SOS           │  │ • notifQueue    │              │
│  │ • advancedRoutes│  │ • UserBehavior  │  │ • personalScorer│              │
│  │ • prieRoutes    │  │ • UserPreference│  │ • behaviorTrack │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │   MIDDLEWARE    │  │    SOCKET.IO    │                                   │
│  ├─────────────────┤  ├─────────────────┤                                   │
│  │ • auth          │  │ • connection    │                                   │
│  │ • errorHandler  │  │ • messaging     │                                   │
│  │ • rateLimiter   │  │ • tracking      │                                   │
│  │ • validation    │  │ • notifications │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ML/Algorithm Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERSONALIZED RIDE INTELLIGENCE ENGINE                     │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────────┐
    │                         DATA COLLECTION                             │
    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
    │  │   Searches   │ │   Bookings   │ │   Reviews    │ │Cancellations│ │
    │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬─────┘ │
    │         │                │                │                │        │
    │         └────────────────┼────────────────┼────────────────┘        │
    │                          │                │                         │
    │                   ┌──────▼────────────────▼──────┐                  │
    │                   │    BEHAVIOR ANALYTICS DB     │                  │
    │                   │   (UserBehaviorAnalytics)    │                  │
    │                   └──────────────┬───────────────┘                  │
    └──────────────────────────────────┼──────────────────────────────────┘
                                       │
    ┌──────────────────────────────────┼──────────────────────────────────┐
    │                         ANALYSIS LAYER                               │
    │                                  │                                   │
    │                   ┌──────────────▼───────────────┐                  │
    │                   │     PREFERENCE ANALYZER      │                  │
    │                   │                              │                  │
    │                   │  • Time pattern detection    │                  │
    │                   │  • Day preference analysis   │                  │
    │                   │  • Route clustering          │                  │
    │                   │  • Price sensitivity calc    │                  │
    │                   │  • Comfort preference learn  │                  │
    │                   └──────────────┬───────────────┘                  │
    │                                  │                                   │
    │                   ┌──────────────▼───────────────┐                  │
    │                   │    USER PREFERENCE PROFILE   │                  │
    │                   │   (UserPreferenceProfile)    │                  │
    │                   └──────────────┬───────────────┘                  │
    └──────────────────────────────────┼──────────────────────────────────┘
                                       │
    ┌──────────────────────────────────┼──────────────────────────────────┐
    │                         SCORING LAYER                                │
    │                                  │                                   │
    │   ┌──────────────────────────────▼───────────────────────────────┐  │
    │   │                   MULTI-OBJECTIVE SCORER                      │  │
    │   │                                                               │  │
    │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │
    │   │  │ Route   │ │  Time   │ │ Driver  │ │ Vehicle │ │  Price  │ │  │
    │   │  │ Match   │ │  Pref   │ │  Pref   │ │  Pref   │ │  Score  │ │  │
    │   │  │  20%    │ │  18%    │ │  15%    │ │  12%    │ │  15%    │ │  │
    │   │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │  │
    │   │       │           │           │           │           │       │  │
    │   │       └───────────┴───────────┼───────────┴───────────┘       │  │
    │   │                               │                               │  │
    │   │                    ┌──────────▼──────────┐                    │  │
    │   │                    │   WEIGHTED SCORE    │                    │  │
    │   │                    │   + Explanation     │                    │  │
    │   │                    └────────────────────┘                    │  │
    │   └───────────────────────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────────────────────┘
```

## Advanced Matching Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GRAPH-BASED RIDE MATCHING                               │
└─────────────────────────────────────────────────────────────────────────────┘

    INPUT: Passenger Route (A → B)
           Available Rides [{driver route, seats, time}]

    ┌────────────────────────────────────────────────────────────────────┐
    │                    STEP 1: ROUTE GRAPH CONSTRUCTION                 │
    │                                                                     │
    │    • Sample points along routes (500m resolution)                   │
    │    • Create nodes at each sample point                              │
    │    • Connect adjacent nodes with weighted edges                     │
    │    • Weight = Haversine distance between points                     │
    │                                                                     │
    │    Driver Route:  A ──○──○──○──○──○──○──○── B ──○──○── C           │
    │    Passenger:              A' ──○──○──○──○──○── B'                  │
    │                            └──────OVERLAP──────┘                    │
    └────────────────────────────────────────────────────────────────────┘
                                      │
    ┌────────────────────────────────▼────────────────────────────────────┐
    │                    STEP 2: A* PATH FINDING                          │
    │                                                                     │
    │    function aStarSearch(start, end):                                │
    │      openSet = PriorityQueue([(0, start)])                          │
    │      gScore[start] = 0                                              │
    │      fScore[start] = heuristic(start, end)                          │
    │                                                                     │
    │      while openSet not empty:                                       │
    │        current = openSet.pop()                                      │
    │        if current == end: return reconstructPath()                  │
    │                                                                     │
    │        for neighbor in getNeighbors(current):                       │
    │          tentative_g = gScore[current] + distance(current, neighbor)│
    │          if tentative_g < gScore[neighbor]:                         │
    │            gScore[neighbor] = tentative_g                           │
    │            fScore[neighbor] = tentative_g + heuristic(neighbor, end)│
    │            openSet.push(neighbor)                                   │
    │                                                                     │
    │    Heuristic: h(n) = haversineDistance(n, end) * 1.1               │
    └────────────────────────────────────────────────────────────────────┘
                                      │
    ┌────────────────────────────────▼────────────────────────────────────┐
    │                    STEP 3: OVERLAP CALCULATION                      │
    │                                                                     │
    │    routeOverlapScore = Σ(sharedSegments) / totalPassengerRoute      │
    │                                                                     │
    │    For each passenger segment:                                      │
    │      - Check if driver route passes within 2km                      │
    │      - Calculate shared distance                                    │
    │      - Calculate required detour                                    │
    └────────────────────────────────────────────────────────────────────┘
                                      │
    ┌────────────────────────────────▼────────────────────────────────────┐
    │                    STEP 4: MULTI-OBJECTIVE SCORING                  │
    │                                                                     │
    │    finalScore = 0.30 × routeOverlapScore                            │
    │                + 0.20 × timeCompatibilityScore                      │
    │                + 0.15 × seatAvailabilityScore                       │
    │                + 0.15 × driverReliabilityScore                      │
    │                + 0.10 × priceScore                                  │
    │                + 0.10 × preferenceMatchScore                        │
    │                                                                     │
    │    OUTPUT: Ranked list of matches with scores                       │
    └────────────────────────────────────────────────────────────────────┘
```

## Notification Queue System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION QUEUE ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────────┐
    │                         EVENT SOURCES                               │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
    │  │ Booking  │ │   SOS    │ │   Ride   │ │   Chat   │ │   ML     │ │
    │  │  Events  │ │  Alerts  │ │  Updates │ │ Messages │ │  Recomm. │ │
    │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
    │       │            │            │            │            │        │
    │       └────────────┴────────────┴────────────┴────────────┘        │
    │                                 │                                   │
    └─────────────────────────────────┼───────────────────────────────────┘
                                      │
    ┌─────────────────────────────────▼───────────────────────────────────┐
    │                     PRIORITY QUEUE SYSTEM                            │
    │                                                                      │
    │   ┌─────────────────────────────────────────────────────────────┐   │
    │   │                    RATE LIMITER                              │   │
    │   │           (10 notifications/minute per user)                 │   │
    │   └─────────────────────────────┬───────────────────────────────┘   │
    │                                 │                                    │
    │   ┌─────────────────────────────▼───────────────────────────────┐   │
    │   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │   │
    │   │  │  CRITICAL   │ │    HIGH     │ │   MEDIUM    │ ┌────────┐ │   │
    │   │  │  (SOS)      │ │ (Bookings)  │ │  (Updates)  │ │  LOW   │ │   │
    │   │  │  Priority 0 │ │  Priority 1 │ │  Priority 2 │ │  Pr. 3 │ │   │
    │   │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────┬───┘ │   │
    │   │         │               │               │              │      │   │
    │   │         └───────────────┴───────────────┴──────────────┘      │   │
    │   │                                │                              │   │
    │   └────────────────────────────────┼──────────────────────────────┘   │
    │                                    │                                  │
    │   ┌────────────────────────────────▼──────────────────────────────┐  │
    │   │                    BATCH PROCESSOR                            │  │
    │   │           (Process 10 jobs per cycle, 1s interval)            │  │
    │   └────────────────────────────────┬──────────────────────────────┘  │
    └────────────────────────────────────┼─────────────────────────────────┘
                                         │
    ┌────────────────────────────────────▼─────────────────────────────────┐
    │                         DELIVERY LAYER                                │
    │                                                                       │
    │   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
    │   │    MongoDB     │  │   Socket.io    │  │  Retry Queue   │         │
    │   │  (Persistent)  │  │  (Real-time)   │  │ (Failed Jobs)  │         │
    │   └────────────────┘  └────────────────┘  └────────────────┘         │
    │                                                                       │
    │   Retry Policy: 3 attempts, exponential backoff (5s × attempt)       │
    └───────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### User Model

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  photo: String,
  role: "user" | "driver" | "admin",
  gender: "male" | "female" | "prefer_not_to_say" | "other",
  vehicle: {
    model: String,
    type: "car" | "suv" | "minivan" | "hatchback",
    color: String,
    licensePlate: String
  },
  driverVerification: {
    isVerified: Boolean,
    status: "pending" | "approved" | "rejected",
    documentsSubmitted: Boolean
  },
  trustScore: Number (0-5),
  carbonStats: {
    totalCO2Saved: Number,
    totalRidesCompleted: Number,
    totalDistanceShared: Number
  },
  createdAt: Date
}
```

### Ride Model

```javascript
{
  _id: ObjectId,
  driver: ObjectId (ref: User),
  from: {
    name: String,
    coordinates: [Number] (2dsphere)
  },
  to: {
    name: String,
    coordinates: [Number] (2dsphere)
  },
  route: {
    type: "LineString",
    coordinates: [[Number]]
  },
  departureTime: Date,
  seats: {
    total: Number,
    available: Number
  },
  price: Number,
  priceMetadata: {
    basePrice: Number,
    dynamicFactors: Object,
    calculatedAt: Date
  },
  preferences: {
    music: String,
    conversation: String,
    smoking: Boolean,
    petsAllowed: Boolean
  },
  status: "scheduled" | "in_progress" | "completed" | "cancelled",
  estimatedDistance: Number,
  estimatedDuration: Number,
  createdAt: Date
}
```

### LiveTracking Model

```javascript
{
  _id: ObjectId,
  ride: ObjectId (ref: Ride),
  driver: ObjectId (ref: User),
  trackingToken: String (unique),
  status: "active" | "completed" | "cancelled",
  currentLocation: {
    type: "Point",
    coordinates: [Number]
  },
  locationHistory: [{
    coordinates: [Number],
    timestamp: Date,
    speed: Number
  }],
  eta: {
    destination: String,
    distanceRemaining: Number,
    durationRemaining: Number,
    lastCalculated: Date
  },
  deviation: {
    isDeviating: Boolean,
    consecutiveDeviations: Number,
    lastChecked: Date
  },
  tokenExpiry: Date (TTL index)
}
```

### UserBehaviorAnalytics Model

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  eventType: "search" | "booking_created" | "booking_cancelled" |
             "booking_completed" | "review_submitted",
  metadata: {
    // Event-specific data
  },
  timestamp: Date,
  expiresAt: Date (TTL: 1 year)
}
```

### UserPreferenceProfile Model

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  timePreferences: {
    morning: Number, afternoon: Number, evening: Number, night: Number,
    confidence: Number
  },
  dayPreferences: {
    weekday: Number, weekend: Number,
    distribution: Object,
    confidence: Number
  },
  routeClusters: [{
    center: { pickup: [Number], drop: [Number] },
    frequency: Number,
    avgPrice: Number
  }],
  driverPreferences: {
    genderPreference: String | null,
    minRating: Number,
    reliabilitySensitivity: String
  },
  vehiclePreferences: {
    primary: String | null,
    distribution: Object
  },
  pricePreferences: {
    avgPrice: Number, minPrice: Number, maxPrice: Number,
    confidence: Number
  },
  lastAnalyzed: Date,
  totalEventsAnalyzed: Number
}
```

## API Endpoints

### Authentication

| Method | Endpoint           | Description        |
| ------ | ------------------ | ------------------ |
| POST   | /api/auth/register | Register new user  |
| POST   | /api/auth/login    | Login user         |
| POST   | /api/auth/google   | Google OAuth login |
| GET    | /api/auth/me       | Get current user   |

### Rides

| Method | Endpoint       | Description      |
| ------ | -------------- | ---------------- |
| POST   | /api/rides     | Create new ride  |
| GET    | /api/rides     | Search rides     |
| GET    | /api/rides/:id | Get ride details |
| PUT    | /api/rides/:id | Update ride      |
| DELETE | /api/rides/:id | Cancel ride      |

### Advanced Features

| Method | Endpoint                         | Description               |
| ------ | -------------------------------- | ------------------------- |
| POST   | /api/advanced/pricing/calculate  | Calculate dynamic price   |
| POST   | /api/advanced/matching/find      | Find best matches (graph) |
| GET    | /api/advanced/carbon/impact      | Get user's carbon impact  |
| GET    | /api/advanced/carbon/leaderboard | Carbon leaderboard        |
| POST   | /api/advanced/demand/forecast    | Get demand forecast       |
| GET    | /api/advanced/fraud/risk/:userId | Get fraud risk (admin)    |

### PRIE (Personalization)

| Method | Endpoint              | Description            |
| ------ | --------------------- | ---------------------- |
| GET    | /api/prie/profile     | Get preference profile |
| POST   | /api/prie/search      | Personalized search    |
| GET    | /api/prie/suggestions | Get ride suggestions   |
| GET    | /api/prie/insights    | Get travel insights    |

### Real-time Tracking

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| POST   | /api/live-tracking/start  | Start tracking session |
| POST   | /api/live-tracking/update | Update location        |
| GET    | /api/live-tracking/:token | Get tracking data      |
| POST   | /api/live-tracking/stop   | Stop tracking          |

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/syncroute

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# External APIs
MAPBOX_TOKEN=your-mapbox-token

# Cache Settings
SEARCH_CACHE_TTL=60
SEARCH_CACHE_MAX_SIZE=1000

# Rate Limiting
NOTIFICATION_RATE_LIMIT=10
NOTIFICATION_RATE_WINDOW=60000
```

## Testing Instructions

### Backend Tests

```bash
cd syncroute-backend

# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Dynamic Pricing"

# Run with coverage
npm run test:coverage
```

### Frontend Tests

```bash
cd syncroute-frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Integration Testing

```bash
# Start backend
cd syncroute-backend && npm start

# Start frontend
cd syncroute-frontend && npm run dev

# Test scenarios:
1. Create account → Search rides → Book ride → Track ride
2. Post ride → Set dynamic price → Receive bookings
3. Complete rides → Check carbon impact → View leaderboard
4. Chat with driver → Share live location → Stop sharing
```

## Production Deployment Checklist

- [ ] Set NODE_ENV=production
- [ ] Use Redis for session store and caching
- [ ] Enable MongoDB replica set
- [ ] Configure CORS for production domain
- [ ] Set up SSL certificates
- [ ] Configure rate limiting
- [ ] Enable compression middleware
- [ ] Set up monitoring (e.g., PM2, New Relic)
- [ ] Configure log aggregation
- [ ] Set up backup strategy for MongoDB
- [ ] Configure CDN for static assets
- [ ] Enable Gzip compression
- [ ] Set security headers (Helmet configured)
