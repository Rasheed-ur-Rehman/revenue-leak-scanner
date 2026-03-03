import React from "react";
import type { ScanTotals } from "../types/shopify";

export function ScanTable({ totals }: { totals: ScanTotals }) {
  return (
    <table border={1} cellPadding={8} cellSpacing={0} style={{ borderCollapse: "collapse", marginBottom: 20, width: "100%", maxWidth: 600 }}>
      <tbody>
        <tr><td style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>Total Orders</td><td>{totals.totalOrders}</td></tr>
        <tr><td style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>Total Revenue</td><td>${totals.totalRevenue.toLocaleString()}</td></tr>
        <tr><td style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>Logged-in Customers</td><td>{totals.loggedInCustomers}</td></tr>
        <tr><td style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>Guest Checkouts</td><td>{totals.guestCheckouts}</td></tr>
        <tr><td style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>Abandoned Checkouts</td><td>{totals.abandonedCheckouts}</td></tr>
        <tr><td style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>Conversion Rate</td><td>{totals.conversionRate}</td></tr>
      </tbody>
    </table>
  );
}
