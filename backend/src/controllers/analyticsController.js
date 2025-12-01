const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

/**
 * Get dashboard overview metrics for a tenant
 */
exports.getDashboardMetrics = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const [totalCustomers, totalProducts, totalOrders, revenueResult] = await Promise.all([
      prisma.customer.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId } }),
      prisma.order.aggregate({
        where: { tenantId },
        _sum: { totalAmount: true }
      })
    ]);

    const totalRevenue = revenueResult._sum.totalAmount || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return res.json({
      totalCustomers,
      totalProducts,
      totalOrders,
      totalRevenue,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
};

/**
 * Get orders by date range with aggregation
 */
exports.getOrdersByDateRange = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;

    const whereClause = { tenantId };
    if (startDate || endDate) {
      whereClause.placedAt = {};
      if (startDate) whereClause.placedAt.gte = new Date(startDate);
      if (endDate) whereClause.placedAt.lte = new Date(endDate);
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: { customer: true },
      orderBy: { placedAt: "asc" }
    });

    // Group orders by date
    const ordersByDate = {};
    orders.forEach(order => {
      const dateKey = order.placedAt.toISOString().split("T")[0];
      if (!ordersByDate[dateKey]) {
        ordersByDate[dateKey] = { date: dateKey, count: 0, revenue: 0 };
      }
      ordersByDate[dateKey].count += 1;
      ordersByDate[dateKey].revenue += order.totalAmount;
    });

    return res.json({
      orders,
      aggregated: Object.values(ordersByDate),
      total: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0)
    });
  } catch (error) {
    console.error("Error fetching orders by date:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
};

/**
 * Get top customers by total spend
 */
exports.getTopCustomers = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        orders: {
          select: { totalAmount: true }
        }
      }
    });

    const customersWithSpend = customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      totalSpend: customer.orders.reduce((sum, order) => sum + order.totalAmount, 0),
      orderCount: customer.orders.length
    }));

    customersWithSpend.sort((a, b) => b.totalSpend - a.totalSpend);

    return res.json(customersWithSpend.slice(0, limit));
  } catch (error) {
    console.error("Error fetching top customers:", error);
    return res.status(500).json({ error: "Failed to fetch top customers" });
  }
};

/**
 * Get revenue trends (daily/weekly/monthly)
 */
exports.getRevenueTrends = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { period = "daily", days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        placedAt: { gte: startDate }
      },
      orderBy: { placedAt: "asc" }
    });

    const trends = {};
    orders.forEach(order => {
      let key;
      const date = order.placedAt;
      
      if (period === "weekly") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "monthly") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (!trends[key]) {
        trends[key] = { period: key, revenue: 0, orders: 0 };
      }
      trends[key].revenue += order.totalAmount;
      trends[key].orders += 1;
    });

    return res.json(Object.values(trends));
  } catch (error) {
    console.error("Error fetching revenue trends:", error);
    return res.status(500).json({ error: "Failed to fetch revenue trends" });
  }
};

/**
 * Get product performance metrics
 */
exports.getProductPerformance = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const products = await prisma.product.findMany({
      where: { tenantId },
      include: {
        orderItems: {
          select: { quantity: true, price: true }
        }
      }
    });

    const productMetrics = products.map(product => ({
      id: product.id,
      title: product.title,
      price: product.price,
      totalSold: product.orderItems.reduce((sum, item) => sum + item.quantity, 0),
      totalRevenue: product.orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
    }));

    productMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.json(productMetrics.slice(0, limit));
  } catch (error) {
    console.error("Error fetching product performance:", error);
    return res.status(500).json({ error: "Failed to fetch product performance" });
  }
};
