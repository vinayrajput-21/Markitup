import Link from "next/link";

function Pin({
  n,
  className,
  tone = "brand",
}: {
  n: number;
  className: string;
  tone?: "brand" | "success";
}) {
  return (
    <span
      className={`absolute grid h-7 w-7 place-items-center rounded-full font-mono text-[0.8125rem] font-semibold text-white shadow-md ring-2 ring-white/70 ${className}`}
      style={{
        background:
          tone === "success" ? "var(--color-success)" : "var(--color-brand)",
      }}
    >
      {n}
    </span>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      {/* brand panel */}
      <section
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: "var(--color-brand)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2.5c-3.9 0-7 3-7 6.8 0 4.8 5.6 10.4 6.4 11.2.3.3.9.3 1.2 0 .8-.8 6.4-6.4 6.4-11.2 0-3.8-3.1-6.8-7-6.8Z" fill="#fff" opacity="0.3" />
              <circle cx="12" cy="9.2" r="2.6" fill="#fff" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">MarkUp</span>
        </div>

        <div className="relative">
          {/* faux mockup with pins, hinting the product */}
          <div className="relative mb-10 w-[78%] rounded-lg bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-[1px]">
            <div className="rounded-md bg-white/85 p-4">
              <div className="mb-3 h-2.5 w-24 rounded-full bg-brand/25" />
              <div className="mb-2 h-2 w-full rounded-full bg-ink/10" />
              <div className="mb-2 h-2 w-4/5 rounded-full bg-ink/10" />
              <div className="h-20 w-full rounded bg-brand/10" />
            </div>
            <Pin n={1} className="-left-3 top-8" />
            <Pin n={2} className="right-6 top-24" />
            <Pin n={3} className="bottom-4 left-16" tone="success" />
          </div>

          <h2 className="max-w-md text-3xl leading-tight font-extrabold tracking-tight">
            Feedback that lands exactly where it matters.
          </h2>
          <p className="mt-3 max-w-md text-base text-white/80">
            Upload a mockup, share a link, and let clients pin comments right on
            the design. No more guessing which button they meant.
          </p>
        </div>

        <p className="text-sm text-white/60">Apexure · Visual review, done right.</p>
      </section>

      {/* form */}
      <section className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: "var(--color-brand)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2.5c-3.9 0-7 3-7 6.8 0 4.8 5.6 10.4 6.4 11.2.3.3.9.3 1.2 0 .8-.8 6.4-6.4 6.4-11.2 0-3.8-3.1-6.8-7-6.8Z" fill="currentColor" opacity="0.25" />
                <circle cx="12" cy="9.2" r="2.6" fill="currentColor" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">MarkUp</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <p className="mt-6 text-sm text-muted">{footer}</p>
        </div>
      </section>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand transition-colors hover:text-brand-hover">
      {children}
    </Link>
  );
}
