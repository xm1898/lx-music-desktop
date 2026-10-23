import { rendererSend, rendererOn, rendererOff } from '@common/rendererIpc'
import { MINI_PLAYER_RENDERER_EVENT_NAME } from '@common/ipcNames'

type RemoveListener = () => void

/** 发送播放控制指令 */
export const sendControl = (action: LX.MiniPlayer.Action, data?: number) => {
  rendererSend(MINI_PLAYER_RENDERER_EVENT_NAME.control, { action, data })
}

/** 关闭迷你播放器 */
export const sendClose = () => {
  rendererSend(MINI_PLAYER_RENDERER_EVENT_NAME.close)
}

/** 切换置顶 */
export const sendToggleAlwaysOnTop = () => {
  rendererSend(MINI_PLAYER_RENDERER_EVENT_NAME.toggle_always_on_top)
}

/** 就绪通知，主进程会补发当前播放状态 */
export const sendReady = () => {
  rendererSend(MINI_PLAYER_RENDERER_EVENT_NAME.ready)
}

/** 监听主进程推送的播放状态 */
export const onState = (listener: LX.IpcRendererEventListenerParams<LX.MiniPlayer.PlayState>): RemoveListener => {
  rendererOn<LX.MiniPlayer.PlayState>(MINI_PLAYER_RENDERER_EVENT_NAME.set_state, listener)
  return () => {
    rendererOff(MINI_PLAYER_RENDERER_EVENT_NAME.set_state, listener)
  }
}
