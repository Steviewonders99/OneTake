"use client";

import { CHANNEL_DEFINITIONS } from "@/lib/channels";

interface ChannelTabBarProps {
  channels: string[];
  activeChannel: string;
  onChannelChange: (channel: string) => void;
}

export default function ChannelTabBar({
  channels,
  activeChannel,
  onChannelChange,
}: ChannelTabBarProps) {
  return (
    <div className="flex gap-0.5 border-b-2 border-[#E5E5E5] mb-5">
      {channels.map((channel) => {
        const def = CHANNEL_DEFINITIONS[channel];
        const isActive = channel === activeChannel;
        return (
          <button
            key={channel}
            onClick={() => onChannelChange(channel)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium cursor-pointer transition-colors ${
              isActive
                ? "text-[#6B21A8] border-b-2 border-[#6B21A8] -mb-[2px]"
                : "text-[#999] hover:text-[#555]"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: def?.color || "#6B21A8" }}
            />
            {channel}
          </button>
        );
      })}
    </div>
  );
}
