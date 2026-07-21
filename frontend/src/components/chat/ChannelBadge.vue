<template>
  <span class="channel-badge" :class="`channel-${channel}`" :title="title">
    {{ icon }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ channel: 'zalo' | 'telegram' | 'facebook' | 'instagram' | 'sms' }>();

const icon = computed(() => {
  switch (props.channel) {
    case 'zalo': return '💬';
    case 'telegram': return '✈️';
    case 'facebook': return '📘';
    case 'instagram': return '📸';
    case 'sms': return '📱';
    default: return '?';
  }
});

const title = computed(() => props.channel.charAt(0).toUpperCase() + props.channel.slice(1));
</script>

<style scoped>
.channel-badge {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 10px;
  flex-shrink: 0;
}
.channel-zalo { background: #e0f2fe; }
.channel-telegram { background: #cffafe; }
.channel-facebook { background: #dbeafe; }
.channel-instagram { background: linear-gradient(135deg, #fdf2f8, #fce7f3); }
.channel-sms { background: #f1f5f9; }
</style>
