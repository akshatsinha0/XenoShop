const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

exports.createProduct = async (req, res) => {
  try {
    const { tenantId, title, description, price, sku, shopifyProductId } = req.body;

    if (!tenantId || !title || price === undefined) {
      return res.status(400).json({ error: "tenantId, title and price are required" });
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenantExists) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        title,
        description,
        price,
        sku,
        shopifyProductId,
      },
    });

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getProductsByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const products = await prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};