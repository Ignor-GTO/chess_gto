<template>
  <nav class="app-nav">
    <!-- Лого -->
    <router-link :to="homeLink" class="nav-logo">
      ♟ <span>Chess GTO</span>
    </router-link>

    <!-- Основные ссылки — только для авторизованных -->
    <div v-if="authStore.isAuthenticated" class="nav-links">
      <router-link to="/lobby"   class="nav-link">{{ $t('nav.play') }}</router-link>
      <router-link to="/profile" class="nav-link">{{ $t('nav.profile') }}</router-link>
    </div>

    <!-- Правая часть: язык + пользователь -->
    <div class="nav-right">
      <!-- Переключатель языка -->
      <div class="lang-switcher">
        <button
          v-for="lang in langs"
          :key="lang.code"
          class="lang-btn"
          :class="{ active: currentLang === lang.code }"
          @click="changeLang(lang.code)"
        >
          {{ lang.flag }}
        </button>
      </div>

      <!-- Пользователь -->
      <div v-if="authStore.isAuthenticated" class="user-menu" @click="menuOpen = !menuOpen">
        <span class="user-rating">{{ Math.round(authStore.user?.rating || 0) }}</span>
        <span class="user-name">{{ authStore.user?.username }}</span>
        <span class="arrow">{{ menuOpen ? '▲' : '▼' }}</span>

        <!-- Дропдаун -->
        <div v-if="menuOpen" class="dropdown" @click.stop>
          <router-link to="/profile" class="dropdown-item" @click="menuOpen = false">
            👤 {{ $t('nav.profile') }}
          </router-link>
          <button @click="logout" class="dropdown-item danger">
            🚪 {{ $t('nav.logout') }}
          </button>
        </div>
      </div>
      <router-link
        v-else-if="route.path === '/login'"
        to="/register"
        class="btn-login btn-login-outline"
      >
        {{ $t('auth.register') }}
      </router-link>
      <router-link
        v-else-if="route.path === '/register'"
        to="/login"
        class="btn-login btn-login-outline"
      >
        {{ $t('auth.login') }}
      </router-link>
      <router-link v-else to="/login" class="btn-login">{{ $t('auth.login') }}</router-link>
    </div>

    <!-- Мобильное меню (нижняя панель) -->
    <div class="mobile-nav">
      <template v-if="authStore.isAuthenticated">
        <router-link to="/lobby"   class="mobile-link"><span>♟</span>{{ $t('nav.play') }}</router-link>
        <router-link to="/profile" class="mobile-link"><span>👤</span>{{ $t('nav.profile') }}</router-link>
      </template>
      <router-link
        v-else-if="route.path === '/login'"
        to="/register"
        class="mobile-link"
      >
        <span>✨</span>{{ $t('auth.register') }}
      </router-link>
      <router-link
        v-else-if="route.path === '/register'"
        to="/login"
        class="mobile-link"
      >
        <span>🔑</span>{{ $t('auth.login') }}
      </router-link>
      <router-link v-else to="/login" class="mobile-link">
        <span>🔑</span>{{ $t('auth.login') }}
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/useAuthStore';
import { setLanguage } from '@/plugins/i18n';

const route     = useRoute();
const router    = useRouter();
const authStore = useAuthStore();
const { locale } = useI18n();
const menuOpen  = ref(false);

const homeLink = computed(() => (
  authStore.isAuthenticated ? '/lobby' : '/login'
));

const currentLang = ref(locale.value);
const langs = [
  { code: 'ru', flag: '🇷🇺' },
  { code: 'uz', flag: '🇺🇿' },
  { code: 'en', flag: '🇬🇧' },
];

function changeLang(code) {
  setLanguage(code);
  currentLang.value = code;
}

async function logout() {
  menuOpen.value = false;
  await authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.app-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: rgba(15, 15, 26, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}

.nav-logo {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
}
.nav-logo span { background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

.nav-links { display: flex; gap: 1.5rem; margin-left: 1rem; }
.nav-link {
  color: var(--color-text-muted);
  font-weight: 500;
  transition: color 0.15s;
  text-decoration: none;
}
.nav-link:hover, .nav-link.router-link-active { color: var(--color-text); }

.nav-right { margin-left: auto; display: flex; align-items: center; gap: 1rem; }

/* Язык */
.lang-switcher { display: flex; gap: 4px; }
.lang-btn {
  width: 28px; height: 28px;
  border-radius: 50%;
  font-size: 1rem;
  background: transparent;
  opacity: 0.5;
  transition: opacity 0.15s;
  cursor: pointer;
}
.lang-btn.active, .lang-btn:hover { opacity: 1; }

/* Пользователь */
.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  user-select: none;
}
.user-rating {
  font-weight: 700;
  color: var(--color-accent);
  font-size: 0.85rem;
}
.user-name { font-size: 0.9rem; }
.arrow { font-size: 0.6rem; color: var(--color-text-muted); }

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 160px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  text-align: left;
  color: var(--color-text);
  text-decoration: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.1s;
}
.dropdown-item:hover { background: var(--color-surface2); }
.dropdown-item.danger { color: var(--color-danger); }

.btn-login {
  padding: 0.4rem 0.9rem;
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
}
.btn-login-outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

/* Мобильная нижняя панель */
.mobile-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: rgba(15,15,26,0.95);
  border-top: 1px solid var(--color-border);
  padding: 0.5rem;
  justify-content: space-around;
  z-index: 200;
}
.mobile-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.7rem;
}
.mobile-link.router-link-active { color: var(--color-accent); }

@media (max-width: 600px) {
  .nav-links { display: none; }
  .mobile-nav { display: flex; }
  .app-nav { padding: 0.5rem 1rem; }
}
</style>
