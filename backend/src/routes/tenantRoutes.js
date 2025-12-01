const express = require("express");
const router = express.Router();
const {
  createTenant,
  getAllTenants,
  getTenantById,
  updateShopifyCredentials
} = require("../controllers/tenantController");

router.post("/", createTenant);
router.get("/", getAllTenants);
router.get("/:tenantId", getTenantById);
router.put("/:tenantId/shopify", updateShopifyCredentials);

module.exports = router;
