const express = require("express");
const router = express.Router();

const {
  syncShopifyCustomers,
  syncShopifyProducts,
  syncShopifyOrders,
  syncAllShopifyData
} = require("../controllers/shopifyController");

router.post("/customers/:tenantId", syncShopifyCustomers);
router.post("/products/:tenantId", syncShopifyProducts);
router.post("/orders/:tenantId", syncShopifyOrders);
router.post("/sync/:tenantId", syncAllShopifyData);

module.exports = router;