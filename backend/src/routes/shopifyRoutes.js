const express = require("express");
const router = express.Router();

const { syncShopifyCustomers } = require("../controllers/shopifyController");

router.post("/customers/:tenantId", syncShopifyCustomers);

module.exports = router;