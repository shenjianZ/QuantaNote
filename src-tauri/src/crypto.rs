//! 本地 Vault 加密基础层。
//!
//! 该模块只提供经过成熟库组合的密钥派生、DEK 封装和记录加解密原语，
//! 不负责数据库迁移、锁定状态机或 UI。调用方接入前仍需完成完整的备份、
//! 迁移回滚和明文缓存清理流程。

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};

const ENVELOPE_VERSION: u8 = 1;
const DEK_SIZE: usize = 32;
const SALT_SIZE: usize = 16;
const NONCE_SIZE: usize = 24;
const AUTH_TAG_SIZE: usize = 16;
const KDF_MEMORY_COST_KIB: u32 = 64 * 1024;
const KDF_TIME_COST: u32 = 3;
const KDF_PARALLELISM: u32 = 1;
const MAX_KDF_MEMORY_COST_KIB: u32 = 1024 * 1024;
const MAX_KDF_TIME_COST: u32 = 10;
const MAX_KDF_PARALLELISM: u32 = 8;
const ALGORITHM: &str = "argon2id+xchacha20poly1305";
const DEK_AAD: &[u8] = b"quanta-note:v1:vault-dek";

/// 加密元数据。它可以持久化，但不能替代主密码，也不包含明文。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KeyEnvelope {
    pub version: u8,
    pub algorithm: String,
    pub memory_cost_kib: u32,
    pub time_cost: u32,
    pub parallelism: u32,
    pub salt: Vec<u8>,
    pub nonce: Vec<u8>,
    pub wrapped_dek: Vec<u8>,
}

/// 单条记录的加密信封。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EncryptedValue {
    pub version: u8,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

/// 进程内的 Vault Data Encryption Key。
///
/// 不实现 Clone，离开作用域时由 `zeroize` 清理其内存内容。
pub struct VaultKey(Zeroizing<[u8; DEK_SIZE]>);

impl std::fmt::Debug for VaultKey {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("VaultKey([REDACTED])")
    }
}

impl VaultKey {
    /// 返回只读密钥视图，调用方不应复制或长期保存该切片。
    pub fn as_bytes(&self) -> &[u8; DEK_SIZE] {
        &self.0
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("随机数生成失败: {0}")]
    Random(String),
    #[error("加密元数据无效: {0}")]
    InvalidEnvelope(String),
    #[error("密钥派生失败: {0}")]
    KeyDerivation(String),
    #[error("加密失败")]
    Encryption,
    #[error("解密失败，密码错误或数据已被篡改")]
    Decryption,
    #[error("序列化加密数据失败: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// 生成新的 DEK，并使用 Argon2id + XChaCha20-Poly1305 封装它。
pub fn create_vault(password: &str) -> Result<(VaultKey, KeyEnvelope), CryptoError> {
    let dek = random_array::<DEK_SIZE>()?;
    let salt = random_array::<SALT_SIZE>()?;
    let nonce = random_array::<NONCE_SIZE>()?;
    let envelope = KeyEnvelope {
        version: ENVELOPE_VERSION,
        algorithm: ALGORITHM.to_string(),
        memory_cost_kib: KDF_MEMORY_COST_KIB,
        time_cost: KDF_TIME_COST,
        parallelism: KDF_PARALLELISM,
        salt: salt.to_vec(),
        nonce: nonce.to_vec(),
        wrapped_dek: wrap_dek(password, &salt, &nonce, &dek)?,
    };
    Ok((VaultKey(Zeroizing::new(dek)), envelope))
}

/// 使用主密码解开持久化的 DEK 封装。
pub fn unlock_vault(password: &str, envelope: &KeyEnvelope) -> Result<VaultKey, CryptoError> {
    validate_envelope(envelope)?;
    let salt: [u8; SALT_SIZE] = envelope
        .salt
        .as_slice()
        .try_into()
        .map_err(|_| CryptoError::InvalidEnvelope("salt 长度无效".to_string()))?;
    let nonce: [u8; NONCE_SIZE] = envelope
        .nonce
        .as_slice()
        .try_into()
        .map_err(|_| CryptoError::InvalidEnvelope("nonce 长度无效".to_string()))?;
    let kek = derive_kek(password, &salt, envelope)?;
    let cipher =
        XChaCha20Poly1305::new_from_slice(kek.as_ref()).map_err(|_| CryptoError::Decryption)?;
    let plaintext = cipher
        .decrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: &envelope.wrapped_dek,
                aad: DEK_AAD,
            },
        )
        .map_err(|_| CryptoError::Decryption)?;
    let dek: [u8; DEK_SIZE] = plaintext.try_into().map_err(|_| CryptoError::Decryption)?;
    Ok(VaultKey(Zeroizing::new(dek)))
}

