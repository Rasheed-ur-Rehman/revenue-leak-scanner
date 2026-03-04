import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { CartAbandonmentDashboard } from "./cart-abandonment";
import { Resend } from 'resend';

/* ---------------- TYPES ---------------- */
type DateRange = {
  startDate: string;
  endDate: string;
};

type AbandonedCartItem = {
  productId: string | null;
  productName: string;
  quantity: number;
  price: number;
};

type AbandonedCart = {
  id: string;
  cartUrl?: string; // Changed from checkoutUrl
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  isLoggedIn: boolean;
  abandonedAt: string;
  totalPrice: number;
  lineItems: AbandonedCartItem[];
  lineItemsCount: number;
};

type CompletedOrder = {
  id: string;
  name: string;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  isLoggedIn: boolean;
  processedAt: string;
  totalPrice: number;
  lineItems: AbandonedCartItem[];
  lineItemsCount: number;
};

type ProductConversion = {
  productId: string;
  productName: string;
  addedToCart: number;
  purchased: number;
  conversionRate: string;
};

type MissingPage = {
  pageType: string;
  isMissing: boolean;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
};

type ProductStats = {
  totalProducts: number;
  missingImages: number;
  missingDescriptions: number;
  missingTitles: number;
  missingReviews: number;
  productsWithIssues: {
    id: string;
    title: string;
    missingImages: boolean;
    missingDescription: boolean;
    missingTitle: boolean;
    missingReviews: boolean;
  }[];
};

type CartAnalytics = {
  totalCarts: number;
  abandonedCarts: number;
  completedCarts: number;
  abandonmentRate: string;
  completionRate: string;
  potentialRevenue: number;
  completedRevenue: number;
  recoverableRevenue: number;
  abandonedCartsList: AbandonedCart[];
  completedOrdersList: CompletedOrder[];
  guestAbandonedCarts: AbandonedCart[];
  topAbandonedProducts: {
    productName: string;
    abandonCount: number;
    totalValue: number;
  }[];
  productConversions: ProductConversion[];
  missingPages: MissingPage[];
  productStats: ProductStats;
  dateRange: DateRange;
};

type ScanResult = {
  scanned: boolean;
  scanId: string;
  scanDate: string;
  error?: string;
  metrics: {
    shopName: string;
    shopUrl?: string;
    totalOrders: number;
    totalRevenue: number;
    cartAnalytics: CartAnalytics;
  };
};

// Local storage key for persistent results
const STORAGE_KEY = 'revenue_scanner_results';

/* ---------------- LOADER ---------------- */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return {};
}

