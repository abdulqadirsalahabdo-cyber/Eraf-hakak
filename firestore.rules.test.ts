/**
 * Phase 0 TDD Security Test Runner for "Dirty Dozen" Payloads
 * Verifies that every adversarial payload violates invariants and receives PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  auth: { uid: string; emailVerified: boolean } | null;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Read',
    targetPath: 'users/u1/private/profile',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: null,
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing',
    targetPath: 'users/u1/private/profile',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: false },
    payload: {
      uid: 'u1',
      email: 'spoof@example.com',
      displayName: 'User',
      photoURL: '',
      privacyMode: '15m',
      maskPiiOnSend: true,
    },
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    targetPath: 'users/u1/private/profile',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u2', emailVerified: true },
  },
  {
    id: 4,
    name: 'Cross-User List Scraping',
    targetPath: 'users/u1/consultations',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u2', emailVerified: true },
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    targetPath: 'users/u1/consultations/c1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
    payload: {
      id: 'c1',
      ownerId: 'u1',
      title: 'استشارة',
      domain: 'قانون العمل',
      status: 'active',
      messageCount: 1,
      isAdmin: true,
    },
  },
  {
    id: 6,
    name: 'ID Poisoning (Malformed/Oversized ID)',
    targetPath: 'users/u1/consultations/bad$id..invalid',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
  },
  {
    id: 7,
    name: 'Identity Spoofing on Owner Field',
    targetPath: 'users/u1/consultations/c2',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
    payload: {
      id: 'c2',
      ownerId: 'u2',
      title: 'استشارة',
      domain: 'قانون العمل',
      status: 'active',
      messageCount: 1,
    },
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    targetPath: 'users/u1/consultations/c3',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
    payload: {
      id: 'c3',
      ownerId: 'u1',
      title: 'استشارة',
      domain: 'قانون العمل',
      status: 'active',
      messageCount: 1,
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    id: 9,
    name: 'Orphan Message Write',
    targetPath: 'users/u1/consultations/missing_parent/messages/m1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
  },
  {
    id: 10,
    name: 'Terminal State Violation on Archived Consultation',
    targetPath: 'users/u1/consultations/archived_c/messages/m2',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
  },
  {
    id: 11,
    name: 'Value Poisoning (Oversized Message Content)',
    targetPath: 'users/u1/consultations/c1/messages/m3',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
    payload: {
      contentLength: 20000,
    },
  },
  {
    id: 12,
    name: 'Immutable Field Mutation on Update',
    targetPath: 'users/u1/consultations/c1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    auth: { uid: 'u1', emailVerified: true },
    payload: {
      ownerId: 'u2',
    },
  },
];
