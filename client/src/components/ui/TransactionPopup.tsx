import React from "react";

interface TransactionPopupProps {
  isVisible: boolean;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export const TransactionPopup: React.FC<TransactionPopupProps> = ({
  isVisible,
  isLoading,
  error,
  onClose,
}) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 3000,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: 6,
        padding: "8px 12px",
        color: "white",
        fontFamily: "monospace",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {isLoading && (
        <>
          <div style={{ color: "#E1CF48" }}>🔄</div>
          <div>Processing...</div>
        </>
      )}

      {error && (
        <>
          <div style={{ color: "#ff6666" }}>❌</div>
          <div style={{ color: "#ccc" }}>Failed</div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              color: "#888",
              border: "none",
              padding: "2px 6px",
              fontSize: 10,
              cursor: "pointer",
              marginLeft: "4px",
            }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
};
