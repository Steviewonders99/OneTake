"use client";

import { Edit3, Upload, Star, Mic, Languages, Home, Monitor, Check, MapPin } from "lucide-react";

interface StepTaskModeProps {
  taskType: string | null;
  workMode: "onsite" | "remote" | null;
  onTaskTypeChange: (type: string) => void;
  onWorkModeChange: (mode: "onsite" | "remote") => void;
}

const TASK_TYPES = [
  { key: "annotation", name: "Annotation", desc: "Label, tag, or classify data", Icon: Edit3 },
  { key: "data_collection", name: "Data Collection", desc: "Gather new data from people", Icon: Upload },
  { key: "judging", name: "Judging", desc: "Rate, rank, or evaluate", Icon: Star },
  { key: "transcription", name: "Transcription", desc: "Audio/video to text", Icon: Mic },
  { key: "translation", name: "Translation", desc: "Translate or localize", Icon: Languages },
];

const WORK_MODES = [
  {
    key: "onsite" as const,
    name: "Onsite Data Collection",
    Icon: Home,
    tags: ["In-person", "Supervised", "AIDA Required"],
  },
  {
    key: "remote" as const,
    name: "Remote / Digital Recruitment",
    Icon: Monitor,
    tags: ["Web-based", "App-based", "Self-paced"],
  },
];

export default function StepTaskMode({
  taskType,
  workMode,
  onTaskTypeChange,
  onWorkModeChange,
}: StepTaskModeProps) {
  return (
    <div style={{ maxWidth: 1600, width: "100%", margin: "0 auto" }}>
      {/* Step card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E8EA",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "32px 36px 24px", borderBottom: "1px solid #E8E8EA" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: "#1A1A1A",
              fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            What type of task is this?
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              color: "#737373",
              fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Select the task type, then choose how contributors will work
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "32px 36px 40px" }}>
          {/* Task type grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 16,
              marginBottom: 40,
            }}
          >
            {TASK_TYPES.map(({ key, name, desc, Icon }) => {
              const selected = taskType === key;
              return (
                <button
                  key={key}
                  onClick={() => onTaskTypeChange(key)}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "28px 16px 24px",
                    borderRadius: 12,
                    border: `2px solid ${selected ? "#6D28D9" : "#E8E8EA"}`,
                    background: selected ? "#faf5ff" : "#FFFFFF",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {/* Checkmark badge */}
                  {selected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#6D28D9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={11} color="white" strokeWidth={3} />
                    </div>
                  )}

                  {/* Icon container */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: selected ? "#ede9fe" : "#F5F5F5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} color={selected ? "#6D28D9" : "#737373"} />
                  </div>

                  {/* Name */}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: selected ? "#6D28D9" : "#1A1A1A",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    {name}
                  </span>

                  {/* Description */}
                  <span
                    style={{
                      fontSize: 11,
                      color: "#737373",
                      lineHeight: 1.4,
                      display: "block",
                    }}
                  >
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode section label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <MapPin size={15} color="#737373" />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#737373",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              How will contributors work?
            </span>
          </div>

          {/* Work mode grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {WORK_MODES.map(({ key, name, Icon, tags }) => {
              const selected = workMode === key;
              return (
                <button
                  key={key}
                  onClick={() => onWorkModeChange(key)}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 18,
                    padding: "24px 24px",
                    borderRadius: 12,
                    border: `2px solid ${selected ? "#6D28D9" : "#E8E8EA"}`,
                    background: selected ? "#faf5ff" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.15s, background 0.15s",
                    fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {/* Checkmark badge */}
                  {selected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#6D28D9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={11} color="white" strokeWidth={3} />
                    </div>
                  )}

                  {/* Icon container */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: selected ? "#ede9fe" : "#F5F5F5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} color={selected ? "#6D28D9" : "#737373"} />
                  </div>

                  {/* Text */}
                  <div style={{ paddingTop: 2 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: selected ? "#6D28D9" : "#1A1A1A",
                        display: "block",
                        marginBottom: 10,
                      }}
                    >
                      {name}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: selected ? "#6D28D9" : "#737373",
                            background: selected ? "#ede9fe" : "#F5F5F5",
                            border: `1px solid ${selected ? "#c4b5fd" : "#E8E8EA"}`,
                            borderRadius: 9999,
                            padding: "3px 10px",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
