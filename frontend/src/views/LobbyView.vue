<template>
  <div class="lobby-view">
    <h1 class="lobby-title">♟ Chess GTO</h1>
    <p class="lobby-subtitle">{{ $t('lobby.title') }}</p>

    <!-- Табы: Онлайн / Против бота -->
    <div class="mode-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'online' }"
        @click="activeTab = 'online'"
      >
        🌐 {{ $t('lobby.tabs.online') }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'bot' }"
        @click="activeTab = 'bot'"
      >
        🤖 {{ $t('lobby.tabs.bot') }}
      </button>
    </div>

    <!-- ── Онлайн: выбор контроля времени ────────────────────────────────── -->
    <div v-if="activeTab === 'online'" class="time-controls">
      <div
        v-for="group in timeGroups"
        :key="group.name"
        class="time-group"
      >
        <h3 class="group-label">{{ group.label }}</h3>
        <div class="time-grid">
          <button
            v-for="tc in group.controls"
            :key="tc.value"
            class="tc-btn"
            :class="{ selected: selectedTC === tc.value, searching: isSearching && selectedTC === tc.value }"
            @click="selectTimeControl(tc.value)"
          >
            <span class="tc-icon">{{ tc.icon }}</span>
            <span class="tc-name">{{ tc.name }}</span>
            <span class="tc-time">{{ tc.display }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Поиск соперника ────────────────────────────────────────────────── -->
    <div v-if="isSearching" class="searching-block">
      <div class="search-spinner">
        <div class="spinner-ring"></div>
      </div>
      <p>{{ $t('lobby.searching') }}</p>
      <span class="search-timer">{{ searchTimer }}с</span>
      <button @click="cancelSearch" class="btn-cancel">{{ $t('lobby.cancel') }}</button>
    </div>

    <!-- ── Против бота: выбор уровня ──────────────────────────────────────── -->
    <div v-if="activeTab === 'bot'" class="bot-settings">
      <h3>{{ $t('lobby.bot.chooseLevel') }}</h3>
      <div class="bot-levels">
        <button
          v-for="(cfg, skill) in SKILL_CONFIGS"
          :key="skill"
          class="level-btn"
          :class="{ selected: selectedSkill == skill }"
          @click="selectedSkill = Number(skill)"
        >
          {{ cfg.label }}
        </button>
      </div>

      <h3 class="mt-4">{{ $t('lobby.bot.chooseColor') }}</h3>
      <div class="color-select">
        <button
          v-for="c in ['white','random','black']"
          :key="c"
          class="color-btn"
          :class="{ selected: selectedColor === c }"
          @click="selectedColor = c"
        >
          {{ c === 'white' ? '♔ Белые' : c === 'black' ? '♚ Чёрные' : '🎲 Случайно' }}
        </button>
      </div>

      <button class="btn-start-bot" @click="startBotGame">
        ▶ {{ $t('lobby.bot.start') }}
      </button>
    </div>

    <!-- Онлайн игроков -->
    <div class="online-count">
      🟢 {{ $t('lobby.onlineCount', { count: onlineCount }) }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import axios from '@/plugins/axios';
import { useAuthStore } from '@/stores/useAuthStore';
import { SKILL_CONFIGS } from '@/composables/useBotGame';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();

const activeTab     = ref('online');
const selectedTC    = ref('blitz_5');
const isSearching   = ref(false);
const searchTimer   = ref(0);
const onlineCount   = ref(0);
const selectedSkill = ref(10);
const selectedColor = ref('random');

let searchInterval = null;
let timerInterval = null;
let pollingInterval = null;
let presenceWs = null;

function wsBaseUrl() {
  const base = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return base.replace(/\/$/, '');
}

// ─── Группы контроля времени ──────────────────────────────────────────────────
const timeGroups = [
  {
    name: 'bullet', label: '⚡ Буллит',
    controls: [
      { value: 'bullet_1',   name: '1+0',   display: '1 мин',   icon: '⚡' },
      { value: 'bullet_1_1', name: '1+1',   display: '1+1',     icon: '⚡' },
      { value: 'bullet_2_1', name: '2+1',   display: '2+1',     icon: '⚡' },
    ],
  },
  {
    name: 'blitz', label: '🔥 Блиц',
    controls: [
      { value: 'blitz_3',   name: '3+0',   display: '3 мин',   icon: '🔥' },
      { value: 'blitz_3_2', name: '3+2',   display: '3+2',     icon: '🔥' },
      { value: 'blitz_5',   name: '5+0',   display: '5 мин',   icon: '🔥' },
      { value: 'blitz_5_3', name: '5+3',   display: '5+3',     icon: '🔥' },
    ],
  },
  {
    name: 'rapid', label: '🕐 Рапид',
    controls: [
      { value: 'rapid_10',    name: '10+0',  display: '10 мин',  icon: '🕐' },
      { value: 'rapid_10_5',  name: '10+5',  display: '10+5',    icon: '🕐' },
      { value: 'rapid_15_10', name: '15+10', display: '15+10',   icon: '🕐' },
    ],
  },
];

// ─── Поиск онлайн соперника ───────────────────────────────────────────────────

async function selectTimeControl(tc) {
  selectedTC.value = tc;
  isSearching.value = true;
  searchTimer.value = 0;

  // Отправляем запрос на создание/вступление в партию
  try {
    const { data } = await axios.post('/api/games/', { time_control: tc });

    if (data.opponent) {
      // Сразу нашли соперника
      router.push(`/game/${data.game_id}`);
      return;
    }

    // Начинаем поллинг (ждём, пока кто-то вступит)
    startPolling(data.game_id);
    startTimer();
  } catch (err) {
    isSearching.value = false;
    console.error('Ошибка поиска партии:', err);
  }
}

function startPolling(gameId) {
  pollingInterval = setInterval(async () => {
    try {
      const { data } = await axios.get(`/api/games/${gameId}/`);
      if (data.black_player && data.status !== 'finished') {
        cancelSearch();
        router.push(`/game/${gameId}`);
      }
    } catch {}
  }, 1500);
}

function startTimer() {
  timerInterval = setInterval(() => { searchTimer.value++; }, 1000);
}

function cancelSearch() {
  isSearching.value = false;
  clearInterval(pollingInterval);
  clearInterval(timerInterval);
  searchTimer.value = 0;
}

// ─── Игра против бота ─────────────────────────────────────────────────────────

function startBotGame() {
  const color = selectedColor.value === 'random'
    ? (Math.random() > 0.5 ? 'white' : 'black')
    : selectedColor.value;
  router.push({
    path: '/game/bot',
    query: { skill: selectedSkill.value, color },
  });
}

// ─── Онлайн счётчик ───────────────────────────────────────────────────────────

async function fetchOnlineCount() {
  try {
    const { data } = await axios.get('/api/users/online-count/');
    onlineCount.value = data.count || 0;
  } catch {
    onlineCount.value = 0;
  }
}

async function connectPresence() {
  if (!authStore.isAuthenticated) return;

  let token = authStore.accessToken;
  if (!token) return;

  presenceWs = new WebSocket(`${wsBaseUrl()}/ws/presence/?token=${token}`);

  presenceWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'online_count') onlineCount.value = data.count;
  };

  presenceWs.onclose = async (event) => {
    if (event.code === 4001) {
      const fresh = await authStore.refreshAccessToken();
      if (fresh) {
        connectPresence();
        return;
      }
    }
    setTimeout(connectPresence, 5000);
  };
}

