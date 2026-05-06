type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export function KpiCard({ label, value, hint, tone = "neutral" }: KpiCardProps) {
  return (
    <section className={`kpi kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </section>
  );
}
