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
          <span v-if="badge(idx * 2)" class="move-badge" :class="'badge-' + badge(idx * 2)">
            {{ badgeIcon(badge(idx * 2)) }}
          </span>
          {{ pair.white || '…' }}
        </button>
        <button
          v-if="pair.black"
          class="move-san"
          :class="{ active: currentIdx === idx * 2 + 2 }"
          @click="emit('jump', idx * 2 + 2)"
        >
          <span v-if="badge(idx * 2 + 1)" class="move-badge" :class="'badge-' + badge(idx * 2 + 1)">
            {{ badgeIcon(badge(idx * 2 + 1)) }}
          </span>
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
  classifications: { type: Array, default: () => [] },
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

function badge(moveIndex) {
  return props.classifications[moveIndex] || null;
}

const BADGE_ICONS = {
  brilliant: '!!', best: '★', great: '!', excellent: '✓',
  good: '·', book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??',
};

function badgeIcon(cls) {
  return BADGE_ICONS[cls] || '';
}

function isActiveRow(idx) {
  const w = idx * 2 + 1;
  const b = idx * 2 + 2;
  return props.currentIdx === w || props.currentIdx === b;
}

watch(() => props.currentIdx, async () => {
  await nextTick();
  bodyRef.value?.querySelector('.move-san.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
  min-height: 0;
}

.move-list.embedded {
  border: none;
  border-radius: 0;
  background: transparent;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.move-list-header {
  padding: 8px 12px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface2);
  flex-shrink: 0;
}

.move-list-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

.move-row {
  display: grid;
  grid-template-columns: 2rem 1fr 1fr;
  gap: 4px;
  padding: 2px 8px;
  align-items: center;
}

.move-row.active {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}

.move-num {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  text-align: right;
}

.move-san {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: left;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.move-san:hover { background: var(--color-surface2); }
.move-san.active { background: var(--color-accent); color: #fff; }
.move-san.empty { cursor: default; }

.move-badge {
  font-size: 0.65rem;
  font-weight: 700;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.badge-blunder { background: #dc3545; color: #fff; }
.badge-mistake { background: #fd7e14; color: #fff; }
.badge-inaccuracy { background: #ffc107; color: #333; }
.badge-brilliant { background: #00bfa5; color: #fff; }
.badge-best { background: #28a745; color: #fff; }
.badge-great { background: #17a2b8; color: #fff; }

.empty-msg {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
