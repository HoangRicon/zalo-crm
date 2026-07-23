<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!-- KbImagePreview.vue — 2026-07-24 — load thumbnail ảnh từ MediaAssetItem theo assetId. -->
<template>
  <div class="kbimg">
    <img v-if="url" :src="url" :alt="alt" loading="lazy" @error="errored = true" />
    <div v-else-if="errored" class="kbimg-fail">
      <v-icon icon="mdi-image-off-outline" size="20" />
    </div>
    <div v-else class="kbimg-loading">
      <v-progress-circular indeterminate :size="16" :width="2" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { listMedia } from '@/api/media';

const props = defineProps<{ assetId: string; alt?: string }>();
const url = ref<string | null>(null);
const errored = ref(false);

async function load() {
  errored.value = false;
  url.value = null;
  try {
    const items = await listMedia({ limit: 200 });
    const m = items.find((it) => it.id === props.assetId);
    if (m) url.value = m.thumbnailUrl || m.url || null;
    else errored.value = true;
  } catch {
    errored.value = true;
  }
}

watch(() => props.assetId, load, { immediate: true });
</script>

<style scoped>
.kbimg { width: 100%; height: 100%; background: #F4F4F7; display: flex; align-items: center; justify-content: center; }
.kbimg img { width: 100%; height: 100%; object-fit: cover; }
.kbimg-fail, .kbimg-loading { color: #97A0AC; }
</style>
