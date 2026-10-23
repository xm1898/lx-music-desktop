<template>
  <div class="mini-root">
    <div class="drag-area">
      <div class="cover">
        <img v-if="playerState.pic" :src="playerState.pic" alt="" decoding="async">
        <div v-else class="cover-placeholder">
          <svg viewBox="0 0 24 24" class="cover-icon">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
          </svg>
        </div>
      </div>

      <div class="info">
        <div class="title" :title="playerState.name">{{ playerState.name || t('mini__no_song') }}</div>
        <div class="singer" :title="playerState.singer">{{ playerState.singer }}</div>
        <div class="progress" @click.stop="handleSeek">
          <div class="progress-inner" :style="{ width: progressPercent + '%' }" />
        </div>
        <div class="time">
          <span>{{ formatTime(playerState.time) }}</span>
          <span>{{ formatTime(playerState.duration) }}</span>
        </div>
      </div>

      <div class="controls">
        <button type="button" class="btn" :title="t('mini__prev')" @click.stop="handlePrev">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M6 5h2v14H6V5zm3.5 7L19 5v14l-9.5-7z" fill="currentColor" />
          </svg>
        </button>
        <button type="button" class="btn play-btn" :title="playerState.isPlay ? t('mini__pause') : t('mini__play')" @click.stop="handleTogglePlay">
          <svg v-if="playerState.isPlay" viewBox="0 0 24 24" class="icon">
            <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" fill="currentColor" />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="icon">
            <path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" />
          </svg>
        </button>
        <button type="button" class="btn" :title="t('mini__next')" @click.stop="handleNext">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M16 5h2v14h-2V5zM5 5l9.5 7L5 19V5z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div class="actions">
        <button type="button" class="btn small-btn" :class="{ active: isPinned }" :title="t('mini__pin')" @click.stop="handleTogglePin">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M14 3l7 7-2.5 1-1.5 4.5L13 12l-4 4-1 4-2-2 4-1 4-4-3.5-4L13 9.5 14 3z" fill="currentColor" />
          </svg>
        </button>
        <button type="button" class="btn small-btn" :title="t('mini__close')" @click.stop="handleClose">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4L10.6 10.6l6.3-6.3z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted } from '@common/utils/vueTools'
import { useI18n } from './plugins/i18n'
import { playerState } from './store/state'
import { onState, sendClose, sendControl, sendReady, sendToggleAlwaysOnTop } from './utils/ipc'

export default {
  name: 'MiniPlayer',
  setup() {
    const t = useI18n()

    const progressPercent = computed(() => {
      if (!playerState.duration) return 0
      return Math.min(100, Math.max(0, (playerState.time / playerState.duration) * 100))
    })

    const formatTime = (sec) => {
      const s = Math.max(0, Math.floor(sec || 0))
      const m = Math.floor(s / 60)
      return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    }

    const removeStateListener = onState(({ params }) => {
      Object.assign(playerState, params)
    })

    const handleTogglePlay = () => {
      sendControl('toggle')
    }
    const handlePrev = () => {
      sendControl('prev')
    }
    const handleNext = () => {
      sendControl('next')
    }
    const handleClose = () => {
      sendClose()
    }
    const handleTogglePin = () => {
      sendToggleAlwaysOnTop()
    }

    const handleSeek = (event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / rect.width
      const time = Math.floor(ratio * (playerState.duration || 0))
      if (time > 0) sendControl('seek', time)
    }

    // 置顶状态由主进程持有，这里通过 URL 参数拿到初始值
    const params = new URLSearchParams(window.location.search)
    const isPinned = params.get('pin') === '1'

    onMounted(() => {
      sendReady()
    })

    onBeforeUnmount(() => {
      removeStateListener()
    })

    return {
      t,
      playerState,
      progressPercent,
      formatTime,
      isPinned,
      handleTogglePlay,
      handlePrev,
      handleNext,
      handleClose,
      handleTogglePin,
      handleSeek,
    }
  },
}
</script>

<style scoped>
.mini-root {
  height: 100vh;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-primary-light-300-alpha-700, rgba(30, 30, 30, 0.92));
  backdrop-filter: blur(12px);
  color: var(--color-font, #eee);
  font-size: 13px;
  user-select: none;
}

.drag-area {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  padding: 8px 10px;
  box-sizing: border-box;
  -webkit-app-region: drag;
}

.drag-area button {
  -webkit-app-region: no-drag;
}

.cover {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
}

.cover-icon {
  width: 26px;
  height: 26px;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.singer {
  font-size: 11px;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress {
  height: 3px;
  margin-top: 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
}

.progress-inner {
  height: 100%;
  border-radius: 2px;
  background: var(--color-primary, #33bc5e);
  transition: width 0.2s linear;
}

.time {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  opacity: 0.5;
  font-variant-numeric: tabular-nums;
}

.controls,
.actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s, background 0.15s;
}

.btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.play-btn {
  width: 36px;
  height: 36px;
  opacity: 1;
}

.small-btn {
  width: 24px;
  height: 24px;
}

.small-btn.active {
  color: var(--color-primary, #33bc5e);
  opacity: 1;
}

.icon {
  width: 18px;
  height: 18px;
}

.small-btn .icon {
  width: 14px;
  height: 14px;
}
</style>