onMounted(() => {
  fetchOnlineCount();
  connectPresence();
  searchInterval = setInterval(fetchOnlineCount, 30_000);
});

onUnmounted(() => {
  presenceWs?.close(1000);
  clearInterval(searchInterval);
  cancelSearch();
});
</script>

<style scoped>
.lobby-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.lobby-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
}
.lobby-subtitle { color: var(--color-text-muted); font-size: 1rem; }

/* Табы */
.mode-tabs {
  display: flex;
  gap: 0.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 4px;
}
.tab-btn {
  padding: 0.5rem 1.5rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 500;
  transition: all 0.2s;
}
.tab-btn.active {
  background: var(--color-accent);
  color: white;
}

/* Время */
.time-controls { width: 100%; }
.time-group { margin-bottom: 1.2rem; }
.group-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}
.time-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}
.tc-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.75rem 0.5rem;
  background: var(--color-surface);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text);
  transition: all 0.15s;
}
.tc-btn:hover { border-color: var(--color-accent); transform: translateY(-1px); }
.tc-btn.selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); }
.tc-btn.searching { animation: pulse 1.5s ease-in-out infinite; }
.tc-icon { font-size: 1.3rem; }
.tc-name { font-weight: 600; font-size: 0.9rem; }
.tc-time { font-size: 0.75rem; color: var(--color-text-muted); }

/* Поиск */
.searching-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.search-spinner { position: relative; width: 50px; height: 50px; }
.spinner-ring {
  width: 50px; height: 50px;
  border: 4px solid rgba(102,126,234,0.2);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.search-timer { font-size: 1.5rem; font-weight: bold; color: var(--color-accent); }
.btn-cancel {
  padding: 0.5rem 1.5rem;
  background: var(--color-danger);
  color: white;
  border-radius: var(--radius-sm);
}

/* Бот */
.bot-settings { width: 100%; }
.bot-levels, .color-select {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.75rem 0;
}
.level-btn, .color-btn {
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text);
  transition: all 0.15s;
  cursor: pointer;
}
.level-btn.selected, .color-btn.selected {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
}
.btn-start-bot {
  width: 100%;
  margin-top: 1rem;
  padding: 0.85rem;
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn-start-bot:hover { opacity: 0.9; }
.mt-4 { margin-top: 1rem; }
.online-count { font-size: 0.85rem; color: var(--color-text-muted); }
</style>
