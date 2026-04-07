import { useEffect, useState } from "react";
import { advancedAPI, type CarbonImpact } from "@/lib/api";
import { Leaf, TreeDeciduous, Smartphone, Lightbulb, Car, TrendingUp, Award, Loader2 } from "lucide-react";

interface CarbonDashboardProps {
  compact?: boolean;
}

export function CarbonDashboard({ compact = false }: CarbonDashboardProps) {
  const [impact, setImpact] = useState<CarbonImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadImpact();
  }, []);

  const loadImpact = async () => {
    try {
      setLoading(true);
      const data = await advancedAPI.getCarbonImpact();
      setImpact(data);
    } catch (err) {
      console.error("Failed to load carbon impact:", err);
      setError("Unable to load environmental impact data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (error || !impact) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error || "No impact data available"}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="flex items-center gap-2 mb-3">
          <Leaf className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-green-800 dark:text-green-300">Your Environmental Impact</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {impact.totalCO2Saved.toFixed(1)} kg
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">CO₂ Saved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {impact.totalRidesCompleted}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Green Rides</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Impact Card */}
      <div className="rounded-xl border bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 dark:from-green-900/30 dark:via-emerald-900/20 dark:to-teal-900/20 dark:border-green-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-800">
              <Leaf className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
                Environmental Impact
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your contribution to a greener planet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 dark:bg-green-800">
            <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {impact.impactLevel}
            </span>
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Leaf className="h-5 w-5" />}
            value={`${impact.totalCO2Saved.toFixed(1)} kg`}
            label="CO₂ Saved"
            color="green"
          />
          <StatCard
            icon={<Car className="h-5 w-5" />}
            value={`${impact.totalFuelSaved.toFixed(1)} L`}
            label="Fuel Saved"
            color="blue"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            value={`${impact.totalDistanceShared.toFixed(0)} km`}
            label="Distance Shared"
            color="purple"
          />
          <StatCard
            icon={<Award className="h-5 w-5" />}
            value={impact.totalRidesCompleted.toString()}
            label="Green Rides"
            color="orange"
          />
        </div>

        {/* Equivalents */}
        <div className="rounded-lg bg-white/60 p-4 dark:bg-gray-800/40">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Your impact is equivalent to:
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EquivalentItem
              icon={<TreeDeciduous className="h-5 w-5 text-green-600" />}
              value={impact.equivalents.trees.toFixed(1)}
              label="Trees planted for a year"
            />
            <EquivalentItem
              icon={<Smartphone className="h-5 w-5 text-blue-600" />}
              value={impact.equivalents.phoneCharges.toFixed(0)}
              label="Phone charges"
            />
            <EquivalentItem
              icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
              value={impact.equivalents.lightBulbHours.toFixed(0)}
              label="Hours of LED light"
            />
            <EquivalentItem
              icon={<Car className="h-5 w-5 text-red-600" />}
              value={impact.equivalents.carKmAvoided.toFixed(0)}
              label="Solo km avoided"
            />
          </div>
        </div>

        {/* Percentile Badge */}
        <div className="mt-4 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-white">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">
              Top {100 - impact.percentile}% of SyncRoute users
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {impact.monthlyBreakdown && impact.monthlyBreakdown.length > 0 && (
        <div className="rounded-xl border p-6 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Monthly Progress</h3>
          <div className="space-y-3">
            {impact.monthlyBreakdown.slice(-6).map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                  {month.month}
                </div>
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (month.co2Saved / (impact.totalCO2Saved / 6)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="w-24 text-right text-sm font-medium text-green-600 dark:text-green-400">
                  {month.co2Saved.toFixed(1)} kg CO₂
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: "green" | "blue" | "purple" | "orange";
}) {
  const colorClasses = {
    green: "bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-400",
  };

  return (
    <div className="rounded-lg bg-white/60 p-3 text-center dark:bg-gray-800/40">
      <div className={`inline-flex rounded-full p-2 mb-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="text-xl font-bold text-gray-800 dark:text-white">{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
}

function EquivalentItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className="text-sm font-semibold dark:text-white">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export default CarbonDashboard;
