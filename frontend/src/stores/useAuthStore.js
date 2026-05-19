/**
 * useAuthStore.js — Pinia store для аутентификации
 *
 * JWT для API + Session cookie для веба.
 * Токены хранятся в localStorage (для мобильного/браузера).
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from '@/plugins/axios';

export const useAuthStore = defineStore('auth', () => {
  const accessToken  = ref(localStorage.getItem('access_token') || null);
  const refreshToken = ref(localStorage.getItem('refresh_token') || null);
  const user         = ref(null);
  const loading      = ref(false);
  const error        = ref(null);

  const isAuthenticated = computed(() => !!accessToken.value);
  const isStaff = computed(() => !!user.value?.is_staff);

  // ─── Авторизация ──────────────────────────────────────────────────────────

  async function login(username, password) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await axios.post('/api/auth/token/', { username, password });
      setTokens(data.access, data.refresh);
      await fetchUser();
      return true;
    } catch (err) {
      error.value = err.response?.data?.detail || 'Ошибка входа';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(username, email, password) {
    loading.value = true;
    error.value = null;
    try {
      await axios.post('/api/auth/register/', { username, email, password });
      return await login(username, password);
    } catch (err) {
      error.value = err.response?.data || 'Ошибка регистрации';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await axios.post('/api/auth/token/blacklist/', { refresh: refreshToken.value });
    } catch {}
    clearTokens();
    user.value = null;
  }

  // ─── Обновление токена ────────────────────────────────────────────────────

  async function refreshAccessToken() {
    try {
      const { data } = await axios.post('/api/auth/token/refresh/', {
        refresh: refreshToken.value,
      });
      setTokens(data.access, refreshToken.value);
      return data.access;
    } catch {
      clearTokens();
      return null;
    }
  }

  // ─── Профиль ──────────────────────────────────────────────────────────────

  async function fetchUser() {
    const { data } = await axios.get('/api/users/me/');
    user.value = data;
  }

  // ─── Вспомогательные ─────────────────────────────────────────────────────

  function setTokens(access, refresh) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Инициализация при запуске
  if (accessToken.value) {
    fetchUser().catch(() => clearTokens());
  }

  return {
    accessToken, refreshToken, user, loading, error,
    isAuthenticated, isStaff,
    login, register, logout, refreshAccessToken, fetchUser,
  };
});
