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

/**
 * Get customer segmentation (RFM Analysis)
 * Recency, Frequency, Monetary
 */
exports.getCustomerSegmentation = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        orders: {
          select: { totalAmount: true, placedAt: true }
        }
      }
    });

    const now = new Date();
    const segments = { vip: [], loyal: [], atRisk: [], new: [], inactive: [] };

    customers.forEach(customer => {
      if (customer.orders.length === 0) {
        segments.inactive.push({ ...customer, segment: 'Inactive', orderCount: 0, totalSpend: 0, daysSinceLastOrder: null });
        return;
      }

      const totalSpend = customer.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const orderCount = customer.orders.length;
      const lastOrderDate = new Date(Math.max(...customer.orders.map(o => new Date(o.placedAt))));
      const daysSinceLastOrder = Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24));

      let segment = 'New';
      if (totalSpend > 5000 && orderCount >= 5 && daysSinceLastOrder < 30) {
        segment = 'VIP';
        segments.vip.push({ ...customer, segment, orderCount, totalSpend, daysSinceLastOrder });
      } else if (orderCount >= 3 && daysSinceLastOrder < 60) {
        segment = 'Loyal';
        segments.loyal.push({ ...customer, segment, orderCount, totalSpend, daysSinceLastOrder });
      } else if (orderCount >= 2 && daysSinceLastOrder > 90) {
        segment = 'At Risk';
        segments.atRisk.push({ ...customer, segment, orderCount, totalSpend, daysSinceLastOrder });
      } else if (orderCount === 1 && daysSinceLastOrder < 30) {
        segments.new.push({ ...customer, segment, orderCount, totalSpend, daysSinceLastOrder });
      } else {
        segment = 'Inactive';
        segments.inactive.push({ ...customer, segment, orderCount, totalSpend, daysSinceLastOrder });
      }
    });

    return res.json({
      summary: {
        vip: segments.vip.length,
        loyal: segments.loyal.length,
        atRisk: segments.atRisk.length,
        new: segments.new.length,
        inactive: segments.inactive.length
      },
      segments
    });
  } catch (error) {
    console.error("Error fetching customer segmentation:", error);
    return res.status(500).json({ error: "Failed to fetch customer segmentation" });
  }
};

/**
 * Get sales growth rate (compare current vs previous period)
 */
exports.getSalesGrowth = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { days = 30 } = req.query;

    const daysNum = parseInt(days);
    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(currentPeriodStart.getDate() - daysNum);

    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (daysNum * 2));
    const previousPeriodEnd = new Date(currentPeriodStart);

    const [currentOrders, previousOrders] = await Promise.all([
      prisma.order.aggregate({
        where: { tenantId, placedAt: { gte: currentPeriodStart } },
        _sum: { totalAmount: true },
        _count: true
      }),
      prisma.order.aggregate({
        where: { tenantId, placedAt: { gte: previousPeriodStart, lt: previousPeriodEnd } },
        _sum: { totalAmount: true },
        _count: true
      })
    ]);

    const currentRevenue = currentOrders._sum.totalAmount || 0;
    const previousRevenue = previousOrders._sum.totalAmount || 0;
    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const currentOrderCount = currentOrders._count || 0;
    const previousOrderCount = previousOrders._count || 0;
    const orderGrowth = previousOrderCount > 0 ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 : 0;

    return res.json({
      currentPeriod: { revenue: currentRevenue, orders: currentOrderCount },
      previousPeriod: { revenue: previousRevenue, orders: previousOrderCount },
      growth: {
        revenue: Math.round(revenueGrowth * 100) / 100,
        orders: Math.round(orderGrowth * 100) / 100
      }
    });
  } catch (error) {
    console.error("Error fetching sales growth:", error);
    return res.status(500).json({ error: "Failed to fetch sales growth" });
  }
};

/**
 * Get recent activity feed
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const recentOrders = await prisma.order.findMany({
      where: { tenantId },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        items: { include: { product: { select: { title: true } } } }
      },
      orderBy: { placedAt: 'desc' },
      take: limit
    });

    const activity = recentOrders.map(order => ({
      type: 'order',
      id: order.id,
      customer: `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email,
      amount: order.totalAmount,
      items: order.items.map(item => item.product.title).join(', '),
      timestamp: order.placedAt
    }));

    return res.json(activity);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return res.status(500).json({ error: "Failed to fetch recent activity" });
  }
};

/**
 * Export data to CSV
 */
exports.exportData = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type = 'orders' } = req.query;

    let data = [];
    let headers = [];

    if (type === 'orders') {
      const orders = await prisma.order.findMany({
        where: { tenantId },
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { placedAt: 'desc' }
      });

      headers = ['Order ID', 'Customer', 'Email', 'Total Amount', 'Currency', 'Order Date', 'Items'];
      data = orders.map(o => [
        o.id,
        `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim(),
        o.customer.email,
        o.totalAmount,
        o.currency || 'INR',
        o.placedAt.toISOString().split('T')[0],
        o.items.map(i => `${i.product.title} (${i.quantity})`).join('; ')
      ]);
    } else if (type === 'customers') {
      const customers = await prisma.customer.findMany({
        where: { tenantId },
        include: { orders: true }
      });

      headers = ['Customer ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Total Orders', 'Total Spend'];
      data = customers.map(c => [
        c.id,
        c.firstName || '',
        c.lastName || '',
        c.email,
        c.phone || '',
        c.orders.length,
        c.orders.reduce((sum, o) => sum + o.totalAmount, 0)
      ]);
    } else if (type === 'products') {
      const products = await prisma.product.findMany({
        where: { tenantId },
        include: { orderItems: true }
      });

      headers = ['Product ID', 'Title', 'Price', 'SKU', 'Total Sold', 'Total Revenue'];
      data = products.map(p => [
        p.id,
        p.title,
        p.price,
        p.sku || '',
        p.orderItems.reduce((sum, i) => sum + i.quantity, 0),
        p.orderItems.reduce((sum, i) => sum + (i.quantity * i.price), 0)
      ]);
    }

    const csv = [headers, ...data].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("Error exporting data:", error);
    return res.status(500).json({ error: "Failed to export data" });
  }
};
