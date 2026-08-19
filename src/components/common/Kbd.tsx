interface KbdProps {
  children: string;
  plain?: boolean;
}

export function Kbd({ children, plain = false }: KbdProps) {
  return <kbd className={`kbd${plain ? " kbd-plain" : ""}`}>{children}</kbd>;
}
