export type ScanTotals = {
  totalOrders: number;
  totalRevenue: number;
  loggedInCustomers: number;
  guestCheckouts: number;
  abandonedCheckouts: number;
  conversionRate: string;
};

export type AbandonedCart = {
  email: string | null;
  totalPrice: number;
  createdAt: string;
};

export type OrderNode = {
  id: string;
  customer: {
    id: string;
    email: string | null;
  } | null;
  totalPriceSet: {
    shopMoney: {
      amount: string;
    };
  };
  processedAt: string;
};

export type ScanResult = {
  scanned: boolean;
  error?: string;
  totals?: ScanTotals;
  abandonedCarts?: AbandonedCart[];
};
import React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      "s-link": React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >;
    }
  }
}