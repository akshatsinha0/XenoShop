const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

exports.createCustomer = async (req, res) => {
  try {
    const { tenantId, email, firstName, lastName, phone } = req.body;

    if (!tenantId || !email) {
      return res.status(400).json({ error: "tenantId and email are required" });
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenantExists) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        email,
        firstName,
        lastName,
        phone,
      },
    });

    return res.status(201).json({
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Error creating customer:", error);

    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
};


exports.getCustomersByTenant = async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};