interface KbdProps {
  children: string;
}

export function Kbd({ children }: KbdProps) {
  return <kbd className="kbd">{children}</kbd>;
}
