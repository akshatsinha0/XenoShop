const express = require("express");
const router = express.Router();
const { createProduct, getProductsByTenant } = require("../controllers/productController");

router.post("/", createProduct);
router.get("/:tenantId", getProductsByTenant);

module.exports = router;