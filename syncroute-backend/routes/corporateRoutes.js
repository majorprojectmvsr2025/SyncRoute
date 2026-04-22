/**
 * Corporate Account Routes
 * 
 * API endpoints for B2B company carpooling management
 */

const express = require("express");
const CorporateAccount = require("../models/CorporateAccount");
const User = require("../models/User");
const Booking = require("../models/Booking");
const { protect } = require("../middleware/auth");
const { sendNotification, NotificationTypes } = require("../utils/notificationQueue");

const router = express.Router();

/**
 * Middleware: Check corporate admin access
 */
const requireCorporateAdmin = async (req, res, next) => {
  try {
    const accountId = req.params.accountId || req.body.accountId;
    
    const account = await CorporateAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: "Corporate account not found" });
    }

    if (!account.isAdmin(req.user._id)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.corporateAccount = account;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create corporate account
 * POST /api/corporate
 */
router.post("/", protect, async (req, res) => {
  try {
    const { company, subsidy, budget, settings } = req.body;

    if (!company?.name) {
      return res.status(400).json({ message: "Company name is required" });
    }

    // Check if domain already registered
    if (company.domain) {
      const existing = await CorporateAccount.findOne({ 
        "company.domain": company.domain,
        status: { $ne: "cancelled" }
      });
      if (existing) {
        return res.status(400).json({ message: "Domain already registered" });
      }
    }

    const corporateAccount = await CorporateAccount.create({
      company,
      admins: [{ user: req.user._id, role: "owner" }],
      subsidy: subsidy || {},
      budget: budget || {},
      settings: settings || {},
      status: "pending"
    });

    // Update user role
    await User.findByIdAndUpdate(req.user._id, {
      corporateAccount: corporateAccount._id,
      corporateRole: "admin"
    });

    res.status(201).json({
      account: corporateAccount,
      message: "Corporate account created. Pending verification."
    });
  } catch (error) {
    console.error("Create corporate account error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's corporate account
 * GET /api/corporate/my-account
 */
router.get("/my-account", protect, async (req, res) => {
  try {
    const account = await CorporateAccount.findForUser(req.user._id);
    
    if (!account) {
      return res.json({ hasAccount: false });
    }

    const isAdmin = account.isAdmin(req.user._id);
    
    // If admin, include full details
    if (isAdmin) {
      const stats = await account.getDashboardStats();
      return res.json({
        hasAccount: true,
        isAdmin: true,
        account,
        stats
      });
    }

    // Employee view
    const employee = account.employees.find(
      e => e.user?.toString() === req.user._id.toString()
    );

    res.json({
      hasAccount: true,
      isAdmin: false,
      company: {
        name: account.company.name,
        logo: account.company.logo
      },
      subsidy: account.subsidy.enabled ? {
        type: account.subsidy.type,
        value: account.subsidy.value
      } : null,
      employeeStatus: employee?.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get corporate dashboard (admin)
 * GET /api/corporate/:accountId/dashboard
 */
router.get("/:accountId/dashboard", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const stats = await req.corporateAccount.getDashboardStats();

    // Get recent activity
    const employeeIds = req.corporateAccount.employees
      .filter(e => e.status === "active" && e.user)
      .map(e => e.user);

    const recentBookings = await Booking.find({
      passenger: { $in: employeeIds }
    })
      .populate("passenger", "name email")
      .populate("ride", "from to date price")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get top commuters
    const topCommuters = await Booking.aggregate([
      { $match: { passenger: { $in: employeeIds }, status: "confirmed" } },
      { $group: { _id: "$passenger", rideCount: { $sum: 1 } } },
      { $sort: { rideCount: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      stats,
      recentActivity: recentBookings,
      topCommuters,
      account: req.corporateAccount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update corporate settings
 * PUT /api/corporate/:accountId
 */
router.put("/:accountId", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const { company, subsidy, budget, settings } = req.body;
    const account = req.corporateAccount;

    if (company) {
      account.company = { ...account.company, ...company };
    }
    if (subsidy) {
      account.subsidy = { ...account.subsidy, ...subsidy };
    }
    if (budget) {
      account.budget = { ...account.budget, ...budget };
    }
    if (settings) {
      account.settings = { ...account.settings, ...settings };
    }

    await account.save();

    res.json({ account, message: "Settings updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employees list
 * GET /api/corporate/:accountId/employees
 */
router.get("/:accountId/employees", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const { status, department, search } = req.query;
    
    let employees = req.corporateAccount.employees;

    if (status) {
      employees = employees.filter(e => e.status === status);
    }
    if (department) {
      employees = employees.filter(e => e.department === department);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      employees = employees.filter(e => 
        e.email?.toLowerCase().includes(searchLower)
      );
    }

    // Populate user details
    const populatedEmployees = await Promise.all(
      employees.map(async (emp) => {
        if (emp.user) {
          const user = await User.findById(emp.user).select("name email photo");
          return { ...emp.toObject(), userDetails: user };
        }
        return emp.toObject();
      })
    );

    res.json({
      employees: populatedEmployees,
      total: req.corporateAccount.employees.length,
      active: req.corporateAccount.employees.filter(e => e.status === "active").length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add employee
 * POST /api/corporate/:accountId/employees
 */
router.post("/:accountId/employees", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const { email, department, employeeId } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const employee = await req.corporateAccount.addEmployee(email, {
      department,
      employeeId
    });

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      employee.user = existingUser._id;
      existingUser.corporateAccount = req.corporateAccount._id;
      await existingUser.save();
      await req.corporateAccount.save();

      // Notify user
      await sendNotification(
        existingUser._id,
        "Welcome to Corporate Carpooling! 🏢",
        `You've been added to ${req.corporateAccount.company.name}'s carpooling program.`,
        NotificationTypes.RIDE_UPDATE
      );
    }

    res.status(201).json({
      employee,
      message: existingUser 
        ? "Employee added and linked to account"
        : "Employee added. They will be linked when they sign up."
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk add employees
 * POST /api/corporate/:accountId/employees/bulk
 */
router.post("/:accountId/employees/bulk", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ message: "Emails array is required" });
    }

    const results = { added: [], failed: [] };

    for (const email of emails) {
      try {
        await req.corporateAccount.addEmployee(email.trim());
        results.added.push(email);
      } catch (err) {
        results.failed.push({ email, error: err.message });
      }
    }

    res.json({
      ...results,
      message: `Added ${results.added.length} employees, ${results.failed.length} failed`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update employee status
 * PATCH /api/corporate/:accountId/employees/:employeeEmail
 */
router.patch("/:accountId/employees/:employeeEmail", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const { status, department } = req.body;
    const account = req.corporateAccount;

    const employee = account.employees.find(
      e => e.email === req.params.employeeEmail
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (status) employee.status = status;
    if (department) employee.department = department;

    await account.save();

    // Notify if approved
    if (status === "active" && employee.user) {
      await sendNotification(
        employee.user,
        "Account Approved! ✅",
        `Your corporate carpooling account with ${account.company.name} has been approved.`,
        NotificationTypes.RIDE_UPDATE
      );
    }

    res.json({ employee, message: "Employee updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove employee
 * DELETE /api/corporate/:accountId/employees/:employeeEmail
 */
router.delete("/:accountId/employees/:employeeEmail", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const account = req.corporateAccount;

    const employeeIndex = account.employees.findIndex(
      e => e.email === req.params.employeeEmail
    );

    if (employeeIndex === -1) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employee = account.employees[employeeIndex];
    
    // Update user if linked
    if (employee.user) {
      await User.findByIdAndUpdate(employee.user, {
        $unset: { corporateAccount: 1, corporateRole: 1 }
      });
    }

    account.employees.splice(employeeIndex, 1);
    await account.save();

    res.json({ message: "Employee removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calculate subsidy for a booking
 * POST /api/corporate/calculate-subsidy
 */
router.post("/calculate-subsidy", protect, async (req, res) => {
  try {
    const { ridePrice } = req.body;

    const account = await CorporateAccount.findForUser(req.user._id);
    
    if (!account || !account.isEmployee(req.user._id)) {
      return res.json({ subsidy: 0, eligible: false });
    }

    const subsidy = account.calculateSubsidy(ridePrice, req.user._id);

    res.json({
      eligible: true,
      subsidy,
      finalPrice: ridePrice - subsidy,
      companyName: account.company.name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Apply subsidy to booking
 * POST /api/corporate/apply-subsidy
 */
router.post("/apply-subsidy", protect, async (req, res) => {
  try {
    const { bookingId, ridePrice } = req.body;

    const account = await CorporateAccount.findForUser(req.user._id);
    
    if (!account || !account.isEmployee(req.user._id)) {
      return res.status(400).json({ message: "Not eligible for subsidy" });
    }

    const subsidy = account.calculateSubsidy(ridePrice, req.user._id);
    
    if (subsidy > 0) {
      // Update booking with subsidy
      await Booking.findByIdAndUpdate(bookingId, {
        corporateSubsidy: {
          accountId: account._id,
          amount: subsidy,
          appliedAt: new Date()
        }
      });

      // Update corporate budget
      account.budget.currentMonthSpent += subsidy;
      account.stats.totalSubsidyPaid += subsidy;
      account.stats.totalRides += 1;
      await account.save();
    }

    res.json({
      applied: subsidy > 0,
      subsidy,
      finalPrice: ridePrice - subsidy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get usage analytics (admin)
 * GET /api/corporate/:accountId/analytics
 */
router.get("/:accountId/analytics", protect, requireCorporateAdmin, async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const account = req.corporateAccount;

    const startDate = new Date();
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const employeeIds = account.employees
      .filter(e => e.status === "active" && e.user)
      .map(e => e.user);

    // Daily ride counts
    const dailyRides = await Booking.aggregate([
      {
        $match: {
          passenger: { $in: employeeIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          totalSubsidy: { $sum: "$corporateSubsidy.amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Department breakdown
    const departmentStats = await Booking.aggregate([
      {
        $match: {
          passenger: { $in: employeeIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: "corporateaccounts",
          let: { passengerId: "$passenger" },
          pipeline: [
            { $unwind: "$employees" },
            { $match: { $expr: { $eq: ["$employees.user", "$$passengerId"] } } },
            { $project: { department: "$employees.department" } }
          ],
          as: "employeeInfo"
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ["$employeeInfo.department", 0] },
          rideCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      period,
      dailyRides,
      departmentStats,
      summary: {
        totalRides: dailyRides.reduce((sum, d) => sum + d.count, 0),
        totalSubsidy: dailyRides.reduce((sum, d) => sum + (d.totalSubsidy || 0), 0),
        avgRidesPerDay: dailyRides.length > 0 
          ? Math.round(dailyRides.reduce((sum, d) => sum + d.count, 0) / dailyRides.length)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
