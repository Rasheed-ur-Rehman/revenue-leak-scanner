import type { OrderNode } from "../types/shopify";

/**
 * Type for GraphQL response from Shopify orders query
 */
type OrdersGraphQLResponse = {
  data?: {
    orders?: {
      edges: { cursor: string; node: OrderNode }[];
      pageInfo: { hasNextPage: boolean };
    };
  };
  errors?: { message: string }[];
};

/**
 * Fetch all orders from Shopify using pagination.
 * Returns empty array if no orders or errors.
 */
export async function fetchAllOrders(admin: any): Promise<OrderNode[]> {
  let orders: OrderNode[] = [];
  let hasNextPage = true;
  let afterCursor: string | null = null;

  while (hasNextPage) {
    const query = `
      query GetOrders($after: String) {
        orders(first: 50, reverse: true, after: $after) {
          edges {
            cursor
            node {
              id
              customer {
                id
                email
              }
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              processedAt
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    try {
      const variables: { after: string | null } = { after: afterCursor };
      const res: { json: () => Promise<OrdersGraphQLResponse> } = await admin.graphql(query, variables);
      const json: OrdersGraphQLResponse = await res.json();

      // Stop if there are errors
      if (json.errors && json.errors.length > 0) {
        console.error("GraphQL errors:", json.errors);
        throw new Error(json.errors[0]?.message || "Failed to fetch orders");
      }

      // Safe access to data.orders
      const ordersData = json.data?.orders;
      if (!ordersData || !ordersData.edges || ordersData.edges.length === 0) {
        console.warn("No orders returned in this page", json);
        break;
      }

      const edges = ordersData.edges;

      // Append nodes to orders
      orders = orders.concat(edges.map(e => e.node));

      // Pagination info
      hasNextPage = ordersData.pageInfo?.hasNextPage ?? false;
      afterCursor = edges[edges.length - 1]?.cursor ?? null;

      if (!afterCursor) break; // safety check

    } catch (error: unknown) {
      console.error("Failed to fetch orders page:", error);
      break; // stop fetching further pages
    }
  }

  return orders;
}

/**
 * Calculate totals from orders + abandoned count
 */
export function calculateTotals(orders: OrderNode[], abandonedCount: number) {
  let totalRevenue = 0;
  let loggedInCustomers = 0;
  let guestCheckouts = 0;

  orders.forEach(order => {
    const amount = parseFloat(order.totalPriceSet?.shopMoney?.amount || "0");
    totalRevenue += amount;

    if (order.customer?.id) loggedInCustomers++;
    else guestCheckouts++;
  });

  const totalCarts = orders.length + abandonedCount;
  const conversionRate = totalCarts === 0 ? "0%" : ((orders.length / totalCarts) * 100).toFixed(1) + "%";

  return {
    totalOrders: orders.length,
    totalRevenue: Math.round(totalRevenue),
    loggedInCustomers,
    guestCheckouts,
    abandonedCheckouts: abandonedCount,
    conversionRate,
  };
}
