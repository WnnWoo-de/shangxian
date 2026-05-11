<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  APP_ONBOARDING_REQUEST_EVENT,
  consumeOnboardingTutorialRequest,
  markOnboardingTutorialSeen,
  shouldAutoOpenOnboardingTutorial,
} from '@/utils/app-config'
import { showToast } from '@/utils/toast'

const props = defineProps({
  enabled: {
    type: Boolean,
    default: true,
  },
})

const router = useRouter()
const route = useRoute()
const open = ref(false)
const activeStepIndex = ref(0)
const lastRequestAt = ref(0)
const lastAutoOpenAt = ref(0)

const steps = [
  {
    id: 'welcome',
    eyebrow: '首次使用指南',
    title: '这个系统就按这个顺序用',
    summary: '先把客户和品种录进去，再开进货单、出货单，最后去列表查单、去报表看账，基本就够用了。',
    tips: [
      '左边菜单就是主入口，要去哪一项就点哪一项。',
      '首页“快速开始”放的都是最常用功能，平时可以直接从这里进。',
      '这份教程现在先看一遍，后面忘了也能在“设置”里再打开。',
    ],
    actionLabel: '去工作台看看',
    actionRoute: '/dashboard',
  },
  {
    id: 'master-data',
    eyebrow: '第 1 步',
    title: '先把常用客户和品种建好',
    summary: '第一次用，先把常做生意的客户和常用的品种录进去。后面开单直接选，会快很多。',
    tips: [
      '客户管理里主要录客户名字、联系人、电话。',
      '品种管理里主要录品种名字、编号，还有平时常用价格。',
      '如果开单时临时输了新客户或新品种，保存后系统也会顺手帮你记住。',
    ],
    actionLabel: '去客户管理',
    actionRoute: '/customer',
  },
  {
    id: 'purchase',
    eyebrow: '第 2 步',
    title: '进货了，就在这里开单',
    summary: '进货时把供货方、品种、重量、单价、已付款填进去，后面总金额和还差多少没付，系统都会帮你算好。',
    tips: [
      '供货方可以自己打字，也可以直接选以前录好的。',
      '品种也一样，直接选或者直接输都行。',
      '如果是过磅货，就把总重量和车皮重量填进去，净重系统会自己算。',
    ],
    actionLabel: '去进货开单',
    actionRoute: '/purchase/create',
  },
  {
    id: 'sale',
    eyebrow: '第 3 步',
    title: '出货了，就在这里开单',
    summary: '出货单和进货单差不多，主要是填客户、品种、重量、单价和已经收了多少钱，后面查账会很方便。',
    tips: [
      '如果这个客户以前有单独价格，选上后会自动带出来。',
      '一张单里有几个品种，就一行一行加上去。',
      '开完单可以直接导出表格或图片，发给客户很方便。',
    ],
    actionLabel: '去出货开单',
    actionRoute: '/sale/create',
  },
  {
    id: 'history',
    eyebrow: '第 4 步',
    title: '以前开的单，都在列表里查',
    summary: '要找以前的进货单、出货单，就来列表页。可以按客户、日期、结清没结清来筛，找到后还能继续看和改。',
    tips: [
      '上面会先告诉你现在筛出来一共多少单、多少钱、多少重量。',
      '中间筛选框就是拿来找单子的，条件一缩，小票就好找了。',
      '找到单子后，可以直接点查看、编辑，必要时也能删掉。',
    ],
    actionLabel: '去出货列表',
    actionRoute: '/sale/list',
  },
  {
    id: 'reports',
    eyebrow: '第 5 步',
    title: '账看得清不清楚，主要看这里',
    summary: '单子录多了以后，就来这里看这个月赚了多少、花了多少、还有谁没结清。',
    tips: [
      '数据统计先看个大概，收入、支出、利润一眼就能看见。',
      '月度报表就是看这个月的账，想导出的话直接点按钮就行。',
      '结算详情就是拿来对账的，谁还没结、差多少，在这里看最清楚。',
    ],
    actionLabel: '去月度报表',
    actionRoute: '/statistics/monthly',
  },
  {
    id: 'settings',
    eyebrow: '最后一步',
    title: '一些平时会改的东西都在这里',
    summary: '比如换亮一点还是暗一点，改导出图片上面的名字，或者重新看这份教程，都在这里。',
    tips: [
      '导出图片顶部标题，改成你自己想显示的名字就行。',
      '主题想亮一点还是暗一点，也是在这里切。',
      '以后新同事上手，直接从这里把教程再打开给他看就行。',
    ],
    actionLabel: '去系统设置',
    actionRoute: '/settings',
  },
]

