import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { InterviewConfig, InterviewSnapshot } from '../types/interview';

const DB_NAME = 'ai-interview-db';
const STORE_NAME = 'interview-store';

/** Typed map of every key persisted in IndexedDB. */
export interface StoredData {
  interviewConfig: InterviewConfig;
  interviewState: InterviewSnapshot;
}

export type StoredKey = keyof StoredData;

interface InterviewDB extends DBSchema {
  [STORE_NAME]: {
    key: StoredKey;
    value: StoredData[StoredKey];
  };
}

let dbPromise: Promise<IDBPDatabase<InterviewDB>> | null = null;

const getDB = () => {
  dbPromise ??= openDB<InterviewDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
  return dbPromise;
};

export const setStoredData = async <K extends StoredKey>(key: K, value: StoredData[K]) => {
  const db = await getDB();
  return db.put(STORE_NAME, value, key);
};

export const getStoredData = async <K extends StoredKey>(key: K): Promise<StoredData[K] | undefined> => {
  const db = await getDB();
  return (await db.get(STORE_NAME, key)) as StoredData[K] | undefined;
};

export const deleteStoredData = async (key: StoredKey) => {
  const db = await getDB();
  return db.delete(STORE_NAME, key);
};
