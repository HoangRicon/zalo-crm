// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * use-push-notifications.ts — Sprint 7 R12 (2026-07-21).
 *
 * Composable cho opt-in flow + subscribe PWA push notifications.
 * Phase 1: cấu trúc đầy đủ nhưng service worker không thật (chưa build → service worker
 * chưa register). Backend endpoint POST /api/v1/push/subscribe đã sẵn sàng nhận.
 *
 * Phase 2: khi vite-plugin-pwa build production, file sw.js tự generate → plugin
 * auto-register. Để dùng push thật:
 *   1. backend: npm i web-push
 *   2. backend: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY env
 *   3. uncomment block dưới.
 */
import { ref } from 'vue';
import { api } from '@/api/index';

type PushSupport = 'unknown' | 'unsupported' | 'opted-out' | 'subscribed' | 'denied';

const support = ref<PushSupport>('unknown');
const vapidKey = ref<string>('');

async function checkSupport(): Promise<PushSupport> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    support.value = 'unsupported';
    return support.value;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    support.value = sub ? 'subscribed' : 'opted-out';
    return support.value;
  } catch {
    support.value = 'unsupported';
    return support.value;
  }
}

/** Opt-in: yêu cầu permission + tạo subscription + POST lên backend. */
export async function optInToPush(): Promise<{ ok: boolean; reason?: string }> {
  // Phase 1: chưa có service worker thật (cần build), fail gracefully.
  // Phase 2 khi có sw.js: uncomment block dưới.
  /*
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    support.value = 'denied';
    return { ok: false, reason: 'permission_denied' };
  }
  const key = await loadVapidKey();
  if (!key) return { ok: false, reason: 'vapid_not_configured' };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  const subJson = sub.toJSON();
  if (!subJson.endpoint || !subJson.keys) return { ok: false, reason: 'invalid_subscription' };
  await api.post('/push/subscribe', {
    endpoint: subJson.endpoint,
    keys: subJson.keys,
  });
  support.value = 'subscribed';
  return { ok: true };
  */

  // Phase 1 stub:
  return { ok: false, reason: 'pwa_sw_not_built_yet' };
}

export async function optOutOfPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    support.value = 'opted-out';
  } catch { /* ignore */ }
}

function _urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}
// Keep helper reachable for Phase 2 when block trong optInToPush được uncomment.
void _urlBase64ToUint8Array;

export function usePushNotifications() {
  return {
    support,
    vapidKey,
    checkSupport,
    optIn: optInToPush,
    optOut: optOutOfPush,
  };
}