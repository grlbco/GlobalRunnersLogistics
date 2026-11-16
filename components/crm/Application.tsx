import Link from "next/link";
import { clsx } from "clsx";
import type { Application } from "@/lib/crm/applications";
import { isConcern } from "@/lib/crm/applications";
import { ago } from "@/lib/crm/format";
import { Badge, Card, Label } from "./ui";

const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT";

/** "Open application" button: always a new window so the profile or board stays where it was. */
export function OpenApplication({ code, className, label = "Open application" }: { code: string; className?: string; label?: string }) {
  return (
    <a
      href={`/crm/applications/${code}`}
      target="_blank"
      rel="noopener"
      className={clsx("inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[0.8rem] font-medium text-fg-2 transition-colors hover:border-fg hover:text-fg", className)}
    >
      {label} <ExternalIcon />
    </a>
  );
}

/** Every answer, concerns in red. `columns` for the wide profile card. */
export function AnswerList({ app, columns = 1 }: { app: Application; columns?: 1 | 2 }) {
  if (!app.answers.length) return <p className="text-sm text-faint">The form was submitted, but no answers were saved with it.</p>;
  return (
    <dl className={clsx("grid gap-x-8", columns === 2 && "md:grid-cols-2")}>
      {app.answers.map((a) => {
        const bad = isConcern(a);
        return (
          <div key={a.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[0.875rem]">
            <dt className="text-muted">{a.label}</dt>
            <dd className={clsx("text-right font-medium", bad ? "text-red-600" : "text-fg")}>{a.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** The application card on a driver's profile. */
export function ApplicationCard({ app }: { app: Application }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Driver application</Label>
          <Badge dot tone="good">Submitted {ago(app.submittedAt)} ago</Badge>
          {app.concerns.length > 0 ? <Badge dot tone="bad">{app.concerns.length} to check</Badge> : <Badge dot tone="good">Meets requirements</Badge>}
        </div>
        <OpenApplication code={app.code} />
      </div>
      <div className="mt-3">
        <AnswerList app={app} columns={2} />
      </div>
    </Card>
  );
}

/** One row in Forms → Submitted forms. */
export function ApplicationRow({ app, stage }: { app: Application; stage?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
      <Link href={`/crm/contacts/${app.contactId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
        {app.name}
      </Link>
      {stage}
      {app.concerns.length > 0 ? <Badge dot tone="bad">{app.concerns.length} to check</Badge> : <Badge dot tone="good">Meets requirements</Badge>}
      <span className="w-36 text-right text-xs text-faint">{when(app.submittedAt)}</span>
      <OpenApplication code={app.code} label="Open" />
    </div>
  );
}
