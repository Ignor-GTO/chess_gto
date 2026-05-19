<template>
  <div class="move-list" :class="{ embedded }">
    <div class="move-list-header">Ходы</div>
    <div class="move-list-body" ref="bodyRef">
      <div
        v-for="(pair, idx) in movePairs"
        :key="idx"
        class="move-row"
        :class="{ active: isActiveRow(idx) }"
      >
        <span class="move-num">{{ idx + 1 }}.</span>
        <button
          class="move-san"
          :class="{ active: currentIdx === idx * 2 + 1 }"
          @click="emit('jump', idx * 2 + 1)"
        >
          {{ pair.white || '…' }}
        </button>
        <button
          v-if="pair.black"
          class="move-san"
          :class="{ active: currentIdx === idx * 2 + 2 }"
          @click="emit('jump', idx * 2 + 2)"
        >
          {{ pair.black }}
        </button>
        <span v-else class="move-san empty" />
      </div>
      <p v-if="!moveSans.length" class="empty-msg">Партия ещё не началась</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps({
  moveSans: { type: Array, default: () => [] },
  currentIdx: { type: Number, default: 0 },
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(['jump']);

const bodyRef = ref(null);

const movePairs = computed(() => {
  const pairs = [];
  for (let i = 0; i < props.moveSans.length; i += 2) {
    pairs.push({
      white: props.moveSans[i],
      black: props.moveSans[i + 1] || null,
    });
  }
  return pairs;
});

function isActiveRow(idx) {
  const w = idx * 2 + 1;
  const b = idx * 2 + 2;
  return props.currentIdx === w || props.currentIdx === b;
}

watch(() => props.currentIdx, async () => {
  await nextTick();
  const el = bodyRef.value?.querySelector('.move-san.active, .move-row.active');
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
</script>

<style scoped>
.move-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  max-height: min(70vh, 560px);
}

.move-list.embedded {
  border: none;
  border-radius: 0;
  background: transparent;
  min-height: 0;
  max-height: none;
  flex: 1;
}

.move-list-header {
  padding: 0.6rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface2);
}

.move-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.35rem 0;
}

.move-row {
  display: grid;
  grid-template-columns: 2rem 1fr 1fr;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  align-items: center;
}

.move-row.active {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.move-num {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-align: right;
  padding-right: 0.25rem;
}

.move-san {
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 500;
  text-align: left;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.move-san:hover {
  background: var(--color-surface2);
}

.move-san.active {
  background: var(--color-accent);
  color: #fff;
  font-weight: 600;
}

.move-san.empty {
  cursor: default;
}

.empty-msg {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
