import { prisma } from "../lib/prisma";

function splitGross(lineGrossCents: number, rate: number) {
  const netCents = Math.round(lineGrossCents / (1 + rate));
  const taxCents = lineGrossCents - netCents;
  return { netCents, taxCents };
}

export type OrderItemInput = {
  productId: string;
  quantity: number;
  modifiers?: { modifierId: string }[];
};

export async function buildOrderItemsData(items: OrderItemInput[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    include: { taxRate: true },
  });

  if (products.length !== items.length) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const modifierIds = items.flatMap((i) => i.modifiers?.map((m) => m.modifierId) ?? []);
  const modifiers = modifierIds.length
    ? await prisma.modifier.findMany({ where: { id: { in: modifierIds }, isActive: true } })
    : [];

  if (modifierIds.length && modifiers.length !== new Set(modifierIds).size) {
    throw new Error("MODIFIER_NOT_FOUND");
  }

  let subtotalCents = 0;
  let taxCents = 0;
  const itemsData = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const selectedMods = (item.modifiers ?? []).map((sel) => {
      const mod = modifiers.find((m) => m.id === sel.modifierId)!;
      return { modifierId: mod.id, name: mod.name, priceCents: mod.priceCents };
    });
    const modifierCentsPerUnit = selectedMods.reduce((s, m) => s + m.priceCents, 0);
    const unitGross = product.priceCents + modifierCentsPerUnit;
    const lineGross = unitGross * item.quantity;
    const rate = Number(product.taxRate.rate);
    const { netCents, taxCents: itemTax } = splitGross(lineGross, rate);
    subtotalCents += netCents;
    taxCents += itemTax;

    const modLabel = selectedMods.map((m) => m.name).join(", ");
    const displayName = modLabel ? `${product.name} (${modLabel})` : product.name;

    return {
      productId: product.id,
      taxRateId: product.taxRateId,
      name: displayName,
      priceCents: unitGross,
      quantity: item.quantity,
      subtotalCents: netCents,
      taxCents: itemTax,
      totalCents: lineGross,
      taxRateSnapshot: product.taxRate.rate,
      modifiers: {
        create: selectedMods.map((m) => ({
          modifierId: m.modifierId,
          name: m.name,
          priceCents: m.priceCents,
        })),
      },
    };
  });

  return { subtotalCents, taxCents, itemsData, products };
}
