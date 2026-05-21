'use client';

import { type ReactNode } from 'react';
import { FaFacebook, FaLinkedin, FaReddit, FaTiktok, FaYoutube, FaHandshake, FaFlipboard } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiGoogleads, SiBrevo, SiIndeed, SiNextdoor } from 'react-icons/si';
import { RiRobot2Fill, RiMailLine, RiGlobalLine, RiMegaphoneLine, RiUserSearchLine } from 'react-icons/ri';
import { BRAND } from './command-center/types';

export interface ChannelMeta { label: string; icon: ReactNode; color: string }

export function getChannelMeta(source: string): ChannelMeta {
  const s = source.toLowerCase();
  if (s === 'facebook' || s === 'fb') return { label: 'Facebook', icon: <FaFacebook size={14} />, color: '#1877F2' };
  if (s.includes('linkedin')) return { label: s.includes('inmail') ? 'LinkedIn InMail' : s.includes('post') ? 'LinkedIn Post' : 'LinkedIn', icon: <FaLinkedin size={14} />, color: '#0A66C2' };
  if (s === 'google' || s === 'google_organic') return { label: 'Google', icon: <SiGoogleads size={13} />, color: '#4285F4' };
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
  if (s === 'meta') return { label: 'Meta', icon: <FaFacebook size={14} />, color: '#1877F2' };
  if (s === 'flyers') return { label: 'Flyers', icon: <FaFlipboard size={13} />, color: '#E12828' };
  if (s === 'bing') return { label: 'Bing', icon: <SiGoogleads size={13} />, color: '#008373' };
  if (s === '(direct)') return { label: 'Direct', icon: <RiGlobalLine size={14} />, color: '#6B7280' };
  if (s === '(other)') return { label: 'Other / Direct', icon: <RiGlobalLine size={14} />, color: '#9CA3AF' };
  if (s === 'internal' || s === 'oneforma.com' || s === 'on-site' || s === 'adiafrom') return { label: 'Internal', icon: <RiGlobalLine size={14} />, color: '#6B7280' };
  if (s === '(not set)') return { label: '(not set)', icon: <RiGlobalLine size={14} />, color: '#D1D5DB' };
  if (s === 'social') return { label: 'Social', icon: <FaLinkedin size={14} />, color: '#0A66C2' };
  if (s === 'job_board') return { label: 'Job Board', icon: <FaHandshake size={14} />, color: '#FF7A59' };
  return { label: source, icon: <RiGlobalLine size={14} />, color: BRAND.purple };
}
