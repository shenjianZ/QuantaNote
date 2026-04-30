interface TagPillProps {
  tag: { name: string; color: string };
}

export function TagPill({ tag }: TagPillProps) {
  return <span className={`tag tag-${tag.color}`}>#{tag.name}</span>;
}
