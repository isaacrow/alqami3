// Browser IndexedDB Artifact Database Manager for Alqami
// Handles persistent multi-view embeddings, BIBFRAME metadata, and custom additions

const DB_NAME = 'AlqamiArtifactDB';
const DB_VERSION = 1;
const STORE_NAME = 'artifacts';

export class ArtifactDatabase {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.baseUrl = import.meta.env.BASE_URL || './';
  }

  async init() {
    if (this.isReady && this.db) return true;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        this.isReady = true;

        // Check if database needs initial seeding
        const count = await this._count();
        if (count === 0) {
          console.log('ArtifactDatabase is empty, seeding from public/data/seed-artifacts.json...');
          await this._seedFromDefault();
        }

        resolve(true);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(e);
      };
    });
  }

  async _count() {
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  }

  async _seedFromDefault() {
    try {
      const resp = await fetch(`${this.baseUrl}data/seed-artifacts.json?v=${Date.now()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const seedList = await resp.json();
      
      for (const artifact of seedList) {
        await this.save(artifact);
      }
      console.log(`Seeded ${seedList.length} artifacts into IndexedDB!`);
    } catch (err) {
      console.warn('Could not seed artifacts from JSON:', err);
    }
  }

  async getAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e);
    });
  }

  async get(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e);
    });
  }

  async save(artifact) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(artifact);
      req.onsuccess = () => resolve(artifact);
      req.onerror = (e) => reject(e);
    });
  }

  async delete(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  async exportJSON() {
    const all = await this.getAll();
    return JSON.stringify(all, null, 2);
  }

  async importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) throw new Error('Root must be an array of artifacts');
      for (const item of parsed) {
        if (!item.id) continue;
        await this.save(item);
      }
      return true;
    } catch (err) {
      console.error('Failed to import artifacts JSON:', err);
      throw err;
    }
  }

  async resetToDefault() {
    await this.init();
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await this._seedFromDefault();
    return true;
  }
}
