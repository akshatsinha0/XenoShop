const express = require("express");
const router = express.Router();
const { createTenant, getAllTenants } = require("../controllers/tenantController");
const { updateShopifyCredentials } = require("../controllers/tenantController");

router.post("/", createTenant);
router.get("/", getAllTenants);
router.put("/:tenantId/shopify", updateShopifyCredentials);

module.exports = router;
