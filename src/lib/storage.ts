export interface StorageBackend {
  list(prefix: string): Promise<{ keys: string[] }>;
  get(key: string): Promise<{ value: string | null }>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

class LocalStorageBackend implements StorageBackend {
  async list(prefix: string): Promise<{ keys: string[] }> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return { keys };
  }

  async get(key: string): Promise<{ value: string | null }> {
    return { value: localStorage.getItem(key) };
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

export const storage: StorageBackend = new LocalStorageBackend();
