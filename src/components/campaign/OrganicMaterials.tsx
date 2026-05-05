'use client';

import { useState } from 'react';
import { FileText, Image, Printer, Link2, Copy, Check, Download } from 'lucide-react';

interface Asset {
  id: string;
  asset_type: string;
  platform: string;
  language: string;
  country: string | null;
  content: Record<string, unknown> | null;
  copy_data: Record<string, unknown> | null;
  blob_url?: string | null;
}

interface OrganicMaterialsProps {
  assets: Asset[];
  requestId: string;
}

const TABS = [
  { key: 'job_posts', label: 'Job Posts', icon: FileText },
  { key: 'social', label: 'Social', icon: Image },
  { key: 'flyers', label: 'Flyers', icon: Printer },
  { key: 'links', label: 'Tracked Links', icon: Link2 },
] as const;

export function OrganicMaterials({ assets, requestId }: OrganicMaterialsProps) {
  const [activeTab, setActiveTab] = useState<string>('job_posts');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const wpPosts = assets.filter(a => a.asset_type === 'wp_job_post');
  const portalCopy = assets.filter(a => a.asset_type === 'job_portal_copy');
  const socialGraphics = assets.filter(a => a.asset_type === 'social_graphic');
  const socialCaptions = assets.filter(a => a.asset_type === 'social_caption');
  const flyers = assets.filter(a => a.asset_type === 'flyer');
  const flyerCopies = assets.filter(a => a.asset_type === 'flyer_copy');

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-[#E5E5E5] pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#32373C] text-white'
                  : 'text-[#737373] hover:bg-[#F5F5F5]'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'job_posts' && (
        <div className="space-y-4">
          {wpPosts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">WordPress Posts</h4>
              <div className="grid gap-3">
                {wpPosts.map(asset => {
                  const content = (asset.content || {}) as Record<string, string>;
                  return (
                    <div key={asset.id} className="card p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">{content.title || 'Untitled Post'}</h5>
                        <span className="badge">{asset.country}</span>
                      </div>
                      <p className="text-sm text-[#737373] mb-2">{content.intro}</p>
                      <button
                        onClick={() => handleCopy(JSON.stringify(content, null, 2), asset.id)}
                        className="btn-secondary text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === asset.id ? 'Copied' : 'Copy All'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {portalCopy.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">Job Portal Copy</h4>
              <div className="grid gap-3">
                {portalCopy.map(asset => {
                  const content = (asset.content || {}) as Record<string, string>;
                  return (
                    <div key={asset.id} className="card p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="badge">{asset.platform}</span>
                        <span className="text-xs text-[#737373]">{asset.country}</span>
                      </div>
                      <p className="text-sm text-[#1A1A1A]">{content.title}</p>
                      <button
                        onClick={() => handleCopy(content.body || JSON.stringify(content), asset.id)}
                        className="btn-secondary text-xs flex items-center gap-1 mt-2 cursor-pointer"
                      >
                        {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                        Copy
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {wpPosts.length === 0 && portalCopy.length === 0 && (
            <p className="text-sm text-[#737373]">No job posts generated yet.</p>
          )}
        </div>
      )}

      {activeTab === 'social' && (
        <div className="space-y-4">
          {socialGraphics.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">Social Graphics</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {socialGraphics.map(asset => {
                  const content = (asset.content || {}) as Record<string, unknown>;
                  const htmlContent = typeof content.html === 'string' ? content.html : undefined;
                  return (
                    <div key={asset.id} className="card p-3">
                      <div className="aspect-square bg-[#F5F5F5] rounded-lg mb-2 overflow-hidden">
                        {htmlContent && (
                          <iframe
                            srcDoc={htmlContent}
                            className="w-full h-full border-0 pointer-events-none"
                            sandbox=""
                          />
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#737373]">{asset.platform}</span>
                        <span className="badge text-xs">{asset.country}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {socialCaptions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">Captions</h4>
              <div className="grid gap-3">
                {socialCaptions.map(asset => {
                  const content = (asset.content || {}) as Record<string, string>;
                  const caption = content.caption || '';
                  return (
                    <div key={asset.id} className="card p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="badge">{asset.platform}</span>
                        <span className="text-xs text-[#737373]">{asset.country}</span>
                      </div>
                      <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{caption.slice(0, 200)}{caption.length > 200 ? '...' : ''}</p>
                      <button
                        onClick={() => handleCopy(caption, asset.id)}
                        className="btn-secondary text-xs flex items-center gap-1 mt-2 cursor-pointer"
                      >
                        {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                        Copy Caption
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {socialGraphics.length === 0 && socialCaptions.length === 0 && (
            <p className="text-sm text-[#737373]">No social content generated yet.</p>
          )}
        </div>
      )}

      {activeTab === 'flyers' && (
        <div className="space-y-4">
          {flyers.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {flyers.map(asset => {
                const content = (asset.content || {}) as Record<string, unknown>;
                const htmlContent = typeof content.html === 'string' ? content.html : undefined;
                return (
                  <div key={asset.id} className="card p-4">
                    <div className="aspect-[3/4] bg-[#F5F5F5] rounded-lg mb-3 overflow-hidden">
                      {htmlContent && (
                        <iframe
                          srcDoc={htmlContent}
                          className="w-full h-full border-0 pointer-events-none"
                          sandbox=""
                        />
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="badge">{asset.country}</span>
                        <span className="text-xs text-[#737373] ml-2">QR → {(content.qr_destination as string)?.slice(0, 40)}...</span>
                      </div>
                      <button className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">No flyers generated yet.</p>
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="card p-4">
          <p className="text-sm text-[#737373]">Tracked links per locale will appear here after generation.</p>
        </div>
      )}
    </div>
  );
}
