'use client';

import { PlacementPreviewFrame } from '@/components/platform-mockups/PlacementPreviewFrame';
import type { MockupCreative } from '@/lib/mockup-types';
import type { GeneratedAsset } from '@/lib/types';

interface MockupPreviewProps {
  asset: GeneratedAsset;
}

/**
 * Maps a GeneratedAsset to MockupCreative and wraps it in
 * the platform-specific preview frame.
 */
// Map our platform keys to the frame dispatcher's expected values
const PLATFORM_MAP: Record<string, { platform: string; placement: string }> = {
  ig_feed: { platform: "instagram", placement: "feed" },
  ig_story: { platform: "instagram", placement: "stories" },
  instagram_feed: { platform: "instagram", placement: "feed" },
  instagram_stories: { platform: "instagram", placement: "stories" },
  facebook_feed: { platform: "facebook", placement: "feed" },
  facebook_stories: { platform: "facebook", placement: "stories" },
  linkedin_feed: { platform: "linkedin", placement: "feed" },
  tiktok_feed: { platform: "tiktok", placement: "feed" },
  telegram_card: { platform: "telegram", placement: "card" },
  twitter_post: { platform: "twitter", placement: "feed" },
  wechat_moments: { platform: "wechat", placement: "feed" },
};

export default function MockupPreview({ asset }: MockupPreviewProps) {
  const content = asset.content as Record<string, unknown> | null;
  const copyData = asset.copy_data as Record<string, unknown> | null;

  const mapped = PLATFORM_MAP[asset.platform?.toLowerCase()] || { platform: asset.platform?.toLowerCase() || "unknown", placement: "feed" };

  const creative: MockupCreative = {
    platform: mapped.platform,
    placement: mapped.placement,
    imageUrl: asset.blob_url || undefined,
    headline: (content?.overlay_headline as string) || (copyData?.headline as string) || (content?.headline as string) || undefined,
    description: (content?.overlay_sub as string) || (copyData?.description as string) || (content?.subheadline as string) || undefined,
    primaryText: (copyData?.primary_text as string) || (content?.overlay_sub as string) || undefined,
    ctaText: (content?.overlay_cta as string) || (copyData?.cta_text as string) || (content?.cta_text as string) || undefined,
    brandName: (content?.brand_name as string) || 'OneForma',
    brandLogoUrl: (content?.brand_logo_url as string) || undefined,
    caption: (copyData?.caption as string) || (copyData?.primary_text as string) || undefined,
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-2 bg-[#1a1a1a] rounded-xl">
      <PlacementPreviewFrame creative={creative} className="w-full" />
    </div>
  );
}
