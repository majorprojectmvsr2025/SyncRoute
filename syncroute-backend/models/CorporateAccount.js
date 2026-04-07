/**
 * Corporate Account Model
 * 
 * Enables B2B company-sponsored carpooling with:
 * - Employee management
 * - Ride subsidies
 * - Admin dashboard data
 * - Usage analytics
 */

const mongoose = require("mongoose");

const CorporateAccountSchema = new mongoose.Schema({
  // Company info
  company: {
    name: { type: String, required: true },
    domain: String, // e.g., "company.com" for email validation
    logo: String,
    industry: String,
    size: {
      type: String,
      enum: ["1-50", "51-200", "201-500", "501-1000", "1000+"]
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      coordinates: {
        type: { type: String, default: "Point" },
        coordinates: [Number]
      }
    }
  },

  // Admin users
  admins: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: {
      type: String,
      enum: ["owner", "admin", "manager"],
      default: "admin"
    },
    addedAt: { type: Date, default: Date.now }
  }],

  // Employees
  employees: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: String,
    department: String,
    employeeId: String,
    status: {
      type: String,
      enum: ["active", "pending", "inactive"],
      default: "pending"
    },
    joinedAt: { type: Date, default: Date.now }
  }],

  // Subsidy settings
  subsidy: {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["percentage", "fixed", "full"],
      default: "percentage"
    },
    value: { type: Number, default: 0 }, // % or fixed amount
    maxPerRide: { type: Number }, // Cap per ride
    maxPerMonth: { type: Number }, // Monthly cap per employee
    eligibleRoutes: [{
      type: {
        type: String,
        enum: ["to_office", "from_office", "both", "any"],
        default: "both"
      },
      officeLocation: {
        name: String,
        coordinates: [Number]
      }
    }]
  },

  // Budget
  budget: {
    monthlyLimit: { type: Number, default: 0 },
    currentMonthSpent: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastResetDate: Date
  },

  // Billing
  billing: {
    plan: {
      type: String,
      enum: ["starter", "professional", "enterprise"],
      default: "starter"
    },
    billingEmail: String,
    paymentMethod: String,
    nextBillingDate: Date
  },

  // Settings
  settings: {
    autoApproveEmployees: { type: Boolean, default: false },
    requireEmailDomain: { type: Boolean, default: true },
    allowGuestRides: { type: Boolean, default: false },
    visibleToEmployees: { type: Boolean, default: true }
  },

  // Stats
  stats: {
    totalRides: { type: Number, default: 0 },
    totalCO2Saved: { type: Number, default: 0 },
    totalSubsidyPaid: { type: Number, default: 0 },
    activeEmployees: { type: Number, default: 0 },
    avgRidesPerEmployee: { type: Number, default: 0 }
  },

  // Status
  status: {
    type: String,
    enum: ["active", "pending", "suspended", "cancelled"],
    default: "pending"
  },

  verificationStatus: {
    type: String,
    enum: ["unverified", "pending", "verified"],
    default: "unverified"
  }
}, {
  timestamps: true
});

// Indexes
CorporateAccountSchema.index({ "company.name": "text" });
CorporateAccountSchema.index({ "company.domain": 1 });
CorporateAccountSchema.index({ "admins.user": 1 });
CorporateAccountSchema.index({ "employees.user": 1 });
CorporateAccountSchema.index({ status: 1 });

/**
 * Check if user is admin of this account
 */
CorporateAccountSchema.methods.isAdmin = function(userId) {
  return this.admins.some(a => a.user.toString() === userId.toString());
};

/**
 * Check if user is employee
 */
CorporateAccountSchema.methods.isEmployee = function(userId) {
  return this.employees.some(e => 
    e.user?.toString() === userId.toString() && e.status === "active"
  );
};

/**
 * Calculate subsidy for a ride
 */
CorporateAccountSchema.methods.calculateSubsidy = function(ridePrice, employeeId) {
  if (!this.subsidy.enabled) return 0;

  const employee = this.employees.find(e => 
    e.user?.toString() === employeeId.toString()
  );
  
  if (!employee || employee.status !== "active") return 0;

  let subsidy = 0;

  switch (this.subsidy.type) {
    case "percentage":
      subsidy = ridePrice * (this.subsidy.value / 100);
      break;
    case "fixed":
      subsidy = this.subsidy.value;
      break;
    case "full":
      subsidy = ridePrice;
      break;
  }

  // Apply caps
  if (this.subsidy.maxPerRide) {
    subsidy = Math.min(subsidy, this.subsidy.maxPerRide);
  }

  // Don't exceed ride price
  subsidy = Math.min(subsidy, ridePrice);

  // Check monthly budget
  const remainingBudget = this.budget.monthlyLimit - this.budget.currentMonthSpent;
  subsidy = Math.min(subsidy, Math.max(0, remainingBudget));

  return Math.round(subsidy * 100) / 100;
};

/**
 * Add employee by email
 */
CorporateAccountSchema.methods.addEmployee = async function(email, userData = {}) {
  // Check domain if required
  if (this.settings.requireEmailDomain && this.company.domain) {
    const emailDomain = email.split("@")[1];
    if (emailDomain !== this.company.domain) {
      throw new Error("Email domain does not match company domain");
    }
  }

  // Check if already exists
  const existing = this.employees.find(e => e.email === email);
  if (existing) {
    throw new Error("Employee already exists");
  }

  this.employees.push({
    email,
    ...userData,
    status: this.settings.autoApproveEmployees ? "active" : "pending"
  });

  await this.save();
  return this.employees[this.employees.length - 1];
};

/**
 * Get dashboard stats
 */
CorporateAccountSchema.methods.getDashboardStats = async function() {
  const Booking = require("./Booking");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const employeeIds = this.employees
    .filter(e => e.status === "active" && e.user)
    .map(e => e.user);

  // Get recent bookings
  const recentBookings = await Booking.countDocuments({
    passenger: { $in: employeeIds },
    createdAt: { $gte: thirtyDaysAgo }
  });

  return {
    totalEmployees: this.employees.filter(e => e.status === "active").length,
    pendingEmployees: this.employees.filter(e => e.status === "pending").length,
    monthlyRides: recentBookings,
    monthlySubsidy: this.budget.currentMonthSpent,
    budgetRemaining: this.budget.monthlyLimit - this.budget.currentMonthSpent,
    totalCO2Saved: this.stats.totalCO2Saved,
    totalRides: this.stats.totalRides
  };
};

/**
 * Static: Find corporate account for user
 */
CorporateAccountSchema.statics.findForUser = async function(userId) {
  return this.findOne({
    $or: [
      { "admins.user": userId },
      { "employees.user": userId, "employees.status": "active" }
    ],
    status: "active"
  });
};

module.exports = mongoose.model("CorporateAccount", CorporateAccountSchema);
