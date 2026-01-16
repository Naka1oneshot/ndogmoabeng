import { useEffect, useState } from 'react';

const DEVICE_ID_KEY = 'NDGM_DEVICE_ID';

/**
 * Get or generate a unique device ID for this browser/device.
 * Stored in localStorage and optionally in a cookie for persistence.
 */
export function getDeviceId(): string {
  // Check localStorage first
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a new UUID
    deviceId = crypto.randomUUID();
    
    // Store in localStorage
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    
    // Also store in cookie for additional persistence (1 year expiry)
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `${DEVICE_ID_KEY}=${deviceId}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
    } catch (e) {
      console.warn('Could not set device ID cookie:', e);
    }
  }
  
  return deviceId;
}

/**
 * Try to recover device ID from cookie if localStorage was cleared
 */
export function recoverDeviceIdFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === DEVICE_ID_KEY && value) {
        // Restore to localStorage
        localStorage.setItem(DEVICE_ID_KEY, value);
        return value;
      }
    }
  } catch (e) {
    console.warn('Could not read device ID cookie:', e);
  }
  return null;
}

/**
 * Hook to get the device ID, with automatic generation on first use
 */
export function useDeviceId(): string {
  const [deviceId, setDeviceId] = useState<string>(() => {
    // Try localStorage first
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    
    // Try to recover from cookie
    const recovered = recoverDeviceIdFromCookie();
    if (recovered) return recovered;
    
    // Will be generated in useEffect
    return '';
  });

  useEffect(() => {
    if (!deviceId) {
      setDeviceId(getDeviceId());
    }
  }, [deviceId]);

  return deviceId;
}
