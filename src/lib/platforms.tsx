// src/lib/platforms.tsx
// Platform metadata, logos, and channel normalizer.
// Extracted from CampaignWorkspace.tsx so MediaStrategyTab can reuse.

import { useId } from "react";

// Used by MediaStrategyTab (Task 2+) — cap the channel mix at the top N channels
// per country and renormalize so the bar chart isn't diluted by long-tail channels.
export const TOP_N_CHANNELS = 4;

export const PLATFORM_META: Record<string, { label: string; color: string; brand: string }> = {
  ig_feed: { label: "Instagram", color: "#E1306C", brand: "instagram" },
  instagram_feed: { label: "Instagram", color: "#E1306C", brand: "instagram" },
  ig_story: { label: "IG Stories", color: "#E1306C", brand: "instagram" },
  ig_carousel: { label: "IG Carousel", color: "#E1306C", brand: "instagram" },
  facebook_feed: { label: "Facebook", color: "#1877F2", brand: "facebook" },
  facebook_stories: { label: "FB Stories", color: "#1877F2", brand: "facebook" },
  linkedin_feed: { label: "LinkedIn", color: "#0A66C2", brand: "linkedin" },
  linkedin_carousel: { label: "LI Carousel", color: "#0A66C2", brand: "linkedin" },
  tiktok_feed: { label: "TikTok", color: "#000000", brand: "tiktok" },
  tiktok_carousel: { label: "TT Carousel", color: "#000000", brand: "tiktok" },
  telegram_card: { label: "Telegram", color: "#0088cc", brand: "telegram" },
  twitter_post: { label: "X/Twitter", color: "#1DA1F2", brand: "twitter" },
  wechat_moments: { label: "WeChat", color: "#07C160", brand: "wechat" },
  wechat_carousel: { label: "WC Carousel", color: "#07C160", brand: "wechat" },
  whatsapp_story: { label: "WhatsApp", color: "#25D366", brand: "whatsapp" },
  google_display: { label: "Display", color: "#4285F4", brand: "google" },
  google_search: { label: "Google Search", color: "#4285F4", brand: "google" },
  pinterest_feed: { label: "Pinterest", color: "#E60023", brand: "pinterest" },
  youtube_feed: { label: "YouTube", color: "#FF0000", brand: "youtube" },
  reddit_ads: { label: "Reddit", color: "#FF4500", brand: "reddit" },
  snapchat_feed: { label: "Snapchat", color: "#FFFC00", brand: "snapchat" },
  discord_feed: { label: "Discord", color: "#5865F2", brand: "discord" },
  discord_community: { label: "Discord", color: "#5865F2", brand: "discord" },
  // Title Case variants (from Stage 3 copy)
  "Facebook Feed": { label: "Facebook", color: "#1877F2", brand: "facebook" },
  "Facebook Groups": { label: "Facebook", color: "#1877F2", brand: "facebook" },
  "Facebook Stories": { label: "Facebook", color: "#1877F2", brand: "facebook" },
  "Instagram Feed": { label: "Instagram", color: "#E1306C", brand: "instagram" },
  "Instagram Stories": { label: "Instagram", color: "#E1306C", brand: "instagram" },
  "LinkedIn Feed": { label: "LinkedIn", color: "#0A66C2", brand: "linkedin" },
  "Google Search": { label: "Google Search", color: "#4285F4", brand: "google" },
  "Reddit Ads": { label: "Reddit", color: "#FF4500", brand: "reddit" },
  "TikTok Feed": { label: "TikTok", color: "#000000", brand: "tiktok" },
  "Telegram Card": { label: "Telegram", color: "#0088cc", brand: "telegram" },
};

export function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform] || { label: platform.replace(/_/g, " "), color: "#6B21A8", brand: "unknown" };
}

/**
 * Normalize any placement/platform string to a canonical channel label.
 * Handles snake_case, Title Case, and stat-suffixed variants like "Facebook Feed (98%)".
 * Returns null for non-ad channels (email, job boards) — caller should filter them out.
 */
