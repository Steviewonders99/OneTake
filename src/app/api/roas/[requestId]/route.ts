import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = await params;
  const sql = getDb();

  const configs = await sql`
    SELECT country, rpp, net_rpp, fulfillment_rate, recognition_rate,
           cpa_target_pct, budget_multiplier, target_cpa, breakeven_cpa,
           recommended_budget, contract_value, required_participants,
           variable_cost_per_participant
    FROM roas_config
    WHERE request_id = ${requestId}
    ORDER BY country
  ` as any[];

  const metrics = await sql`
    SELECT country,
           SUM(spend) as total_spend,
           SUM(conversions) as total_conversions,
           SUM(signups) as total_signups,
           SUM(profile_completes) as total_completes
    FROM normalized_daily_metrics
    WHERE request_id = ${requestId}
    GROUP BY country
  ` as any[];

  const metricsMap = new Map(
    metrics.map((m: any) => [m.country, m])
  );

  const countries = configs.map((config: any) => {
    const actuals = metricsMap.get(config.country);
    const result: any = {
      country: config.country,
      rpp: Number(config.rpp),
      net_rpp: Number(config.net_rpp),
      target_cpa: Number(config.target_cpa),
      breakeven_cpa: Number(config.breakeven_cpa),
      recommended_budget: Number(config.recommended_budget),
      fulfillment_rate: Number(config.fulfillment_rate),
      recognition_rate: Number(config.recognition_rate),
    };

    if (actuals && Number(actuals.total_completes) > 0) {
      const spend = Number(actuals.total_spend);
      const completes = Number(actuals.total_completes);
      const fr = Number(config.fulfillment_rate);
      const netRpp = Number(config.net_rpp);

      result.actual_cpa = Math.round((spend / completes) * 100) / 100;
      result.effective_cpa = fr > 0 ? Math.round((spend / (completes * fr)) * 100) / 100 : null;
      result.roas = spend > 0 ? Math.round((completes * fr * netRpp / spend) * 10000) / 10000 : null;
      result.roi_pct = result.roas ? Math.round((result.roas - 1) * 1000) / 10 : null;
      result.ad_spend = spend;
      result.completions = completes;

      if (result.actual_cpa <= result.target_cpa) result.health = 'excellent';
      else if (result.actual_cpa <= result.breakeven_cpa) result.health = 'acceptable';
      else result.health = 'unprofitable';
    }

    return result;
  });

  return Response.json({ countries });
}
