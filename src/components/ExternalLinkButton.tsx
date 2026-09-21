import { Button } from "@fluentui/react-components";

type Props = {
  href: string;
  children: string;
  appearance?: "primary" | "secondary" | "subtle" | "transparent" | "outline";
};

export function ExternalLinkButton({ href, children, appearance }: Props) {
  if (!href) {
    return <Button appearance={appearance} disabled>{children}</Button>;
  }
  return (
    <Button as="a" appearance={appearance} href={href} target="_blank" rel="noreferrer">
      {children}
    </Button>
  );
}
