import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Navigation,
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Repeat,
  AlertCircle,
  Loader2,
  Car,
  IndianRupee,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recurringRideAPI, RecurringRide } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface RecurringRideManagerProps {
  onCreateRide?: () => void;
}

const RecurringRideManager: React.FC<RecurringRideManagerProps> = ({ onCreateRide }) => {
  const [rides, setRides] = useState<RecurringRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRide, setExpandedRide] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadRecurringRides();
    }
  }, [user]);

  const loadRecurringRides = async () => {
    setLoading(true);
    try {
      const data = await recurringRideAPI.getMyRecurringRides();
      setRides(data);
    } catch (error) {
      console.error('Failed to load recurring rides:', error);
      toast.error('Failed to load recurring rides');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (rideId: string) => {
    try {
      const updated = await recurringRideAPI.toggleActive(rideId);
      setRides(rides.map(r => r._id === rideId ? updated : r));
      toast.success(updated.isActive ? 'Recurring ride activated' : 'Recurring ride paused');
    } catch (error) {
      toast.error('Failed to toggle ride status');
    }
  };

  const deleteRide = async (rideId: string) => {
    if (!confirm('Are you sure you want to delete this recurring ride?')) return;
    
    try {
      await recurringRideAPI.delete(rideId);
      setRides(rides.filter(r => r._id !== rideId));
      toast.success('Recurring ride deleted');
    } catch (error) {
      toast.error('Failed to delete ride');
    }
  };

  const generateRides = async (rideId: string) => {
    try {
      const result = await recurringRideAPI.generateRides(rideId);
      toast.success(`Generated ${result.generated} rides for upcoming days`);
    } catch (error) {
      toast.error('Failed to generate rides');
    }
  };

  const getRecurrenceText = (ride: RecurringRide) => {
    if (ride.recurrenceType === 'daily') return 'Every day';
    if (ride.recurrenceType === 'weekly') {
      const days = ride.recurrenceDays.map(d => DAY_NAMES[d]).join(', ');
      return `Every ${days}`;
    }
    if (ride.recurrenceType === 'custom') {
      const days = ride.recurrenceDays.map(d => DAY_NAMES[d]).join(', ');
      return `On ${days}`;
    }
    return 'Custom schedule';
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recurring Rides</h2>
          <p className="text-sm text-gray-500">
            Set up rides that automatically repeat on your schedule
          </p>
        </div>
        <button
          onClick={() => onCreateRide ? onCreateRide() : setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Recurring Ride
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Repeat className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-medium text-blue-900">How Recurring Rides Work</h3>
          <p className="text-sm text-blue-700 mt-1">
            Recurring rides automatically create new ride posts based on your schedule. 
            Perfect for daily commutes or regular trips. Rides are generated up to 7 days in advance.
          </p>
        </div>
      </div>

      {/* Rides List */}
      {rides.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Repeat className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No recurring rides yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Set up a recurring ride for your regular commute
          </p>
          <button
            onClick={() => onCreateRide ? onCreateRide() : setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Recurring Ride
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => (
            <motion.div
              key={ride._id}
              layout
              className={`bg-white rounded-xl border transition-all ${
                ride.isActive ? 'border-emerald-200' : 'border-gray-200 opacity-75'
              }`}
            >
              {/* Main Card */}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    ride.isActive ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    <Car className={`w-6 h-6 ${ride.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {/* Route */}
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <MapPin className="w-3 h-3 text-emerald-500" />
                          <span className="font-medium truncate">{ride.source.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Navigation className="w-3 h-3 text-red-500" />
                          <span className="truncate">{ride.destination.name}</span>
                        </div>
                      </div>
                      
                      {/* Toggle */}
                      <button
                        onClick={() => toggleActive(ride._id)}
                        className={`p-1 rounded transition-colors ${
                          ride.isActive ? 'text-emerald-500' : 'text-gray-400'
                        }`}
                      >
                        {ride.isActive ? (
                          <ToggleRight className="w-8 h-8" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    {/* Schedule & Stats */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Repeat className="w-4 h-4" />
                        {getRecurrenceText(ride)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(ride.departureTime)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {ride.availableSeats} seats
                      </div>
                      <div className="flex items-center gap-1">
                        <IndianRupee className="w-4 h-4" />
                        ₹{ride.pricePerSeat}/seat
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => setExpandedRide(expandedRide === ride._id ? null : ride._id)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-3 mx-auto"
                >
                  {expandedRide === ride._id ? (
                    <>Hide details <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>Show details <ChevronDown className="w-4 h-4" /></>
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedRide === ride._id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="p-4 bg-gray-50 space-y-4">
                      {/* Schedule Details */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Schedule</h4>
                        <div className="flex gap-2">
                          {DAY_NAMES.map((day, idx) => (
                            <div
                              key={day}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                                ride.recurrenceType === 'daily' || ride.recurrenceDays.includes(idx)
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Skip Dates */}
                      {ride.skipDates && ride.skipDates.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                            Skipped Dates
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {ride.skipDates.slice(0, 5).map((date, idx) => (
                              <span 
                                key={idx}
                                className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-lg"
                              >
                                {new Date(date).toLocaleDateString()}
                              </span>
                            ))}
                            {ride.skipDates.length > 5 && (
                              <span className="px-2 py-1 text-gray-500 text-xs">
                                +{ride.skipDates.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => generateRides(ride._id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                        >
                          <Calendar className="w-4 h-4" />
                          Generate Upcoming Rides
                        </button>
                        <button
                          onClick={() => deleteRide(ride._id)}
                          className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringRideManager;
