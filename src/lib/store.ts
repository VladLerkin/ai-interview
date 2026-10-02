import { openDB } from 'idb';

const DB_NAME = 'ai-interview-db';
const STORE_NAME = 'interview-store';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const setStoredData = async (key: string, value: any) => {
  const db = await initDB();
  return db.put(STORE_NAME, value, key);
};

export const getStoredData = async (key: string) => {
  const db = await initDB();
  return db.get(STORE_NAME, key);
};

export const deleteStoredData = async (key: string) => {
  const db = await initDB();
  return db.delete(STORE_NAME, key);
};
