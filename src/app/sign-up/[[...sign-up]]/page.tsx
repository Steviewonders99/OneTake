"use client";

import { SignUp } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const DarkVeil = dynamic(() => import("@/components/DarkVeil"), {
  ssr: false,
});

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Cinematic WebGL background — OneForma purple/pink palette */}
      <DarkVeil
        hueShift={270}
        noiseIntensity={0.015}
        speed={0.25}
        warpAmount={0.25}
        resolutionScale={0.6}
      />

      {/* Dark overlay for text readability */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-[2] flex flex-col items-center gap-8">
        <div className="text-center">
          <h1
            className="text-4xl font-bold tracking-tight text-white"
            style={{ fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif" }}
          >
            OneForma
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Creative OS — Recruitment Marketing Intelligence
          </p>
        </div>

        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full max-w-md",
              card: "bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 rounded-2xl",
              headerTitle: "text-[#1A1A1A] text-xl font-bold",
              headerSubtitle: "text-[#737373]",
              formButtonPrimary:
                "bg-[#32373C] hover:bg-[#1A1A1A] text-white rounded-full font-semibold",
              formFieldInput:
                "border-[#E5E5E5] rounded-[10px] focus:border-[#6B21A8] focus:ring-[#6B21A8]/20",
              footerAction: "text-[#737373]",
              footerActionLink: "text-[#6B21A8] hover:text-[#9B51E0]",
            },
          }}
        />

        <p className="text-xs text-white/30">
          Powered by Centific
        </p>
      </div>
    </div>
  );
}
