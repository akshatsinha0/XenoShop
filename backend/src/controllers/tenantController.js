const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

/**
 * Sanitizes tenant object by removing sensitive fields
 * @param {Object} tenant - Raw tenant object from database
 * @returns {Object} Sanitized tenant object safe for API response
 */
const sanitizeTenant = (tenant) => {
  if (!tenant) return null;
  const { shopifyAccessToken, ...safeTenant } = tenant;
  return {
    ...safeTenant,
    hasShopifyToken: !!shopifyAccessToken
  };
};

exports.createTenant = async (req, res) => {
  try {
    const { name, shopDomain } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Tenant name is required" });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        shopDomain,
      },
    });

    return res.status(201).json({
      message: "Tenant created successfully",
      tenant: sanitizeTenant(tenant),
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

    return res.status(200).json(tenants.map(sanitizeTenant));
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getTenantById = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.status(200).json(sanitizeTenant(tenant));
  } catch (error) {
    console.error("Error fetching tenant:", error);
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
      tenant: sanitizeTenant(tenant)
    });
  } catch (error) {
    console.error("Error updating Shopify credentials:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
