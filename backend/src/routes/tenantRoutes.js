const express = require("express");
const router = express.Router();
const { createTenant, getAllTenants } = require("../controllers/tenantController");

router.post("/", createTenant);
router.get("/", getAllTenants);

module.exports = router;
