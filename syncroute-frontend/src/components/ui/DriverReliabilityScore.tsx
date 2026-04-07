import { useState, useEffect } from "react";
import { statsAPI } from "@/lib/api";
import { Star, TrendingUp, CheckCircle2, XCircle, Clock } from "lucide-react";

interface DriverReliabilityProps {
  driverId: string;
  compact?: boolean;
  showBreakdown?: boolean;
}

interface ReliabilityData {
  score: number;
  stars: number;
  completionRate: number;
  punctualityRate: number;
  cancellationRate: number;
  avgRating: number;
  totalRatings: number;
}

export function DriverReliabilityScore({
  driverId,
  compact = false,
  showBreakdown = false
}: DriverReliabilityProps) {
  const [reliability, setReliability] = useState<ReliabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReliability();
  }, [driverId]);

  const loadReliability = async () => {
    try {
      const data = await statsAPI.getReliability(driverId);
      setReliability(data);
    } catch (error) {
      console.error("Failed to load reliability:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={compact ? "flex items-center gap-1" : "animate-pulse"}>
        <div className={`bg-muted rounded ${compact ? "h-4 w-16" : "h-8 w-24"}`}></div>
      </div>
    );
  }

  if (!reliability) {
    return null;
  }

  // Render stars
  const renderStars = (stars: number) => {
    const fullStars = Math.floor(stars);
    const hasHalfStar = stars % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star className="h-4 w-4 text-gray-300" />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
        ))}
      </div>
    );
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50 dark:bg-green-900/20";
    if (score >= 70) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20";
    return "text-red-600 bg-red-50 dark:bg-red-900/20";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {renderStars(reliability.stars)}
        <span className="text-sm font-medium">{reliability.stars.toFixed(1)}</span>
        {reliability.totalRatings > 0 && (
          <span className="text-xs text-muted-foreground">
            ({reliability.totalRatings})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main score display */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {renderStars(reliability.stars)}
            <span className="text-lg font-bold">{reliability.stars.toFixed(1)}</span>
          </div>
          {reliability.totalRatings > 0 && (
            <p className="text-sm text-muted-foreground">
              Based on {reliability.totalRatings} review{reliability.totalRatings > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className={`px-4 py-2 rounded-full font-bold ${getScoreColor(reliability.score)}`}>
          {reliability.score}%
        </div>
      </div>

      {/* Breakdown */}
      {showBreakdown && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Reliability Breakdown
          </h4>
          
          <div className="space-y-2">
            {/* Completion Rate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Completion Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${reliability.completionRate}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {reliability.completionRate}%
                </span>
              </div>
            </div>

            {/* Punctuality Rate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Punctuality</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${reliability.punctualityRate}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {reliability.punctualityRate}%
                </span>
              </div>
            </div>

            {/* Cancellation Rate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Cancellation Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full transition-all"
                    style={{ width: `${reliability.cancellationRate}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {reliability.cancellationRate}%
                </span>
              </div>
            </div>

            {/* Average Rating */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Avg. Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full transition-all"
                    style={{ width: `${(reliability.avgRating / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {reliability.avgRating.toFixed(1)}/5
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverReliabilityScore;
