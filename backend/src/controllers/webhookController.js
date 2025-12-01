const crypto = require("crypto");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

/**
 * Verify Shopify webhook signature
 */
const verifyShopifyWebhook = (req, secret) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (!hmac || !secret) return false;
  
  const hash = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest("base64");
  
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
};

/**
 * Handle customer create/update webhook
 */
exports.handleCustomerWebhook = async (req, res) => {
  try {
    const shopDomain = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    const customer = req.body;

    console.log(`Webhook received: ${topic} from ${shopDomain}`);

    const tenant = await prisma.tenant.findFirst({
      where: { shopDomain }
    });

    if (!tenant) {
      console.log("Tenant not found for shop:", shopDomain);
      return res.status(200).send("OK");
    }

    const email = customer.email || `shopify-${customer.id}@placeholder.local`;

    if (topic === "customers/delete") {
      await prisma.customer.deleteMany({ where: { email, tenantId: tenant.id } });
    } else {
      await prisma.customer.upsert({
        where: { email },
        update: {
          firstName: customer.first_name,
          lastName: customer.last_name,
          phone: customer.phone
        },
        create: {
          tenantId: tenant.id,
          email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          phone: customer.phone
        }
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Customer webhook error:", error);
    return res.status(200).send("OK");
  }
};


/**
 * Handle order create/update webhook
 */
exports.handleOrderWebhook = async (req, res) => {
  try {
    const shopDomain = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    const order = req.body;

    console.log(`Order webhook received: ${topic} from ${shopDomain}`);

    const tenant = await prisma.tenant.findFirst({
      where: { shopDomain }
    });

    if (!tenant) {
      return res.status(200).send("OK");
    }

    if (topic === "orders/cancelled" || topic === "orders/delete") {
      await prisma.order.deleteMany({
        where: { tenantId: tenant.id, shopifyOrderId: String(order.id) }
      });
      return res.status(200).send("OK");
    }

    // Find or create customer
    const customerEmail = order.customer?.email || `order-${order.id}@placeholder.local`;
    let customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
    
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          email: customerEmail,
          firstName: order.customer?.first_name || "Unknown",
          lastName: order.customer?.last_name || "Customer"
        }
      });
    }

    // Check if order exists
    const existingOrder = await prisma.order.findFirst({
      where: { tenantId: tenant.id, shopifyOrderId: String(order.id) }
    });

    if (!existingOrder) {
      const newOrder = await prisma.order.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          shopifyOrderId: String(order.id),
          totalAmount: parseFloat(order.total_price) || 0,
          currency: order.currency || "INR",
          placedAt: new Date(order.created_at)
        }
      });

      // Create order items
      for (const item of order.line_items || []) {
        let product = await prisma.product.findFirst({
          where: { tenantId: tenant.id, shopifyProductId: String(item.product_id) }
        });

        if (!product) {
          product = await prisma.product.create({
            data: {
              tenantId: tenant.id,
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

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Order webhook error:", error);
    return res.status(200).send("OK");
  }
};

/**
 * Handle product create/update webhook
 */
exports.handleProductWebhook = async (req, res) => {
  try {
    const shopDomain = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    const product = req.body;

    console.log(`Product webhook received: ${topic} from ${shopDomain}`);

    const tenant = await prisma.tenant.findFirst({
      where: { shopDomain }
    });

    if (!tenant) {
      return res.status(200).send("OK");
    }

    if (topic === "products/delete") {
      await prisma.product.deleteMany({
        where: { tenantId: tenant.id, shopifyProductId: String(product.id) }
      });
      return res.status(200).send("OK");
    }

    const variant = product.variants?.[0];
    await prisma.product.upsert({
      where: {
        tenantId_shopifyProductId: { tenantId: tenant.id, shopifyProductId: String(product.id) }
      },
      update: {
        title: product.title,
        description: product.body_html || null,
        price: parseFloat(variant?.price) || 0,
        sku: variant?.sku || null
      },
      create: {
        tenantId: tenant.id,
        shopifyProductId: String(product.id),
        title: product.title,
        description: product.body_html || null,
        price: parseFloat(variant?.price) || 0,
        sku: variant?.sku || null
      }
    });

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Product webhook error:", error);
    return res.status(200).send("OK");
  }
};
