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

  // Modifier groups for burgers
  const sizeGroup = await prisma.modifierGroup.upsert({
    where: { id: "modgrp_size" },
    update: {},
    create: {
      id: "modgrp_size",
      merchantId: merchant.id,
      name: "Size",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      sortOrder: 0,
    },
  });

  const extrasGroup = await prisma.modifierGroup.upsert({
    where: { id: "modgrp_extras" },
    update: {},
    create: {
      id: "modgrp_extras",
      merchantId: merchant.id,
      name: "Extras",
      minSelections: 0,
      maxSelections: 0,
      isRequired: false,
      sortOrder: 1,
    },
  });

  const removeGroup = await prisma.modifierGroup.upsert({
    where: { id: "modgrp_remove" },
    update: {},
    create: {
      id: "modgrp_remove",
      merchantId: merchant.id,
      name: "Remove",
      minSelections: 0,
      maxSelections: 0,
      isRequired: false,
      sortOrder: 2,
    },
  });

  const modifiers = [
    { id: "mod_sm", groupId: sizeGroup.id, name: "Regular", price: 0, sort: 0 },
    { id: "mod_lg", groupId: sizeGroup.id, name: "Large", price: 150, sort: 1 },
    { id: "mod_cheese", groupId: extrasGroup.id, name: "Extra cheese", price: 100, sort: 0 },
    { id: "mod_sauce", groupId: extrasGroup.id, name: "Extra sauce", price: 50, sort: 1 },
    { id: "mod_pickles", groupId: removeGroup.id, name: "No pickles", price: 0, sort: 0 },
    { id: "mod_onion", groupId: removeGroup.id, name: "No onion", price: 0, sort: 1 },
  ];

  for (const m of modifiers) {
    await prisma.modifier.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        modifierGroupId: m.groupId,
        name: m.name,
        priceCents: m.price,
        sortOrder: m.sort,
      },
    });
  }

  for (const productId of ["prod_0", "prod_1", "prod_2"]) {
    for (const groupId of [sizeGroup.id, extrasGroup.id, removeGroup.id]) {
      await prisma.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId, modifierGroupId: groupId } },
        update: {},
        create: { productId, modifierGroupId: groupId },
      });
    }
  }

  await prisma.discount.upsert({
    where: { id: "disc_10pct" },
    update: {},
    create: {
      id: "disc_10pct",
      merchantId: merchant.id,
      name: "10% off",
      type: "PERCENT",
      value: 1000,
      sortOrder: 0,
    },
  });

  await prisma.discount.upsert({
    where: { id: "disc_2eur" },
    update: {},
    create: {
      id: "disc_2eur",
      merchantId: merchant.id,
      name: "€2 off",
      type: "FIXED",
      value: 200,
      sortOrder: 1,
    },
  });

  console.log("✅ Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
