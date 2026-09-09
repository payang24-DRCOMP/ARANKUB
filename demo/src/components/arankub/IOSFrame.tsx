"use client";

import type { ReactNode } from "react";

/** กรอบเครื่อง iPhone 390x844 สำหรับพรีวิวหน้ามือถือ (ตามดีไซน์ ios-frame.jsx) */
export function IOSFrame({ children, time }: { children: ReactNode; time: string }) {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        borderRadius: 56,
        padding: 12,
        background: "linear-gradient(160deg,#3a3550,#15131f)",
        boxShadow: "0 40px 80px rgba(40,25,90,.35), 0 0 0 2px rgba(255,255,255,.08) inset",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 45,
          overflow: "hidden",
          background: "#f4f2fb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* status bar */}
        <div
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            zIndex: 30,
            height: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 30px",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1826" }}>{time}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="18" height="11" viewBox="0 0 19 12" aria-hidden>
              <rect x="0" y="7.5" width="3.2" height="4.5" rx=".7" fill="#1a1826" />
              <rect x="4.8" y="5" width="3.2" height="7" rx=".7" fill="#1a1826" />
              <rect x="9.6" y="2.5" width="3.2" height="9.5" rx=".7" fill="#1a1826" />
              <rect x="14.4" y="0" width="3.2" height="12" rx=".7" fill="#1a1826" />
            </svg>
            <svg width="25" height="12" viewBox="0 0 27 13" aria-hidden>
              <rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="#1a1826" strokeOpacity=".35" fill="none" />
              <rect x="2" y="2" width="17" height="9" rx="2" fill="#1a1826" />
            </svg>
          </div>
        </div>

        {/* dynamic island */}
        <div
          style={{
            position: "absolute",
            top: 11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 118,
            height: 33,
            borderRadius: 100,
            background: "#15131f",
            zIndex: 40,
          }}
        />

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>

        {/* home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 134,
            height: 5,
            borderRadius: 100,
            background: "rgba(0,0,0,.28)",
            zIndex: 40,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
