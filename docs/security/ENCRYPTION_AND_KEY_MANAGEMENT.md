# Security: Encryption & Key Management Specification

## 1. Overview
This specification details cryptographic protocols, cipher suites, key derivation functions, and storage security standards implemented across the Mediclaim infrastructure.

## 2. Data in Transit (Network Cryptography)

```
[Browser / Client] 
        |
        |  TLS 1.3 / HTTPS (ECDHE-ECDSA-AES256-GCM-SHA384)
        v
[Reverse Proxy / Nginx]
        |
        |  Internal Encrypted Docker Network
        v
[FastAPI Application Services]
```

- **Protocols**: Strict Transport Security (HSTS) with TLS 1.3 mandated. Legacy SSL v2/v3, TLS 1.0, and TLS 1.1 are disabled.
- **Cipher Suites**: Modern AEAD ciphers prioritized (`TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`).
- **HTTP Headers**:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: default-src 'self' ...`

## 3. Data at Rest (Storage Cryptography)

### 3.1 Relational Database Encryption
- Underlying PostgreSQL persistent volumes are hosted on storage encrypted with AES-256 (LUKS on Linux / BitLocker on Windows Server).
- Database credentials and connection URIs are injected exclusively via environment variables (`DATABASE_URL`), never committed to source version control.

### 3.2 File System Storage
- Medical document uploads (`/data/uploads/documents/<patient_id>/`) are stored within isolated container volumes.
- Access to uploaded assets is mediated exclusively via authenticated backend endpoints with consent evaluation; direct static file serving is disabled.

## 4. Identity & Token Cryptography

### 4.1 JSON Web Tokens (JWT)
- **Algorithm**: `HS256` (HMAC using SHA-256) with high-entropy cryptographic secret keys.
- **Payload Claims**:
  - `sub`: User UUID
  - `role`: Role identifier (`patient`, `doctor`, `hospital`, `admin`)
  - `exp`: Expiration timestamp (Access tokens: 60 minutes)
  - `iat`: Issued at timestamp
- **Revocation**: Stateless verification complemented by account active state checking in database.

### 4.2 Password Hashing
- **Algorithm**: `Argon2id` (RFC 9106 recommended).
- **Configuration**:
  - Type: Argon2id (resistant against both GPU side-channel and trade-off attacks)
  - Time Cost: 3 iterations
  - Memory Cost: 65536 KiB (64 MiB)
  - Parallelism: 4 threads
- Passwords are salted automatically with 128-bit cryptographically secure random salts.
