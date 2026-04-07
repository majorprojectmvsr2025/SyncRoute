import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Medal, 
  Star, 
  Target, 
  Flame, 
  Zap,
  Crown,
  Leaf,
  Heart,
  Shield,
  Gift,
  TrendingUp,
  Award,
  Loader2,
  ChevronRight,
  Users,
  Calendar,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { gamificationAPI, UserGamification, Badge } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Badge icon mapping
const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_ride: Trophy,
  ride_10: Medal,
  ride_50: Star,
  ride_100: Crown,
  carbon_saver: Leaf,
  eco_warrior: Leaf,
  streak_7: Flame,
  streak_30: Flame,
  social_butterfly: Heart,
  top_reviewer: Star,
  verified_driver: Shield,
  trusted_driver: Shield,
  early_bird: Clock,
  night_owl: Clock,
  referral_champion: Gift,
  default: Award
};

// Badge rarity colors
const RARITY_COLORS: Record<string, string> = {
  common: 'bg-gray-100 text-gray-600 border-gray-200',
  uncommon: 'bg-green-100 text-green-600 border-green-200',
  rare: 'bg-blue-100 text-blue-600 border-blue-200',
  epic: 'bg-purple-100 text-purple-600 border-purple-200',
  legendary: 'bg-yellow-100 text-yellow-600 border-yellow-200'
};

// Level colors
const LEVEL_COLORS = [
  'from-gray-400 to-gray-500',     // Level 1: Newcomer
  'from-green-400 to-green-500',   // Level 2: Explorer
  'from-blue-400 to-blue-500',     // Level 3: Regular
  'from-indigo-400 to-indigo-500', // Level 4: Rider
  'from-purple-400 to-purple-500', // Level 5: Commuter
  'from-pink-400 to-pink-500',     // Level 6: Traveler
  'from-red-400 to-red-500',       // Level 7: Voyager
  'from-orange-400 to-orange-500', // Level 8: Pioneer
  'from-yellow-400 to-yellow-500', // Level 9: Champion
  'from-emerald-400 to-emerald-500', // Level 10: Legend
];

interface GamificationProfileProps {
  compact?: boolean;
}