const totalSteps = computed(() => steps.length)
const currentStep = computed(() => steps[activeStepIndex.value] || steps[0])
const progressText = computed(() => `${activeStepIndex.value + 1} / ${totalSteps.value}`)
const progressPercent = computed(() => `${((activeStepIndex.value + 1) / totalSteps.value) * 100}%`)
const isFirstStep = computed(() => activeStepIndex.value === 0)
const isLastStep = computed(() => activeStepIndex.value >= totalSteps.value - 1)

const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
}

const unlockBodyScroll = () => {
  document.body.style.overflow = ''
}

const openTutorial = ({ force = false } = {}) => {
  if (!props.enabled) return
  if (!force && open.value) return
  open.value = true
  activeStepIndex.value = 0
  lockBodyScroll()
}

const closeTutorial = ({ markSeen = false } = {}) => {
  if (!open.value) return
  open.value = false
  unlockBodyScroll()

  if (markSeen) {
    markOnboardingTutorialSeen()
  }
}

const nextStep = () => {
  if (isLastStep.value) {
    closeTutorial({ markSeen: true })
    showToast('教程已完成，后面可以在设置里再次打开', 'success')
    return
  }

  activeStepIndex.value += 1
}

const prevStep = () => {
  if (isFirstStep.value) return
  activeStepIndex.value -= 1
}

const jumpToStep = (index) => {
  if (index < 0 || index >= steps.length) return
  activeStepIndex.value = index
}

const openCurrentPage = async () => {
  const targetRoute = currentStep.value?.actionRoute
  if (!targetRoute) return
  if (route.path === targetRoute) return

  try {
    await router.push(targetRoute)
  } catch (error) {
    console.warn('Onboarding navigation failed:', error)
  }
}

const handleMaskClick = (event) => {
  if (event.target !== event.currentTarget) return
  closeTutorial({ markSeen: true })
}

const handleRequestEvent = (event) => {
  const requestedAt = Number(event?.detail?.requestedAt || 0)
  if (!requestedAt || requestedAt <= lastRequestAt.value) return
  lastRequestAt.value = requestedAt
  openTutorial({ force: true })
}

const tryConsumeManualRequest = () => {
  const requestedAt = consumeOnboardingTutorialRequest()
  if (!requestedAt || requestedAt <= lastRequestAt.value) return
  lastRequestAt.value = requestedAt
  openTutorial({ force: true })
}

const maybeAutoOpenTutorial = () => {
  if (!props.enabled) return
  if (!shouldAutoOpenOnboardingTutorial()) return
  if (lastAutoOpenAt.value) return

  lastAutoOpenAt.value = Date.now()
  openTutorial({ force: true })
}

watch(() => props.enabled, (enabled) => {
  if (!enabled) {
    closeTutorial()
    return
  }

  tryConsumeManualRequest()
  maybeAutoOpenTutorial()
}, { immediate: true })

