import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SavedConsultation } from '../src/types/legal.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRIMARY_USERS_PATH = path.join(__dirname, 'data', 'auth_users.json');
const TMP_USERS_PATH = '/tmp/e3raf_auth_users.json';

export interface EmailUserProfile {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

interface OtpChallenge {
  email: string;
  displayName: string;
  codeHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

interface AuthStoreData {
  users: Record<string, EmailUserProfile>;
  consultationsByUid: Record<string, SavedConsultation[]>;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.GEMINI_API_KEY ||
  'e3raf-ha2ak-session-signing-secret-2026';

const OTP_TTL_MS = 1000 * 60 * 10; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const otpChallenges = new Map<string, OtpChallenge>();

let storeCache: AuthStoreData | null = null;

function loadStore(): AuthStoreData {
  if (storeCache) return storeCache;
  for (const p of [TMP_USERS_PATH, PRIMARY_USERS_PATH]) {
    try {
      if (fs.existsSync(p)) {
        storeCache = JSON.parse(fs.readFileSync(p, 'utf-8')) as AuthStoreData;
        return storeCache;
      }
    } catch {
      // Try next path
    }
  }
  storeCache = { users: {}, consultationsByUid: {} };
  return storeCache;
}

function saveStore(data: AuthStoreData): void {
  try {
    const dir = path.dirname(PRIMARY_USERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PRIMARY_USERS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    try {
      fs.writeFileSync(TMP_USERS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Memory cache remains active
    }
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function hashOtp(code: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
}

function makeUidFromEmail(email: string): string {
  return 'usr_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 24);
}

export function signSessionToken(profile: EmailUserProfile): string {
  const payload = {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): EmailUserProfile | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      uid: string;
      email: string;
      displayName: string;
      exp: number;
    };
    if (!parsed.uid || !parsed.email || Date.now() > parsed.exp) {
      return null;
    }
    const store = loadStore();
    return (
      store.users[parsed.uid] ?? {
        uid: parsed.uid,
        email: parsed.email,
        displayName: parsed.displayName,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }
    );
  } catch {
    return null;
  }
}

export async function createAndSendOtp(
  rawEmail: string,
  rawName?: string
): Promise<{
  ok: true;
  email: string;
  deliveryMode: 'email' | 'instant';
  instantCode?: string;
}> {
  const email = normalizeEmail(rawEmail);
  const existingChallenge = otpChallenges.get(email);
  const now = Date.now();

  if (existingChallenge && now - existingChallenge.lastSentAt < 15_000) {
    const waitSec = Math.ceil((15_000 - (now - existingChallenge.lastSentAt)) / 1000);
    throw new Error(`يرجى الانتظار ${waitSec} ثانية قبل طلب رمز جديد.`);
  }

  const code = String(crypto.randomInt(100000, 999999));
  const salt = crypto.randomBytes(16).toString('hex');
  const displayName = (rawName?.trim() || email.split('@')[0] || 'مواطن مصري').slice(0, 80);

  otpChallenges.set(email, {
    email,
    displayName,
    codeHash: hashOtp(code, salt),
    salt,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  });

  // Clean expired entries lazily
  for (const [k, v] of otpChallenges.entries()) {
    if (now > v.expiresAt) otpChallenges.delete(k);
  }

  // Send via Resend API if configured in environment variables
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'اعرف حقك <onboarding@resend.dev>',
          to: [email],
          subject: `رمز الدخول لمنصة اعرف حقك: ${code}`,
          html: `<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height: 1.8; color: #0f172a;">
            <h2>مرحباً بك في منصة «اعرف حقك»</h2>
            <p>رمز التحقق الخاص بتسجيل دخولك هو:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f766e; margin: 16px 0;">${code}</div>
            <p>الرمز صالح لمدة 10 دقائق فقط ولا تشاركه مع أي شخص.</p>
          </div>`,
        }),
      });
      if (resp.ok) {
        return { ok: true, email, deliveryMode: 'email' };
      }
    } catch {
      // Fall back to instant verification code if external mail provider fails
    }
  }

  // Instant reliable fallback when no external SMTP/Resend provider is attached
  return {
    ok: true,
    email,
    deliveryMode: 'instant',
    instantCode: code,
  };
}

export function verifyOtpAndLogin(
  rawEmail: string,
  rawCode: string
): { user: EmailUserProfile; token: string; consultations: SavedConsultation[] } {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();
  const challenge = otpChallenges.get(email);

  if (!challenge) {
    throw new Error('لم يتم طلب رمز تحقق لهذا البريد الإلكتروني أو انتهت صلاحيته. اطلب رمزاً جديداً.');
  }
  if (Date.now() > challenge.expiresAt) {
    otpChallenges.delete(email);
    throw new Error('انتهت صلاحية رمز التحقق (10 دقائق). يرجى طلب رمز جديد.');
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    otpChallenges.delete(email);
    throw new Error('تم استنفاد محاولات التحقق المسموح بها. يرجى طلب رمز جديد.');
  }

  challenge.attempts += 1;
  const candidateHash = hashOtp(code, challenge.salt);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(challenge.codeHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('رمز التحقق غير صحيح، يرجى التأكد من الأرقام الستة وإعادة المحاولة.');
  }

  otpChallenges.delete(email);

  const store = loadStore();
  const uid = makeUidFromEmail(email);
  const nowIso = new Date().toISOString();
  const existing = store.users[uid];

  const user: EmailUserProfile = {
    uid,
    email,
    displayName: existing?.displayName || challenge.displayName,
    emailVerified: true,
    createdAt: existing?.createdAt || nowIso,
    lastLoginAt: nowIso,
  };

  store.users[uid] = user;
  saveStore(store);

  const token = signSessionToken(user);
  const consultations = store.consultationsByUid[uid] ?? [];
  return { user, token, consultations };
}

export function getUserConsultations(uid: string): SavedConsultation[] {
  const store = loadStore();
  return store.consultationsByUid[uid] ?? [];
}

export function saveUserConsultation(uid: string, consultation: SavedConsultation): SavedConsultation[] {
  const store = loadStore();
  const existing = store.consultationsByUid[uid] ?? [];
  const next = [consultation, ...existing.filter((c) => c.id !== consultation.id)].slice(0, 30);
  store.consultationsByUid[uid] = next;
  saveStore(store);
  return next;
}

export function deleteUserConsultation(uid: string, consultationId: string): SavedConsultation[] {
  const store = loadStore();
  const existing = store.consultationsByUid[uid] ?? [];
  const next = existing.filter((c) => c.id !== consultationId);
  store.consultationsByUid[uid] = next;
  saveStore(store);
  return next;
}
