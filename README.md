# SyncRoute

A full-stack intelligent carpooling platform that matches passengers with drivers based on route overlap optimization rather than simple distance calculations. Built with modern web technologies and designed for scalability and real-time interactions.

## Overview

SyncRoute implements advanced geospatial algorithms to provide accurate ride matching by analyzing actual route polylines and calculating proportional pricing based on shared segments. The platform features real-time notifications, instant booking capabilities, and comprehensive user management.

## Technology Stack

### Frontend
- **Framework**: React 18.3 with TypeScript 5.8
- **Build Tool**: Vite 5.4
- **UI Library**: shadcn/ui with Tailwind CSS 3.4
- **State Management**: TanStack Query for server state
- **Routing**: React Router DOM 6.x
- **Maps**: Leaflet with react-leaflet
- **Real-time**: Socket.io Client 4.8

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 5.2
- **Database**: MongoDB 5.0+ with Mongoose ODM 9.2
- **Authentication**: JWT with bcryptjs
- **Real-time**: Socket.io 4.8
- **Security**: Helmet, CORS, Express Rate Limit

### External Services
- **Geocoding**: Nominatim (OpenStreetMap), Photon (Komoot)
- **Routing**: OSRM (Open Source Routing Machine)
- **Map Tiles**: CartoDB

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)            │
│  - Component-based architecture with shadcn/ui              │
│  - Context API for auth and socket management               │
│  - TanStack Query for data fetching and caching             │
└──────────────┬──────────────────────────────────────────────┘
               │ REST API + WebSocket (JWT Authentication)
               ↓
┌──────────────────────────────────────────────────────────────┐
│              Backend (Express.js + Socket.io)                │
│  - RESTful API endpoints with JWT middleware                │
│  - Real-time event handling for bookings and messages       │
│  - Rate limiting and security hardening                     │
└──────────────┬───────────────────────────────────────────────┘
               │ Mongoose ODM
               ↓
         ┌─────────────────┐
         │   MongoDB        │
         │   - users        │
         │   - rides        │
         │   - bookings     │
         │   - messages     │
         │   - reviews      │
         └──────────────────┘
```

## Core Features

### Intelligent Route Matching
- Polyline-based route analysis using OSRM
- Proximity detection with configurable thresholds
- Direction validation to ensure logical ride segments
- Fallback mechanisms for routes without stored polylines

### Dynamic Pricing
- Fuel cost calculation based on vehicle type and distance
- Proportional pricing for partial route segments
- Automatic price suggestions with configurable markup
- Service fee calculation and breakdown

### Real-time Communication
- WebSocket-based instant notifications
- Live booking status updates
- In-app messaging between drivers and passengers
- Typing indicators and read receipts

### User Management
- Email/password authentication with bcrypt hashing
- Google OAuth integration
- Role-based access control (passenger, driver, both)
- Profile management with document upload

## Project Structure

```
syncroute/
├── syncroute-backend/
│   ├── models/              # Mongoose schemas
│   ├── routes/              # Express route handlers
│   ├── middleware/          # Authentication and validation
│   ├── socket/              # Socket.io event handlers
│   ├── utils/               # Helper functions and algorithms
│   ├── __tests__/           # Jest test suites
│   └── server.js            # Application entry point
│
├── syncroute-frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Route-level components
│   │   ├── contexts/        # React Context providers
│   │   ├── lib/             # Utility functions and API client
│   │   └── test/            # Vitest test suites
│   └── vite.config.ts       # Vite configuration
│
└── .github/
    └── workflows/           # CI/CD pipelines
```

## Installation

### Prerequisites

- Node.js 18.x or higher
- MongoDB 5.0 or higher
- npm 9.x or higher

### Backend Setup

```bash
cd syncroute-backend
npm install

# Create environment configuration
cp .env.example .env

# Configure the following variables in .env:
# MONGODB_URI=mongodb://127.0.0.1:27017/syncroute
# JWT_SECRET=your_secure_secret_key
# PORT=5000
# FRONTEND_URL=http://localhost:5173

# Start the development server
npm run dev
```

### Frontend Setup

```bash
cd syncroute-frontend
npm install

# Create environment configuration
cp .env.example .env

