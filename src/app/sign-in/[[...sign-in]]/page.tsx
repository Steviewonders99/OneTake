"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAFAFA",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      {/* Gradient accent bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, #0693E3, #9B51E0, #E91E8C)",
        }}
      />

      {/* Logo */}
      <img
        src="/oneforma-logo-full.png"
        alt="OneForma"
        style={{ height: 40, marginBottom: 32, objectFit: "contain" }}
      />

      {/* Clerk sign-in */}
      <SignIn
        signUpUrl="/sign-up"
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
            card: "rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-[#E5E5E5]",
            formButtonPrimary:
              "bg-[#32373C] hover:bg-[#1A1A1A] rounded-full font-semibold text-sm h-11 text-white transition-all border-0",
            socialButtonsBlockButton:
              "border border-[#E5E5E5] rounded-xl h-11 hover:bg-[#F5F5F5] transition-colors",
            formFieldInput:
              "rounded-[10px] border-[#E5E5E5] h-11 focus:border-[#0693E3] focus:ring-1 focus:ring-[#0693E3]/20",
            footerActionLink:
              "text-[#0693E3] hover:text-[#9B51E0] font-medium",
          },
        }}
      />

      {/* Footer */}
      <p
        style={{
          fontSize: 11,
          color: "#B0B0B5",
          marginTop: 24,
          fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        Powered by Centific
      </p>
    </div>
  );
}