onMounted(() => {
  tryConsumeManualRequest()
  maybeAutoOpenTutorial()
  window.addEventListener(APP_ONBOARDING_REQUEST_EVENT, handleRequestEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener(APP_ONBOARDING_REQUEST_EVENT, handleRequestEvent)
  unlockBodyScroll()
})
</script>

<template>
  <teleport to="body">
    <transition name="onboarding-fade">
      <div
        v-if="open"
        class="onboarding-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        @click="handleMaskClick"
      >
        <div class="onboarding-shell">
          <button type="button" class="onboarding-close" aria-label="关闭教程" @click="closeTutorial({ markSeen: true })">
            ×
          </button>

          <div class="onboarding-sidebar">
            <p class="onboarding-kicker">新手教程</p>
            <h2 id="onboarding-title">第一次用，先按这几步走就行</h2>
            <p class="onboarding-intro">不用想太复杂，这里就告诉你先点哪、再做什么，照着走一遍基本就会用了。</p>

            <div class="onboarding-progress-bar">
              <div class="onboarding-progress-fill" :style="{ width: progressPercent }"></div>
            </div>

            <div class="onboarding-step-list">
              <button
                v-for="(step, index) in steps"
                :key="step.id"
                type="button"
                :class="['onboarding-step-chip', { active: index === activeStepIndex }]"
                @click="jumpToStep(index)"
              >
                <span class="chip-index">{{ index + 1 }}</span>
                <span class="chip-title">{{ step.title }}</span>
              </button>
            </div>
          </div>

          <div class="onboarding-main">
            <div class="onboarding-topline">
              <span>{{ currentStep.eyebrow }}</span>
              <strong>{{ progressText }}</strong>
            </div>

            <div class="onboarding-card">
              <div class="onboarding-card-head">
                <h3>{{ currentStep.title }}</h3>
                <p>{{ currentStep.summary }}</p>
              </div>

              <ul class="onboarding-tip-list">
                <li v-for="tip in currentStep.tips" :key="tip">{{ tip }}</li>
              </ul>

              <div class="onboarding-highlight">
                <span class="highlight-label">直接去看</span>
                <strong>{{ currentStep.actionLabel }}</strong>
                <p>想边看边试的话，点下面按钮就能直接跳过去。</p>
              </div>
            </div>

            <div class="onboarding-actions">
              <div class="actions-left">
                <button type="button" class="ghost-btn" :disabled="isFirstStep" @click="prevStep">上一步</button>
                <button type="button" class="ghost-btn" @click="closeTutorial({ markSeen: true })">先跳过</button>
              </div>

              <div class="actions-right">
                <button type="button" class="secondary-btn" @click="openCurrentPage">打开对应页面</button>
                <button type="button" class="primary-btn" @click="nextStep">
                  {{ isLastStep ? '完成教程' : '下一步' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped lang="scss">
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(circle at top left, rgba(158, 207, 194, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(227, 187, 122, 0.2), transparent 30%),
    rgba(39, 31, 23, 0.46);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.onboarding-shell {
  position: relative;
  width: min(1080px, 100%);
  min-height: min(720px, calc(100vh - 40px));
  max-height: calc(100vh - 40px);
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255, 250, 243, 0.98) 0%, rgba(247, 238, 226, 0.97) 100%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 40px 90px rgba(38, 30, 22, 0.24);
}

.onboarding-close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 2;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(106, 93, 82, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: $text-primary;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: transform $transition-fast, background $transition-normal;
}

.onboarding-close:hover {
  transform: scale(1.04);
  background: rgba(255, 250, 243, 0.96);
}

.onboarding-sidebar {
  position: relative;
  padding: 38px 28px 28px;
  background:
    radial-gradient(circle at left top, rgba(227, 187, 122, 0.22), transparent 34%),
    linear-gradient(180deg, rgba(255, 248, 238, 0.96) 0%, rgba(244, 232, 214, 0.94) 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.7);
}

.onboarding-sidebar::after {
  content: '';
  position: absolute;
  right: -60px;
  bottom: -60px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(158, 207, 194, 0.22), transparent 68%);
  pointer-events: none;
}

.onboarding-kicker {
  margin: 0 0 12px;
  color: $secondary-dark;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.onboarding-sidebar h2 {
  margin: 0;
  color: #57483b;
  font-size: 30px;
  line-height: 1.14;
}

.onboarding-intro {
  margin: 16px 0 0;
  color: $text-secondary;
  font-size: 14px;
  line-height: 1.8;
}

.onboarding-progress-bar {
  height: 6px;
  margin-top: 22px;
  border-radius: 999px;
  background: rgba(227, 187, 122, 0.2);
  overflow: hidden;
}

.onboarding-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #e3bb7a 0%, #9ecfc2 100%);
  transition: width $transition-normal;
}

.onboarding-step-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
}

.onboarding-step-chip {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(106, 93, 82, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.56);
  color: $text-primary;
  text-align: left;
  cursor: pointer;
  transition: transform $transition-fast, background $transition-normal, border-color $transition-normal;
}

.onboarding-step-chip:hover,
.onboarding-step-chip.active {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(227, 187, 122, 0.28);
}

.chip-index {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(227, 187, 122, 0.9), rgba(158, 207, 194, 0.78));
  color: #4b4035;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.chip-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.onboarding-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 38px 34px 30px;
  min-height: 0;
}

