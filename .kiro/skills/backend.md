# SyncRoute Backend Skill

## Stack
- Node.js 18+ / Express 5.2
- MongoDB 5+ / Mongoose 9.2
- JWT authentication (30-day expiry)
- Socket.io 4.8 (real-time)
- bcryptjs (password hashing)
- Helmet + CORS + Rate Limiting
- Nodemailer (email)
- Multer (file uploads)

## Server Entry
`syncroute-backend/server.js` — port 5000

## Environment Variables
```
MONGODB_URI=mongodb://127.0.0.1:27017/syncroute
JWT_SECRET=your_secret
PORT=5000
FRONTEND_URL=http://localhost:5173
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
```

## API Base URL
`http://localhost:5000/api`

## Auth Middleware
All protected routes require: `Authorization: Bearer <token>`

## Routes

### Auth `/api/auth`
- `POST /register` — { name, email, password, phone?, role }
- `POST /login` — { email, password } → { token, user }
- `POST /google` — { email, name, googleId, photo }
- `POST /forgot-password` — { email }
- `POST /reset-password` — { token, password }

### Rides `/api/rides`
- `GET /` — all active rides
- `POST /create` — create ride (auth required)
- `POST /search` — search by coords
- `GET /my-rides` — driver's rides (auth)
- `GET /:id` — ride details
- `PUT /:id` — update ride (auth, owner)
- `DELETE /:id` — cancel ride (auth, owner)

### Bookings `/api/bookings`
- `POST /create` — book a ride (auth)
- `GET /my-bookings` — passenger bookings (auth)
- `GET /ride-bookings` — driver's received bookings (auth)
- `PUT /:id/status` — update booking status (auth)
- `DELETE /:id` — cancel booking (auth)

### Driver `/api/driver`
- `GET /earnings` — earnings stats (auth)
- `GET /stats` — trip statistics (auth)

### Profile `/api/profile`
- `GET /` — get own profile (auth)
- `PUT /` — update profile (auth)
- `POST /photo` — upload photo (auth, multipart)

### Reviews `/api/reviews`
- `POST /` — create review (auth)
- `GET /user/:userId` — reviews for user

### Messages `/api/messages`
- `GET /conversations` — list conversations (auth)
- `GET /:conversationId` — messages in conversation (auth)
- `POST /send` — send message (auth)

### Notifications `/api/notifications`
- `GET /` — user notifications (auth)
- `PUT /:id/read` — mark read (auth)

## Data Models

### User
```js
{ name, email, password, phone, role: ['passenger','driver','both'],
  photo, googleId, verified, rating, trips,
  vehicle: { type, model, color, plate },
  reviewStats: { avgStars, totalReviews } }
```

### Ride
```js
{ driver: ObjectId, from: { name, coordinates },
  to: { name, coordinates }, date, departureTime,
  price, totalSeats, availableSeats, status,
  vehicleType, vehicleModel, routePath,
  estimatedDistance, estimatedDuration }
```

### Booking
```js
{ ride: ObjectId, passenger: ObjectId,
  seats, totalPrice, status,
  pickupLocation: { name, coordinates },
  dropLocation: { name, coordinates } }
```

## Socket Events
- `join-room` — join ride room
- `booking-update` — booking status changed
- `new-message` — chat message
- `typing` — typing indicator
- `notification` — push notification

## Error Response Format
```json
{ "message": "Error description", "errors": [] }
```

## Success Response Format
```json
{ "data": {}, "message": "Success" }
```
