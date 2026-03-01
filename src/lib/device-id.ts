// 기기 고유 ID 생성 및 관리
// localStorage + IndexedDB 이중 백업으로 안정성 확보
// 브라우저 핑거프린트를 결합하여 같은 컴퓨터 인식

const DEVICE_ID_KEY = 'saju_device_id';
const FINGERPRINT_KEY = 'saju_device_fingerprint';
const DB_NAME = 'SajuroDeviceDB';
const STORE_NAME = 'device';

// UUID v4 생성 함수
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 브라우저/컴퓨터 핑거프린트 생성 (변경되지 않는 속성들 기반)
function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    (navigator as any).deviceMemory || 'unknown',
    navigator.platform,
  ];
  
  // 간단한 해시 생성
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// IndexedDB에서 device_id 가져오기
async function getFromIndexedDB(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onerror = () => resolve(null);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        try {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const getRequest = store.get('device_id');
          
          getRequest.onsuccess = () => {
            resolve(getRequest.result?.value || null);
          };
          getRequest.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

// IndexedDB에 device_id 저장
async function saveToIndexedDB(deviceId: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onerror = () => resolve();
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.put({ key: 'device_id', value: deviceId });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}

// 핑거프린트와 함께 IndexedDB에 저장
async function saveWithFingerprint(deviceId: string, fingerprint: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onerror = () => resolve();
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.put({ key: 'device_id', value: deviceId });
          store.put({ key: 'fingerprint', value: fingerprint });
          store.put({ key: 'created_at', value: new Date().toISOString() });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}

// 캐시된 device_id (비동기 초기화 후 동기적으로 사용)
let cachedDeviceId: string | null = null;
let initPromise: Promise<string> | null = null;

// 기기 ID 초기화 (앱 시작 시 호출)
export async function initDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const fingerprint = generateFingerprint();
    
    // 1. localStorage에서 확인
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const storedFingerprint = localStorage.getItem(FINGERPRINT_KEY);
    
    // 2. IndexedDB에서 확인 (localStorage가 삭제된 경우 복구)
    if (!deviceId) {
      deviceId = await getFromIndexedDB();
      if (deviceId) {
        console.log('[DeviceID] IndexedDB에서 복구:', deviceId);
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
        localStorage.setItem(FINGERPRINT_KEY, fingerprint);
      }
    }
    
    // 3. 새로 생성
    if (!deviceId) {
      deviceId = generateUUID();
      console.log('[DeviceID] 새 기기 ID 생성:', deviceId);
      console.log('[DeviceID] 핑거프린트:', fingerprint);
    }
    
    // 4. 모든 저장소에 저장 (이중 백업)
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    await saveWithFingerprint(deviceId, fingerprint);
    
    cachedDeviceId = deviceId;
    return deviceId;
  })();
  
  return initPromise;
}

// 기기 ID 가져오기 (동기 버전 - 초기화 후 사용)
export function getDeviceId(): string {
  // 캐시된 값이 있으면 반환
  if (cachedDeviceId) return cachedDeviceId;
  
  // localStorage에서 확인
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // 동기적으로 새로 생성 (초기화되지 않은 경우)
    deviceId = generateUUID();
    const fingerprint = generateFingerprint();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    console.log('[DeviceID] 새 기기 ID 생성 (동기):', deviceId);
    
    // 비동기로 IndexedDB에도 저장
    saveWithFingerprint(deviceId, fingerprint);
  }
  
  cachedDeviceId = deviceId;
  return deviceId;
}

// 기기 ID 존재 여부 확인
export function hasDeviceId(): boolean {
  return !!localStorage.getItem(DEVICE_ID_KEY) || !!cachedDeviceId;
}

// 기기 ID 가져오기 (생성하지 않음)
export function getDeviceIdIfExists(): string | null {
  return cachedDeviceId || localStorage.getItem(DEVICE_ID_KEY);
}

// 현재 기기 정보 반환 (디버깅/관리용)
export function getDeviceInfo(): { deviceId: string; fingerprint: string; createdAt?: string } {
  return {
    deviceId: getDeviceId(),
    fingerprint: localStorage.getItem(FINGERPRINT_KEY) || generateFingerprint(),
  };
}

// 강제로 device_id 설정 (관리자용 - 다른 컴퓨터의 데이터 복구 시)
export async function setDeviceId(newDeviceId: string): Promise<void> {
  const fingerprint = generateFingerprint();
  localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
  localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  await saveWithFingerprint(newDeviceId, fingerprint);
  cachedDeviceId = newDeviceId;
  console.log('[DeviceID] 기기 ID 수동 설정:', newDeviceId);
}
