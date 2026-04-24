/**
 * @deprecated Phase 1 introduces src/shared/lib/repositories/supabaseRepository
 * as the canonical production repository boundary. Keep this adapter only while
 * legacy diagnosis flows still support Firebase.
 */
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';

import { getFirebaseClientServices } from '../../../../integrations/firebase/client.js';
import { buildDiagnosisSessionRecord } from '../../diagnosisSessionRecord.js';
import type { DemoDataAdapterDescriptor } from '../contracts.js';
import { FIRESTORE_COLLECTIONS, parseFirestoreAdminUser, parseFirestoreStore } from '../../firebase/firestoreSchema.js';

export const firebaseAdapter: DemoDataAdapterDescriptor = {
  description: 'Uses Firebase Auth, Firestore, and Storage when browser Firebase config is available.',
  id: 'firebase',
  isConfigured: () => Boolean(getFirebaseClientServices()),
  label: 'Firebase',
  saveDiagnosisSession: async (input) => {
    try {
      const services = getFirebaseClientServices();
      if (!services) {
        return null;
      }

      const sessionRef = doc(collection(services.firestore, FIRESTORE_COLLECTIONS.diagnosisSessions));
      const record = buildDiagnosisSessionRecord(input, sessionRef.id);

      await setDoc(sessionRef, record);
      return record;
    } catch {
      return null;
    }
  },
  resolveAdminAccess: async (input) => {
    try {
      const services = getFirebaseClientServices();
      if (!services) {
        return null;
      }

      const currentUser = services.auth.currentUser;
      if (!currentUser?.email) {
        return null;
      }

      const normalizedEmail = currentUser.email.trim().toLowerCase();
      const adminUserSnapshot = await getDocs(
        query(collection(services.firestore, FIRESTORE_COLLECTIONS.adminUsers), where('email', '==', normalizedEmail), limit(1)),
      );
      const adminUser = adminUserSnapshot.docs[0]
        ? parseFirestoreAdminUser(adminUserSnapshot.docs[0].id, adminUserSnapshot.docs[0].data())
        : null;

      const accessibleStores = await Promise.all(
        (adminUser?.linked_store_ids || []).map(async (storeId) => {
          const snapshot = await getDoc(doc(services.firestore, FIRESTORE_COLLECTIONS.stores, storeId));
          if (!snapshot.exists()) {
            return null;
          }

          return parseFirestoreStore(snapshot.id, snapshot.data());
        }),
      );

      return {
        accessibleStores: accessibleStores.filter((item): item is NonNullable<typeof item> => Boolean(item)),
        email: normalizedEmail,
        fullName: currentUser.displayName?.trim() || input.requestedFullName?.trim() || input.fallbackFullName,
        profileId: currentUser.uid || input.fallbackProfileId,
        provider: 'firebase',
        role: adminUser?.role || 'store_owner',
      };
    } catch {
      return null;
    }
  },
};
