/**
 * 无缝衔接
 *
 * 播放器是单 audio 元素，做不了真正的交叉淡化，这里的策略是：
 * 1. 新曲起播时从 0 渐入到目标音量，消除起播爆音
 * 2. 用户手动改音量时立即中断渐变，不和用户操作打架
 *
 * 与「下一首预加载」（usePreloadNextMusic）配合：
 * 预加载负责提前把 URL 取好并验证可播放，这里负责音量过渡。
 */
import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { onPlaying, setVolume } from '@renderer/plugins/player'
import { volume, isMute } from '@renderer/store/player/volume'
import { appSetting } from '@renderer/store/setting'
import { playMusicInfo } from '@renderer/store/player/state'

const FADE_INTERVAL_MS = 16

let fadeTimer: ReturnType<typeof setInterval> | null = null

const stopFade = () => {
  if (fadeTimer) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

/** 目标音量（考虑静音状态） */
const getTargetVolume = (): number => (isMute.value ? 0 : volume.value)

/**
 * 音量渐变
 * @param from 起始音量
 * @param to 目标音量
 * @param durationMs 时长，0 表示直接到位
 */
const fadeTo = async(from: number, to: number, durationMs: number): Promise<void> => {
  stopFade()
  if (durationMs <= 0) {
    setVolume(to)
    return
  }
  await new Promise<void>(resolve => {
    const startedAt = Date.now()
    fadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs)
      setVolume(from + (to - from) * progress)
      if (progress >= 1) {
        stopFade()
        resolve()
      }
    }, FADE_INTERVAL_MS)
  })
}

/** 用户手动调节音量时立即停止渐变，避免和用户操作打架 */
export const cancelFade = () => {
  stopFade()
}

/**
 * 挂载无缝衔接：监听切歌 + 起播事件，新曲起播时执行渐入
 */
export const useGaplessFade = () => {
  let pendingFadeIn = false
  let lastMusicId = playMusicInfo.musicInfo?.id ?? null

  // 切到新歌时打标记，等真正起播再渐入
  watch(() => playMusicInfo.musicInfo?.id ?? null, id => {
    if (id && id !== lastMusicId) pendingFadeIn = true
    lastMusicId = id
  })

  const removePlayingListener = onPlaying(() => {
    if (!pendingFadeIn) return
    pendingFadeIn = false
    const duration = appSetting['player.gaplessFade']
    if (!duration) return
    const target = getTargetVolume()
    if (target <= 0) return
    void fadeTo(0, target, duration)
  })

  onBeforeUnmount(() => {
    removePlayingListener()
    stopFade()
  })
}
