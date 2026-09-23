import type { ReactNode } from "react";
import { Text, Title1 } from "@fluentui/react-components";

type Props = { title: string; subtitle: string; actions?: ReactNode };

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="topbar">
      <div><Title1>{title}</Title1><div className="subtitle">{subtitle}</div></div>
      {actions ? <div className="headerActions">{actions}</div> : null}
    </header>
  );
}
