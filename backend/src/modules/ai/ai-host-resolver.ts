// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * ai-host-resolver.ts — Map localhost / 127.0.0.1 → host.docker.internal khi
 * backend chạy trong Docker. Lý do: `localhost` bên trong container trỏ về
 * chính container, không phải máy host — vì vậy user config
 * `http://localhost:20128/v1` (trỏ tới 9router chạy ở host) sẽ fail
 * ECONNREFUSED. `host.docker.internal` là DNS do Docker cung cấp trỏ về
 * host gateway.
 *
 * Áp dụng khi `RUNNING_IN_DOCKER === '1'` (set trong docker-compose.dev.yml).
 * Tắt khi chạy ngoài Docker (dev trực tiếp trên host).
 */
export function resolveHost(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (process.env.RUNNING_IN_DOCKER !== '1') return rawUrl;
  return rawUrl
    .replace('localhost', 'host.docker.internal')
    .replace('127.0.0.1', 'host.docker.internal');
}

export function isRunningInDocker(): boolean {
  return process.env.RUNNING_IN_DOCKER === '1';
}