export function toChannel(plat: string): string | null {
  const cleaned = plat.replace(/\s*\(.*$/, "").trim();
  const lower = cleaned.toLowerCase().replace(/\s+/g, "_");
  if (lower.includes("email") || lower.includes("university") || lower.includes("job_board")) return null;
  if (lower.includes("instagram") || lower.includes("ig_")) return "Instagram";
  if (lower.includes("facebook") || lower === "fb_feed" || lower === "fb_stories") return "Facebook";
  if (lower.includes("linkedin") || lower === "li_feed" || lower === "li_carousel") return "LinkedIn";
  if (lower.includes("tiktok") || lower === "tt_feed" || lower === "tt_carousel") return "TikTok";
  if (lower.includes("telegram")) return "Telegram";
  if (lower.includes("twitter") || lower.startsWith("x_")) return "X/Twitter";
  if (lower.includes("whatsapp")) return "WhatsApp";
  if (lower.includes("youtube")) return "YouTube";
  if (lower.includes("google") && lower.includes("search")) return "Google Search";
  if (lower.includes("google") && lower.includes("display")) return "Google Display";
  if (lower.includes("pinterest")) return "Pinterest";
  if (lower.includes("reddit")) return "Reddit";
  if (lower.includes("wechat")) return "WeChat";
  if (lower.includes("snapchat")) return "Snapchat";
  if (lower.includes("discord")) return "Discord";
  return cleaned.split("_")[0].charAt(0).toUpperCase() + cleaned.split("_")[0].slice(1);
}

export function PlatformLogo({ brand, className = "w-5 h-5" }: { brand: string; className?: string }) {
  const uid = useId();
  const igGradId = `ig-grad-${uid}`;
  switch (brand) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <defs><linearGradient id={igGradId} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#FD5" /><stop offset="50%" stopColor="#FF543E" /><stop offset="100%" stopColor="#C837AB" /></linearGradient></defs>
          <rect width="24" height="24" rx="6" fill={`url(#${igGradId})`} />
          <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="17" cy="7" r="1.2" fill="white" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#1877F2" />
          <path d="M16.5 12.5h-2.5v8h-3v-8H9v-2.5h2v-1.8c0-2 1.2-3.2 3-3.2.9 0 1.5.1 1.5.1v2h-.8c-.8 0-1.2.5-1.2 1.1v1.8h2.5l-.5 2.5z" fill="white" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path d="M7 10h2v7H7zm1-3.5a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM11 10h2v1c.5-.7 1.3-1.2 2.3-1.2 2 0 2.7 1.2 2.7 3.2v4h-2v-3.5c0-1-.4-1.5-1.2-1.5-.9 0-1.5.6-1.5 1.7V17h-2.3V10z" fill="white" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#000" />
          <path d="M16.5 8.5c-.8-.5-1.3-1.4-1.5-2.5h-2v10a2 2 0 11-1.5-1.9V12c-2.2.2-4 2-4 4.2a4.2 4.2 0 007.5 2.3V11c.7.5 1.5.8 2.5.8V9.5c-.4 0-.7-.1-1-.2z" fill="white" />
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#0088CC" />
          <path d="M6 12l2.5 1.5L10 17l2-3 4 3 3-11-13 6z" fill="white" />
          <path d="M10 17l.5-3 5.5-5" fill="none" stroke="white" strokeWidth=".5" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#000" />
          <path d="M13.5 11L17 7h-1.2l-3 3.4L10.2 7H7l3.7 5.2L7 17h1.2l3.2-3.7 2.8 3.7H17l-3.5-5z" fill="white" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#25D366" />
          <path d="M8 16.5l.8-2.8A5 5 0 1114.5 16L8 16.5z" fill="white" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="6" fill="#FF0000" />
          <polygon points="10,7 17,12 10,17" fill="white" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#E60023" />
          <path d="M12 6c-3.3 0-6 2.7-6 6 0 2.5 1.5 4.6 3.6 5.5-.1-.5-.1-1.2 0-1.7l.7-2.8s-.2-.4-.2-.9c0-.8.5-1.4 1.1-1.4.5 0 .8.4.8.9 0 .5-.3 1.3-.5 2-.1.6.3 1.1.9 1.1 1.1 0 2-1.2 2-2.9 0-1.5-1.1-2.5-2.6-2.5-1.8 0-2.8 1.3-2.8 2.7 0 .5.2 1.1.4 1.4.1.1 0 .2 0 .3l-.1.6c0 .1-.1.2-.3.1-.7-.4-1.2-1.4-1.2-2.3 0-1.9 1.4-3.6 4-3.6 2.1 0 3.7 1.5 3.7 3.5 0 2.1-1.3 3.8-3.1 3.8-.6 0-1.2-.3-1.4-.7l-.4 1.5c-.1.5-.4 1.1-.7 1.5.6.2 1.1.3 1.7.3 3.3 0 6-2.7 6-6s-2.7-6-6-6z" fill="white" />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#fff" stroke="#ddd" strokeWidth=".5" />
          <path d="M18.6 12.2H12v2.8h3.8c-.4 1.6-1.8 2.8-3.8 2.8a4.2 4.2 0 010-8.4c1 0 2 .4 2.7 1l2-2a7 7 0 10-4.7 12.2c4 0 7.3-2.8 7.3-7 0-.5 0-.9-.1-1.4z" fill="#4285F4" />
        </svg>
      );
    case "wechat":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#07C160" />
          <ellipse cx="10" cy="11" rx="4.5" ry="3.5" fill="white" />
          <ellipse cx="14.5" cy="14" rx="3.5" ry="2.5" fill="white" opacity=".8" />
        </svg>
      );
    case "reddit":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <circle cx="12" cy="13" r="5" fill="white" />
          <circle cx="10" cy="12.5" r="1" fill="#FF4500" />
          <circle cx="14" cy="12.5" r="1" fill="#FF4500" />
          <circle cx="12" cy="7" r="2" fill="white" />
          <path d="M14 7 L17 4" stroke="white" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case "snapchat":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#FFFC00" />
          <path d="M12 7c-2 0-3 1.5-3 3v2l-2 .5c0 .5.5 1 1 1-.5 1-1.5 2-1.5 2h11s-1-1-1.5-2c.5 0 1-.5 1-1l-2-.5v-2c0-1.5-1-3-3-3z" fill="white" />
        </svg>
      );
    default: {
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#6B21A8" />
          <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{brand.slice(0, 2).toUpperCase()}</text>
        </svg>
      );
    }
  }
}
