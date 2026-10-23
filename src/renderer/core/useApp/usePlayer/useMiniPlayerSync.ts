import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { getCurrentTime, getDuration, onTimeupdate } from '@renderer/plugins/player'
import { musicInfo, playMusicInfo, isPlay } from '@renderer/store/player/state'
import { rendererSend, rendererOn, rendererOff } from '@common/rendererIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { playNext, playPrev, pause, play } from '@renderer/core/player'

/** 进度推送节流：进度每秒一次足够，信息变化立即推 */
const PROGRESS_INTERVAL = 1000

let lastPushTime = 0

const buildState = (): LX.MiniPlayer.PlayState => ({
  name: musicInfo.name,
  singer: musicInfo.singer,
  album: musicInfo.album,
  pic: musicInfo.pic ?? '',
  isPlay: isPlay.value,
  time: getCurrentTime(),
  duration: getDuration(),
})

/** 把当前播放状态推给主进程，由它转给迷你播放器窗口 */
const sendState = () => {
  if (!playMusicInfo.musicInfo) return
  rendererSend<LX.MiniPlayer.PlayState>(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_state, buildState())
}

/** 处理迷你播放器下发的控制指令 */
const handleControl = ({ params }: { params: { action: LX.MiniPlayer.Action, data?: number } }) => {
  const { action, data } = params
  switch (action) {
    case 'toggle':
      if (isPlay.value) pause()
      else play()
      break
    case 'play':
      play()
      break
    case 'pause':
      pause()
      break
    case 'next':
      void playNext()
      break
    case 'prev':
      void playPrev()
      break
    case 'seek':
      if (typeof data == 'number') window.app_event.setProgress(data)
      break
  }
}

/**
 * 迷你播放器状态同步：
 * 把播放信息 / 播放状态 / 进度推给迷你播放器窗口，
 * 并接收它的播放控制指令。
 */
export default () => {
  watch(() => [musicInfo.id, musicInfo.name, musicInfo.pic, isPlay.value], () => {
    sendState()
  }, { immediate: true })

  const removeTimeupdate = onTimeupdate(() => {
    const now = Date.now()
    if (now - lastPushTime < PROGRESS_INTERVAL) return
    lastPushTime = now
    sendState()
  })

  rendererOn(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_control, handleControl)

  onBeforeUnmount(() => {
    removeTimeupdate()
    rendererOff(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_control, handleControl)
  })
}
