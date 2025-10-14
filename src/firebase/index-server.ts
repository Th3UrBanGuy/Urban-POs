'use server';

// NOTE: This is a server-only file. It is safe to import from here in client components
// because the functions are marked with 'use server'. Next.js will correctly handle
// the separation of concerns.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

// This function is intended for use in Server Actions and other server-side code.
export async function initializeFirebase() {
  if (!getApps().length) {
     let firebaseApp;
    try {
      firebaseApp = initializeApp();
    } catch (e) {
       if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
    return getSdks(firebaseApp);
  }
  return getSdks(getApp());
}

function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    firestore: getFirestore(app),
    auth: getAuth(app),
  };
}
