import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.resolve(process.cwd(), '.hr-data');
const BATCHES_FILE = path.join(STORAGE_DIR, 'batches.json');
const RESULTS_FILE = path.join(STORAGE_DIR, 'results.json');
const ROLLBACKS_FILE = path.join(STORAGE_DIR, 'rollbacks.json');

const ensureDir = () => {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
};

const writeJson = (filePath: string, data: any) => {
  ensureDir();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Failed to write ${filePath}:`, e);
  }
};

const readJson = <T>(filePath: string, defaultValue: T): T => {
  ensureDir();
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(`Failed to read ${filePath}:`, e);
    return defaultValue;
  }
};

export interface PersistenceStore<K, V> {
  getAll: () => Map<K, V>;
  set: (key: K, value: V) => void;
  get: (key: K) => V | undefined;
  delete: (key: K) => boolean;
  has: (key: K) => boolean;
  entries: () => Array<[K, V]>;
  values: () => V[];
  save: () => void;
  load: () => void;
}

export const createFilePersistence = <K extends string, V>(
  filePath: string
): PersistenceStore<K, V> => {
  let inMemoryMap = new Map<K, V>();
  let isDirty = false;

  const load = () => {
    const stored = readJson<Record<string, V>>(filePath, {});
    inMemoryMap = new Map(Object.entries(stored) as Array<[K, V]>);
  };

  const save = () => {
    if (!isDirty) return;
    const obj: Record<string, V> = {};
    inMemoryMap.forEach((v, k) => {
      obj[k as string] = v;
    });
    writeJson(filePath, obj);
    isDirty = false;
  };

  load();

  setInterval(() => {
    if (isDirty) save();
  }, 2000);

  process.on('beforeExit', save);
  process.on('SIGINT', () => { save(); process.exit(); });

  return {
    getAll: () => inMemoryMap,
    set: (key: K, value: V) => {
      inMemoryMap.set(key, value);
      isDirty = true;
    },
    get: (key: K) => inMemoryMap.get(key),
    delete: (key: K) => {
      const result = inMemoryMap.delete(key);
      isDirty = true;
      return result;
    },
    has: (key: K) => inMemoryMap.has(key),
    entries: () => Array.from(inMemoryMap.entries()),
    values: () => Array.from(inMemoryMap.values()),
    save,
    load,
  };
};

export const batchesStore = createFilePersistence<string, any>(BATCHES_FILE);
export const resultsStore = createFilePersistence<string, any>(RESULTS_FILE);
export const rollbacksStore = createFilePersistence<string, any>(ROLLBACKS_FILE);
