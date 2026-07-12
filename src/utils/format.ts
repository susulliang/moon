// ============================================================================
// Number / time formatting helpers
// ============================================================================

export function fmtNum(v: number, digits = 0): string {
  if (!isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (abs >= 10_000) return (v / 1000).toFixed(1) + "k";
  if (abs >= 1000) return Math.round(v).toString();
  if (abs >= 100) return Math.round(v).toString();
  if (abs >= 1) return v.toFixed(Math.min(digits, 1));
  if (abs > 0) return v.toFixed(2);
  return "0";
}

export function fmtRate(v: number): string {
  if (Math.abs(v) < 0.01) return "0";
  const sign = v > 0 ? "+" : "";
  return sign + fmtNum(v, 1);
}

export function fmtTime(simHours: number): string {
  const totalHours = Math.floor(simHours);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `D${days.toString().padStart(3, "0")}·${hours.toString().padStart(2, "0")}h`;
}

export function fmtClock(simHours: number): string {
  const totalHours = Math.floor(simHours);
  const years = Math.floor(totalHours / (365 * 24));
  const daysOfYear = Math.floor((totalHours - years * 365 * 24) / 24);
  const hours = totalHours % 24;
  if (years > 0) return `Y${years}·D${daysOfYear.toString().padStart(3, "0")}·${hours.toString().padStart(2, "0")}`;
  return `D${daysOfYear.toString().padStart(3, "0")}·${hours.toString().padStart(2, "0")}`;
}
