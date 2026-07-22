<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- TriggersTab.vue - Tab quản lý Triggers (placeholder) -->
<template>
  <div class="trg-tab">
    <h2 class="trg-title">⚡ Triggers</h2>
    <p class="trg-desc">Event-based triggers: rule chạy khi có event xảy ra (new friend, message, schedule).</p>
    <div class="empty">
      🚧 Triggers sẽ được thêm ở sprint tiếp theo. Hiện tại vui lòng sử dụng Auto Reply hoặc Sequences.
    </div>
  </div>
</template>

<style scoped>
.trg-tab { display: flex; flex-direction: column; gap: 12px; }
.trg-title { font-size: 16px; font-weight: 700; margin: 0; }
.trg-desc { color: #64748b; font-size: 13px; margin: 0; }
.empty { padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; }
</style>