/* ---------------- ACTION ---------------- */
export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const actionType = url.searchParams.get("action");

  console.log("🔧 Action called:", actionType, request.method);

  // ============ SEND REMINDER EMAIL WITH RESEND ============
  if (actionType === "send_reminder" && request.method === "POST") {
    try {
      console.log("📧 Starting send reminder process...");
      
      const formData = await request.formData();
      const cartId = formData.get("cartId")?.toString() || "";
      const customerEmail = formData.get("email")?.toString() || "";
      const customerName = formData.get("name")?.toString() || "Customer";
      const cartTotal = formData.get("total")?.toString() || "0";
      const discountPercentage = formData.get("discount")?.toString() || "15";
      const message = formData.get("message")?.toString() || "Hi {name}, we noticed you left some items in your cart. Complete your purchase now and enjoy {discount} off!";
      const shopUrl = formData.get("shopUrl")?.toString() || "";
      
      console.log("📧 Form data received:", {
        cartId,
        customerEmail,
        customerName,
        cartTotal,
        discountPercentage,
        shopUrl
      });
      
      // Validate email
      if (!customerEmail) {
        return new Response(JSON.stringify({
          success: false,
          message: "No email address provided"
        }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid email format"
        }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      // Check if Resend API key exists
      const resendApiKey = process.env.RESEND_API_KEY;
      
      if (!resendApiKey) {
        return new Response(JSON.stringify({
          success: false,
          message: "Email service not configured. Please add RESEND_API_KEY to .env file"
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      // Initialize Resend
      let resend;
      try {
        resend = new Resend(resendApiKey);
      } catch (initError) {
        return new Response(JSON.stringify({
          success: false,
          message: "Failed to initialize email service"
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      // Generate a discount code
      const discountCode = `SAVE${discountPercentage}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Format the message with customer name and discount
      const formattedMessage = message
        .replace('{name}', customerName)
        .replace('{discount}', `${discountPercentage}% off with code: ${discountCode}`);
      
      console.log("📧 Sending email via Resend to:", customerEmail);
      
      // Build cart URL
      const cartUrl = shopUrl ? `${shopUrl}/cart` : '#';
      
      // Create HTML email template with proper cart link
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Complete Your Purchase</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #008060; padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">🛍️ Complete Your Purchase</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="color: #333; margin-top: 0;">Hello ${customerName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; font-size: 16px;">
                          We noticed you left some items in your cart. They're still waiting for you!
                        </p>
                        
                        <!-- Cart Value Box -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin: 25px 0;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <p style="margin: 0; color: #666; font-size: 14px;">Your Cart Total</p>
                              <p style="margin: 5px 0 0; font-size: 32px; font-weight: bold; color: #008060;">
                                $${parseFloat(cartTotal).toFixed(2)}
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Custom Message -->
                        <p style="color: #666; line-height: 1.6; font-size: 16px;">
                          ${formattedMessage}
                        </p>
                        
                        <!-- Discount Code Box -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #008060; border-radius: 8px; margin: 25px 0;">
                          <tr>
                            <td style="padding: 25px; text-align: center;">
                              <p style="margin: 0; color: white; font-size: 14px; opacity: 0.9;">Your Exclusive Discount</p>
                              <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: white; letter-spacing: 2px;">
                                ${discountCode}
                              </p>
                              <p style="margin: 0; color: white; font-size: 18px;">
                                ${discountPercentage}% OFF
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${cartUrl}" 
                                 style="background-color: #008060; color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block;"
                                 target="_blank">
                                Complete Your Purchase
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
                          This discount code expires in 7 days. Shop now to save!
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e4e5e7;">
                        <p style="margin: 0; color: #999; font-size: 12px;">
                          © 2026 Your Store. All rights reserved.
                        </p>
                        <p style="margin: 5px 0 0; color: #999; font-size: 12px;">
                          You received this email because you started a checkout at our store.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;
      
      // Create plain text version
      const plainText = `
        Hello ${customerName},
        
        We noticed you left some items in your cart. They're still waiting for you!
        
        Your Cart Total: $${parseFloat(cartTotal).toFixed(2)}
        
        ${formattedMessage}
        
        Your exclusive discount code: ${discountCode} (${discountPercentage}% OFF)
        
        Complete your purchase now and save!
        ${cartUrl}
        
        This discount code expires in 7 days.
      `;
      
      console.log("📧 Attempting to send email via Resend...");
      
      // Send email with timeout
      const sendPromise = resend.emails.send({
        from: 'Revenue Scanner <onboarding@resend.dev>',
        to: [customerEmail],
        subject: `Complete Your Purchase - ${discountPercentage}% Off Inside!`,
        html: emailHtml,
        text: plainText,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Email sending timeout after 10 seconds")), 10000)
      );

      const { data, error } = await Promise.race([sendPromise, timeoutPromise]) as any;

      if (error) {
        console.error("❌ Resend error details:", error);
        return new Response(JSON.stringify({
          success: false,
          message: `Failed to send email: ${error.message}`,
          error: error
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      console.log("✅ Email sent successfully via Resend:", data);
      
      return new Response(JSON.stringify({
        success: true,
        message: `✅ Email sent to ${customerEmail}`,
        sentTo: customerEmail,
        cartId,
        discountCode,
        discountValue: `${discountPercentage}% OFF`,
        formattedMessage,
        emailId: data?.id
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff"
        }
      });
      
    } catch (error) {
      console.error("❌ Send reminder error details:", error);
      
      // Always return JSON, never HTML
      return new Response(JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Failed to send reminder",
        error: error instanceof Error ? error.stack : String(error)
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
  }

  // ============ REGULAR SCAN WITH DATE RANGE ============
  if (request.method === "POST" && !actionType) {
    try {
      const formData = await request.formData();
      const startDate = formData.get("startDate")?.toString() || getDefaultStartDate();
      const endDate = formData.get("endDate")?.toString() || getDefaultEndDate();
      
      console.log("🔍 STARTING SCAN with date range:", { startDate, endDate });

      // ============ 1. SHOP INFO ============
      const shopQuery = await admin.graphql(
        `#graphql
        query {
          shop {
            name
            myshopifyDomain
            primaryDomain {
              url
            }
          }
        }`
      );

      const shopData = await shopQuery.json() as any;
      const shopName = shopData.data?.shop?.name || "Your Store";
      const shopUrl = shopData.data?.shop?.primaryDomain?.url || `https://${shopData.data?.shop?.myshopifyDomain}`;
      console.log(`✅ Shop: ${shopName}, URL: ${shopUrl}`);

      // ============ 2. COMPLETED ORDERS ============
      console.log("📦 Fetching completed orders...");
      
      const ordersQuery = await admin.graphql(
        `#graphql
        query {
          orders(first: 250, query: "created_at:>=${startDate} AND created_at:<=${endDate}") {
            edges {
              node {
                id
                name
                customer {
                  id
                  email
                  firstName
                  lastName
                }
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                processedAt
                lineItems(first: 20) {
                  edges {
                    node {
                      name
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                        }
                      }
                      product {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }`
      );

      const ordersData = await ordersQuery.json() as any;
      const orders = ordersData.data?.orders?.edges || [];
      console.log(`✅ Found ${orders.length} completed orders`);

      // Process completed orders
      const completedOrdersList: CompletedOrder[] = orders.map(({ node }: any) => {
        const customer = node.customer;
        
        const lineItems = (node.lineItems?.edges || []).map(({ node: item }: any) => {
          const totalPrice = parseFloat(item.originalTotalSet?.shopMoney?.amount || "0");
          const quantity = item.quantity || 1;
          
          return {
            productId: item.product?.id || null,
            productName: item.product?.title || item.name || "Unknown Product",
            quantity: quantity,
            price: quantity > 0 ? totalPrice / quantity : 0
          };
        });

        return {
          id: node.id,
          name: node.name || "",
          customerEmail: customer?.email || null,
          customerFirstName: customer?.firstName || null,
          customerLastName: customer?.lastName || null,
          isLoggedIn: !!customer?.id,
          processedAt: node.processedAt || new Date().toISOString(),
          totalPrice: parseFloat(node.totalPriceSet?.shopMoney?.amount || "0"),
          lineItems: lineItems,
          lineItemsCount: lineItems.length
        };
      });

      const completedRevenue = completedOrdersList.reduce((sum, order) => sum + order.totalPrice, 0);

      // ============ 3. ABANDONED CHECKOUTS ============
      console.log("🛒 Fetching abandoned checkouts...");

      // Fixed: Removed checkoutUrl field as it doesn't exist in the API
      const abandonedQuery = await admin.graphql(
        `#graphql
        query {
          abandonedCheckouts(first: 250) {
            edges {
              node {
                id
                customer {
                  id
                  email
                  firstName
                  lastName
                }
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                lineItems(first: 20) {
                  edges {
                    node {
                      title
                      quantity
                      product {
                        id
                        title
                      }
                    }
                  }
                }
                completedAt
                createdAt
              }
            }
          }
        }`
      );

      const abandonedData = await abandonedQuery.json() as any;
      
      if (abandonedData.errors) {
        console.error("❌ GraphQL errors:", abandonedData.errors);
      }

      const allAbandoned = abandonedData.data?.abandonedCheckouts?.edges || [];
      console.log(`📊 Total from API: ${allAbandoned.length}`);
      
      // Filter by date range and not completed
      const abandonedCheckouts = allAbandoned.filter(({ node }: any) => {
        if (node.completedAt) return false;
        const createdAt = node.createdAt?.split('T')[0] || '';
        return createdAt >= startDate && createdAt <= endDate;
      });
      
      console.log(`✅ Found ${abandonedCheckouts.length} abandoned checkouts in date range`);

      const abandonedCartsList: AbandonedCart[] = abandonedCheckouts.map(({ node }: any) => {
        const customer = node.customer;
        
        let totalPrice = 0;
        if (node.totalPriceSet?.shopMoney?.amount) {
          totalPrice = parseFloat(node.totalPriceSet.shopMoney.amount);
        }
        
        const lineItems = (node.lineItems?.edges || []).map(({ node: item }: any) => {
          return {
            productId: item.product?.id || null,
            productName: item.product?.title || item.title || "Unknown Product",
            quantity: item.quantity || 1,
            price: 0
          };
        });

        return {
          id: node.id,
          cartUrl: `${shopUrl}/cart`, // Construct cart URL from shop URL
          customerEmail: customer?.email || null,
          customerFirstName: customer?.firstName || null,
          customerLastName: customer?.lastName || null,
          isLoggedIn: !!customer?.id,
          abandonedAt: node.createdAt || new Date().toISOString(),
          totalPrice: totalPrice,
          lineItems: lineItems,
          lineItemsCount: lineItems.length
        };
      });

      // Guest abandoned carts (not logged in)
      const guestAbandonedCarts = abandonedCartsList.filter(cart => !cart.isLoggedIn);

      const potentialRevenue = abandonedCartsList.reduce((sum, cart) => sum + cart.totalPrice, 0);
      
      const abandonedWithEmail = abandonedCartsList.filter(c => c.customerEmail).length;
      console.log(`📧 Abandoned with email: ${abandonedWithEmail}`);
      console.log(`👤 Guest abandoned carts: ${guestAbandonedCarts.length}`);

      // Calculate product conversions
      const productConversionMap = new Map<string, { added: number; purchased: number; name: string }>();
      
      // Track abandoned adds
      abandonedCartsList.forEach(cart => {
        cart.lineItems.forEach(item => {
          if (item.productId) {
            const key = item.productId;
            const existing = productConversionMap.get(key) || { added: 0, purchased: 0, name: item.productName };
            existing.added += item.quantity;
            productConversionMap.set(key, existing);
          }
        });
      });
      
      // Track purchases
      completedOrdersList.forEach(order => {
        order.lineItems.forEach(item => {
          if (item.productId) {
            const key = item.productId;
            const existing = productConversionMap.get(key) || { added: 0, purchased: 0, name: item.productName };
            existing.purchased += item.quantity;
            productConversionMap.set(key, existing);
          }
        });
      });

      const productConversions: ProductConversion[] = Array.from(productConversionMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          addedToCart: data.added,
          purchased: data.purchased,
          conversionRate: data.added > 0 ? ((data.purchased / data.added) * 100).toFixed(1) + '%' : '0%'
        }))
        .filter(p => p.addedToCart > 0)
        .sort((a, b) => (b.addedToCart - b.purchased) - (a.addedToCart - a.purchased))
        .slice(0, 10);

      // Calculate top abandoned products
      const productMap = new Map<string, { name: string; count: number; value: number }>();
      
      abandonedCartsList.forEach(cart => {
        cart.lineItems.forEach(item => {
          const key = item.productName;
          const existing = productMap.get(key) || { name: key, count: 0, value: 0 };
          existing.count += item.quantity;
          productMap.set(key, existing);
        });
      });

      const topAbandonedProducts = Array.from(productMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(p => ({
          productName: p.name,
          abandonCount: p.count,
          totalValue: 0
        }));

      // ============ 4. CHECK MISSING PAGES ============
      console.log("📄 Checking for missing pages...");
      
      const pagesQuery = await admin.graphql(
        `#graphql
        query {
          pages(first: 50) {
            edges {
              node {
                title
                handle
              }
            }
          }
        }`
      );
      
      const pagesData = await pagesQuery.json() as any;
      const pages = pagesData.data?.pages?.edges || [];
      const pageTitles = pages.map((p: any) => p.node.title.toLowerCase());
      
      const missingPages: MissingPage[] = [
        {
          pageType: 'About Us',
          isMissing: !pageTitles.some((t: string | string[]) => t.includes('about')),
          severity: 'medium',
          recommendation: 'Add an About Us page to build trust with customers'
        },
        {
          pageType: 'Shipping Policy',
          isMissing: !pageTitles.some((t: string | string[]) => t.includes('shipping') || t.includes('delivery')),
          severity: 'high',
          recommendation: 'Add a clear shipping policy to reduce cart abandonment'
        },
        {
          pageType: 'Return Policy',
          isMissing: !pageTitles.some((t: string | string[]) => t.includes('return') || t.includes('refund')),
          severity: 'high',
          recommendation: 'Add a return policy to increase customer confidence'
        },
        {
          pageType: 'Privacy Policy',
          isMissing: !pageTitles.some((t: string | string[]) => t.includes('privacy')),
          severity: 'high',
          recommendation: 'Privacy policy is legally required for most businesses'
        },
        {
          pageType: 'FAQ',
          isMissing: !pageTitles.some((t: string | string[]) => t.includes('faq') || t.includes('questions')),
          severity: 'medium',
          recommendation: 'Add an FAQ page to answer common customer questions'
        },
        {
          pageType: 'Contact Us',
          isMissing: !pageTitles.some((t: string | string[]) => t.includes('contact')),
          severity: 'high',
          recommendation: 'Add a contact page so customers can reach you'
        }
      ];

      // ============ 5. CHECK PRODUCT STATS ============
      console.log("📦 Checking product statistics...");
      
      const productsQuery = await admin.graphql(
        `#graphql
        query {
          products(first: 250) {
            edges {
              node {
                id
                title
                description
                featuredImage {
                  url
                }
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
                priceRange {
                  minVariantPrice {
                    amount
                  }
                }
              }
            }
          }
        }`
      );
      
      const productsData = await productsQuery.json() as any;
      const products = productsData.data?.products?.edges || [];
      
      let missingImages = 0;
      let missingDescriptions = 0;
      let missingTitles = 0;
      let missingReviews = 0;
      
      const productsWithIssues: any[] = [];
      
      products.forEach(({ node }: any) => {
        const hasImages = node.featuredImage?.url || (node.images?.edges && node.images.edges.length > 0);
        const hasDescription = node.description && node.description.trim().length >= 20;
        const hasTitle = node.title && node.title.trim().length > 0;
        
        if (!hasImages) missingImages++;
        if (!hasDescription) missingDescriptions++;
        if (!hasTitle) missingTitles++;
        
        missingReviews += 1;
        
        if (!hasImages || !hasDescription || !hasTitle) {
          productsWithIssues.push({
            id: node.id,
            title: node.title || "Untitled Product",
            missingImages: !hasImages,
            missingDescription: !hasDescription,
            missingTitle: !hasTitle,
            missingReviews: true
          });
        }
      });
      
      const productStats: ProductStats = {
        totalProducts: products.length,
        missingImages,
        missingDescriptions,
        missingTitles,
        missingReviews,
        productsWithIssues: productsWithIssues.slice(0, 10)
      };

      console.log("📊 Product Stats:", {
        total: products.length,
        missingImages,
        missingDescriptions,
        missingTitles,
        missingReviews
      });

      const totalCarts = completedOrdersList.length + abandonedCartsList.length;
      const abandonmentRate = totalCarts > 0 
        ? ((abandonedCartsList.length / totalCarts) * 100).toFixed(1) + "%" 
        : "0%";
      const completionRate = totalCarts > 0 
        ? ((completedOrdersList.length / totalCarts) * 100).toFixed(1) + "%" 
        : "0%";

      console.log("📊 FINAL STATS:", {
        totalCarts,
        abandoned: abandonedCartsList.length,
        completed: completedOrdersList.length,
        abandonedWithEmail,
        guestAbandoned: guestAbandonedCarts.length,
        potentialRevenue
      });

      const scanResult: ScanResult = {
        scanned: true,
        scanId: `scan_${Date.now()}`,
        scanDate: new Date().toISOString(),
        metrics: {
          shopName,
          shopUrl,
          totalOrders: completedOrdersList.length,
          totalRevenue: Math.round(completedRevenue),
          cartAnalytics: {
            totalCarts,
            abandonedCarts: abandonedCartsList.length,
            completedCarts: completedOrdersList.length,
            abandonmentRate,
            completionRate,
            potentialRevenue: Math.round(potentialRevenue),
            completedRevenue: Math.round(completedRevenue),
            recoverableRevenue: Math.round(potentialRevenue * 0.2),
            abandonedCartsList,
            completedOrdersList,
            guestAbandonedCarts,
            topAbandonedProducts,
            productConversions,
            missingPages,
            productStats,
            dateRange: { startDate, endDate }
          }
        }
      };

      console.log("✅ SCAN COMPLETE!");
      return scanResult;

    } catch (error) {
      console.error("❌ Scan error:", error);
      return {
        scanned: false,
        error: error instanceof Error ? error.message : "Failed to scan store"
      };
    }
  }

  return { scanned: false };
}

// Helper functions for default dates
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

/* ---------------- MAIN UI ---------------- */
export default function Index() {
  const fetcher = useFetcher<ScanResult>();
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState("");
  const [savedResult, setSavedResult] = useState<ScanResult | null>(null);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(false);
  
  const isScanning = fetcher.state === "submitting";

  // Load saved results from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSavedResult(parsed);
        setShowStartScreen(false);
        console.log("📂 Loaded saved scan results from:", parsed.scanDate);
      } else {
        setShowStartScreen(true);
      }
    } catch (error) {
      console.error("Error loading saved results:", error);
      setShowStartScreen(true);
    }
  }, []);

  // Save results to localStorage when scan completes
  useEffect(() => {
    if (fetcher.data?.scanned) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fetcher.data));
        setSavedResult(fetcher.data);
        setShowStartScreen(false);
        console.log("💾 Saved scan results to localStorage");
      } catch (error) {
        console.error("Error saving results:", error);
      }
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (!isScanning) {
      setScanProgress(0);
      setScanStep("");
      return;
    }

    const steps = [
      "🔍 Initializing...",
      "🏪 Fetching store info...",
      "📦 Scanning orders...",
      "🛒 Checking abandoned carts...",
      "📄 Checking pages...",
      "📧 Processing customer data...",
      "⚖️ Calculating metrics..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setScanStep(steps[currentStep]);
        setScanProgress(((currentStep + 1) / steps.length) * 100);
        currentStep++;
      }
    }, 800);

    return () => clearInterval(interval);
  }, [isScanning]);

  const handleScan = () => {
    const formData = new FormData();
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleClearSaved = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedResult(null);
    setShowStartScreen(true);
  };

  const handleNewScan = () => {
    setShowStartScreen(true);
  };

  // Use either current scan data or saved results
  const displayData = fetcher.data?.scanned ? fetcher.data : savedResult;
  const errorData = fetcher.data?.scanned === false ? fetcher.data : null;

  // Show start screen if no data and not scanning
  if (showStartScreen && !isScanning && !errorData) {
    return (
      <div style={{ 
        maxWidth: '800px', 
        margin: '4rem auto', 
        padding: '3rem', 
        textAlign: 'center',
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '2.5rem', color: '#008060', marginBottom: '1rem' }}>
          Revenue Leak Scanner
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#5C5F62', marginBottom: '2rem' }}>
          Find abandoned carts, missing pages, and recover lost revenue
        </p>
        
        {/* Date Range Picker */}
        <div style={{ 
          background: '#F6F6F7', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#008060' }}>📅 Select Date Range</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #8A9199',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #8A9199',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginTop: '0.5rem' }}>
            Data will be scanned for the selected date range
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning}
          style={{
            background: '#008060',
            color: 'white',
            border: 'none',
            borderRadius: '40px',
            padding: '1rem 4rem',
            fontSize: '1.3rem',
            fontWeight: '600',
            cursor: isScanning ? 'not-allowed' : 'pointer',
            opacity: isScanning ? 0.7 : 1,
            boxShadow: '0 4px 8px rgba(0,128,96,0.3)'
          }}
        >
          {isScanning ? 'Scanning...' : 'Start Scan'}
        </button>
        <p style={{ marginTop: '2rem', color: '#8A9199', fontSize: '0.9rem' }}>
          🔒 Read-only • We never modify your store • Results are saved
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      
      {/* Scanning Progress */}
      {isScanning && (
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '2rem', 
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{scanStep}</h2>
          <div style={{ height: '10px', background: '#E4E5E7', borderRadius: '5px' }}>
            <div 
              style={{ 
                width: `${scanProgress}%`, 
                height: '100%', 
                background: '#008060', 
                borderRadius: '5px',
                transition: 'width 0.3s'
              }} 
            />
          </div>
          <p style={{ marginTop: '1rem', color: '#5C5F62' }}>{Math.round(scanProgress)}% complete</p>
        </div>
      )}

      {/* Error State */}
      {errorData && (
        <div style={{ 
          background: '#FFF4F4', 
          padding: '2rem', 
          borderRadius: '16px', 
          color: '#D82C0D',
          marginBottom: '2rem'
        }}>
          <h3>❌ Error: {errorData.error}</h3>
          <button
            onClick={handleScan}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              background: '#D82C0D',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {displayData && displayData.metrics && (
        <div>
          {/* Header with Date Range and Scan Info */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
            background: '#F6F6F7',
            padding: '1.5rem',
            borderRadius: '12px'
          }}>
            <div>
              <h1 style={{ fontSize: '2rem', color: '#008060', marginBottom: '0.5rem' }}>
                {displayData.metrics.shopName}
              </h1>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <p style={{ color: '#5C5F62' }}>
                  📅 {displayData.metrics.cartAnalytics?.dateRange ? 
                    `${new Date(displayData.metrics.cartAnalytics.dateRange.startDate).toLocaleDateString()} - ${new Date(displayData.metrics.cartAnalytics.dateRange.endDate).toLocaleDateString()}` 
                    : 'No date range'}
                </p>
                <p style={{ color: '#5C5F62' }}>
                  📍 {displayData.metrics.totalOrders} orders • ${displayData.metrics.totalRevenue.toLocaleString()} revenue
                </p>
                <p style={{ color: '#5C5F62' }}>
                  🕐 Scanned: {new Date(displayData.scanDate).toLocaleString()}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#008060',
                  border: '1px solid #008060',
                  borderRadius: '40px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📅 Change Dates
              </button>
              <button
                onClick={handleNewScan}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#008060',
                  color: 'white',
                  border: 'none',
                  borderRadius: '40px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                New Scan
              </button>
              <button
                onClick={handleClearSaved}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#D82C0D',
                  color: 'white',
                  border: 'none',
                  borderRadius: '40px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear Saved
              </button>
            </div>
          </div>

          {/* Date Range Picker (collapsible) */}
          {showDatePicker && (
            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '12px', 
              marginBottom: '2rem',
              border: '1px solid #E4E5E7'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>📅 Select New Date Range</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #8A9199',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #8A9199',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  style={{
                    padding: '0.75rem 2rem',
                    background: '#008060',
                    color: 'white',
                    border: 'none',
                    borderRadius: '40px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isScanning ? 'not-allowed' : 'pointer',
                    opacity: isScanning ? 0.7 : 1
                  }}
                >
                  {isScanning ? 'Scanning...' : 'Scan with New Dates'}
                </button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          {displayData.metrics.cartAnalytics && (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '1.5rem', 
                marginBottom: '2rem' 
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #008060, #006E52)',
                  color: 'white',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,128,96,0.2)'
                }}>
                  <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>📊 Checkout Summary</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700' }}>{displayData.metrics.cartAnalytics.totalCarts}</p>
                  <p>
                    {displayData.metrics.cartAnalytics.completedCarts} completed • {displayData.metrics.cartAnalytics.abandonedCarts} abandoned
                  </p>
                </div>
                
                <div style={{ 
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  border: '1px solid #E4E5E7',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <p style={{ fontSize: '0.9rem', color: '#5C5F62', marginBottom: '0.5rem' }}>📧 Customer with Email</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#008060' }}>
                    {displayData.metrics.cartAnalytics.abandonedCartsList?.filter(c => c.customerEmail).length}
                  </p>
                  <p style={{ color: '#5C5F62' }}>
                    ${displayData.metrics.cartAnalytics.abandonedCartsList
                      ?.filter(c => c.customerEmail)
                      .reduce((sum, c) => sum + c.totalPrice, 0)
                      .toLocaleString() || 0} recoverable
                  </p>
                </div>
                
                <div style={{ 
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  border: '1px solid #E4E5E7',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <p style={{ fontSize: '0.9rem', color: '#5C5F62', marginBottom: '0.5rem' }}>👤 Guest Customers</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#D82C0D' }}>
                    {displayData.metrics.cartAnalytics.guestAbandonedCarts?.length || 0}
                  </p>
                  <p style={{ color: '#5C5F62' }}>
                    ${displayData.metrics.cartAnalytics.guestAbandonedCarts?.reduce((sum, c) => sum + c.totalPrice, 0).toLocaleString() || 0} at risk
                  </p>
                </div>
              </div>

              {/* Pass data to CartAbandonmentDashboard */}
              <CartAbandonmentDashboard 
                cartAnalytics={displayData.metrics.cartAnalytics}
                checkoutFunnel={{
                  totalCheckoutStarts: displayData.metrics.cartAnalytics.totalCarts,
                  checkoutsCompleted: displayData.metrics.cartAnalytics.completedCarts,
                  checkoutsAbandoned: displayData.metrics.cartAnalytics.abandonedCarts,
                  completionRate: displayData.metrics.cartAnalytics.completionRate,
                  abandonmentRate: displayData.metrics.cartAnalytics.abandonmentRate,
                  averageOrderValue: displayData.metrics.totalRevenue / (displayData.metrics.totalOrders || 1),
                  purchasesAfterCheckout: displayData.metrics.totalOrders,
                  purchasesAfterReminder: Math.round(displayData.metrics.cartAnalytics.abandonedCarts * 0.18),
                  conversionRate: displayData.metrics.cartAnalytics.completionRate,
                  checkoutSteps: [],
                  dailyFunnel: []
                }}
                shopUrl={displayData.metrics.shopUrl}
              />

              {/* Product Stats Section */}
              {displayData.metrics.cartAnalytics.productStats && (
                <div style={{ 
                  background: 'white', 
                  borderRadius: '16px', 
                  border: '1px solid #E4E5E7', 
                  padding: '2rem', 
                  marginTop: '2rem',
                  marginBottom: '2rem'
                }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📦 Product Health Overview</h2>
                  
                  {/* Summary Stats */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '1rem', 
                    marginBottom: '2rem' 
                  }}>
                    <StatCardSmall 
                      label="Total Products" 
                      value={displayData.metrics.cartAnalytics.productStats.totalProducts} 
                      color="#008060"
                    />
                    <StatCardSmall 
                      label="Missing Images" 
                      value={displayData.metrics.cartAnalytics.productStats.missingImages} 
                      color={displayData.metrics.cartAnalytics.productStats.missingImages > 0 ? '#D82C0D' : '#50B83C'}
                    />
                    <StatCardSmall 
                      label="Missing Descriptions" 
                      value={displayData.metrics.cartAnalytics.productStats.missingDescriptions} 
                      color={displayData.metrics.cartAnalytics.productStats.missingDescriptions > 0 ? '#D82C0D' : '#50B83C'}
                    />
                    <StatCardSmall 
                      label="Missing Titles" 
                      value={displayData.metrics.cartAnalytics.productStats.missingTitles} 
                      color={displayData.metrics.cartAnalytics.productStats.missingTitles > 0 ? '#D82C0D' : '#50B83C'}
                    />
                    <StatCardSmall 
                      label="Missing Reviews" 
                      value={displayData.metrics.cartAnalytics.productStats.missingReviews} 
                      color={displayData.metrics.cartAnalytics.productStats.missingReviews > 0 ? '#FFC58B' : '#50B83C'}
                    />
                  </div>

                  {/* Detailed Issues */}
                  {displayData.metrics.cartAnalytics.productStats.productsWithIssues.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Products with Issues</h3>
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {displayData.metrics.cartAnalytics.productStats.productsWithIssues.map((product, i) => (
                          <div key={i} style={{ 
                            padding: '1rem', 
                            background: '#F6F6F7', 
                            borderRadius: '8px',
                            borderLeft: `4px solid ${product.missingImages || product.missingDescription ? '#D82C0D' : '#FFC58B'}`
                          }}>
                            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{product.title}</p>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                              {product.missingImages && <span style={{ color: '#D82C0D' }}>❌ No images</span>}
                              {product.missingDescription && <span style={{ color: '#D82C0D' }}>❌ No description</span>}
                              {product.missingTitle && <span style={{ color: '#D82C0D' }}>❌ No title</span>}
                              {product.missingReviews && <span style={{ color: '#FFC58B' }}>⚠️ No reviews</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Missing Pages Section */}
              {displayData.metrics.cartAnalytics.missingPages?.filter(p => p.isMissing).length > 0 && (
                <div style={{ 
                  background: 'white', 
                  borderRadius: '16px', 
                  border: '1px solid #E4E5E7', 
                  padding: '2rem', 
                  marginTop: '2rem',
                  marginBottom: '2rem'
                }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📄 Missing Important Pages</h2>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {displayData.metrics.cartAnalytics.missingPages
                      .filter(p => p.isMissing)
                      .map((page, i) => (
                        <div key={i} style={{ 
                          padding: '1rem', 
                          background: page.severity === 'high' ? '#FFF4F4' : '#F6F6F7',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${page.severity === 'high' ? '#D82C0D' : '#FFC58B'}`
                        }}>
                          <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>⚠️ Missing: {page.pageType}</p>
                          <p style={{ fontSize: '0.9rem', color: '#5C5F62' }}>{page.recommendation}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Small stat card component
function StatCardSmall({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ 
      padding: '1rem', 
      background: '#F6F6F7', 
      borderRadius: '8px',
      textAlign: 'center'
    }}>
      <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: '700', color }}>{value}</p>
    </div>
  );
}