/// 使用 DEK 加密一条记录，并把记录身份绑定到认证数据 AAD。
pub fn encrypt_record(
    key: &VaultKey,
    record_type: &str,
    record_id: &str,
    field: &str,
    plaintext: &[u8],
) -> Result<EncryptedValue, CryptoError> {
    let nonce = random_array::<NONCE_SIZE>()?;
    let cipher =
        XChaCha20Poly1305::new_from_slice(key.as_bytes()).map_err(|_| CryptoError::Encryption)?;
    let aad = record_aad(record_type, record_id, field);
    let ciphertext = cipher
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: plaintext,
                aad: &aad,
            },
        )
        .map_err(|_| CryptoError::Encryption)?;
    Ok(EncryptedValue {
        version: ENVELOPE_VERSION,
        nonce: nonce.to_vec(),
        ciphertext,
    })
}

/// 解密记录；记录类型、ID 或字段名不一致时认证会失败。
pub fn decrypt_record(
    key: &VaultKey,
    record_type: &str,
    record_id: &str,
    field: &str,
    encrypted: &EncryptedValue,
) -> Result<Vec<u8>, CryptoError> {
    if encrypted.version != ENVELOPE_VERSION || encrypted.nonce.len() != NONCE_SIZE {
        return Err(CryptoError::InvalidEnvelope(
            "记录信封版本或 nonce 长度无效".to_string(),
        ));
    }
    let cipher =
        XChaCha20Poly1305::new_from_slice(key.as_bytes()).map_err(|_| CryptoError::Decryption)?;
    let aad = record_aad(record_type, record_id, field);
    cipher
        .decrypt(
            XNonce::from_slice(&encrypted.nonce),
            Payload {
                msg: &encrypted.ciphertext,
                aad: &aad,
            },
        )
        .map_err(|_| CryptoError::Decryption)
}

/// 将加密信封编码为 JSON，便于存入 Vault 元数据或逻辑备份。
pub fn serialize_envelope<T: Serialize>(value: &T) -> Result<String, CryptoError> {
    serde_json::to_string(value).map_err(CryptoError::from)
}

/// 从 JSON 解码加密信封。
pub fn deserialize_envelope<T: for<'de> Deserialize<'de>>(value: &str) -> Result<T, CryptoError> {
    serde_json::from_str(value).map_err(CryptoError::from)
}

fn wrap_dek(
    password: &str,
    salt: &[u8; SALT_SIZE],
    nonce: &[u8; NONCE_SIZE],
    dek: &[u8; DEK_SIZE],
) -> Result<Vec<u8>, CryptoError> {
    let envelope = KeyEnvelope {
        version: ENVELOPE_VERSION,
        algorithm: ALGORITHM.to_string(),
        memory_cost_kib: KDF_MEMORY_COST_KIB,
        time_cost: KDF_TIME_COST,
        parallelism: KDF_PARALLELISM,
        salt: salt.to_vec(),
        nonce: nonce.to_vec(),
        wrapped_dek: Vec::new(),
    };
    let kek = derive_kek(password, salt, &envelope)?;
    let cipher =
        XChaCha20Poly1305::new_from_slice(kek.as_ref()).map_err(|_| CryptoError::Encryption)?;
    cipher
        .encrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: dek,
                aad: DEK_AAD,
            },
        )
        .map_err(|_| CryptoError::Encryption)
}

fn derive_kek(
    password: &str,
    salt: &[u8; SALT_SIZE],
    envelope: &KeyEnvelope,
) -> Result<Zeroizing<[u8; DEK_SIZE]>, CryptoError> {
    let params = Params::new(
        envelope.memory_cost_kib,
        envelope.time_cost,
        envelope.parallelism,
        Some(DEK_SIZE),
    )
    .map_err(|error| CryptoError::KeyDerivation(error.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; DEK_SIZE]);
    argon2
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|error| CryptoError::KeyDerivation(error.to_string()))?;
    Ok(key)
}