.onboarding-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: $text-secondary;
  font-size: 13px;
}

.onboarding-topline strong {
  color: $text-primary;
  font-size: 15px;
}

.onboarding-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 20px 44px rgba(179, 153, 123, 0.1);
  overflow-y: auto;
  @include scrollbar-beautiful;
}

.onboarding-card-head h3 {
  margin: 0;
  color: #2b241e;
  font-size: 32px;
  line-height: 1.15;
}

.onboarding-card-head p {
  margin: 14px 0 0;
  color: $text-secondary;
  font-size: 16px;
  line-height: 1.8;
}

.onboarding-tip-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.onboarding-tip-list li {
  position: relative;
  padding: 16px 18px 16px 48px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 249, 239, 0.96), rgba(248, 244, 237, 0.9));
  color: $text-primary;
  font-size: 15px;
  line-height: 1.7;
  border: 1px solid rgba(227, 187, 122, 0.18);
}

.onboarding-tip-list li::before {
  content: '✓';
  position: absolute;
  left: 18px;
  top: 16px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(158, 207, 194, 0.24);
  color: #2d695c;
  font-size: 12px;
  font-weight: 800;
}

.onboarding-highlight {
  padding: 20px 22px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(227, 187, 122, 0.18), rgba(158, 207, 194, 0.14));
  border: 1px solid rgba(227, 187, 122, 0.22);
}

.highlight-label {
  display: inline-block;
  margin-bottom: 10px;
  color: $secondary-dark;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.onboarding-highlight strong {
  display: block;
  color: #3e3228;
  font-size: 24px;
  line-height: 1.2;
}

.onboarding-highlight p {
  margin: 10px 0 0;
  color: $text-secondary;
  font-size: 14px;
  line-height: 1.7;
}

.onboarding-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.actions-left,
.actions-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ghost-btn,
.secondary-btn,
.primary-btn {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform $transition-fast, background $transition-normal, border-color $transition-normal, color $transition-normal, box-shadow $transition-normal;
}

.ghost-btn {
  border: 1px solid rgba(106, 93, 82, 0.14);
  background: rgba(255, 255, 255, 0.65);
  color: $text-primary;
}

.ghost-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.92);
}

.ghost-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.secondary-btn {
  border: 1px solid rgba(125, 183, 173, 0.32);
  background: rgba(125, 183, 173, 0.12);
  color: #2f665b;
}

.secondary-btn:hover {
  transform: translateY(-1px);
  background: rgba(125, 183, 173, 0.18);
}

