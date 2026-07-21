<template>
  <div class="ab-variants-editor">
    <p class="hint">A/B test: chia đều KH cho {{ variantCount }} variants. Mỗi variant có messageText riêng.</p>

    <div class="variant-cards">
      <div v-for="(_, i) in modelValue" :key="i" class="variant-card">
        <div class="variant-header">
          <span class="group-badge">{{ groupLetter(i) }}</span>
          <span class="variant-title">Variant {{ groupLetter(i) }}</span>
          <button v-if="modelValue.length > 2" class="btn-remove" @click="removeVariant(i)" title="Xoá variant">×</button>
        </div>
        <textarea
          v-model="modelValue[i]"
          rows="3"
          placeholder="Tin nhắn variant {{ten}} {{sdt}}"
          maxlength="500"
          class="variant-input"
        />
        <div class="char-count">{{ modelValue[i]?.length ?? 0 }}/500</div>
      </div>
    </div>

    <button
      v-if="modelValue.length < 3"
      class="btn-add"
      @click="addVariant"
    >
      <v-icon size="14">mdi-plus</v-icon>
      Thêm variant ({{ groupLetter(modelValue.length) }})
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [v: string[]] }>();

const variantCount = computed(() => props.modelValue.length);

function groupLetter(i: number): 'A' | 'B' | 'C' {
  return (['A', 'B', 'C'] as const)[i] ?? 'A';
}

function addVariant() {
  const next = [...props.modelValue, ''];
  emit('update:modelValue', next);
}

function removeVariant(i: number) {
  const next = props.modelValue.filter((_, idx) => idx !== i);
  emit('update:modelValue', next);
}
</script>

<style scoped>
.ab-variants-editor {
  border: 1px dashed var(--accent, #10b981);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-subtle, #f8fafc);
}
.hint {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin: 0 0 8px;
}
.variant-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.variant-card {
  background: var(--bg-surface, #fff);
  border-radius: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
}
.variant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.group-badge {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: var(--accent, #10b981);
  color: white;
  font-weight: 700;
  font-size: 12px;
}
.variant-title {
  font-size: 13px;
  font-weight: 600;
}
.btn-remove {
  margin-left: auto;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted, #64748b);
}
.variant-input {
  width: 100%;
  border-radius: 4px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
}
.char-count {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  text-align: right;
}
.btn-add {
  margin-top: 8px;
  background: transparent;
  border: 1px dashed var(--accent, #10b981);
  color: var(--accent, #10b981);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
