/**
 * main.js — точка входа Vue приложения
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import { i18n } from './plugins/i18n';

// ─── Маршруты ─────────────────────────────────────────────────────────────────

const routes = [
  {
    path: '/',
    redirect: '/lobby',
  },
  {
    path: '/login',
    component: () => import('./views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    component: () => import('./views/RegisterView.vue'),
    meta: { public: true },
  },
  {
    path: '/lobby',
    component: () => import('./views/LobbyView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/game/bot',
    component: () => import('./views/BotGameView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/game/:id',
    component: () => import('./views/GameView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/analysis/:id',  // id может быть UUID или 'bot'
    component: () => import('./views/AnalysisView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    component: () => import('./views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/:username',
    component: () => import('./views/ProfileView.vue'),
    meta: { public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('./views/NotFoundView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// ─── Навигационный guard (проверка авторизации) ───────────────────────────────

router.beforeEach((to) => {
  const token = localStorage.getItem('access_token');
  if (to.meta.requiresAuth && !token) {
    return '/login';
  }
  if ((to.path === '/login' || to.path === '/register') && token) {
    return '/lobby';
  }
});

// ─── Инициализация приложения ─────────────────────────────────────────────────

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(i18n);

app.mount('#app');
