# SyncRoute

Route-matched carpooling platform for India. Connect drivers and passengers sharing the same path, not just the same destination.

## Overview

SyncRoute uses OSRM road routing to match rides based on actual route overlap, not straight-line distance. Passengers pay only for the segment they travel, and drivers earn without commission fees.

### Key Features

- **Route-First Matching**: 60%+ actual road overlap required
- **OCR Verification**: Automated license and RC verification
- **Zero Commission**: No booking fees or hidden charges
- **Instant Booking**: One-tap seat reservation with in-app chat
- **Safety Features**: SOS button, live tracking, mutual ratings
- **Real-Time Updates**: WebSocket-based ride tracking and messaging

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Mapbox GL for interactive maps
- Socket.io-client for real-time features

### Backend
- Node.js with Express
- MongoDB with Mongoose ODM
- JWT authentication
- Socket.io for WebSocket connections
- OSRM for route calculations
- Tesseract.js for OCR verification

## Project Structure

```
syncroute/
├── syncroute-frontend/     # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── lib/            # API clients and utilities
│   │   └── hooks/          # Custom React hooks
│   └── public/             # Static assets
│
└── syncroute-backend/      # Node.js backend API
    ├── models/             # MongoDB schemas
    ├── routes/             # API route handlers
    ├── middleware/         # Express middleware
    ├── utils/              # Helper functions
    └── socket/             # WebSocket handlers
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- MongoDB 6.0 or higher
- npm or yarn package manager

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/syncroute.git
cd syncroute
```

2. Install frontend dependencies
```bash
cd syncroute-frontend
npm install
```

3. Install backend dependencies
```bash
cd ../syncroute-backend
npm install
```

### Configuration

#### Frontend Environment Variables

Create `syncroute-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_MAPBOX_TOKEN=your_mapbox_token
```

#### Backend Environment Variables

Create `syncroute-backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/syncroute
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
OSRM_SERVER=http://router.project-osrm.org
```

### Running the Application

#### Development Mode

Start the backend server:
```bash
cd syncroute-backend
npm run dev
```

Start the frontend development server:
```bash
cd syncroute-frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

#### Production Build

Build the frontend:
```bash
cd syncroute-frontend
npm run build
```

Start the backend in production mode:
```bash
cd syncroute-backend
npm start
```

## Core Features

### Route Matching Algorithm

The platform uses OSRM (Open Source Routing Machine) to calculate actual road routes between points. Rides are matched only if they share 60% or more of the actual driving path.

**How it works:**
1. User enters pickup and drop locations
2. System queries OSRM for route geometry
3. Compares with existing ride routes using polyline overlap
4. Returns only rides with sufficient overlap
5. Calculates proportional pricing based on segment distance

### Document Verification

Automated OCR verification for driver documents:
- Driving license validation
- Vehicle registration (RC) verification
- Age verification (minimum 18 years)
- Document expiry checking

### Real-Time Features

WebSocket-based real-time updates:
- Live ride tracking
- In-app messaging between drivers and passengers
- Booking notifications
- Ride status updates

### Safety Features

- SOS emergency button with location sharing
- Live location tracking during rides
- Emergency contact notifications
- Mutual rating system
- Driver verification badges

## API Documentation

### Authentication Endpoints

```
POST /api/auth/register     - Register new user
POST /api/auth/login        - User login
POST /api/auth/google       - Google OAuth login
GET  /api/auth/me           - Get current user
PUT  /api/auth/profile      - Update user profile
```

### Ride Endpoints

```
GET    /api/rides           - List all active rides
POST   /api/rides           - Create new ride
GET    /api/rides/:id       - Get ride details
PUT    /api/rides/:id       - Update ride
DELETE /api/rides/:id       - Cancel ride
GET    /api/rides/my-rides  - Get user's rides
POST   /api/rides/search    - Search rides by route
```

### Booking Endpoints

```
POST   /api/bookings        - Create booking
GET    /api/bookings/my     - Get user's bookings
PUT    /api/bookings/:id    - Update booking status
DELETE /api/bookings/:id    - Cancel booking
```

### Document Verification

```
POST /api/documents/verify-license    - Verify driving license
POST /api/documents/verify-rc         - Verify vehicle registration
POST /api/documents/validate-age      - Validate user age
```

## Database Schema

### User Model
- Authentication credentials
- Profile information
- Driver verification status
- Document verification data
- Rating and review statistics

### Ride Model
- Route information (from/to coordinates)
- Date and time
- Vehicle details
- Pricing and available seats
- Status (active/completed/cancelled)

### Booking Model
- Passenger and ride references
- Booking status
- Seat count
- Payment information

### Message Model
- Sender and receiver references
- Message content
- Timestamp
- Read status

## Deployment

### Frontend Deployment (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy automatically on push

### Backend Deployment (Render/Railway)

1. Create new web service
2. Connect GitHub repository
3. Set environment variables
4. Configure build command: `npm install`
5. Configure start command: `npm start`

### Database (MongoDB Atlas)

1. Create free cluster
2. Configure network access
3. Create database user
4. Get connection string
5. Update MONGODB_URI in backend

## Testing

Run frontend tests:
```bash
cd syncroute-frontend
npm test
```

Run backend tests:
```bash
cd syncroute-backend
npm test
```

## Performance Optimization

- Route caching for frequently searched paths
- Database indexing on location and date fields
- Image optimization for profile photos
- Lazy loading for map components
- WebSocket connection pooling

## Security Measures

- JWT token-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting on API endpoints
- CORS configuration
- Secure WebSocket connections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/syncroute/issues
- Email: support@syncroute.com

## Roadmap

- Mobile applications (iOS and Android)
- Advanced route optimization
- Multi-stop ride support
- Corporate carpooling programs
- Carbon footprint tracking
- Ride scheduling automation
- Payment gateway integration
- Multi-language support

---

Built with modern web technologies for efficient, safe, and sustainable commuting.
