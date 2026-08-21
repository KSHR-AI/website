import Link from "next/link";

type EmptyStateProps = Readonly<{
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}>;

export function EmptyState({
  actionHref,
  actionLabel,
  children,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p>{children}</p>
      {actionHref && actionLabel ? (
        <Link className="text-action" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
