const axios = require("axios");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

const SHOPIFY_API_VERSION = "2024-10";

/**
 * Helper to get tenant with validated Shopify credentials
 */
const getTenantWithCredentials = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.shopifyAccessToken || !tenant.shopDomain) {
    return null;
  }
  return tenant;
};

/**
 * Helper to make Shopify API requests
 */
const shopifyRequest = async (tenant, endpoint) => {
  const url = `https://${tenant.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`;
  return axios.get(url, {
    headers: {
      "X-Shopify-Access-Token": tenant.shopifyAccessToken,
      "Content-Type": "application/json"
    }
  });
};

/**
 * Sync customers from Shopify
 */
exports.syncShopifyCustomers = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await getTenantWithCredentials(tenantId);

    if (!tenant) {
      return res.status(400).json({ error: "Tenant or Shopify credentials missing" });
    }

    const response = await shopifyRequest(tenant, "customers.json");
    const customers = response.data.customers || [];

    for (const cust of customers) {
      const email = cust.email || `shopify-${cust.id}@placeholder.local`;
      await prisma.customer.upsert({
        where: { email },
        update: {
          firstName: cust.first_name,
          lastName: cust.last_name,
          phone: cust.phone
        },
        create: {
          tenantId,
          email,
          firstName: cust.first_name,
          lastName: cust.last_name,
          phone: cust.phone
        }
      });
    }

    return res.json({ message: "Shopify customers synced successfully", count: customers.length });
  } catch (error) {
    console.error("Error syncing customers:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to sync Shopify customers" });
  }
};

/**
 * Sync products from Shopify
 */
exports.syncShopifyProducts = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await getTenantWithCredentials(tenantId);

    if (!tenant) {
      return res.status(400).json({ error: "Tenant or Shopify credentials missing" });
    }

    const response = await shopifyRequest(tenant, "products.json");
    const products = response.data.products || [];

    for (const prod of products) {
      const variant = prod.variants?.[0];
      const price = variant ? parseFloat(variant.price) : 0;
      const sku = variant?.sku || null;

      await prisma.product.upsert({
        where: { 
          tenantId_shopifyProductId: { tenantId, shopifyProductId: String(prod.id) }
        },
        update: {
          title: prod.title,
          description: prod.body_html || null,
          price,
          sku
        },
        create: {
          tenantId,
          shopifyProductId: String(prod.id),
          title: prod.title,
          description: prod.body_html || null,
          price,
          sku
        }
      });
    }

    return res.json({ message: "Shopify products synced successfully", count: products.length });
  } catch (error) {
    console.error("Error syncing products:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to sync Shopify products" });
  }
};

/**
 * Sync orders from Shopify
 */
exports.syncShopifyOrders = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await getTenantWithCredentials(tenantId);

    if (!tenant) {
      return res.status(400).json({ error: "Tenant or Shopify credentials missing" });
    }

    const response = await shopifyRequest(tenant, "orders.json?status=any");
    const orders = response.data.orders || [];

    for (const ord of orders) {
      // Find or create customer
      const customerEmail = ord.customer?.email || `order-${ord.id}@placeholder.local`;
      let customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
      
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            tenantId,
            email: customerEmail,
            firstName: ord.customer?.first_name || "Unknown",
            lastName: ord.customer?.last_name || "Customer"
          }
        });
      }

      // Upsert order
      const existingOrder = await prisma.order.findFirst({
        where: { tenantId, shopifyOrderId: String(ord.id) }
      });

      if (!existingOrder) {
        const newOrder = await prisma.order.create({
          data: {
            tenantId,
            customerId: customer.id,
            shopifyOrderId: String(ord.id),
            totalAmount: parseFloat(ord.total_price) || 0,
            currency: ord.currency || "INR",
            placedAt: new Date(ord.created_at)
          }
        });

        // Create order items
        for (const item of ord.line_items || []) {
          // Find product by shopifyProductId
          let product = await prisma.product.findFirst({
            where: { tenantId, shopifyProductId: String(item.product_id) }
          });

          if (!product) {
            product = await prisma.product.create({
              data: {
                tenantId,
                shopifyProductId: String(item.product_id),
                title: item.title || "Unknown Product",
                price: parseFloat(item.price) || 0
              }
            });
          }

          await prisma.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: product.id,
              quantity: item.quantity || 1,
              price: parseFloat(item.price) || 0
            }
          });
        }
      }
    }

    return res.json({ message: "Shopify orders synced successfully", count: orders.length });
  } catch (error) {
    console.error("Error syncing orders:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to sync Shopify orders" });
  }
};

