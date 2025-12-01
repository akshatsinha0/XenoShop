# XenoShop - Multi-Tenant Shopify Data Ingestion & Insights Service

A full-stack application that enables enterprise retailers to onboard, integrate, and analyze their Shopify store data with multi-tenant support.

## 🚀 Features

### Data Ingestion
- **Multi-tenant architecture** - Isolated data per store using tenant identifiers
- **Shopify API integration** - Sync customers, products, and orders
- **Webhooks support** - Real-time data sync via Shopify webhooks
- **Scheduled sync** - Automated hourly data synchronization

### Insights Dashboard
- **Authentication** - JWT-based email authentication
- **Key Metrics** - Total customers, orders, revenue, avg order value
- **Revenue Trends** - 30-day line chart visualization
- **Orders by Date** - Bar chart with date range filtering
- **Top Customers** - Top 5 customers by total spend
- **Product Performance** - Top products by revenue

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│  Express API    │────▶│   PostgreSQL    │
│   (Frontend)    │     │   (Backend)     │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Shopify API    │
                        │  (External)     │
                        └─────────────────┘
```

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router, Recharts, Axios |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT, bcryptjs |

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Shopify Development Store

### 1. Clone Repository
```bash
git clone https://github.com/akshatsinha0/XenoShop.git
cd XenoShop
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database URL and Shopify credentials

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start server
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create .env file (optional - defaults to localhost:4000)
echo "VITE_API_URL=http://localhost:4000/api" > .env

# Start dev server
npm run dev
```

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/profile` | Get current user profile |

### Tenants
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants` | List all tenants |
| GET | `/api/tenants/:id` | Get tenant by ID |
| PUT | `/api/tenants/:id/shopify` | Update Shopify credentials |

### Shopify Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shopify/sync/:tenantId` | Sync all Shopify data |
| POST | `/api/shopify/customers/:tenantId` | Sync customers only |
| POST | `/api/shopify/products/:tenantId` | Sync products only |
| POST | `/api/shopify/orders/:tenantId` | Sync orders only |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard/:tenantId` | Dashboard metrics |
| GET | `/api/analytics/orders/:tenantId` | Orders with date filter |
| GET | `/api/analytics/top-customers/:tenantId` | Top customers by spend |
| GET | `/api/analytics/revenue-trends/:tenantId` | Revenue trends |
| GET | `/api/analytics/product-performance/:tenantId` | Product metrics |

### Webhooks (for Shopify)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/shopify/customers` | Customer webhook |
| POST | `/webhooks/shopify/orders` | Order webhook |
| POST | `/webhooks/shopify/products` | Product webhook |

## 🗄️ Database Schema

```prisma
model Tenant {
  id                 String   @id @default(uuid())
  name               String
  shopDomain         String?
  shopifyAccessToken String?
  customers          Customer[]
  products           Product[]
  orders             Order[]
  users              User[]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  tenantId  String?
  tenant    Tenant?
}

model Customer {
  id        String   @id @default(uuid())
  tenantId  String
  email     String   @unique
  firstName String?
  lastName  String?
  phone     String?
  orders    Order[]
}

model Product {
  id               String   @id @default(uuid())
  tenantId         String
  title            String
  description      String?
  price            Float
  sku              String?
  shopifyProductId String?
  orderItems       OrderItem[]
  @@unique([tenantId, shopifyProductId])
}

model Order {
  id             String      @id @default(uuid())
  tenantId       String
  customerId     String
  shopifyOrderId String?
  totalAmount    Float
  currency       String?
  placedAt       DateTime
  items          OrderItem[]
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  productId String
  quantity  Int
  price     Float
}
```

## 🔐 Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/xenodb"
PORT=4000
JWT_SECRET="your-secret-key"
FRONTEND_URL="http://localhost:3000"
ENABLE_SCHEDULER="false"
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:4000/api
```

## 📋 Assumptions

1. Each Shopify store maps to one tenant
2. Users can belong to one tenant at a time
3. Shopify API version 2024-10 is used
4. Orders without customer email use placeholder emails
5. Product price is taken from first variant

## 🚧 Known Limitations

1. No OAuth flow for Shopify - requires manual token setup
2. Webhook signature verification needs SHOPIFY_WEBHOOK_SECRET
3. No pagination for large datasets
4. Single currency display (INR)

## 🔮 Next Steps to Production

1. **Security**
   - Implement Shopify OAuth flow
   - Add rate limiting
   - Enable webhook signature verification
   - Use environment-specific secrets

2. **Scalability**
   - Add Redis for caching
   - Implement job queue (Bull/RabbitMQ) for async sync
   - Add database connection pooling
   - Implement pagination

3. **Monitoring**
   - Add logging service (Winston/Pino)
   - Implement error tracking (Sentry)
   - Add APM monitoring

4. **Features**
   - Add more analytics (cohort analysis, RFM)
   - Implement data export
   - Add email notifications
   - Multi-currency support

## 📄 License

MIT

---

Built for Xeno FDE Internship Assignment 2025
