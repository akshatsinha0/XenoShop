import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#800000", "#A52A2A", "#6F4E37", "#8B7355", "#C19A6B"];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [productPerf, setProductPerf] = useState([]);
  const [orders, setOrders] = useState({ aggregated: [] });
  const [segmentation, setSegmentation] = useState(null);
  const [salesGrowth, setSalesGrowth] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const tenantId = user?.tenantId;

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [m, tc, rt, pp, ord, seg, growth, activity] = await Promise.all([
        client.get(`/analytics/dashboard/${tenantId}`),
        client.get(`/analytics/top-customers/${tenantId}?limit=5`),
        client.get(`/analytics/revenue-trends/${tenantId}?days=30`),
        client.get(`/analytics/product-performance/${tenantId}?limit=5`),
        client.get(`/analytics/orders/${tenantId}`),
        client.get(`/analytics/customer-segmentation/${tenantId}`),
        client.get(`/analytics/sales-growth/${tenantId}?days=30`),
        client.get(`/analytics/recent-activity/${tenantId}?limit=5`)
      ]);
      setMetrics(m.data);
      setTopCustomers(tc.data);
      setRevenueTrends(rt.data);
      setProductPerf(pp.data);
      setOrders(ord.data);
      setSegmentation(seg.data);
      setSalesGrowth(growth.data);
      setRecentActivity(activity.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const handleSync = async () => {
    if (!tenantId) return;
    setSyncing(true);
    try {
      await client.post(`/shopify/sync/${tenantId}`);
      await fetchData();
    } catch (err) {
      alert("Sync failed: " + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const filterOrders = async () => {
    if (!tenantId) return;
    const params = new URLSearchParams();
    if (dateRange.start) params.append("startDate", dateRange.start);
    if (dateRange.end) params.append("endDate", dateRange.end);
    const { data } = await client.get(`/analytics/orders/${tenantId}?${params}`);
    setOrders(data);
  };

  const handleExport = async (type) => {
    if (!tenantId) return;
    try {
      const response = await client.get(`/analytics/export/${tenantId}?type=${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Export failed: " + (err.response?.data?.error || err.message));
    }
  };

  if (!tenantId) {
    return (
      <div className="dashboard">
        <header>
          <h1>XenoShop Dashboard</h1>
          <div className="user-info">
            <span>{user?.email}</span>
            <button onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="no-tenant">
          <h2>No Store Connected</h2>
          <p>Please contact admin to assign you to a store.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const segmentData = segmentation ? [
    { name: 'VIP', value: segmentation.summary.vip, color: COLORS[0] },
    { name: 'Loyal', value: segmentation.summary.loyal, color: COLORS[1] },
    { name: 'At Risk', value: segmentation.summary.atRisk, color: COLORS[2] },
    { name: 'New', value: segmentation.summary.new, color: COLORS[3] },
    { name: 'Inactive', value: segmentation.summary.inactive, color: COLORS[4] }
  ] : [];

  return (
    <div className="dashboard">
      <header>
        <h1>XenoShop Dashboard</h1>
        <div className="header-actions">
          <span className="tenant-name">{user?.tenant?.name || "Store"}</span>
          <button onClick={handleSync} disabled={syncing} className="sync-btn">
            {syncing ? "Syncing..." : "Sync Shopify"}
          </button>
          <span className="user-email">{user?.email}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Customers</h3>
          <p className="metric-value">{metrics?.totalCustomers || 0}</p>
        </div>
        <div className="metric-card">
          <h3>Total Orders</h3>
          <p className="metric-value">{metrics?.totalOrders || 0}</p>
        </div>
        <div className="metric-card">
          <h3>Total Revenue</h3>
          <p className="metric-value">₹{(metrics?.totalRevenue || 0).toLocaleString()}</p>
        </div>
        <div className="metric-card">
          <h3>Avg Order Value</h3>
          <p className="metric-value">₹{(metrics?.avgOrderValue || 0).toLocaleString()}</p>
        </div>
      </div>

      {salesGrowth && (
        <div className="growth-section">
          <div className="growth-card">
            <h3>Revenue Growth (30 Days)</h3>
            <p className={`growth-value ${salesGrowth.growth.revenue >= 0 ? 'positive' : 'negative'}`}>
              {salesGrowth.growth.revenue >= 0 ? '↑' : '↓'} {Math.abs(salesGrowth.growth.revenue)}%
            </p>
            <small>₹{salesGrowth.currentPeriod.revenue.toLocaleString()} vs ₹{salesGrowth.previousPeriod.revenue.toLocaleString()}</small>
          </div>
          <div className="growth-card">
            <h3>Order Growth (30 Days)</h3>
            <p className={`growth-value ${salesGrowth.growth.orders >= 0 ? 'positive' : 'negative'}`}>
              {salesGrowth.growth.orders >= 0 ? '↑' : '↓'} {Math.abs(salesGrowth.growth.orders)}%
            </p>
            <small>{salesGrowth.currentPeriod.orders} vs {salesGrowth.previousPeriod.orders} orders</small>
          </div>
        </div>
      )}

      <div className="charts-section">
        <div className="chart-card">
          <h3>Revenue Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={(v) => v.slice(5)} />
              <YAxis />
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="revenue" stroke="#800000" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Orders by Date</h3>
          <div className="date-filter">
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} />
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} />
            <button onClick={filterOrders}>Filter</button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={orders.aggregated}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6F4E37" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Customer Segmentation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={segmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {segmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card activity-card">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {recentActivity.map((activity, i) => (
              <div key={i} className="activity-item">
                <div className="activity-icon">📦</div>
                <div className="activity-details">
                  <p><strong>{activity.customer}</strong> placed an order</p>
                  <small>{activity.items}</small>
                  <small className="activity-time">{new Date(activity.timestamp).toLocaleDateString()}</small>
                </div>
                <div className="activity-amount">₹{activity.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="export-section">
        <h3>Export Data</h3>
        <div className="export-buttons">
          <button onClick={() => handleExport('orders')} className="export-btn">Export Orders</button>
          <button onClick={() => handleExport('customers')} className="export-btn">Export Customers</button>
          <button onClick={() => handleExport('products')} className="export-btn">Export Products</button>
        </div>
      </div>

      <div className="tables-section">
        <div className="table-card">
          <h3>Top 5 Customers by Spend</h3>
          <table>
            <thead>
              <tr><th>Customer</th><th>Orders</th><th>Total Spend</th></tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.id}>
                  <td>{c.firstName} {c.lastName} <small>({c.email})</small></td>
                  <td>{c.orderCount}</td>
                  <td>₹{c.totalSpend.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <h3>Top Products by Revenue</h3>
          <table>
            <thead>
              <tr><th>Product</th><th>Sold</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {productPerf.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.totalSold}</td>
                  <td>₹{p.totalRevenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
