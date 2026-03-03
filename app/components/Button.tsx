import React from "react";

export function Button({ children, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        fontSize: 16,
        cursor: disabled ? "wait" : "pointer",
        backgroundColor: disabled ? "#ccc" : "#007bff",
        color: "white",
        border: "none",
        borderRadius: 4,
      }}
    >
      {children}
    </button>
  );
}
