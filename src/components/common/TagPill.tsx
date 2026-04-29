import type { Tag } from "../../types";

interface TagPillProps {
  tag: Tag;
}

export function TagPill({ tag }: TagPillProps) {
  return <span className={`tag tag-${tag.color}`}>#{tag.name}</span>;
}
