"use client";

import { SignIn } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const DarkVeil = dynamic(() => import("@/components/DarkVeil"), {
  ssr: false,
  loading: () => <div style={{ position: "fixed", inset: 0, background: "#0D0624" }} />,
});

export default function SignInPage() {
  return (
    <>
      {/* Full-viewport WebGL background — OneForma brand aurora */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          background: "#0D0624",
        }}
      >
        <DarkVeil
          hueShift={0}
          noiseIntensity={0.012}
          speed={0.2}
          warpAmount={0.2}
          resolutionScale={0.5}
        />
      </div>

      {/* Centered sign-in content */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          gap: "20px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.5px",
              fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
              margin: 0,
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}
          >
            OneForma
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.45)",
              marginTop: "4px",
              fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Creative OS — Recruitment Marketing Intelligence
          </p>
        </div>

        {/* Clerk — clean white card, NO transparency tricks */}
        <SignIn
          appearance={{
            layout: {
              socialButtonsPlacement: "top",
              socialButtonsVariant: "blockButton",
            },
            variables: {
              colorPrimary: "#6B21A8",
              colorBackground: "#ffffff",
              colorText: "#1A1A1A",
              colorTextSecondary: "#737373",
              colorInputBackground: "#F5F5F5",
              colorInputText: "#1A1A1A",
              borderRadius: "12px",
              fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
            },
            elements: {
              rootBox: "w-full max-w-[400px]",
              card: "rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/20",
              formButtonPrimary:
                "bg-[#32373C] hover:bg-[#1A1A1A] rounded-full font-semibold text-sm h-11",
              socialButtonsBlockButton:
                "border border-[#E5E5E5] rounded-xl h-11 hover:bg-[#F5F5F5] transition-colors",
              formFieldInput:
                "rounded-[10px] border-[#E5E5E5] h-11 focus:border-[#6B21A8] focus:ring-1 focus:ring-[#6B21A8]/20",
              footerActionLink: "text-[#6B21A8] hover:text-[#9B51E0] font-medium",
            },
          }}
        />

        {/* Footer */}
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.2)",
            fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          Powered by Centific
        </p>
      </div>
    </>
  );
}
