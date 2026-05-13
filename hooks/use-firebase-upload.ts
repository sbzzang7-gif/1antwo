"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { escapeStorageName } from "@/lib/utils";

export async function uploadFirebaseFile(path: string, file: File) {
  if (!storage) throw new Error("Firebase Storage is not configured.");

  const storageRef = ref(storage, `${path}/${escapeStorageName(file.name)}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

export async function deleteFirebaseFile(url: string) {
  if (!storage) throw new Error("Firebase Storage is not configured.");

  await deleteObject(ref(storage, url));
}
