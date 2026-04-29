pub fn prefixed_id(prefix: &str, seed: &str) -> String {
    let normalized = seed
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();
    format!("{}-{}", prefix, normalized.trim_matches('-'))
}