/**
 * Sync all data from Shopify (customers, products, orders)
 */
exports.syncAllShopifyData = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await getTenantWithCredentials(tenantId);

    if (!tenant) {
      return res.status(400).json({ error: "Tenant or Shopify credentials missing" });
    }

    const results = { customers: 0, products: 0, orders: 0 };

    // Sync customers
    try {
      const custResponse = await shopifyRequest(tenant, "customers.json");
      const customers = custResponse.data.customers || [];
      for (const cust of customers) {
        const email = cust.email || `shopify-${cust.id}@placeholder.local`;
        await prisma.customer.upsert({
          where: { email },
          update: { firstName: cust.first_name, lastName: cust.last_name, phone: cust.phone },
          create: { tenantId, email, firstName: cust.first_name, lastName: cust.last_name, phone: cust.phone }
        });
      }
      results.customers = customers.length;
    } catch (e) {
      console.error("Customer sync error:", e.message);
    }

    // Sync products
    try {
      const prodResponse = await shopifyRequest(tenant, "products.json");
      const products = prodResponse.data.products || [];
      for (const prod of products) {
        const variant = prod.variants?.[0];
        await prisma.product.upsert({
          where: { tenantId_shopifyProductId: { tenantId, shopifyProductId: String(prod.id) } },
          update: { title: prod.title, description: prod.body_html, price: parseFloat(variant?.price) || 0, sku: variant?.sku },
          create: { tenantId, shopifyProductId: String(prod.id), title: prod.title, description: prod.body_html, price: parseFloat(variant?.price) || 0, sku: variant?.sku }
        });
      }
      results.products = products.length;
    } catch (e) {
      console.error("Product sync error:", e.message);
    }

    // Sync orders
    try {
      const ordResponse = await shopifyRequest(tenant, "orders.json?status=any");
      const orders = ordResponse.data.orders || [];
      for (const ord of orders) {
        const customerEmail = ord.customer?.email || `order-${ord.id}@placeholder.local`;
        let customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
        if (!customer) {
          customer = await prisma.customer.create({
            data: { tenantId, email: customerEmail, firstName: ord.customer?.first_name || "Unknown", lastName: ord.customer?.last_name || "Customer" }
          });
        }

        const existingOrder = await prisma.order.findFirst({ where: { tenantId, shopifyOrderId: String(ord.id) } });
        if (!existingOrder) {
          const newOrder = await prisma.order.create({
            data: { tenantId, customerId: customer.id, shopifyOrderId: String(ord.id), totalAmount: parseFloat(ord.total_price) || 0, currency: ord.currency || "INR", placedAt: new Date(ord.created_at) }
          });

          for (const item of ord.line_items || []) {
            let product = await prisma.product.findFirst({ where: { tenantId, shopifyProductId: String(item.product_id) } });
            if (!product) {
              product = await prisma.product.create({
                data: { tenantId, shopifyProductId: String(item.product_id), title: item.title || "Unknown Product", price: parseFloat(item.price) || 0 }
              });
            }
            await prisma.orderItem.create({
              data: { orderId: newOrder.id, productId: product.id, quantity: item.quantity || 1, price: parseFloat(item.price) || 0 }
            });
          }
        }
      }
      results.orders = orders.length;
    } catch (e) {
      console.error("Order sync error:", e.message);
    }

    return res.json({ message: "Shopify data sync completed", results });
  } catch (error) {
    console.error("Error in full sync:", error.message);
    return res.status(500).json({ error: "Failed to sync Shopify data" });
  }
};
