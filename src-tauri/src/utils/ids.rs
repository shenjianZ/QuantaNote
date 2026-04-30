pub fn new_id(prefix: &str) -> String {
    let uuid = uuid::Uuid::new_v4();
    let short = &uuid.to_string().replace('-', "")[..12];
    format!("{}-{}", prefix, short)
}
