---
title: Authentication
description: QuantaNote sync authentication features including registration, login, password reset, token management, and system credential storage
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# Authentication

To use QuantaNote's sync feature, you need to register an account on the sync server and authenticate. QuantaNote uses a token-based authentication mechanism to ensure your sync operations are secure and reliable.

## Registering an Account

When using the sync feature for the first time, you need to create an account.

**Registration steps:**

1. In the **Settings > Sync** page, confirm the server address is correctly configured and the test passes
2. Click the "Register" button to open the registration modal
3. Fill in the following information:
   - **Email address** — Used as account identifier, must be a valid email format
   - **Password** — Set your account password, a strong password is recommended
   - **Confirm password** — Re-enter the password to confirm
4. Click the "Register" button to submit

**Registration requirements:**

- The email address must be in a valid format (e.g., `user@example.com`)
- The password must be at least 8 characters long
- Each email can only register once

**After successful registration:**

- The system automatically logs you in with the registered credentials
- Your device receives a unique Device ID
- You can start using the sync feature immediately

> **Note:** The email address is used solely for account authentication. QuantaNote will not send marketing emails to this address.

## Logging In

If you have already registered on another device, you can log in directly.

**Login steps:**

1. In the **Settings > Sync** page, click the "Login" button
2. Enter your email address and password
3. Click the "Login" button

**Token Management:**

Upon successful login, the server returns two tokens:

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | Short (~1 hour) | Used for authenticating all sync API requests |
| Refresh Token | Long (~30 days) | Used to obtain new tokens when the Access Token expires |

QuantaNote automatically manages these tokens:

- Every sync request carries the Access Token
- When the Access Token expires, it automatically uses the Refresh Token to obtain a new one
- If the Refresh Token also expires, you will need to log in again

**Token storage:**

- Access Token and Refresh Token are stored in the operating system credential store (Windows Credential Manager, macOS Keychain, or Linux Secret Service)
- SQLite configuration does not store plaintext tokens; it stores only non-sensitive settings such as the server, device, and sync state
- When upgrading from an older version, the app migrates legacy tokens into the system credential store and removes the old SQLite token values after a successful migration

**Device Identity:**

Each device receives a unique Device ID after logging in. The Device ID is used to:

- Identify the source of changes during sync
- Track the sync baseline for each device
- Support multiple devices online simultaneously

## Forgot Password

If you have forgotten your login password, you can reset it through the following steps:

1. In the login modal, click the "Forgot Password" link
2. Enter the email address you used during registration
3. Click the "Send Reset Link" button
4. The system sends a password reset email to your inbox
5. Click the reset link in the email and set a new password

**Important notes:**

- Password reset links have a time limit, so please act promptly after receiving the email
- If you don't receive the email, check your spam folder
- After resetting your password, previous tokens become invalid and you'll need to log in again on all devices

## Logging Out

When you no longer need sync or want to switch accounts, you can log out.

**Logout steps:**

1. In the **Settings > Sync** page, find the current login status area
2. Click the "Log Out" button
3. Confirm the logout action

**Effects of logging out:**

- Auto sync will be stopped
- Local data is not affected in any way
- Access Token and Refresh Token are cleared from the system credential store
- Device ID and sync baseline are preserved (syncing can continue on next login)

> **Tip:** If you use sync on multiple devices, it's recommended to keep each device logged in to ensure continuous data synchronization.