fn validate_envelope(envelope: &KeyEnvelope) -> Result<(), CryptoError> {
    if envelope.version != ENVELOPE_VERSION {
        return Err(CryptoError::InvalidEnvelope("版本不受支持".to_string()));
    }
    if envelope.algorithm != ALGORITHM {
        return Err(CryptoError::InvalidEnvelope("算法组合不受支持".to_string()));
    }
    if envelope.salt.len() != SALT_SIZE || envelope.nonce.len() != NONCE_SIZE {
        return Err(CryptoError::InvalidEnvelope(
            "salt 或 nonce 长度无效".to_string(),
        ));
    }
    if envelope.wrapped_dek.len() != DEK_SIZE + AUTH_TAG_SIZE {
        return Err(CryptoError::InvalidEnvelope(
            "封装 DEK 长度无效".to_string(),
        ));
    }
    if envelope.memory_cost_kib == 0
        || envelope.memory_cost_kib > MAX_KDF_MEMORY_COST_KIB
        || envelope.time_cost == 0
        || envelope.time_cost > MAX_KDF_TIME_COST
        || envelope.parallelism == 0
        || envelope.parallelism > MAX_KDF_PARALLELISM
    {
        return Err(CryptoError::InvalidEnvelope(
            "Argon2id 参数超出允许范围".to_string(),
        ));
    }
    Ok(())
}

fn record_aad(record_type: &str, record_id: &str, field: &str) -> Vec<u8> {
    serde_json::to_vec(&(ENVELOPE_VERSION, record_type, record_id, field))
        .expect("记录 AAD 序列化不应失败")
}

fn random_array<const N: usize>() -> Result<[u8; N], CryptoError> {
    let mut bytes = [0u8; N];
    getrandom::getrandom(&mut bytes).map_err(|error| CryptoError::Random(error.to_string()))?;
    Ok(bytes)
}

impl Drop for VaultKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_and_unlocks_vault_with_correct_password() {
        let (key, envelope) = create_vault("correct horse battery staple").unwrap();
        assert_eq!(key.as_bytes().len(), DEK_SIZE);
        let restored = unlock_vault("correct horse battery staple", &envelope).unwrap();
        assert_eq!(key.as_bytes(), restored.as_bytes());
        assert!(matches!(
            unlock_vault("wrong password", &envelope),
            Err(CryptoError::Decryption)
        ));
    }

    #[test]
    fn serializes_key_envelope_without_password_or_plaintext() {
        let (_, envelope) = create_vault("test password").unwrap();
        let json = serialize_envelope(&envelope).unwrap();
        assert!(!json.contains("test password"));
        assert!(!json.contains("plaintext"));
        let restored: KeyEnvelope = deserialize_envelope(&json).unwrap();
        assert_eq!(envelope, restored);
    }

    #[test]
    fn encrypts_and_binds_record_identity() {
        let (key, _) = create_vault("test password").unwrap();
        let encrypted = encrypt_record(&key, "item", "item-1", "content", b"secret").unwrap();
        assert_ne!(encrypted.ciphertext, b"secret");
        assert_eq!(
            decrypt_record(&key, "item", "item-1", "content", &encrypted).unwrap(),
            b"secret"
        );
        assert!(matches!(
            decrypt_record(&key, "item", "item-2", "content", &encrypted),
            Err(CryptoError::Decryption)
        ));
    }

    #[test]
    fn detects_tampering_and_invalid_envelopes() {
        let (key, _) = create_vault("test password").unwrap();
        let mut encrypted = encrypt_record(&key, "attachment", "a-1", "data", b"bytes").unwrap();
        encrypted.ciphertext[0] ^= 1;
        assert!(matches!(
            decrypt_record(&key, "attachment", "a-1", "data", &encrypted),
            Err(CryptoError::Decryption)
        ));

        let mut malformed = KeyEnvelope {
            version: ENVELOPE_VERSION,
            algorithm: ALGORITHM.to_string(),
            memory_cost_kib: KDF_MEMORY_COST_KIB,
            time_cost: KDF_TIME_COST,
            parallelism: KDF_PARALLELISM,
            salt: vec![0; SALT_SIZE],
            nonce: vec![0; NONCE_SIZE],
            wrapped_dek: vec![0; DEK_SIZE],
        };
        assert!(matches!(
            unlock_vault("test password", &malformed),
            Err(CryptoError::InvalidEnvelope(_))
        ));
        malformed.wrapped_dek = vec![0; DEK_SIZE + AUTH_TAG_SIZE];
        malformed.memory_cost_kib = MAX_KDF_MEMORY_COST_KIB + 1;
        assert!(matches!(
            unlock_vault("test password", &malformed),
            Err(CryptoError::InvalidEnvelope(_))
        ));
    }
}
