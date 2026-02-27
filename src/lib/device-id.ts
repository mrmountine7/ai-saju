// 기기 고유 ID 생성 및 관리
// localStorage에 저장되어 브라우저/기기별로 고유하게 유지됨

const DEVICE_ID_KEY = 'saju_device_id';

// UUID v4 생성 함수
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 기기 ID 가져오기 (없으면 생성)
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('[DeviceID] 새 기기 ID 생성:', deviceId);
  }
  
  return deviceId;
}

// 기기 ID 존재 여부 확인
export function hasDeviceId(): boolean {
  return !!localStorage.getItem(DEVICE_ID_KEY);
}

// 기기 ID 가져오기 (생성하지 않음)
export function getDeviceIdIfExists(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}
