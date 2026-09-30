import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="empty-state">
      <h2 className="empty-state-title">{title}</h2>
      {description ? <div className="empty-state-description">{description}</div> : null}
      {action ? <div className="empty-state-actions">{action}</div> : null}
    </div>
  );
}
