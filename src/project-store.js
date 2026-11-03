// Local copy of the work in progress (videos, trims, names, subtitles) in this browser's IndexedDB,
// so reloading the page after an update does not start from zero. Nothing leaves the computer.
const DB = 'videosarnago';
let opening = null;
function open() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['files', 'meta']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(e => {opening = null; throw e;});
  return opening;
}
async function run(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operación cancelada.'));
  });
}
export const getItem = (store, key) => run(store, 'readonly', s => s.get(key));
export const putItem = (store, key, value) => run(store, 'readwrite', s => s.put(value, key));
export const deleteItem = (store, key) => run(store, 'readwrite', s => s.delete(key));
export const clearStore = store => run(store, 'readwrite', s => s.clear());
// Asks the browser not to evict the saved videos when disk space runs low.
export function keepStorage() {try {navigator.storage?.persist?.().catch(() => {});} catch {}}
