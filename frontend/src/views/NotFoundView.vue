<template>
  <div class="not-found">
    <div class="nf-content">
      <div class="nf-piece">♟</div>
      <h1>404</h1>
      <p>Страница не найдена</p>
      <router-link to="/lobby" class="btn-home">← На главную</router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nf-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.nf-piece { font-size: 5rem; animation: shake 2s ease-in-out infinite; }
@keyframes shake {
  0%,100% { transform: rotate(0); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}
h1 {
  font-size: 5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
p { color: var(--color-text-muted); font-size: 1.1rem; }
.btn-home {
  padding: 0.7rem 1.5rem;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent2));
  color: white;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn-home:hover { opacity: 0.9; }
</style>