.primary-btn {
  border: none;
  background: linear-gradient(135deg, #e9cf9d 0%, #dcb372 100%);
  color: #5b4730;
  box-shadow: 0 14px 26px rgba(227, 187, 122, 0.22);
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(227, 187, 122, 0.28);
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity $transition-normal;
}

.onboarding-fade-enter-active .onboarding-shell,
.onboarding-fade-leave-active .onboarding-shell {
  transition: transform $transition-normal, opacity $transition-normal;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}

.onboarding-fade-enter-from .onboarding-shell,
.onboarding-fade-leave-to .onboarding-shell {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

@media (max-width: 900px) {
  .onboarding-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .onboarding-sidebar {
    padding: 28px 22px 18px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.7);
  }

  .onboarding-step-list {
    margin-top: 20px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-direction: row;
    padding-bottom: 4px;
  }

  .onboarding-step-chip {
    min-width: 220px;
  }

  .onboarding-main {
    padding: 24px 22px 22px;
  }

  .onboarding-card-head h3 {
    font-size: 28px;
  }
}

@media (max-width: 640px) {
  .onboarding-overlay {
    padding: 10px;
    align-items: stretch;
  }

  .onboarding-shell {
    width: 100%;
    max-height: none;
    border-radius: 24px;
  }

  .onboarding-close {
    top: 12px;
    right: 12px;
    width: 38px;
    height: 38px;
  }

  .onboarding-sidebar {
    padding: 22px 16px 16px;
  }

  .onboarding-sidebar h2 {
    padding-right: 38px;
    font-size: 24px;
  }

  .onboarding-intro {
    font-size: 13px;
  }

  .onboarding-step-chip {
    min-width: 186px;
    padding: 12px 14px;
  }

  .onboarding-main {
    gap: 14px;
    padding: 16px;
  }

  .onboarding-card {
    padding: 18px;
    border-radius: 20px;
  }

  .onboarding-card-head h3 {
    font-size: 22px;
  }

  .onboarding-card-head p,
  .onboarding-tip-list li,
  .onboarding-highlight p {
    font-size: 14px;
  }

  .onboarding-highlight strong {
    font-size: 20px;
  }

  .onboarding-actions,
  .actions-left,
  .actions-right {
    width: 100%;
  }

  .actions-left,
  .actions-right {
    justify-content: stretch;
  }

  .ghost-btn,
  .secondary-btn,
  .primary-btn {
    flex: 1 1 calc(50% - 5px);
  }
}

:global(html[data-theme='dark']) .onboarding-shell {
  background: linear-gradient(180deg, rgba(25, 28, 27, 0.98) 0%, rgba(18, 21, 20, 0.98) 100%);
  border-color: rgba(255, 255, 255, 0.08);
}

:global(html[data-theme='dark']) .onboarding-sidebar {
  background:
    radial-gradient(circle at left top, rgba(227, 187, 122, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(28, 31, 29, 0.98) 0%, rgba(21, 24, 23, 0.96) 100%);
  border-color: rgba(255, 255, 255, 0.08);
}

:global(html[data-theme='dark']) .onboarding-close,
:global(html[data-theme='dark']) .onboarding-step-chip,
:global(html[data-theme='dark']) .onboarding-card,
:global(html[data-theme='dark']) .ghost-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-normal);
}

:global(html[data-theme='dark']) .onboarding-sidebar h2,
:global(html[data-theme='dark']) .onboarding-card-head h3,
:global(html[data-theme='dark']) .onboarding-highlight strong,
:global(html[data-theme='dark']) .chip-title {
  color: var(--text-normal);
}

:global(html[data-theme='dark']) .onboarding-intro,
:global(html[data-theme='dark']) .onboarding-topline,
:global(html[data-theme='dark']) .onboarding-card-head p,
:global(html[data-theme='dark']) .onboarding-highlight p {
  color: var(--text-soft);
}

:global(html[data-theme='dark']) .onboarding-tip-list li {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(125, 183, 173, 0.16);
  color: var(--text-normal);
}

:global(html[data-theme='dark']) .onboarding-highlight {
  background: linear-gradient(135deg, rgba(227, 187, 122, 0.12), rgba(125, 183, 173, 0.12));
  border-color: rgba(227, 187, 122, 0.16);
}

:global(html[data-theme='dark']) .secondary-btn {
  background: rgba(125, 183, 173, 0.12);
  border-color: rgba(125, 183, 173, 0.22);
  color: #bfe3d9;
}

:global(html[data-theme='dark']) .primary-btn {
  color: #2d2418;
}
</style>
