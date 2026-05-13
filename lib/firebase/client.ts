"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, ref, type Database, type DatabaseReference } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseDatabaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);
export const isFirebaseStorageConfigured = Boolean(isFirebaseDatabaseConfigured && firebaseConfig.storageBucket);

export const app: FirebaseApp | null = isFirebaseDatabaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db: Database | null = app ? getDatabase(app) : null;
export const dashboardRef: DatabaseReference | null = db ? ref(db, "dashboard") : null;
export const storage: FirebaseStorage | null = app && isFirebaseStorageConfigured ? getStorage(app) : null;
