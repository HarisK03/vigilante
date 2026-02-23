// app/settings/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings • DispatchNow",
};

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold tracking-wide text-[#D9D9D9]">{title}</div>
      {sub ? <div className="mt-1 text-xs text-[#D9D9D9]/60">{sub}</div> : null}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr] md:items-center">
      <div>
        <div className="text-sm font-medium text-[#D9D9D9]">{label}</div>
        {hint ? <div className="text-xs text-[#D9D9D9]/55">{hint}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#D9D9D9]",
        "placeholder:text-[#D9D9D9]/35 outline-none",
        "focus:border-[#D9D9D9]/25 focus:bg-white/7",
      ].join(" ")}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#D9D9D9]",
        "outline-none focus:border-[#D9D9D9]/25 focus:bg-white/7",
      ].join(" ")}
    >
      {props.children}
    </select>
  );
}

export default function SettingsPage() {
  const username = "user";
  const email = "user@example.com";
  const tier: 1 | 2 | 3 = 1;

  return (
    <main className="min-h-screen overflow-y-auto bg-[#0b0b0c] text-[#D9D9D9]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-bold text-[#D9D9D9]">Settings</div>
            <div className="mt-1 text-sm text-[#D9D9D9]/55">
              Manage your account preferences.
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full border border-white/10 bg-[#8B000D] px-4 py-2 text-sm text-white hover:brightness-110 transition"
            >
              Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-5">
              <SectionTitle
                title="Account"
                sub="Basic identity details and role tier."
              />

              <div className="space-y-4">
                <Row label="Username" hint="Public handle used in URLs.">
                  <Input value={username} onChange={() => {}} />
                </Row>

                <Row label="Email" hint="Used for login and notifications.">
                  <Input value={email} onChange={() => {}} />
                </Row>

                <Row label="Tier" hint="Determines permissions.">
                  <Select value={tier} onChange={() => {}}>
                    <option value={1}>Citizen</option>
                    <option value={2}>Volunteer</option>
                    <option value={3}>Authority</option>
                  </Select>
                </Row>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-5">
              <SectionTitle
                title="Accessibility"
                sub="Visual preferences to make the UI easier to use."
              />

              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition"
                >
                  <div className="text-sm font-bold text-[#D9D9D9]">Bold text</div>
                  <div className="mt-1 text-xs text-[#D9D9D9]/55">
                    Enable heavier font weight across the app.
                  </div>
                </button>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-sm font-semibold text-[#D9D9D9]">Colorblind mode</div>
                  <div className="mt-1 text-xs text-[#D9D9D9]/55">TODO</div>
                </div>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-5">
              <SectionTitle
                title="Security"
                sub="Password and session-related actions."
              />

              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition"
                >
                  <div className="text-sm font-semibold text-[#D9D9D9]">Reset password</div>
                  <div className="mt-1 text-xs text-[#D9D9D9]/55">
                    Send a reset email to your account.
                  </div>
                </button>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition"
                >
                  <div className="text-sm font-semibold text-[#D9D9D9]">Log out</div>
                  <div className="mt-1 text-xs text-[#D9D9D9]/55">
                    End the current session.
                  </div>
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-5">
              <SectionTitle title="Danger zone" sub="Irreversible actions." />

              <button
                type="button"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition"
              >
                <div className="text-sm font-semibold text-[#D9D9D9]">Delete account</div>
                <div className="mt-1 text-xs text-[#D9D9D9]/55">TODO</div>
              </button>
            </section>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-[#D9D9D9]/45">
          DispatchNow • settings
        </div>
      </div>
    </main>
  );
}