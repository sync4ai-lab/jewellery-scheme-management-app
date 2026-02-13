// Modularized XIRR calculation for /c/pulse

export function computeXirr(cashflows: { amount: number; date: string }[]): number | null {
  if (cashflows.length < 2) return null;
  const hasPositive = cashflows.some((flow) => flow.amount > 0);
  const hasNegative = cashflows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const baseDate = new Date(cashflows[0].date);
  const yearFractions = cashflows.map((flow) => {
    const days = (new Date(flow.date).getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
    return days / 365;
  });

  let rate = 0.1;
  for (let i = 0; i < 50; i += 1) {
    let f = 0;
    let df = 0;

    for (let j = 0; j < cashflows.length; j += 1) {
      const t = yearFractions[j];
      const denom = Math.pow(1 + rate, t);
      f += cashflows[j].amount / denom;
      df += -t * cashflows[j].amount / (denom * (1 + rate));
    }

    if (Math.abs(f) < 1e-6) return rate;
    if (Math.abs(df) < 1e-10) return null;

    const nextRate = rate - f / df;
    if (nextRate <= -0.9999 || !Number.isFinite(nextRate)) return null;
    rate = nextRate;
  }

  return null;
}
