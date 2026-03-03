import type { AbandonedCart } from "../types/shopify";

export async function fetchAbandonedCarts(rest: any): Promise<AbandonedCart[]> {
  try {
    const res = await rest.get("/checkouts.json?status=any&limit=50");
    const data = res.body.checkouts || [];

    return data.map((c: any) => ({
      email: c.email ?? null,
      totalPrice: parseFloat(c.total_price || "0"),
      createdAt: c.created_at,
    }));
  } catch (err) {
    console.warn("Failed to fetch abandoned carts", err);
    return [];
  }
}
