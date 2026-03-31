"use client";

import { SignIn } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const Grainient = dynamic(() => import("@/components/Grainient"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, background: "#0A1628" }} />
  ),
});

export default function DesignerSignInPage() {
  return (
    <>
      {/* Full-viewport animated gradient — Designer palette (teal/blue) */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
        }}
      >
        <Grainient
          color1="#0693E3"
          color2="#0A1628"
          color3="#06b6d4"
          timeSpeed={0.15}
          colorBalance={0}
          warpStrength={0.5}
          warpFrequency={6}
          warpSpeed={2}
          warpAmplitude={20}
          blendAngle={60}
          blendSoftness={0.4}
          rotationAmount={600}
          noiseScale={3}
          grainAmount={0.04}
          grainScale={2}
          grainAnimated={false}
          contrast={1.15}
          gamma={1}
          saturation={1.1}
          centerX={0}
          centerY={0}
          zoom={0.7}
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
        <SignIn
          signUpUrl="/sign-up"
          forceRedirectUrl="/designer"
          appearance={{
            layout: {
              socialButtonsPlacement: "top",
              socialButtonsVariant: "blockButton",
            },
            variables: {
              colorPrimary: "#0693E3",
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
              headerTitle: "text-lg font-bold",
              headerSubtitle: "text-sm",
              formButtonPrimary:
                "bg-gradient-to-r from-[#0693E3] to-[#06b6d4] hover:from-[#0580CC] hover:to-[#059caf] rounded-full font-semibold text-sm h-11 text-white shadow-lg shadow-cyan-500/25 transition-all border-0",
              socialButtonsBlockButton:
                "border border-[#E5E5E5] rounded-xl h-11 hover:bg-[#F5F5F5] transition-colors",
              formFieldInput:
                "rounded-[10px] border-[#E5E5E5] h-11 focus:border-[#0693E3] focus:ring-1 focus:ring-[#0693E3]/20",
              footerActionLink:
                "text-[#0693E3] hover:text-[#06b6d4] font-medium",
            },
          }}
        />

        {/* Footer */}
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.25)",
            fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          OneForma Design Studio
        </p>
      </div>
    </>
  );
}
