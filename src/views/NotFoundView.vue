<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/dashboard')
}
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-container">
      <div class="not-found-icon">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#e5e7eb" />
          <circle cx="35" cy="40" r="5" fill="#6b7280" />
          <circle cx="65" cy="40" r="5" fill="#6b7280" />
          <path
            d="M 30 60 Q 50 70 70 60"
            stroke="#6b7280"
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <div class="not-found-content">
        <h1 class="not-found-title">404</h1>
        <p class="not-found-message">抱歉，您访问的页面不存在</p>
        <p class="not-found-desc">您可能输入了错误的地址，或者该页面已被移动或删除。</p>
      </div>

      <div class="not-found-actions">
        <button class="btn-primary" @click="goHome">
          回到首页
        </button>
        <button class="btn-secondary" @click="window.history.back()">
          返回上页
        </button>
      </div>
    </div>

    <div class="not-found-footer">
      <p>如果您认为这是一个错误，请联系系统管理员。</p>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  min-height: 100vh;
  background-color: var(--bg-main);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.not-found-container {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 24px;
  padding: 48px;
  text-align: center;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  max-width: 500px;
  width: 100%;
}

.not-found-icon {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  animation: float 3s ease-in-out infinite;
}

.not-found-title {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.not-found-message {
  font-size: 20px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.not-found-desc {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 32px;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  padding: 12px 24px;
  background: white;
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.not-found-footer {
  margin-top: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (max-width: 768px) {
  .not-found-container {
    padding: 32px 24px;
  }

  .not-found-icon {
    width: 100px;
    height: 100px;
  }

  .not-found-title {
    font-size: 40px;
  }

  .not-found-message {
    font-size: 18px;
  }

  .not-found-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .not-found-container {
    padding: 24px 16px;
  }

  .not-found-icon {
    width: 80px;
    height: 80px;
  }

  .not-found-title {
    font-size: 36px;
  }

  .not-found-message {
    font-size: 16px;
  }

  .not-found-desc {
    font-size: 13px;
  }
}
</style>
