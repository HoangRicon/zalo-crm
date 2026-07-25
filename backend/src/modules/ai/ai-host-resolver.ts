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
 * Auto-detect: nếu đang chạy trong container (file /.dockerenv tồn tại) → bật
 * resolve mặc định. Override qua env `RUNNING_IN_DOCKER=1` (force on) hoặc
 * `RUNNING_IN_DOCKER=0` (force off) để phòng edge-case (vd Podman không tạo
 * /.dockerenv, hoặc dev cố ý chạy container nhưng muốn tắt mapping).
 */

/* Cached 1 lần lúc boot — fs.existsSync mỗi call tốn ~1 syscall, không cần. */
const isInContainer = (() => {
  try {
    // Node 20+. Đồng bộ, không async, không await được nhưng isInContainer
    // chỉ chạy khi resolveHost() được gọi → chỉ trả 1 lần là đủ.
    // require('node:fs') để bundle tree-shake đúng.
    return require('node:fs').existsSync('/.dockerenv');
  } catch {
    return false;
  }
})();

function isRunningInDockerEnv(): boolean {
  const env = process.env.RUNNING_IN_DOCKER;
  if (env === '1') return true;   // force on
  if (env === '0') return false;  // force off
  return isInContainer;           // auto-detect
}

export function resolveHost(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (!isRunningInDockerEnv()) return rawUrl;
  return rawUrl
    .replace('localhost', 'host.docker.internal')
    .replace('127.0.0.1', 'host.docker.internal');
}

export function isRunningInDocker(): boolean {
  return isRunningInDockerEnv();
}