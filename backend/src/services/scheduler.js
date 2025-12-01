const axios = require("axios");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

const SHOPIFY_API_VERSION = "2024-10";
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Sync all data for a single tenant
 */
const syncTenantData = async (tenant) => {
  if (!tenant.shopifyAccessToken || !tenant.shopDomain) return;

  const headers = {
    "X-Shopify-Access-Token": tenant.shopifyAccessToken,
    "Content-Type": "application/json"
  };

  const baseUrl = `https://${tenant.shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;

  try {
    // Sync customers
    const custRes = await axios.get(`${baseUrl}/customers.json`, { headers });
    for (const cust of custRes.data.customers || []) {
      const email = cust.email || `shopify-${cust.id}@placeholder.local`;
      await prisma.customer.upsert({
        where: { email },
        update: { firstName: cust.first_name, lastName: cust.last_name, phone: cust.phone },
        create: { tenantId: tenant.id, email, firstName: cust.first_name, lastName: cust.last_name, phone: cust.phone }
      });
    }

    // Sync products
    const prodRes = await axios.get(`${baseUrl}/products.json`, { headers });
    for (const prod of prodRes.data.products || []) {
      const variant = prod.variants?.[0];
      await prisma.product.upsert({
        where: { tenantId_shopifyProductId: { tenantId: tenant.id, shopifyProductId: String(prod.id) } },
        update: { title: prod.title, description: prod.body_html, price: parseFloat(variant?.price) || 0, sku: variant?.sku },
        create: { tenantId: tenant.id, shopifyProductId: String(prod.id), title: prod.title, description: prod.body_html, price: parseFloat(variant?.price) || 0, sku: variant?.sku }
      });
    }

    // Sync orders
    const ordRes = await axios.get(`${baseUrl}/orders.json?status=any`, { headers });
    for (const ord of ordRes.data.orders || []) {
      const customerEmail = ord.customer?.email || `order-${ord.id}@placeholder.local`;
      let customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: { tenantId: tenant.id, email: customerEmail, firstName: ord.customer?.first_name || "Unknown", lastName: ord.customer?.last_name || "Customer" }
        });
      }

      const existingOrder = await prisma.order.findFirst({ where: { tenantId: tenant.id, shopifyOrderId: String(ord.id) } });
      if (!existingOrder) {
        const newOrder = await prisma.order.create({
          data: { tenantId: tenant.id, customerId: customer.id, shopifyOrderId: String(ord.id), totalAmount: parseFloat(ord.total_price) || 0, currency: ord.currency || "INR", placedAt: new Date(ord.created_at) }
        });

        for (const item of ord.line_items || []) {
          let product = await prisma.product.findFirst({ where: { tenantId: tenant.id, shopifyProductId: String(item.product_id) } });
          if (!product) {
            product = await prisma.product.create({
              data: { tenantId: tenant.id, shopifyProductId: String(item.product_id), title: item.title || "Unknown", price: parseFloat(item.price) || 0 }
            });
          }
          await prisma.orderItem.create({
            data: { orderId: newOrder.id, productId: product.id, quantity: item.quantity || 1, price: parseFloat(item.price) || 0 }
          });
        }
      }
    }

    console.log(`[Scheduler] Synced data for tenant: ${tenant.name}`);
  } catch (error) {
    console.error(`[Scheduler] Sync failed for tenant ${tenant.name}:`, error.message);
  }
};

/**
 * Run sync for all tenants
 */
const runScheduledSync = async () => {
  console.log("[Scheduler] Starting scheduled sync...");
  const tenants = await prisma.tenant.findMany({
    where: { shopifyAccessToken: { not: null } }
  });

  for (const tenant of tenants) {
    await syncTenantData(tenant);
  }
  console.log("[Scheduler] Scheduled sync completed");
};

/**
 * Start the scheduler
 */
const startScheduler = () => {
  console.log(`[Scheduler] Starting with interval: ${SYNC_INTERVAL_MS / 1000}s`);
  setInterval(runScheduledSync, SYNC_INTERVAL_MS);
  // Run initial sync after 10 seconds
  setTimeout(runScheduledSync, 10000);
};

module.exports = { startScheduler, runScheduledSync };
