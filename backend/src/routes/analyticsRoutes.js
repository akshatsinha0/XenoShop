const express = require("express");
const router = express.Router();

const {
  getDashboardMetrics,
  getOrdersByDateRange,
  getTopCustomers,
  getRevenueTrends,
  getProductPerformance
} = require("../controllers/analyticsController");

router.get("/dashboard/:tenantId", getDashboardMetrics);
router.get("/orders/:tenantId", getOrdersByDateRange);
router.get("/top-customers/:tenantId", getTopCustomers);
router.get("/revenue-trends/:tenantId", getRevenueTrends);
router.get("/product-performance/:tenantId", getProductPerformance);

module.exports = router;
