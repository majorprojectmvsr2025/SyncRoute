export interface Ride {
  id: string;
  driver: {
    name: string;
    photo: string;
    rating: number;
    trips: number;
    verified: boolean;
  };
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  currency: string;
  availableSeats: number;
  totalSeats: number;
  vehicleType: string;
  vehicleModel: string;
  instantBooking: boolean;
  genderPreference: "any" | "women-only" | "men-only";
  stops: string[];
}

export interface Message {
  id: string;
  sender: "user" | "driver";
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  driver: { name: string; photo: string };
  rideId: string;
  route: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  messages: Message[];
}

export interface Trip {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  status: "completed" | "upcoming" | "cancelled";
  price: number;
  driver: string;
}

export const mockRides: Ride[] = [
  {
    id: "r1",
    driver: { name: "Marcus Chen", photo: "MC", rating: 4.9, trips: 342, verified: true },
    from: "Berlin Hauptbahnhof",
    to: "Munich Central",
    departureTime: "06:30",
    arrivalTime: "12:15",
    date: "2026-02-22",
    price: 38,
    currency: "EUR",
    availableSeats: 3,
    totalSeats: 4,
    vehicleType: "Sedan",
    vehicleModel: "Tesla Model 3",
    instantBooking: true,
    genderPreference: "any",
    stops: ["Leipzig", "Nuremberg"],
  },
  {
    id: "r2",
    driver: { name: "Sophia Andersen", photo: "SA", rating: 4.8, trips: 189, verified: true },
    from: "Berlin Hauptbahnhof",
    to: "Munich Central",
    departureTime: "08:00",
    arrivalTime: "13:45",
    date: "2026-02-22",
    price: 35,
    currency: "EUR",
    availableSeats: 2,
    totalSeats: 4,
    vehicleType: "SUV",
    vehicleModel: "BMW X3",
    instantBooking: false,
    genderPreference: "any",
    stops: ["Nuremberg"],
  },
  {
    id: "r3",
    driver: { name: "Tobias Krüger", photo: "TK", rating: 4.7, trips: 95, verified: false },
    from: "Berlin Hauptbahnhof",
    to: "Munich Central",
    departureTime: "10:00",
    arrivalTime: "16:30",
    date: "2026-02-22",
    price: 30,
    currency: "EUR",
    availableSeats: 1,
    totalSeats: 3,
    vehicleType: "Compact",
    vehicleModel: "VW Golf",
    instantBooking: true,
    genderPreference: "any",
    stops: ["Leipzig", "Erfurt", "Nuremberg"],
  },
  {
    id: "r4",
    driver: { name: "Elena Volkov", photo: "EV", rating: 5.0, trips: 512, verified: true },
    from: "Berlin Hauptbahnhof",
    to: "Munich Central",
    departureTime: "14:00",
    arrivalTime: "19:30",
    date: "2026-02-22",
    price: 42,
    currency: "EUR",
    availableSeats: 4,
    totalSeats: 4,
    vehicleType: "Sedan",
    vehicleModel: "Mercedes C-Class",
    instantBooking: true,
    genderPreference: "women-only",
    stops: ["Nuremberg"],
  },
  {
    id: "r5",
    driver: { name: "Jan Müller", photo: "JM", rating: 4.6, trips: 67, verified: true },
    from: "Berlin Hauptbahnhof",
    to: "Munich Central",
    departureTime: "16:30",
    arrivalTime: "22:00",
    date: "2026-02-22",
    price: 33,
    currency: "EUR",
    availableSeats: 2,
    totalSeats: 4,
    vehicleType: "Sedan",
    vehicleModel: "Audi A4",
    instantBooking: false,
    genderPreference: "any",
    stops: ["Leipzig", "Nuremberg"],
  },
  {
    id: "r6",
    driver: { name: "Aisha Rahman", photo: "AR", rating: 4.9, trips: 230, verified: true },
    from: "Berlin Hauptbahnhof",
    to: "Munich Central",
    departureTime: "07:15",
    arrivalTime: "12:45",
    date: "2026-02-22",
    price: 40,
    currency: "EUR",
    availableSeats: 3,
    totalSeats: 4,
    vehicleType: "SUV",
    vehicleModel: "Volvo XC60",
    instantBooking: true,
    genderPreference: "any",
    stops: ["Nuremberg"],
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "c1",
    driver: { name: "Marcus Chen", photo: "MC" },
    rideId: "r1",
    route: "Berlin → Munich",
    lastMessage: "I'll be at the east entrance of the station.",
    lastMessageTime: "10:32",
    unread: 1,
    messages: [
      { id: "m1", sender: "user", text: "Hi, where exactly will you pick up?", timestamp: "10:28" },
      { id: "m2", sender: "driver", text: "I'll be at the east entrance of the station.", timestamp: "10:32" },
    ],
  },
  {
    id: "c2",
    driver: { name: "Elena Volkov", photo: "EV" },
    rideId: "r4",
    route: "Berlin → Munich",
    lastMessage: "Confirmed. See you then.",
    lastMessageTime: "Yesterday",
    unread: 0,
    messages: [
      { id: "m3", sender: "user", text: "Can I bring a medium-sized suitcase?", timestamp: "09:15" },
      { id: "m4", sender: "driver", text: "Yes, trunk has plenty of space.", timestamp: "09:20" },
      { id: "m5", sender: "user", text: "Great, thanks!", timestamp: "09:21" },
      { id: "m6", sender: "driver", text: "Confirmed. See you then.", timestamp: "09:22" },
    ],
  },
];

export const mockTrips: Trip[] = [
  { id: "t1", from: "Berlin", to: "Munich", date: "2026-02-22", time: "06:30", status: "upcoming", price: 38, driver: "Marcus Chen" },
  { id: "t2", from: "Hamburg", to: "Berlin", date: "2026-02-18", time: "09:00", status: "completed", price: 28, driver: "Lena Schmidt" },
  { id: "t3", from: "Frankfurt", to: "Stuttgart", date: "2026-02-15", time: "14:00", status: "completed", price: 22, driver: "Paul Weber" },
  { id: "t4", from: "Berlin", to: "Dresden", date: "2026-02-10", time: "11:30", status: "cancelled", price: 18, driver: "Anna Bauer" },
  { id: "t5", from: "Munich", to: "Zurich", date: "2026-02-25", time: "08:00", status: "upcoming", price: 45, driver: "Elena Volkov" },
];

export const popularLocations = [
  "Berlin Hauptbahnhof",
  "Munich Central",
  "Hamburg Hbf",
  "Frankfurt am Main",
  "Cologne Central",
  "Stuttgart Hbf",
  "Düsseldorf",
  "Dresden",
  "Leipzig",
  "Nuremberg",
  "Zurich HB",
  "Vienna Westbahnhof",
];

export const popularRoutes = [
  { from: "Berlin", to: "Munich", distance: "585 km", density: "High" },
  { from: "Hamburg", to: "Berlin", distance: "289 km", density: "High" },
  { from: "Frankfurt", to: "Stuttgart", distance: "204 km", density: "Medium" },
  { from: "Cologne", to: "Düsseldorf", distance: "40 km", density: "High" },
  { from: "Munich", to: "Zurich", distance: "315 km", density: "Medium" },
  { from: "Berlin", to: "Dresden", distance: "193 km", density: "Medium" },
];

export const systemMetrics = {
  activeRides: 3482,
  avgMatchTime: 42,
  co2Saved: 12.4,
};