const GamificationProfile: React.FC<GamificationProfileProps> = ({ compact = false }) => {
  const [profile, setProfile] = useState<UserGamification | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'badges' | 'leaderboard' | 'challenges'>('badges');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileData, badgesData, leaderboardData, challengesData] = await Promise.all([
        gamificationAPI.getProfile(),
        gamificationAPI.getBadges(),
        gamificationAPI.getLeaderboard('weekly', 10),
        gamificationAPI.getChallenges()
      ]);
      
      setProfile(profileData);
      setBadges(badgesData);
      setLeaderboard(leaderboardData);
      setChallenges(challengesData);
    } catch (error) {
      console.error('Failed to load gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUnlockedBadgeIds = () => {
    return new Set(profile?.badges?.map(b => b.badgeId) || []);
  };

  const getBadgeIcon = (badgeId: string) => {
    return BADGE_ICONS[badgeId] || BADGE_ICONS.default;
  };

  const getProgressToNextLevel = () => {
    if (!profile) return 0;
    const levels = [0, 100, 300, 600, 1000, 2000, 3500, 5500, 7500, 10000];
    const currentLevelPoints = levels[profile.level - 1] || 0;
    const nextLevelPoints = levels[profile.level] || levels[levels.length - 1];
    const pointsInLevel = profile.points.total - currentLevelPoints;
    const pointsNeeded = nextLevelPoints - currentLevelPoints;
    return Math.min(100, (pointsInLevel / pointsNeeded) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center p-8 text-gray-500">
        Complete your first ride to start earning badges!
      </div>
    );
  }

  // Compact view for dashboard widgets
  if (compact) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Your Progress</h3>
          <div className="flex items-center gap-2 text-sm">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="font-medium">{profile.streak?.current || 0} day streak</span>
          </div>
        </div>
        
        {/* Level Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className={`font-bold bg-gradient-to-r ${LEVEL_COLORS[profile.level - 1]} bg-clip-text text-transparent`}>
              Level {profile.level}: {profile.levelName}
            </span>
            <span className="text-gray-500">{profile.points.total} pts</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full bg-gradient-to-r ${LEVEL_COLORS[profile.level - 1]}`}
              initial={{ width: 0 }}
              animate={{ width: `${getProgressToNextLevel()}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Recent Badges */}
        <div className="flex items-center gap-2">
          {profile.badges.slice(-3).map((badge) => {
            const BadgeIcon = getBadgeIcon(badge.badgeId);
            return (
              <div 
                key={badge.badgeId}
                className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"
                title={badge.badgeId.replace(/_/g, ' ')}
              >
                <BadgeIcon className="w-5 h-5 text-emerald-600" />
              </div>
            );
          })}
          {profile.badges.length > 3 && (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
              +{profile.badges.length - 3}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className={`rounded-2xl p-6 bg-gradient-to-r ${LEVEL_COLORS[profile.level - 1]} text-white`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Level {profile.level}</h2>
            <p className="text-white/80">{profile.levelName}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{profile.points.total}</p>
            <p className="text-white/80">Total Points</p>
          </div>
        </div>

        {/* Level Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress to Level {profile.level + 1}</span>
            <span>{Math.round(getProgressToNextLevel())}%</span>
          </div>
          <div className="h-3 bg-white/30 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${getProgressToNextLevel()}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-5 h-5" />
              <span className="text-2xl font-bold">{profile.streak?.current || 0}</span>
            </div>
            <p className="text-sm text-white/80">Day Streak</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="w-5 h-5" />
              <span className="text-2xl font-bold">{profile.badges?.length || 0}</span>
            </div>
            <p className="text-sm text-white/80">Badges</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="w-5 h-5" />
              <span className="text-2xl font-bold">{profile.stats?.ridesCompleted || 0}</span>
            </div>
            <p className="text-sm text-white/80">Rides</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
        {(['badges', 'leaderboard', 'challenges'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'badges' && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {badges.map((badge) => {
              const isUnlocked = getUnlockedBadgeIds().has(badge.id);
              const BadgeIcon = getBadgeIcon(badge.id);
              const unlockedBadge = profile.badges.find(b => b.badgeId === badge.id);
              
              return (
                <div
                  key={badge.id}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isUnlocked 
                      ? RARITY_COLORS[badge.rarity] || RARITY_COLORS.common
                      : 'bg-gray-50 border-gray-200 opacity-50'
                  }`}
                >
                  {isUnlocked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center"
                    >
                      <Star className="w-3 h-3 text-white fill-white" />
                    </motion.div>
                  )}
                  
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                    isUnlocked ? 'bg-white/50' : 'bg-gray-200'
                  }`}>
                    <BadgeIcon className={`w-6 h-6 ${isUnlocked ? 'text-current' : 'text-gray-400'}`} />
                  </div>
                  
                  <h4 className={`font-semibold text-sm mb-1 ${isUnlocked ? '' : 'text-gray-400'}`}>
                    {badge.name}
                  </h4>
                  <p className={`text-xs ${isUnlocked ? 'text-current/70' : 'text-gray-400'}`}>
                    {badge.description}
                  </p>
                  
                  {isUnlocked && unlockedBadge && (
                    <p className="text-[10px] mt-2 text-current/50">
                      Unlocked {new Date(unlockedBadge.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                  
                  <div className={`mt-2 text-xs font-medium ${isUnlocked ? '' : 'text-gray-400'}`}>
                    +{badge.points} pts
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {leaderboard.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  entry.userId === user?._id 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-600' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  index === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {entry.rank}
                </div>
                
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {entry.name}
                    {entry.userId === user?._id && (
                      <span className="ml-2 text-xs text-emerald-600">(You)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    Level {entry.level} • {entry.levelName}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-gray-900">{entry.points.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'challenges' && (
          <motion.div
            key="challenges"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {challenges.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No active challenges right now. Check back soon!
              </div>
            ) : (
              challenges.map((challenge) => {
                const progress = challenge.userProgress || 0;
                const progressPercent = Math.min(100, (progress / challenge.target) * 100);
                
                return (
                  <div
                    key={challenge.id}
                    className="p-4 rounded-xl bg-white border border-gray-100"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{challenge.name}</h4>
                        <p className="text-sm text-gray-500">{challenge.description}</p>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-medium">
                        <Zap className="w-3 h-3" />
                        +{challenge.reward} pts
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {progress} / {challenge.target}
                        </span>
                        <span className="text-gray-500">
                          {Math.round(progressPercent)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${challenge.userCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        Ends {new Date(challenge.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {challenge.userCompleted && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                        <Trophy className="w-4 h-4" />
                        Challenge Completed!
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamificationProfile;
