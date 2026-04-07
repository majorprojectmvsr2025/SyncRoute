import { useState, useEffect } from "react";
import { advancedAPI, type DynamicPrice } from "@/lib/api";
import { TrendingUp, TrendingDown, Clock, Fuel, MapPin, Info, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DynamicPricingProps {
  pickup: { lat: number; lng: number } | null;
  drop: { lat: number; lng: number } | null;
  vehicleType?: string;
  seatsRequired?: number;
  onPriceCalculated?: (price: DynamicPrice) => void;
  showDetails?: boolean;
}

export function DynamicPricing({
  pickup,
  drop,
  vehicleType = "car",
  seatsRequired = 1,
  onPriceCalculated,
  showDetails = true,
}: DynamicPricingProps) {
  const [pricing, setPricing] = useState<DynamicPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pickup && drop) {
      calculatePrice();
    } else {
      setPricing(null);
    }
  }, [pickup, drop, vehicleType, seatsRequired]);

  const calculatePrice = async () => {
    if (!pickup || !drop) return;

    try {
      setLoading(true);
      setError(null);
      const data = await advancedAPI.calculatePrice({
        pickup,
        drop,
        vehicleType,
        seatsRequired,
      });
      setPricing(data);
      onPriceCalculated?.(data);
    } catch (err) {
      console.error("Failed to calculate price:", err);
      setError("Unable to calculate price");
    } finally {
      setLoading(false);
    }
  };

  if (!pickup || !drop) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Calculating price...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
    );
  }

  if (!pricing) {
    return null;
  }

  const surgeActive = pricing.factors.peak > 1 || pricing.factors.demand > 1;
  const totalSurge = pricing.factors.peak * pricing.factors.demand;

  return (
    <div className="space-y-3">
      {/* Price Range Display */}
      <div className="rounded-lg border bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested Price Range
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Price is calculated based on distance, fuel costs, current demand,
                  and time of day. Set your price within this range for the best
                  chance of getting passengers.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
              ₹{pricing.priceRange.suggested}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Range: ₹{pricing.priceRange.min} - ₹{pricing.priceRange.max}
            </div>
          </div>

          {surgeActive && (
            <div className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">
                {((totalSurge - 1) * 100).toFixed(0)}% surge
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Price Breakdown */}
      {showDetails && (
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Price Breakdown
          </h4>

          <div className="space-y-2">
            <PriceItem
              icon={<MapPin className="h-4 w-4 text-blue-500" />}
              label="Distance cost"
              value={`₹${pricing.breakdown.distanceCost.toFixed(0)}`}
            />
            <PriceItem
              icon={<Fuel className="h-4 w-4 text-orange-500" />}
              label="Fuel cost"
              value={`₹${pricing.breakdown.fuelCost.toFixed(0)}`}
            />
            {pricing.breakdown.peakSurcharge > 0 && (
              <PriceItem
                icon={<Clock className="h-4 w-4 text-red-500" />}
                label="Peak hour charge"
                value={`+₹${pricing.breakdown.peakSurcharge.toFixed(0)}`}
                highlight
              />
            )}
            {pricing.breakdown.demandSurcharge > 0 && (
              <PriceItem
                icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
                label="High demand"
                value={`+₹${pricing.breakdown.demandSurcharge.toFixed(0)}`}
                highlight
              />
            )}

            <div className="border-t pt-2 mt-2 flex justify-between items-center dark:border-gray-600">
              <span className="font-medium text-gray-800 dark:text-white">
                Total suggested
              </span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                ₹{pricing.finalPrice}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Factor Indicators */}
      {showDetails && (
        <div className="flex flex-wrap gap-2">
          <FactorBadge
            label="Peak"
            value={pricing.factors.peak}
            active={pricing.factors.peak > 1}
            type={pricing.factors.peak > 1 ? "up" : "neutral"}
          />
          <FactorBadge
            label="Demand"
            value={pricing.factors.demand}
            active={pricing.factors.demand > 1}
            type={pricing.factors.demand > 1 ? "up" : pricing.factors.demand < 1 ? "down" : "neutral"}
          />
          <FactorBadge
            label="Distance"
            value={pricing.factors.distance}
            active={false}
            type="neutral"
          />
        </div>
      )}
    </div>
  );
}

function PriceItem({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <span
        className={`text-sm font-medium ${
          highlight
            ? "text-orange-600 dark:text-orange-400"
            : "text-gray-800 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function FactorBadge({
  label,
  value,
  active,
  type,
}: {
  label: string;
  value: number;
  active: boolean;
  type: "up" | "down" | "neutral";
}) {
  const baseClasses = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium";
  const colorClasses = {
    up: active
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    down: active
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <span className={`${baseClasses} ${colorClasses[type]}`}>
      {type === "up" && active && <TrendingUp className="h-3 w-3" />}
      {type === "down" && active && <TrendingDown className="h-3 w-3" />}
      {label}: {value.toFixed(2)}x
    </span>
  );
}

export default DynamicPricing;
