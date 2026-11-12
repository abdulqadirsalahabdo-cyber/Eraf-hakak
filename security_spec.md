# Security Specification — اعرف حقك (E3raf Ha2ak)

## 1. Data Invariants
1. **Default Deny:** Every Firestore path outside explicit rules is denied (`allow read, write: if false;`).
2. **Verified Identity & Strict Ownership:** All reads, writes, and list queries require `request.auth != null`, `request.auth.token.email_verified == true`, and exact UID ownership (`request.auth.uid == userId` and `data.ownerId == request.auth.uid`).
3. **PII Isolation:** Personal profile data (`email`, `displayName`, `photoURL`) is isolated inside `/users/{userId}/private/profile`, readable and writable solely by that verified user.
4. **Master Gate Relational Sync:** Messages inside `/users/{userId}/consultations/{consultationId}/messages/{messageId}` enforce existence and ownership of the parent consultation via `get()`, and forbid writes once the parent consultation is `archived`.
5. **Temporal Integrity & Immutability:** `createdAt` and `updatedAt` must equal `request.time`; `createdAt`, `uid`, `ownerId`, and `consultationId` are strictly immutable on update.
6. **ID & Size Hardening:** Every path ID matches `^[a-zA-Z0-9_\-]+$` and `<= 128` chars; every string field has strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Profile Read:** Unauthenticated client attempts `get` on `/users/u1/private/profile` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing:** Authenticated user with `email_verified: false` attempts `create` on `/users/u1/private/profile` -> `PERMISSION_DENIED`.
3. **Cross-User PII Read:** Verified user `u2` attempts `get` on `/users/u1/private/profile` -> `PERMISSION_DENIED`.
4. **Cross-User List Scraping:** Verified user `u2` attempts `list` on `/users/u1/consultations` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection:** User `u1` creates consultation with extra field `isAdmin: true` -> `PERMISSION_DENIED` (blocked by `hasOnly`).
6. **ID Poisoning (Oversized/Malformed ID):** User `u1` creates consultation with ID `"bad$id/../../../"` or 200-char ID -> `PERMISSION_DENIED` (`isValidId`).
7. **Identity Spoofing on Owner Field:** User `u1` creates consultation under `/users/u1/consultations/c1` with `ownerId: "u2"` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery:** User `u1` creates consultation with forged past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Orphan Message Write:** User `u1` writes message under non-existent `consultationId` -> `PERMISSION_DENIED` (`exists` / `get` parent gate).
10. **Terminal State Violation:** User `u1` writes a new message or edits title on a consultation with `status: "archived"` -> `PERMISSION_DENIED`.
11. **Value Poisoning (Oversized String):** User `u1` creates message with `content` exceeding 15,000 characters -> `PERMISSION_DENIED`.
12. **Immutable Field Mutation:** User `u1` attempts to update `ownerId` or `createdAt` on an existing consultation -> `PERMISSION_DENIED`.
