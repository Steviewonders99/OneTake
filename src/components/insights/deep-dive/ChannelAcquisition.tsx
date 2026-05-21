'use client';

import { type ReactNode } from 'react';
import { FaFacebook, FaLinkedin, FaReddit, FaTiktok, FaYoutube, FaHandshake, FaFlipboard } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiGoogleads, SiBrevo, SiIndeed, SiNextdoor } from 'react-icons/si';
import { Search } from 'lucide-react';
import { RiRobot2Fill, RiMailLine, RiGlobalLine, RiMegaphoneLine, RiUserSearchLine } from 'react-icons/ri';
import { BRAND } from '../command-center/types';

interface SourceRow {
  source: string;
  medium: string;
  wp_entry: number;
  apply_click: number;
  nda_signed: number;
  doing_tasks: number;
}

interface ChannelAcquisitionProps {
  sources: SourceRow[];
  dateLabel?: string;
}

const MEDIUM_COLOR: Record<string, string> = {
  cpc: BRAND.blue, paid: BRAND.blue, paidsocial: BRAND.blue,
  social: BRAND.purple, organic: BRAND.purple,
  job_board: BRAND.amber, email: BRAND.pink, referral: BRAND.rose,
  flyer: '#A855F7', '(none)': '#6B7280', unattributed: '#9CA3AF',
};

interface ChannelMeta { label: string; icon: ReactNode; color: string }

function getChannelMeta(source: string): ChannelMeta {
  const s = source.toLowerCase();
  if (s === 'facebook' || s === 'fb') return { label: 'Facebook', icon: <FaFacebook size={14} />, color: '#1877F2' };
  if (s.includes('linkedin')) return { label: s.includes('inmail') ? 'LinkedIn InMail' : s.includes('post') ? 'LinkedIn Post' : 'LinkedIn', icon: <FaLinkedin size={14} />, color: '#0A66C2' };
  if (s === 'google' || s === 'google_organic') return { label: 'Google', icon: <SiGoogleads size={13} />, color: '#4285F4' };
  if (s === 'bing') return { label: 'Bing', icon: <Search size={13} />, color: '#008373' };
  if (s.includes('reddit')) return { label: 'Reddit', icon: <FaReddit size={14} />, color: '#FF4500' };
  if (s.includes('tiktok')) return { label: 'TikTok', icon: <FaTiktok size={13} />, color: '#000000' };
  if (s.includes('youtube')) return { label: 'YouTube', icon: <FaYoutube size={14} />, color: '#FF0000' };
  if (s.includes('twitter') || s === 't.co') return { label: 'X / Twitter', icon: <FaXTwitter size={13} />, color: '#000000' };
  if (s.includes('chatgpt')) return { label: 'ChatGPT', icon: <RiRobot2Fill size={14} />, color: '#10A37F' };
  if (s.includes('gemini')) return { label: 'Gemini', icon: <RiRobot2Fill size={14} />, color: '#8E75B2' };
  if (s === 'brevo' || s === 'brevo email' || s === 'sendinblue') return { label: 'Brevo Email', icon: <SiBrevo size={13} />, color: '#0B996E' };
  if (s === 'email') return { label: 'Email', icon: <RiMailLine size={14} />, color: BRAND.pink };
  if (s === 'handshake') return { label: 'Handshake', icon: <FaHandshake size={14} />, color: '#FF7A59' };
  if (s === 'indeed') return { label: 'Indeed', icon: <SiIndeed size={13} />, color: '#2164F3' };
  if (s === 'career_builder') return { label: 'CareerBuilder', icon: <RiUserSearchLine size={14} />, color: '#6A0DAD' };
  if (s === 'nextdoor') return { label: 'Nextdoor', icon: <SiNextdoor size={13} />, color: '#8ED500' };
  if (s === 'paid_media') return { label: 'Paid Media', icon: <RiMegaphoneLine size={14} />, color: BRAND.blue };
  if (s === 'flyers') return { label: 'Flyers', icon: <FaFlipboard size={13} />, color: '#E12828' };
  if (s === '(direct)') return { label: 'Direct', icon: <RiGlobalLine size={14} />, color: '#6B7280' };
  if (s === '(other)') return { label: 'Other / Direct', icon: <RiGlobalLine size={14} />, color: '#9CA3AF' };
  if (s === 'internal' || s === 'oneforma.com' || s === 'on-site') return { label: 'Internal', icon: <RiGlobalLine size={14} />, color: '#6B7280' };
  if (s === '(not set)') return { label: '(not set)', icon: <RiGlobalLine size={14} />, color: '#D1D5DB' };
  return { label: source, icon: <RiGlobalLine size={14} />, color: BRAND.purple };
}

