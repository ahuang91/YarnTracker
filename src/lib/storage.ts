export interface StorageBackend {
  list(prefix: string): Promise<{ keys: string[] }>;
  get(key: string): Promise<{ value: string | null }>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

class ApiStorageBackend implements StorageBackend {
  async list(prefix: string): Promise<{ keys: string[] }> {
    const res = await fetch(`/api/storage/list?prefix=${encodeURIComponent(prefix)}`);
    return res.json();
  }

  async get(key: string): Promise<{ value: string | null }> {
    const res = await fetch(`/api/storage/get?key=${encodeURIComponent(key)}`);
    return res.json();
  }

  async set(key: string, value: string): Promise<void> {
    await fetch('/api/storage/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  }

  async delete(key: string): Promise<void> {
    await fetch('/api/storage/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  }
}

export const storage: StorageBackend = new ApiStorageBackend();
