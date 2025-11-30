const axios = require("axios");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

exports.syncShopifyCustomers = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || !tenant.shopifyAccessToken || !tenant.shopDomain) {
      return res.status(400).json({ error: "Tenant or Shopify credentials missing" });
    }

    const url = `https://${tenant.shopDomain}/admin/api/2024-10/customers.json`;

    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": tenant.shopifyAccessToken,
        "Content-Type": "application/json"
      }
    });

    const customers = response.data.customers;

    for (const cust of customers) {
      await prisma.customer.upsert({
        where: { email: cust.email || `unknown-${cust.id}@example.com` },
        update: {
          firstName: cust.first_name,
          lastName: cust.last_name,
          phone: cust.phone
        },
        create: {
          tenantId,
          email: cust.email || `unknown-${cust.id}@example.com`,
          firstName: cust.first_name,
          lastName: cust.last_name,
          phone: cust.phone
        }
      });
    }

    return res.json({
      message: "Shopify customers synced successfully",
      count: customers.length
    });

  } catch (error) {
    console.error("Error syncing customers:", error.response?.data || error);
    return res.status(500).json({ error: "Failed to sync Shopify customers" });
  }
};
