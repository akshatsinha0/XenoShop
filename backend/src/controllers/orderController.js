const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

exports.createOrder = async (req, res) => {
  try {
    const { tenantId, customerId, totalAmount, currency, placedAt, items } = req.body;

    if (!tenantId || !customerId || !placedAt || !Array.isArray(items)) {
      return res.status(400).json({
        error: "tenantId, customerId, placedAt, and items[] are required"
      });
    }

    // Verify tenant
    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenantExists) return res.status(404).json({ error: "Tenant not found" });

    // Verify customer
    const customerExists = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customerExists) return res.status(404).json({ error: "Customer not found" });

    // Create the order + items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          customerId,
          totalAmount,
          currency,
          placedAt: new Date(placedAt),
        },
      });

      // Insert order items
      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          },
        });
      }

      return newOrder;
    });

    return res.status(201).json({
      message: "Order created successfully",
      order,
    });

  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getOrdersByTenant = async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    const orders = await prisma.order.findMany({
      where: { tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
      orderBy: { placedAt: "desc" },
    });

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};