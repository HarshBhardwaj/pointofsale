// packages/db/prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create merchant
  const merchant = await prisma.merchant.upsert({
    where: { id: "merchant_01" },
    update: {},
    create: {
      id: "merchant_01",
      name: "Truck POS",
      legalName: "Muster Food GmbH",
      taxId: "12/345/67890",
      status: "ACTIVE",
    },
  });

  // Create tax rates
  const vat7 = await prisma.taxRate.upsert({
    where: { id: "tax_7" },
    update: {},
    create: {
      id: "tax_7",
      merchantId: merchant.id,
      name: "MwSt. 7% (Speisen)",
      rate: 0.07,
      isDefault: true,
    },
  });

  const vat19 = await prisma.taxRate.upsert({
    where: { id: "tax_19" },
    update: {},
    create: {
      id: "tax_19",
      merchantId: merchant.id,
      name: "MwSt. 19% (Getränke)",
      rate: 0.19,
      isDefault: false,
    },
  });

  // Create categories
  const cats = ["Burgers", "Sides", "Drinks", "Desserts"];
  const catMap: Record<string, string> = {};
  for (const [i, name] of cats.entries()) {
    const cat = await prisma.category.upsert({
      where: { id: `cat_${i}` },
      update: {},
      create: { id: `cat_${i}`, merchantId: merchant.id, name, sortOrder: i },
    });
    catMap[name] = cat.id;
  }

  // Create products
  const products = [
    { name: "Classic burger", cat: "Burgers", price: 850, vat: vat7.id, emoji: "🍔" },
    { name: "Cheese burger",  cat: "Burgers", price: 950, vat: vat7.id, emoji: "🍔" },
    { name: "Veggie burger",  cat: "Burgers", price: 800, vat: vat7.id, emoji: "🥦" },
    { name: "Loaded fries",   cat: "Sides",   price: 450, vat: vat7.id, emoji: "🍟" },
    { name: "Side salad",     cat: "Sides",   price: 350, vat: vat7.id, emoji: "🥗" },
    { name: "Onion rings",    cat: "Sides",   price: 390, vat: vat7.id, emoji: "🧅" },
    { name: "Club-Mate",      cat: "Drinks",  price: 300, vat: vat19.id, emoji: "🍶" },
    { name: "Berliner Pilsner", cat: "Drinks", price: 350, vat: vat19.id, emoji: "🍺" },
    { name: "Still water",    cat: "Drinks",  price: 200, vat: vat19.id, emoji: "💧" },
    { name: "Choco brownie",  cat: "Desserts", price: 350, vat: vat7.id, emoji: "🍫" },
    { name: "Soft serve",     cat: "Desserts", price: 280, vat: vat7.id, emoji: "🍦" },
  ];

  for (const [i, p] of products.entries()) {
    await prisma.product.upsert({
      where: { id: `prod_${i}` },
      update: {},
      create: {
        id: `prod_${i}`,
        merchantId: merchant.id,
        categoryId: catMap[p.cat],
        taxRateId: p.vat,
        name: p.name,
        priceCents: p.price,
        emoji: p.emoji,
        isActive: true,
        sortOrder: i,
      },
    });
  }

  // Create location
  await prisma.location.upsert({
    where: { id: "loc_01" },
    update: {},
    create: {
      id: "loc_01",
      merchantId: merchant.id,
      name: "Mauerpark",
      address: "Bernauer Str. 63-64",
      city: "Berlin",
    },
  });

  console.log("✅ Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
