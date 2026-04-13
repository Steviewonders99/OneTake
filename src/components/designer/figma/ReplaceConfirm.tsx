"use client";

import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";

interface ReplaceConfirmProps {
  originalUrl: string;
  newUrl: string;
  assetName: string;
  theme: Theme;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ReplaceConfirm({
  originalUrl,
  newUrl,
  assetName,
  theme,
  onConfirm,
  onCancel,
}: ReplaceConfirmProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          maxWidth: "90vw",
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          fontFamily: FONT.sans,
        }}
      >
        {/* Title */}
        <h2
          style={{
            margin: "0 0 20px",
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          Replace Creative?
        </h2>

        {/* Side-by-side images */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {/* Original */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: theme.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              Original
            </div>
            <div
              style={{
                height: 200,
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                overflow: "hidden",
                background: theme.bg,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original creative"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>

          {/* New */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: theme.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              New
            </div>
            <div
              style={{
                height: 200,
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                overflow: "hidden",
                background: theme.bg,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={newUrl}
                alt="New creative"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>
        </div>

        {/* Asset name */}
        <div
          style={{
            fontSize: 13,
            color: theme.textMuted,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {assetName}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              height: 38,
              padding: "0 18px",
              borderRadius: 9999,
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.textMuted,
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 38,
              padding: "0 22px",
              borderRadius: 9999,
              border: "none",
              background: "#22c55e",
              color: "#fff",
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Confirm Replace
          </button>
        </div>
      </div>
    </div>
  );
}
