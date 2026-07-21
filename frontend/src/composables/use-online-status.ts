// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * use-online-status.ts — Sprint 7 R12 (2026-07-21).
 *
 * Reactive wrapper cho navigator.onLine + 'online'/'offline' events.
 */
import { ref, onMounted, onUnmounted } from 'vue';

export function useOnlineStatus() {
  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);

  function setOnline() { isOnline.value = true; }
  function setOffline() { isOnline.value = false; }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
  });

  onUnmounted(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', setOnline);
    window.removeEventListener('offline', setOffline);
  });

  return { isOnline };
}