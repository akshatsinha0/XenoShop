require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Raw body for webhook signature verification
app.use("/webhooks", express.raw({ type: "application/json" }), (req, res, next) => {
  req.rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});

app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const shopifyRoutes = require("./routes/shopifyRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/shopify", shopifyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/webhooks", webhookRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "xenoshop-backend", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`XenoShop backend running on http://localhost:${PORT}`);
  
  // Start scheduler for periodic sync (optional - enable in production)
  if (process.env.ENABLE_SCHEDULER === "true") {
    const { startScheduler } = require("./services/scheduler");
    startScheduler();
  }
});