function barColor(medium: string): string {
  return MEDIUM_COLOR[medium.toLowerCase().replace(/[\s-]/g, '')] ?? BRAND.purple;
}

export function ChannelAcquisition({ sources, dateLabel }: ChannelAcquisitionProps) {
  if (!sources || sources.length === 0) return null;

  const sorted = [...sources].sort((a, b) => b.wp_entry - a.wp_entry);
  const maxEntry = sorted[0]?.wp_entry ?? 1;
  const totalEntry = sorted.reduce((s, r) => s + r.wp_entry, 0);
  const totalApps = sorted.reduce((s, r) => s + r.nda_signed, 0);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: "'Roboto', system-ui, sans-serif" }}>
      <div className="mb-5">
        <div className="text-sm font-bold leading-tight" style={{ color: BRAND.text }}>
          How People Found This Project
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>
          GA4 first-touch attribution · Unique users{dateLabel ? ` · ${dateLabel}` : ''}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* TOP — horizontal bars (full width) */}
        <div className="flex flex-col gap-[5px]">
          {sorted.filter(r => r.wp_entry > 0).map((row) => {
            const pct = totalEntry > 0 ? (row.wp_entry / totalEntry) * 100 : 0;
            const widthPct = maxEntry > 0 ? Math.max((row.wp_entry / maxEntry) * 100, 3) : 3;
            return (
              <div key={`${row.source}-${row.medium}`} className="flex items-center gap-2">
                <div className="w-[90px] text-right text-[11px] font-medium shrink-0 truncate"
                     style={{ color: BRAND.text2 }} title={`${row.source} / ${row.medium}`}>
                  {displaySource(row.source)}
                </div>
                <div className="flex-1 h-[24px] rounded-md relative" style={{ background: BRAND.bgRaised }}>
                  <div className="h-full rounded-md flex items-center justify-end px-2 transition-all duration-500"
                       style={{ width: `${widthPct}%`, background: barColor(row.medium), minWidth: 52 }}>
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                      {row.wp_entry.toLocaleString()}{' '}
                      <span className="font-normal opacity-80">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM — attribution table (full width) */}
        <div className="overflow-hidden rounded-xl border border-black/[0.06]">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: BRAND.bgRaised }}>
                {['Source / Medium', 'Page Views', 'Applications', 'CVR'].map((h) => (
                  <th key={h} className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2"
                      style={{ color: BRAND.text3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const cvr = row.wp_entry > 0 ? ((row.nda_signed / row.wp_entry) * 100) : 0;
                return (
                  <tr key={`${row.source}-${row.medium}-tbl`}
                      className="border-t border-black/[0.04]"
                      style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-medium" style={{ color: BRAND.text2 }}>
                        {displaySource(row.source)}
                      </span>
                      <span className="text-[10px] ml-1" style={{ color: BRAND.text3 }}>
                        / {row.medium}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                      {row.wp_entry.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-bold tabular-nums" style={{ color: BRAND.text }}>
                      {row.nda_signed.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {cvr > 0 ? (
                        <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                              style={{ color: cvr > 1 ? BRAND.purple : BRAND.text2, background: cvr > 1 ? '#F5F3FF' : 'transparent' }}>
                          {cvr.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: BRAND.text3 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/[0.08]" style={{ background: BRAND.bgRaised }}>
                <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: BRAND.text2 }}>
                  TOTAL
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                  {totalEntry.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.purple }}>
                  {totalApps.toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: BRAND.text2 }}>
                    {totalEntry > 0 ? ((totalApps / totalEntry) * 100).toFixed(1) : '0'}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
