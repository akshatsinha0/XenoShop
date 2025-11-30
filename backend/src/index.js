require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

// routes here i am adding
const tenantRoutes = require("./routes/tenantRoutes");
app.use("/api/tenants", tenantRoutes);

const customerRoutes = require("./routes/customerRoutes");
app.use("/api/customers", customerRoutes);

const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);


app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "xenoshop-backend" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`XenoShop backend running on http://localhost:${PORT}`);
});
