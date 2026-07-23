<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="nf-shell">
    <div class="nf-card">
      <v-icon icon="mdi-map-marker-question-outline" size="96" color="primary" />
      <h1 class="nf-title">404 — Không tìm thấy trang</h1>
      <p class="nf-sub">
        Đường dẫn bạn mở không tồn tại hoặc đã được di chuyển. Vui lòng kiểm tra lại URL hoặc quay lại trang trước.
      </p>
      <div class="nf-actions">
        <v-btn color="primary" variant="flat" prepend-icon="mdi-arrow-left" @click="goBack">
          Quay lại trang trước
        </v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-home-outline" to="/">
          Về trang chủ
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) window.history.back();
  else window.location.href = '/';
}
</script>

<style scoped>
.nf-shell {
  display: flex; align-items: center; justify-content: center;
  min-height: calc(100vh - 80px); padding: 24px;
}
.nf-card {
  max-width: 480px; text-align: center;
  background: var(--smax-bg, #fff);
  border: 1px solid var(--smax-grey-200, #e5e7eb);
  border-radius: 12px;
  padding: 48px 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}
.nf-title { font-size: 22px; font-weight: 600; margin: 16px 0 8px; color: var(--smax-text, #1f2937); }
.nf-sub { color: var(--smax-grey-700, #6b7280); font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
.nf-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
</style>
