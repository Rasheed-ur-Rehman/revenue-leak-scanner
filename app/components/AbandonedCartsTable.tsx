import React from "react";
import type { AbandonedCart } from "../types/shopify";

export function AbandonedCartsTable({ carts }: { carts: AbandonedCart[] }) {
  if (!carts.length) return <p>No abandoned carts found.</p>;

  return (
    <table border={1} cellPadding={8} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr style={{ backgroundColor: "#f8f9fa" }}>
          <th>Email</th>
          <th>Value</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {carts.map((c, i) => (
          <tr key={i}>
            <td>{c.email ?? "Guest"}</td>
            <td>${c.totalPrice.toFixed(2)}</td>
            <td>{c.createdAt ? new Date(c.createdAt).toLocaleString() : "Unknown"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
