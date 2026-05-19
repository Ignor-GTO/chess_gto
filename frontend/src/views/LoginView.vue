<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- Лого -->
      <div class="auth-logo">♟ Chess GTO</div>
      <h1 class="auth-title">{{ $t('auth.login') }}</h1>

      <form @submit.prevent="handleLogin" class="auth-form">
        <!-- Username -->
        <div class="field">
          <label>{{ $t('auth.username') }}</label>
          <input
            v-model="form.username"
            type="text"
            autocomplete="username"
            :class="{ error: errors.username }"
            @input="errors.username = ''"
          />
          <span v-if="errors.username" class="field-error">{{ errors.username }}</span>
        </div>

        <!-- Password -->
        <div class="field">
          <label>{{ $t('auth.password') }}</label>
          <div class="input-eye">
            <input
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              autocomplete="current-password"
              :class="{ error: errors.password }"
              @input="errors.password = ''"
            />
            <button type="button" class="eye-btn" @click="showPwd = !showPwd">
              {{ showPwd ? '🙈' : '👁' }}
            </button>
          </div>
          <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        </div>

        <!-- Ошибка сервера -->
        <div v-if="serverError" class="server-error">
          ⚠️ {{ serverError }}
        </div>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading" class="spinner-sm"></span>
          {{ loading ? 'Вход...' : $t('auth.login') }}
        </button>
      </form>

      <p class="auth-switch">
        {{ $t('auth.noAccount') }}
        <router-link to="/register">{{ $t('auth.register') }}</router-link>
      </p>
    </div>

    <!-- Фоновая анимация -->
    <div class="auth-bg">
      <div class="bg-piece" v-for="i in 8" :key="i">♟</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';

const router    = useRouter();
const authStore = useAuthStore();

const form = reactive({ username: '', password: '' });
const errors = reactive({ username: '', password: '' });
const serverError = ref('');
const loading  = ref(false);
const showPwd  = ref(false);

function validate() {
  errors.username = form.username.trim() ? '' : 'Введите имя пользователя';
  errors.password = form.password        ? '' : 'Введите пароль';
  return !errors.username && !errors.password;
}

async function handleLogin() {
  if (!validate()) return;
  loading.value = true;
  serverError.value = '';
  const ok = await authStore.login(form.username.trim(), form.password);
  loading.value = false;
  if (ok) {
    router.push('/lobby');
  } else {
    serverError.value = authStore.error || 'Неверный логин или пароль';
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

.auth-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  margin: 1rem;
  padding: 2.5rem 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
}

.auth-logo {
  text-align: center;
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}
.auth-title {
  text-align: center;
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.auth-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.85rem; color: var(--color-text-muted); font-weight: 500; }
.field input {
  padding: 0.65rem 0.9rem;
  background: var(--color-surface2);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.15s;
  width: 100%;
}
.field input:focus   { outline: none; border-color: var(--color-accent); }
.field input.error   { border-color: var(--color-danger); }
.field-error { font-size: 0.78rem; color: var(--color-danger); }

.input-eye { position: relative; }
.input-eye input { padding-right: 2.5rem; }
.eye-btn {
  position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
  background: none; font-size: 1rem; cursor: pointer; padding: 0.2rem;
}

.server-error {
  padding: 0.6rem 0.9rem;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: 0.85rem;
}

.btn-submit {
  margin-top: 0.5rem;
  padding: 0.8rem;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent2));
  color: white;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.spinner-sm {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.auth-switch {
  text-align: center;
  margin-top: 1.2rem;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
.auth-switch a { color: var(--color-accent); font-weight: 500; }

/* Анимированный фон с шахматными фигурами */
.auth-bg {
  position: absolute; inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.bg-piece {
  position: absolute;
  font-size: 4rem;
  opacity: 0.03;
  animation: float 12s ease-in-out infinite;
  color: white;
}
.bg-piece:nth-child(1)  { top: 10%; left: 5%;   animation-delay: 0s; }
.bg-piece:nth-child(2)  { top: 20%; right: 8%;  animation-delay: 1.5s; font-size: 6rem; }
.bg-piece:nth-child(3)  { top: 60%; left: 12%;  animation-delay: 3s; }
.bg-piece:nth-child(4)  { bottom: 15%; right: 15%; animation-delay: 4.5s; font-size: 5rem; }
.bg-piece:nth-child(5)  { top: 40%; left: 55%;  animation-delay: 2s; font-size: 3rem; }
.bg-piece:nth-child(6)  { bottom: 30%; left: 30%; animation-delay: 6s; }
.bg-piece:nth-child(7)  { top: 80%; right: 40%; animation-delay: 1s; font-size: 5rem; }
.bg-piece:nth-child(8)  { top: 5%;  left: 45%;  animation-delay: 3.5s; font-size: 7rem; }

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%       { transform: translateY(-20px) rotate(5deg); }
}
</style>
