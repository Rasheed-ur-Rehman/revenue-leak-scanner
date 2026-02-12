import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": any;
      "s-section": any;
      "s-card": any;
      "s-heading": any;
      "s-text": any;
    }
  }
}

/**
 * SERVER: Fetch total orders & revenue
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query RevenueQuery {
      orders(first: 100, query: "financial_status:paid") {
        edges {
          node {
            totalPriceSet {
              shopMoney {
                amount
              }
            }
          }
        }
      }
    }
  `);

  const json = await response.json();
  const orders = json.data.orders.edges;

  const totalOrders = orders.length;

  const totalRevenue = orders.reduce(
    (sum: number, edge: any) =>
      sum + parseFloat(edge.node.totalPriceSet.shopMoney.amount),
    0
  );

  return {
    totalOrders,
    totalRevenue: totalRevenue.toFixed(2),
  };
};

/**
 * CLIENT: Revenue UI
 */
export default function Index() {
  const { totalOrders, totalRevenue } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Revenue Scanner">
      <s-section>
        <s-card>
          <s-heading>📦 Total Orders</s-heading>
          <s-text>{totalOrders}</s-text>
        </s-card>
      </s-section>

      <s-section>
        <s-card>
          <s-heading>💰 Total Revenue</s-heading>
          <s-text>${totalRevenue}</s-text>
        </s-card>
      </s-section>
    </s-page>
  );
}

/**
 * REQUIRED: Shopify boundary headers
 */
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
