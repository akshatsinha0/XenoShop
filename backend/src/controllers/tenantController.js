const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

exports.createTenant = async (req, res) => {
  try {
    const { name, shopDomain, adminEmail } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Tenant name is required" });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        shopDomain,
        // adminEmail is not in schema, we will add a table later for admin auth
      },
    });

    return res.status(201).json({
      message: "Tenant created successfully",
      tenant,
    });
  } catch (error) {
    console.error("Error creating tenant:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllTenants = async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateShopifyCredentials = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { shopDomain, shopifyAccessToken } = req.body;

    if (!shopDomain || !shopifyAccessToken) {
      return res.status(400).json({ error: "shopDomain and shopifyAccessToken are required" });
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        shopDomain,
        shopifyAccessToken
      }
    });

    return res.status(200).json({
      message: "Shopify credentials updated successfully",
      tenant
    });
  } catch (error) {
    console.error("Error updating Shopify credentials:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
