import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  IndianRupee,
  Leaf,
  Car,
  Mail,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Filter,
  Search,
  Loader2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { corporateAPI, CorporateAccount } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalRides: number;
  totalSubsidy: number;
  co2Saved: number;
  monthlyTrend: Array<{ month: string; rides: number; subsidy: number }>;
}

const CorporateDashboard: React.FC = () => {
  const [account, setAccount] = useState<CorporateAccount | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountData, statsData, employeesData] = await Promise.all([
        corporateAPI.getAccount().catch(() => null),
        corporateAPI.getDashboard().catch(() => null),
        corporateAPI.getEmployees().catch(() => [])
      ]);
      
      setAccount(accountData);
      setStats(statsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Failed to load corporate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const inviteEmployee = async () => {
    if (!inviteEmail.trim()) return;
    
    setInviting(true);
    try {
      await corporateAPI.addEmployee(inviteEmail);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to invite employee');
    } finally {
      setInviting(false);
    }
  };

  const removeEmployee = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from the corporate account?`)) return;
    
    try {
      await corporateAPI.removeEmployee(userId);
      toast.success('Employee removed');
      setEmployees(employees.filter(e => e.userId !== userId));
    } catch (error) {
      toast.error('Failed to remove employee');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'inactive': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'inactive': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || emp.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!account) {
    return <RegisterCorporateAccount onSuccess={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{account.companyName}</h1>
            <p className="text-sm text-gray-500">Corporate Carpooling Account</p>
          </div>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Employee
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Employees"
            value={stats.totalEmployees}
            subValue={`${stats.activeEmployees} active`}
            color="blue"
          />
          <StatCard
            icon={Car}
            label="Total Rides"
            value={stats.totalRides}
            trend={stats.monthlyTrend[stats.monthlyTrend.length - 1]?.rides || 0}
            trendLabel="this month"
            color="emerald"
          />
          <StatCard
            icon={IndianRupee}
            label="Total Subsidy"
            value={`₹${stats.totalSubsidy.toLocaleString()}`}
            color="purple"
          />
          <StatCard
            icon={Leaf}
            label="CO₂ Saved"
            value={`${stats.co2Saved.toFixed(1)} kg`}
            color="green"
          />
        </div>
      )}

      {/* Subsidy Settings Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Subsidy Settings</h2>
          <button className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
            <Settings className="w-4 h-4" />
            Edit
          </button>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Subsidy Type</p>
            <p className="font-medium text-gray-900 capitalize">
              {account.subsidyRules.type === 'percentage' 
                ? `${account.subsidyRules.value}% of ride cost`
                : account.subsidyRules.type === 'fixed'
                ? `₹${account.subsidyRules.value} per ride`
                : 'Full ride coverage'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Max Per Ride</p>
            <p className="font-medium text-gray-900">
              {account.subsidyRules.maxPerRide 
                ? `₹${account.subsidyRules.maxPerRide}`
                : 'No limit'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Monthly Limit</p>
            <p className="font-medium text-gray-900">
              {account.subsidyRules.monthlyLimit 
                ? `₹${account.subsidyRules.monthlyLimit}`
                : 'No limit'}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {stats && stats.monthlyTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Overview</h2>
          <div className="h-48 flex items-end gap-2">
            {stats.monthlyTrend.map((month, idx) => {
              const maxRides = Math.max(...stats.monthlyTrend.map(m => m.rides));
              const height = maxRides > 0 ? (month.rides / maxRides) * 100 : 0;
              
              return (
                <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{month.rides}</span>
                    <motion.div
                      className="w-full bg-emerald-500 rounded-t-lg"
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: idx * 0.1 }}
                      style={{ minHeight: month.rides > 0 ? '20px' : '4px' }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{month.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employees List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Employees ({employees.length})</h2>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery || filterStatus !== 'all' 
                ? 'No employees match your filters'
                : 'No employees yet. Start inviting your team!'}
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <div key={emp.userId} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {(emp.name || emp.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{emp.name || 'Pending User'}</p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right mr-4">
                    <p className="text-sm font-medium text-gray-900">{emp.ridesCount || 0} rides</p>
                    <p className="text-xs text-gray-500">
                      ₹{(emp.subsidyUsed || 0).toLocaleString()} subsidy used
                    </p>
                  </div>
                  
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(emp.status)}`}>
                    {getStatusIcon(emp.status)}
                    {emp.status}
                  </span>
                  
                  <button
                    onClick={() => removeEmployee(emp.userId, emp.email)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Employee</h3>
              <p className="text-sm text-gray-500 mb-4">
                Enter the employee's email address. They'll receive an invitation to join your corporate carpooling program.
              </p>
              
              <div className="relative mb-4">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="employee@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              {account.settings.requireEmailDomain && (
                <p className="text-xs text-gray-500 mb-4">
                  Email must use @{account.companyDomain} domain
                </p>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={inviteEmployee}
                  disabled={!inviteEmail.trim() || inviting}
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Send Invite
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  color: 'blue' | 'emerald' | 'purple' | 'green';
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, subValue, trend, trendLabel, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {(subValue || trend !== undefined) && (
        <p className="text-sm text-gray-500 mt-1">
          {subValue || `${trend} ${trendLabel}`}
        </p>
      )}
    </div>
  );
};

