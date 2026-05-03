---
title: Server Setup
description: QuantaNote sync server configuration guide, including server requirements, address configuration, and connection testing
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Server Setup

QuantaNote's sync feature requires a sync server. You can use a self-hosted server to run the sync service. This chapter covers how to configure and verify your sync server connection.

## Sync Server Requirements

The QuantaNote sync server needs to meet the following conditions:

**Basic requirements:**

- A server capable of running the sync service (can be a local server, VPS, or intranet server)
- The server must implement the QuantaNote sync API interfaces
- HTTPS is recommended for secure data transmission

**API Endpoints:**

The sync server must provide the following core API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/auth/refresh` | POST | Refresh token |
| `/api/auth/forgot-password` | POST | Forgot password |
| `/api/auth/reset-password` | POST | Reset password |
| `/api/sync/push` | POST | Push local changes |
| `/api/sync/pull` | POST | Pull remote changes |
| `/api/sync/status` | GET | Get sync status |

**Self-hosting instructions:**

If you plan to self-host the sync server, you can refer to the server implementation provided by QuantaNote. The server is a standalone web service that can be deployed in any environment supporting Rust.

Deployment overview:

1. Prepare a server (Linux recommended)
2. Compile and deploy the sync server binary
3. Configure the database (the server uses PostgreSQL or SQLite)
4. Set up a reverse proxy (such as Nginx) and enable HTTPS
5. Ensure the firewall allows traffic on the relevant ports

> **Tip:** For personal use, a low-spec VPS is sufficient. Sync data volume is typically small, depending mainly on the number of notes and attachment sizes.

## Configuring the Server Address

Configure the sync server address in the QuantaNote client:

1. Open the **Settings > Sync** page
2. Find the "Server Address" input field
3. Enter the full URL of your sync server, for example:
   ```
   https://sync.example.com
   ```
   Or a local address:
   ```
   http://localhost:3000
   ```
4. Do not add a trailing slash `/` at the end of the URL

**Supported protocols:**

- `https://` — Recommended, data transmission is encrypted
- `http://` — Only recommended for local development or intranet environments

> **Note:** After configuring the server address, you should test the connection before proceeding with registration or login.

## Testing the Connection

After configuring the server address, it is recommended to test the connection first:

1. In Settings > Sync, click the "Test Connection" button
2. QuantaNote sends a health check request to the server
3. The test result is displayed on the interface:
   - **Connection successful** — Shows server version and response time
   - **Connection failed** — Shows the specific error reason

**Common connection issues:**

| Issue | Possible cause | Solution |
|-------|---------------|----------|
| Connection timeout | Server unreachable or port not open | Check server status and firewall settings |
| SSL certificate error | HTTPS misconfiguration | Verify the SSL certificate is valid |
| 404 Not Found | Incorrect URL path | Confirm the server address and API paths |
| Connection refused | Service not running | Check if the server program is running |

**After a successful test:**

Once the connection test passes, you can proceed with the next steps:

1. Register a new account (first-time use)
2. Log in with an existing account
3. Configure auto sync parameters

For detailed authentication steps, see the [Authentication](./authentication) chapter.
