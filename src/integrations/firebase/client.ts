import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { PUBLIC_RUNTIME_CONFIG, isFirebaseConfigured } from '@/shared/lib/appConfig';

export interface FirebaseClientServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let cachedFirebaseServices: FirebaseClientServices | null = null;

export function getFirebaseClientServices(): FirebaseClientServices | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (cachedFirebaseServices) {
    return cachedFirebaseServices;
  }

  const firebaseApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: PUBLIC_RUNTIME_CONFIG.firebase.apiKey,
          appId: PUBLIC_RUNTIME_CONFIG.firebase.appId,
          authDomain: PUBLIC_RUNTIME_CONFIG.firebase.authDomain,
          messagingSenderId: PUBLIC_RUNTIME_CONFIG.firebase.messagingSenderId,
          projectId: PUBLIC_RUNTIME_CONFIG.firebase.projectId,
          storageBucket: PUBLIC_RUNTIME_CONFIG.firebase.storageBucket,
        });

  cachedFirebaseServices = {
    app: firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
  };

  return cachedFirebaseServices;
}
