

export async function authenticateAdmin(request: Request) {
  // Replace with your actual Shopify admin authentication
  // returns { admin: ShopifyGraphQLClient, rest: ShopifyRESTClient }
  // mock for example
  const admin = {
    graphql: async (query: string) => {
      return {
        json: async () => ({ data: {} })
      };
    }
  };

  const rest = {
    get: async (endpoint: string) => {
      return {
        body: { checkouts: [] }
      };
    }
  };

  return { admin, rest };
}
