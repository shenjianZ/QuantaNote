pub fn new_id(prefix: &str) -> String {
    let uuid = uuid::Uuid::new_v4();
    let short = &uuid.to_string().replace('-', "")[..16];
    format!("{}-{}", prefix, short)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_id_starts_with_prefix() {
        assert!(new_id("item").starts_with("item-"));
        assert!(new_id("ver").starts_with("ver-"));
        assert!(new_id("att").starts_with("att-"));
    }

    #[test]
    fn new_id_has_correct_length() {
        let id = new_id("item");
        assert_eq!(id.len(), "item-".len() + 16);
    }

    #[test]
    fn new_id_generates_unique_ids() {
        let ids: std::collections::HashSet<String> = (0..100).map(|_| new_id("item")).collect();
        assert_eq!(ids.len(), 100);
    }
}