# Configure the following variables in .env:
# VITE_API_URL=http://localhost:5000
# VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Start the development server
npm run dev
```

### Database Initialization

Ensure MongoDB is running on the configured port:

```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "string",
  "email": "string",
  "password": "string",
  "phone": "string (optional)",
  "role": "passenger | driver | both"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

#### Google OAuth
```http
POST /api/auth/google
Content-Type: application/json

{
  "email": "string",
  "name": "string",
  "googleId": "string",
  "photo": "string"
}
```

### Ride Endpoints

#### Create Ride
```http
POST /api/rides/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "fromLat": number,
  "fromLng": number,
  "fromName": "string",
  "toLat": number,
  "toLng": number,
  "toName": "string",
  "date": "YYYY-MM-DD",
  "departureTime": "HH:MM",
  "price": number,
  "totalSeats": number,
  "vehicleType": "string",
  "vehicleModel": "string",
  "routeCoords": [[lng, lat], ...],
  "estimatedDistance": number,
  "estimatedDuration": number
}
```

#### Search Rides
```http
POST /api/rides/search
Content-Type: application/json

{
  "pickupLat": number,
  "pickupLng": number,
  "dropLat": number,
  "dropLng": number,
  "date": "YYYY-MM-DD (optional)",
  "passengers": number (optional)
}
```

### Booking Endpoints

#### Create Booking
```http
POST /api/bookings/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "rideId": "string",
  "seats": number,
  "pickupLocation": {
    "name": "string",
    "coordinates": [lng, lat]
  },
  "dropLocation": {
    "name": "string",
    "coordinates": [lng, lat]
  }
}
```

## Testing

### Backend Tests
```bash
cd syncroute-backend
npm test
```

### Frontend Tests
```bash
cd syncroute-frontend
npm test
```

### Continuous Integration
The project includes GitHub Actions workflows for automated testing on push and pull requests.

## Key Algorithms

### Route Overlap Calculation

The system calculates the closest points on a driver's route polyline to a passenger's pickup and drop locations using the Haversine formula. It validates that:

1. Pickup point is within 3km of the route
2. Drop point is within 3km of the route
3. Pickup occurs before drop in the route sequence

### Proportional Pricing Formula

```
effectivePrice = basePrice × (overlapDistance / totalDistance)
```

Where:
- `basePrice`: Driver's listed price per seat
- `overlapDistance`: Length of shared route segment
- `totalDistance`: Total route distance

### Fuel Cost Estimation

```
fuelCost = distance × fuelConsumption × fuelPrice
suggestedPrice = (fuelCost × markup) / totalSeats
```

Vehicle fuel consumption rates:
- Compact: 0.05 L/km
- Sedan: 0.06 L/km
- SUV: 0.08 L/km
- Van: 0.09 L/km

## Environment Variables

### Backend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/syncroute` |
| `JWT_SECRET` | Secret key for JWT signing | Required |
| `PORT` | Server port | `5000` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `SMTP_HOST` | Email server host | `smtp.ethereal.email` |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email username | Optional |
| `SMTP_PASS` | Email password | Optional |

### Frontend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |

## Security Considerations

- JWT tokens with 30-day expiration
- Password hashing with bcrypt (10 salt rounds)
- Rate limiting on authentication endpoints
- Helmet.js for HTTP header security
- CORS configuration with origin whitelist
- Input validation using express-validator
- MongoDB injection prevention through Mongoose

## Performance Optimization

- Database indexing on geospatial fields
- Query result caching with TanStack Query
- Lazy loading of route components
- Image optimization with Sharp
- Connection pooling for MongoDB
- WebSocket connection reuse

## Deployment

### Production Build

Backend:
```bash
cd syncroute-backend
npm start
```

Frontend:
```bash
cd syncroute-frontend
npm run build
npm run preview
```

### Environment Preparation

1. Set `NODE_ENV=production`
2. Configure production MongoDB instance
3. Update CORS origins for production domain
4. Set secure JWT secret
5. Configure production SMTP credentials
6. Enable HTTPS/TLS

## Known Limitations

1. OSRM public API has rate limiting constraints
2. Nominatim geocoding limited to 1 request per second
3. Google OAuth tokens not verified server-side
4. Payment processing not implemented
5. Document verification requires manual review

## License

ISC License - See LICENSE file for details.

## Support

For technical issues or questions, please open an issue in the repository issue tracker.
