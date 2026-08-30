---
title: Local Encryption Design
description: Design boundaries for QuantaNote local encryption, key management, locking, search, sync, and backups
author: QuantaNote Team
createdAt: 2026-08-30
lastUpdated: 2026-08-30
---

# Local Encryption Design

This page records the design constraints for a future encrypted local vault. The current version does not integrate database-level at-rest encryption. `items.encrypted` is only a reserved compatibility field and must not be treated as proof that note content is encrypted. The project now provides an isolated cryptographic foundation, but it does not change the existing plaintext database read/write path by itself.

## Goals and boundaries

The goal is to protect the database, attachments, and backup files when the device is offline or another local user can read the files. It cannot defend against malware that already controls the current user session, and it cannot recover a forgotten master password.

The implementation must follow these rules:

- Keys exist only briefly in the process memory after unlock. The master password and derived keys must never be written to SQLite, settings, logs, or sync requests.
- There is no bypass for a forgotten master password. Recovery depends on a user-created encrypted backup or recovery material.
- Before encryption migration, create and verify a logical backup and support rollback. Never overwrite plaintext in place without a verified backup.
- Attachments are part of note content and cannot remain plaintext while only Markdown is encrypted.

## Key management and lock/unlock flow

### Key hierarchy

The cryptographic foundation uses mature libraries for the following layers; it does not invent cryptographic algorithms:

1. Generate a random Vault Data Encryption Key (DEK) when the vault is enabled. The user password is never used directly as the data key.
2. Derive a Key Encryption Key (KEK) from the master password and a random salt with Argon2id. Store the Argon2id parameters in encrypted metadata so parameters can be upgraded later.
3. Encrypt the DEK with XChaCha20-Poly1305 and a random nonce, storing the algorithm version, salt, parameters, nonce, and wrapped DEK.
4. Use a separate random nonce for every note, version, and attachment. Bind the record type, record ID, and field name as AAD so ciphertext cannot be moved between records without failing authentication.
5. Prefer mature Rust crates such as `argon2`, `chacha20poly1305`, and `zeroize`; use the operating system secure random source. Handle library and parameter upgrades with an explicit envelope version.

### Implemented Cryptographic Foundation

`src-tauri/src/crypto.rs` now provides reusable primitives:

- `create_vault` generates a DEK from the system secure random source, derives a KEK with Argon2id, and wraps the DEK with XChaCha20-Poly1305.
- `unlock_vault` validates the algorithm version, KDF parameters, random values, and authentication tag; wrong passwords or tampering never return the plaintext DEK.
- `encrypt_record` / `decrypt_record` use a distinct nonce per record and bind the record type, record ID, and field name as AAD.
- `VaultKey` is not `Clone` and is cleared with `zeroize` when dropped; key and record envelopes are serializable without containing the master password.

This is only the cryptographic foundation. Database migration, the lock state machine, in-memory index cleanup, encrypted attachment integration, and restore wizard still require separate implementation and security review before local encryption can be enabled.

### State machine

| State | Allowed operations | In-memory keys |
|------|--------------------|---------------|
| `locked` | Open the app, show non-sensitive status, accept the master password | None |
| `unlocking` | Verify the password and unwrap the DEK | Temporary; zeroized on failure |
| `unlocked` | Read, write, search, sync, and back up | Process memory only; zeroized on idle timeout or manual lock |
| `locking` | Stop work, remove temporary indexes, zeroize keys | Being cleared |

Locking must cancel or await active save, import, sync, and backup jobs, remove plaintext caches and search indexes, and then zeroize the DEK/KEK. Closing a window must not be assumed to mean the vault was successfully locked; the app still needs to checkpoint the database and clean temporary files before exit.

## Search, sync, and backups

### Search

The existing persistent `items_fts` FTS5 table contains plaintext. Encrypted notes therefore cannot continue writing plaintext to that table:

- While `locked`, do not search encrypted note bodies, summaries, versions, or attachment content. Whether non-sensitive metadata remains searchable must be an explicit product setting.
- While `unlocked`, decrypt locally and build a temporary in-memory index. Remove it on lock; it must not survive in a normal SQLite backup.
- Clear result context and highlights on lock so UI state and logs do not retain plaintext.

### Sync

The server receives versioned ciphertext, explicitly public metadata, and integrity hashes—not the master password, KEK, or DEK. Conflict comparison uses ciphertext versions and field hashes. Field-level merging happens locally after decryption and is uploaded as a new ciphertext version. The server cannot unlock or merge plaintext for the user.

Attachment sync must transmit encrypted attachments as well. While locked, encrypted bytes may be downloaded to a controlled staging location, but they must not be exposed to the frontend as previewable plaintext.

### Backups and restore

- Logical ZIP backups should contain encrypted records and attachments; they must not write decrypted note content into the ZIP temporarily.
- A SQLite file backup is a valid encrypted-vault backup only after the encryption migration is complete. An extension or the `encrypted` field must not be used to claim an unencrypted backup is protected.
- Validate envelope versions, authentication tags, and attachment integrity before restore; a failed restore must not replace the current vault.
- A backup password must not be stored in automatic-backup settings. Automatic backups either use a controlled key from the unlocked vault session or clearly state that encrypted notes are excluded.

## Migration and compatibility

Before implementation, `encrypted` remains a compatibility field only and is not a security switch. The real implementation needs explicit vault metadata and encryption-state fields plus a one-time migration wizard: verify a backup, encrypt and validate each record, commit safely, and only then remove old plaintext. Older versions opening an encrypted vault must fail safely instead of rendering ciphertext as Markdown or writing it back.

Until database integration, migration rollback, and security testing are complete, docs, settings UI, and IPC types must accurately say “foundation available, full-vault encryption not implemented” rather than implying encryption is active.
