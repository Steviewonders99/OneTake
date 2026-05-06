'use client';

import { useState, useEffect } from 'react';
import { FileSearch, Users, Globe, Sparkles, CheckCircle2 } from 'lucide-react';

/**
 * OnForma-branded extraction loader with:
 * - Animated progress timeline showing what's happening
 * - Rotating recruiter fun facts to keep the user engaged
 * - Brand-consistent gradient accent (blue → purple)
 */

const FUN_FACTS = [
  "OneForma contributors span 190+ countries and territories worldwide",
  "The most common task type on OneForma is audio annotation for voice AI",
  "Our fastest campaign went from intake to live creatives in 23 minutes",
  "OneForma supports 80+ languages for data annotation projects",
  "The average recruiter saves 3-5 days per campaign with OneTake",
  "Our QR-coded flyers have a 12% higher scan rate than plain URLs",
  "Top-performing campaigns use localized copy in the contributor's native language",
  "OneForma's contributor community has grown 340% since 2024",
  "The best job posts mention specific pay rates — they convert 2.7x better",
  "Campaigns targeting 3+ countries use dynamic persona scaling for efficiency",
  "Our AI generates 15-30 unique creative assets per campaign per country",
  "Contributors who apply through tracked links have 40% higher completion rates",
  "The most successful campaigns combine organic social + direct job portal postings",
  "OneForma's data annotation work powers AI models used by Fortune 500 companies",
];

const PROGRESS_STEPS = [
  { icon: FileSearch, label: "Reading document structure", duration: 3000 },
  { icon: Users, label: "Extracting requirements & qualifications", duration: 5000 },
  { icon: Globe, label: "Identifying regions & languages", duration: 4000 },
  { icon: Sparkles, label: "Mapping to intake fields", duration: 3000 },
];

export function ExtractionLoader() {
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * FUN_FACTS.length));
  const [activeStep, setActiveStep] = useState(0);
  const [factFade, setFactFade] = useState(true);

  // Rotate fun facts every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactFade(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
        setFactFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Progress through steps
  useEffect(() => {
    if (activeStep >= PROGRESS_STEPS.length) return;
    const timer = setTimeout(() => {
      setActiveStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length));
    }, PROGRESS_STEPS[activeStep].duration);
    return () => clearTimeout(timer);
  }, [activeStep]);

  return (
    <div
      style={{
        maxWidth: 1600,
        width: "100%",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "55vh",
      }}
    >
      {/* Brand gradient bar */}
      <div
        style={{
          width: 80,
          height: 3,
          borderRadius: 2,
          background: "linear-gradient(135deg, #0693E3, #9B51E0)",
          marginBottom: 36,
        }}
      />

      {/* Animated pulse ring */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(6,147,227,0.12), rgba(155,81,224,0.12))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          animation: "ofPulse 2s ease-in-out infinite",
        }}
      >
        <Sparkles size={24} style={{ color: "#0693E3" }} />
      </div>

      {/* Heading */}
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#1A1A1A",
          margin: "0 0 6px",
          fontFamily: "inherit",
        }}
      >
        Analyzing your brief
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "#737373",
          margin: "0 0 36px",
          textAlign: "center",
          maxWidth: 380,
          lineHeight: 1.5,
        }}
      >
        Extracting task details, requirements, and compensation information
      </p>

      {/* Progress timeline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          width: "100%",
          maxWidth: 380,
          marginBottom: 40,
        }}
      >
        {PROGRESS_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeStep;
          const isDone = i < activeStep;
          const isPending = i > activeStep;

          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {/* Vertical connector line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDone
                      ? "#0693E3"
                      : isActive
                        ? "linear-gradient(135deg, #0693E3, #9B51E0)"
                        : "#F5F5F5",
                    transition: "all 0.5s ease",
                    flexShrink: 0,
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={14} style={{ color: "white" }} />
                  ) : (
                    <Icon
                      size={14}
                      style={{
                        color: isActive ? "white" : "#B0B0B5",
                        animation: isActive ? "ofSpin 2s linear infinite" : "none",
                      }}
                    />
                  )}
                </div>
                {i < PROGRESS_STEPS.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      height: 20,
                      background: isDone ? "#0693E3" : "#E5E5E5",
                      transition: "background 0.5s ease",
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isDone ? "#0693E3" : isActive ? "#1A1A1A" : "#B0B0B5",
                  paddingTop: 4,
                  transition: "all 0.3s ease",
                }}
              >
                {step.label}
                {isDone && <span style={{ color: "#0693E3", marginLeft: 6, fontSize: 11 }}></span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fun fact card */}
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E5E5E5",
          borderRadius: 12,
          padding: "16px 24px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontSize: 13,
            color: "#737373",
            margin: 0,
            lineHeight: 1.5,
            fontStyle: "italic",
            opacity: factFade ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {FUN_FACTS[factIndex]}
        </p>
      </div>

      <style>{`
        @keyframes ofPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes ofSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
