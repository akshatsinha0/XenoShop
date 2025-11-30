const express = require("express");
const router = express.Router();

const { createOrder, getOrdersByTenant } = require("../controllers/orderController");

router.post("/", createOrder);
router.get("/:tenantId", getOrdersByTenant);

module.exports = router;