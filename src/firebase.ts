import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { ChatMessage, SavedConsultation } from './types/legal';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function sanitizeFirestoreId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || `id_${Date.now()}`;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function syncUserProfile(
  user: User,
  privacyMode: 'close' | '15m' | '60m' | 'manual',
  maskPiiOnSend: boolean
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}/private/profile`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'profile');
  try {
    let exists = false;
    try {
      const snap = await getDocFromServer(profileRef);
      exists = snap.exists();
    } catch {
      exists = false;
    }

    const basePayload = {
      uid: user.uid,
      email: (user.email ?? 'user@example.com').slice(0, 254),
      displayName: (user.displayName ?? 'مواطن مصري').slice(0, 120),
      ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 500) } : {}),
      privacyMode,
      maskPiiOnSend,
      updatedAt: serverTimestamp(),
    };

    if (!exists) {
      await setDoc(profileRef, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        profileRef,
        basePayload,
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveConsultationToFirestore(
  user: User,
  consultationId: string,
  title: string,
  domain: string,
  messages: ChatMessage[]
): Promise<void> {
  if (!user.emailVerified || messages.length === 0) return;
  const safeConsultId = sanitizeFirestoreId(consultationId);
  const consultPath = `users/${user.uid}/consultations/${safeConsultId}`;
  const consultRef = doc(db, 'users', user.uid, 'consultations', safeConsultId);

  try {
    let exists = false;
    try {
      const existingSnap = await getDocFromServer(consultRef);
      exists = existingSnap.exists();
    } catch {
      exists = false;
    }

    const boundedTitle = (title || 'استشارة قانونية').slice(0, 200);
    const boundedDomain = (domain || 'استشارة قانونية عامة').slice(0, 120);

    if (!exists) {
      await setDoc(consultRef, {
        id: safeConsultId,
        ownerId: user.uid,
        title: boundedTitle,
        domain: boundedDomain,
        status: 'active',
        messageCount: messages.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        consultRef,
        {
          title: boundedTitle,
          domain: boundedDomain,
          messageCount: messages.length,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const batch = writeBatch(db);
    for (const msg of messages.slice(-20)) {
      const safeMsgId = sanitizeFirestoreId(msg.id);
      const msgRef = doc(db, 'users', user.uid, 'consultations', safeConsultId, 'messages', safeMsgId);
      const cleanContent = (msg.content || '').slice(0, 15000);
      if (!cleanContent) continue;
      batch.set(msgRef, {
        id: safeMsgId,
        ownerId: user.uid,
        consultationId: safeConsultId,
        role: msg.role,
        content: cleanContent,
        ...(msg.meta?.matchedDomain ? { matchedDomain: msg.meta.matchedDomain.slice(0, 120) } : {}),
        ...(msg.meta?.sentiment?.labelAr
          ? { sentimentLabel: msg.meta.sentiment.labelAr.slice(0, 120) }
          : {}),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, consultPath);
  }
}

export async function loadConsultationsFromFirestore(user: User): Promise<SavedConsultation[]> {
  if (!user.emailVerified) return [];
  const path = `users/${user.uid}/consultations`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'consultations'),
      orderBy('updatedAt', 'desc'),
      limit(15)
    );
    const snap = await getDocs(q);
    const results: SavedConsultation[] = [];

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const msgQuery = query(
        collection(db, 'users', user.uid, 'consultations', docSnap.id, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(40)
      );
      const msgSnap = await getDocs(msgQuery);
      const loadedMessages: ChatMessage[] = msgSnap.docs.map((m) => {
        const md = m.data();
        return {
          id: String(md.id ?? m.id),
          role: md.role === 'assistant' ? 'assistant' : 'user',
          content: String(md.content ?? ''),
          timestamp: md.createdAt?.toDate ? md.createdAt.toDate().toISOString() : new Date().toISOString(),
        };
      });

      results.push({
        id: String(data.id ?? docSnap.id),
        title: String(data.title ?? 'استشارة قانونية'),
        domain: String(data.domain ?? 'استشارة قانونية عامة'),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
        messages: loadedMessages,
      });
    }

    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteConsultationFromFirestore(
  user: User,
  consultationId: string
): Promise<void> {
  if (!user.emailVerified) return;
  const safeId = sanitizeFirestoreId(consultationId);
  const path = `users/${user.uid}/consultations/${safeId}`;
  try {
    const msgsSnap = await getDocs(
      collection(db, 'users', user.uid, 'consultations', safeId, 'messages')
    );
    for (const m of msgsSnap.docs) {
      await deleteDoc(m.ref);
    }
    await deleteDoc(doc(db, 'users', user.uid, 'consultations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logFeedbackToFirestore(
  user: User,
  domain: string,
  isHelpful: boolean,
  correctionNote?: string
): Promise<void> {
  if (!user.emailVerified) return;
  const feedbackId = sanitizeFirestoreId(`fb_${Date.now()}`);
  const path = `users/${user.uid}/feedback/${feedbackId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'feedback', feedbackId), {
      id: feedbackId,
      ownerId: user.uid,
      domain: (domain || 'استشارة قانونية عامة').slice(0, 120),
      isHelpful,
      ...(correctionNote ? { correctionNote: correctionNote.slice(0, 600) } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
