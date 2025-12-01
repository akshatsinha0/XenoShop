const express = require("express");
const router = express.Router();

const {
  getDashboardMetrics,
  getOrdersByDateRange,
  getTopCustomers,
  getRevenueTrends,
  getProductPerformance,
  getCustomerSegmentation,
  getSalesGrowth,
  getRecentActivity,
  exportData
} = require("../controllers/analyticsController");

router.get("/dashboard/:tenantId", getDashboardMetrics);
router.get("/orders/:tenantId", getOrdersByDateRange);
router.get("/top-customers/:tenantId", getTopCustomers);
router.get("/revenue-trends/:tenantId", getRevenueTrends);
router.get("/product-performance/:tenantId", getProductPerformance);
router.get("/customer-segmentation/:tenantId", getCustomerSegmentation);
router.get("/sales-growth/:tenantId", getSalesGrowth);
router.get("/recent-activity/:tenantId", getRecentActivity);
router.get("/export/:tenantId", exportData);

module.exports = router;
