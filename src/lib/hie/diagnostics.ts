/**
 * HIE Diagnostics — 5 deterministic CRO detectors.
 */

import { getDb } from '@/lib/db';

export interface DiagnosticObservation {
  type: 'scroll_cliff' | 'cta_weakness' | 'form_friction' | 'platform_mismatch' | 'ignored_section';
  confidence: 'high' | 'medium' | 'low';
  message: string;
  detail: Record<string, unknown>;
  recommended_action: string;
}

export async function runDiagnostics(pageUrl: string): Promise<DiagnosticObservation[]> {
  const observations: DiagnosticObservation[] = [];
  const sql = getDb();

  // 1. Scroll Cliff — >30% drop between consecutive milestones
  const milestones = await sql`
    SELECT milestone, COUNT(DISTINCT session_id)::int as sessions
    FROM hie_scroll_events
    WHERE page_url = ${pageUrl} AND milestone IS NOT NULL
    GROUP BY milestone ORDER BY milestone
  `;

  if (milestones.length >= 2) {
    const ms = milestones as { milestone: number; sessions: number }[];
    for (let i = 1; i < ms.length; i++) {
      const prev = ms[i - 1];
      const curr = ms[i];
      if (prev.sessions > 0) {
        const dropPct = Math.round(((prev.sessions - curr.sessions) / prev.sessions) * 100);
        if (dropPct > 30) {
          observations.push({
            type: 'scroll_cliff',
            confidence: prev.sessions >= 100 ? 'high' : prev.sessions >= 30 ? 'medium' : 'low',
            message: `${dropPct}% of users drop off between ${prev.milestone}% and ${curr.milestone}% scroll depth`,
            detail: { from_milestone: prev.milestone, to_milestone: curr.milestone, drop_pct: dropPct, sessions_before: prev.sessions, sessions_after: curr.sessions },
            recommended_action: `Review content at the ${prev.milestone}-${curr.milestone}% scroll zone — consider moving key information or CTAs above this point`,
          });
        }
      }
    }
  }

  // 2. CTA Weakness — CTAs with hover/proximity but low click rate
  const ctaEvents = await sql`
    SELECT element_selector, element_tag,
      COUNT(*) FILTER (WHERE event_type = 'cta_click')::int as clicks,
      COUNT(*) FILTER (WHERE event_type = 'mousemove_sample')::int as hovers,
      COUNT(DISTINCT session_id)::int as sessions
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND (event_type = 'cta_click' OR (event_type = 'mousemove_sample' AND element_tag IN ('button', 'a')))
    GROUP BY element_selector, element_tag
    HAVING COUNT(*) FILTER (WHERE event_type = 'mousemove_sample') > 5
  `;

  for (const row of ctaEvents) {
    const cta = row as { element_selector: string; element_tag: string; clicks: number; hovers: number; sessions: number };
    if (cta.hovers > 10 && cta.clicks === 0) {
      observations.push({
        type: 'cta_weakness',
        confidence: cta.sessions >= 30 ? 'medium' : 'low',
        message: `CTA "${cta.element_selector}" gets attention (${cta.hovers} hovers) but 0 clicks`,
        detail: { selector: cta.element_selector, hovers: cta.hovers, clicks: cta.clicks },
        recommended_action: 'Review CTA copy, color contrast, and positioning — users notice it but don\'t engage',
      });
    }
  }

  // 3. Form Friction — high abandonment
  const formEvents = await sql`
    SELECT
      COUNT(*) FILTER (WHERE event_data->>'action' = 'focus')::int as form_starts,
      COUNT(*) FILTER (WHERE event_data->>'action' = 'submit')::int as form_submits,
      COUNT(DISTINCT session_id)::int as sessions
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND event_type = 'form_interaction'
  `;

  if (formEvents.length > 0) {
    const form = formEvents[0] as { form_starts: number; form_submits: number; sessions: number };
    if (form.form_starts > 5 && form.form_submits === 0) {
      observations.push({
        type: 'form_friction',
        confidence: form.sessions >= 30 ? 'high' : 'medium',
        message: `${form.form_starts} users started the form but 0 submitted — 100% abandonment`,
        detail: { starts: form.form_starts, submits: form.form_submits },
        recommended_action: 'Simplify the form — reduce fields, add progress indicators, or check for validation errors',
      });
    } else if (form.form_starts > 10 && form.form_submits > 0) {
      const abandonRate = Math.round(((form.form_starts - form.form_submits) / form.form_starts) * 100);
      if (abandonRate > 70) {
        observations.push({
          type: 'form_friction',
          confidence: form.sessions >= 30 ? 'high' : 'medium',
          message: `${abandonRate}% form abandonment rate (${form.form_starts} starts, ${form.form_submits} submits)`,
          detail: { starts: form.form_starts, submits: form.form_submits, abandon_rate: abandonRate },
          recommended_action: 'High form friction detected — consider reducing required fields or adding inline validation',
        });
      }
    }
  }

  // 4. Platform Mismatch — mobile vs desktop behavior divergence
  const deviceSessions = await sql`
    SELECT s.device_type, COUNT(DISTINCT s.session_id)::int as sessions,
      COUNT(DISTINCT e.id)::int as events
    FROM hie_sessions s
    LEFT JOIN hie_interaction_events e ON e.session_id = s.session_id AND e.page_url = ${pageUrl}
    WHERE s.device_type IN ('mobile', 'desktop')
    GROUP BY s.device_type
  `;

  if (deviceSessions.length >= 2) {
    const devices = deviceSessions as { device_type: string; sessions: number; events: number }[];
    const mobile = devices.find(d => d.device_type === 'mobile');
    const desktop = devices.find(d => d.device_type === 'desktop');
    if (mobile && desktop && mobile.sessions > 5 && desktop.sessions > 5) {
      const mobileEngRate = mobile.events / mobile.sessions;
      const desktopEngRate = desktop.events / desktop.sessions;
      if (desktopEngRate > 0 && mobileEngRate / desktopEngRate < 0.4) {
        observations.push({
          type: 'platform_mismatch',
          confidence: (mobile.sessions + desktop.sessions) >= 60 ? 'medium' : 'low',
          message: `Mobile engagement is ${Math.round((mobileEngRate / desktopEngRate) * 100)}% of desktop — potential mobile UX issue`,
          detail: { mobile_rate: Math.round(mobileEngRate * 10) / 10, desktop_rate: Math.round(desktopEngRate * 10) / 10 },
          recommended_action: 'Review mobile layout — check CTA visibility, form usability, and content reflow',
        });
      }
    }
  }

  return observations;
}
