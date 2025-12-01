const express = require("express");
const router = express.Router();

const {
  handleCustomerWebhook,
  handleOrderWebhook,
  handleProductWebhook
} = require("../controllers/webhookController");

// Shopify webhooks
router.post("/shopify/customers", handleCustomerWebhook);
router.post("/shopify/orders", handleOrderWebhook);
router.post("/shopify/products", handleProductWebhook);

module.exports = router;
