// app/dashboard/citizen/page.tsx
import Link from "next/link";
import Sidebar from "@/util/sidebar";

function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const tierText = tier === 1 ? "Citizen" : tier === 2 ? "Volunteer" : "Authority";
  return (
    <span
      className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium"
      style={{
        color: tier === 1 ? "#34D399" : tier === 2 ? "#FF9F1A" : "#FFFFFF",
        background: tier === 3 ? "#8B000D" : "rgba(255,255,255,0.06)",
      }}
    >
      {tierText}
    </span>
  );
}

function PillButton({
  children,
  href,
  variant = "ghost",
}: {
  children: React.ReactNode;
  href?: string;
  variant?: "ghost" | "red";
}) {
  const cls = [
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-medium transition whitespace-nowrap",
    variant === "red"
      ? "border-transparent bg-[#8B000D] text-white hover:brightness-110"
      : "border-white/10 bg-white/5 text-white hover:bg-white/10",
  ].join(" ");
  return href ? <Link href={href} className={cls}>{children}</Link> : <button type="button" className={cls}>{children}</button>;
}

function WideButton({
  children,
  href,
  variant = "ghost",
}: {
  children: React.ReactNode;
  href?: string;
  variant?: "ghost" | "red";
}) {
  const cls = [
    "flex w-full items-center justify-center rounded-xl border px-6 py-4 text-sm font-medium transition",
    variant === "red"
      ? "border-transparent bg-[#8B000D] text-white hover:brightness-110"
      : "border-white/10 bg-white/[0.04] text-[#D9D9D9] hover:bg-white/10",
  ].join(" ");
  return href ? <Link href={href} className={cls}>{children}</Link> : <button type="button" className={cls}>{children}</button>;
}

function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
      <div>
        <p className="text-sm font-semibold text-[#D9D9D9]">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-[#D9D9D9]/45">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-4 text-center">
      <span className="text-3xl font-extrabold text-[#D9D9D9]">{value}</span>
      <span className="mt-1 text-xs text-[#D9D9D9]/45">{label}</span>
    </div>
  );
}

export default function CitizenDashboardPage() {
  const SIDEBAR_W = 84;
  const username = "arshin";
  const tier: 1 | 2 | 3 = 1;
  const myReportsCount = 0;
  const myIncidentsCount = 0;
  const myRequestsCount: number | string = "—";

  return (
    <main className="relative h-screen overflow-hidden bg-[#0b0b0c] text-[#D9D9D9]">
      <Sidebar activeHref="/dashboard" />

      <div
        className="absolute bottom-0 right-0 top-0 flex flex-col gap-4 p-5"
        style={{ left: SIDEBAR_W }}
      >

        {/* ── Header ── */}
        <header className="flex shrink-0 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#D9D9D9]/40">
              Citizen dashboard
            </p>
            <div className="mt-0.5 flex items-baseline gap-2.5">
              <h1 className="text-3xl font-extrabold text-[#D9D9D9]">My Activity</h1>
              <span className="text-base text-[#D9D9D9]/45">@{username}</span>
            </div>
            <div className="mt-2.5">
              <TierBadge tier={tier} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PillButton href={`/profile/${username}`}>View Profile</PillButton>
            <PillButton href="/report/new" variant="red">Create Report</PillButton>
          </div>
        </header>

        {/* ── 2 × 2 grid ── */}
        <div
          className="grid min-h-0 flex-1 gap-4"
          style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}
        >

          {/* Quick Actions */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <CardHeader
              title="Quick Actions"
              subtitle="Common things you'll do as a citizen."
              right={<PillButton href="/dashboard/citizen/shortcuts">Shortcuts</PillButton>}
            />
            {/* scrollable body */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
              <WideButton href="/report/new" variant="red">Create a new report</WideButton>
              <WideButton href="/incidents-catalog">Browse incident catalog</WideButton>
              <WideButton href="/reports-catalog">Browse reports catalog</WideButton>
            </div>
          </div>

          {/* Recent Reports */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <CardHeader
              title="Recent Reports"
              subtitle="Your latest submissions."
              right={<PillButton href="/reports-catalog">See all</PillButton>}
            />
            {/* scrollable body */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm font-semibold text-[#D9D9D9]">No reports yet</p>
                <p className="mt-1.5 text-xs text-[#D9D9D9]/45">
                  Create one to start tracking activity here.
                </p>
                <div className="mt-5">
                  <PillButton href="/report/new" variant="red">Create Report</PillButton>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <CardHeader title="Status" subtitle="Your recent activity summary." />
            {/* scrollable body */}
            <div className="flex flex-1 gap-4 overflow-y-auto p-6">
              <StatBox label="My reports" value={myReportsCount} />
              <StatBox label="My incidents" value={myIncidentsCount} />
              <StatBox label="Requests" value={myRequestsCount} />
            </div>
          </div>

          {/* Nearby Incidents */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <CardHeader
              title="Nearby Incidents"
              subtitle="Quick peek at what's active."
              right={<PillButton href="/incidents-catalog">Open</PillButton>}
            />
            {/* scrollable body */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm font-semibold text-[#D9D9D9]">None pinned</p>
                <p className="mt-1.5 text-xs text-[#D9D9D9]/45">
                  Browse the catalog to view details.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <p className="shrink-0 text-center text-[11px] text-[#D9D9D9]/25">
          DispatchNow • citizen dashboard
        </p>

      </div>
    </main>
  );
}