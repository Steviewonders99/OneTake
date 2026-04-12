'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { TrackedLinksResponse } from '@/lib/types';
import ChannelBarChart from './ChannelBarChart';
import TopPerformers from './TopPerformers';
import LinksTable from './LinksTable';

interface DashboardTabProps {
  requestId: string;
}

export default function DashboardTab({ requestId }: DashboardTabProps) {
  const [data, setData] = useState<TrackedLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/tracked-links?request_id=${requestId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail — keep showing last known data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
        <span style={{ fontSize: 13, color: '#737373' }}>Loading dashboard...</span>
      </div>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
        <BarChart3 size={40} color="#D1D1D6" />
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>No tracked links yet</p>
        <p style={{ fontSize: 13, color: '#737373', margin: 0, textAlign: 'center', maxWidth: 320 }}>
          Use the Link Builder to generate UTM-tracked links for each channel. Clicks will appear here automatically.
        </p>
      </div>
    );
  }

  const { summary, links } = data;
  const avgPerLink = summary.total_links > 0
    ? (summary.total_clicks / summary.total_links).toFixed(1)
    : '0.0';

  const stats = [
    { label: 'Total Links', value: summary.total_links },
    { label: 'Total Clicks', value: summary.total_clicks },
    { label: 'Avg / Link', value: avgPerLink },
    { label: 'Recruiters', value: summary.recruiter_count },
    { label: 'Channels', value: summary.channel_count },
  ];

  return (
    <div>
      {/* 5-stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              border: '1px solid #E8E8EA',
              padding: 14,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.2 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
        {/* Clicks by Channel */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E5E5', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 14 }}>
            Clicks by Channel
          </div>
          <ChannelBarChart links={links} />
        </div>

        {/* Top Performers */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E5E5', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 14 }}>
            Top Performers
          </div>
          <TopPerformers links={links} />
        </div>
      </div>

      {/* Full links table */}
      <LinksTable links={links} />

      {/* Footer */}
      <div style={{ fontSize: 10, color: '#737373', textAlign: 'center', marginTop: 16 }}>
        Updates every 30 seconds · Click counts include all redirects since creation
      </div>
    </div>
  );
}
