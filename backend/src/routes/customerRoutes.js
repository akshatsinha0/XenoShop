const express = require("express");
const router = express.Router();
const { createCustomer, getCustomersByTenant } = require("../controllers/customerController");

router.post("/", createCustomer);
router.get("/:tenantId", getCustomersByTenant);

module.exports = router;