// Register Corporate Account Component
const RegisterCorporateAccount: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    companyDomain: '',
    subsidyType: 'percentage' as 'percentage' | 'fixed' | 'full',
    subsidyValue: 50,
    maxPerRide: '',
    monthlyLimit: ''
  });
  const [registering, setRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.companyDomain) return;
    
    setRegistering(true);
    try {
      await corporateAPI.register({
        companyName: formData.companyName,
        companyDomain: formData.companyDomain,
        subsidyType: formData.subsidyType,
        subsidyValue: formData.subsidyType === 'full' ? 100 : formData.subsidyValue,
        subsidyCaps: {
          maxPerRide: formData.maxPerRide ? Number(formData.maxPerRide) : undefined,
          monthlyLimit: formData.monthlyLimit ? Number(formData.monthlyLimit) : undefined
        }
      });
      toast.success('Corporate account created successfully!');
      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create corporate account');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Corporate Carpooling</h1>
        <p className="text-gray-500">
          Set up a corporate account to offer subsidized rides to your employees
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder="Acme Corporation"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Domain
          </label>
          <input
            type="text"
            value={formData.companyDomain}
            onChange={(e) => setFormData({ ...formData, companyDomain: e.target.value })}
            placeholder="acme.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Employees with this email domain can join automatically
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subsidy Type
          </label>
          <select
            value={formData.subsidyType}
            onChange={(e) => setFormData({ ...formData, subsidyType: e.target.value as any })}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="percentage">Percentage of ride cost</option>
            <option value="fixed">Fixed amount per ride</option>
            <option value="full">Full ride coverage</option>
          </select>
        </div>

        {formData.subsidyType !== 'full' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.subsidyType === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
            </label>
            <input
              type="number"
              value={formData.subsidyValue}
              onChange={(e) => setFormData({ ...formData, subsidyValue: Number(e.target.value) })}
              min="1"
              max={formData.subsidyType === 'percentage' ? 100 : undefined}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Per Ride (₹)
            </label>
            <input
              type="number"
              value={formData.maxPerRide}
              onChange={(e) => setFormData({ ...formData, maxPerRide: e.target.value })}
              placeholder="Optional"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Limit (₹)
            </label>
            <input
              type="number"
              value={formData.monthlyLimit}
              onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
              placeholder="Optional"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={registering || !formData.companyName || !formData.companyDomain}
          className="w-full py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {registering ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Building2 className="w-5 h-5" />
              Create Corporate Account
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CorporateDashboard;
