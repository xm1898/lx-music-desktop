import { WIN_MAIN_RENDERER_EVENT_NAME, MINI_PLAYER_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle, mainOn } from '@common/mainIpc'
import { getWebContents } from '@main/modules/winMain'
import { closeWindow, createWindow, isExistWindow, sendEvent, toggleAlwaysOnTop } from './main'

let lastState: LX.MiniPlayer.PlayState | null = null

/** 把主渲染进程推来的播放状态转发给迷你播放器窗口 */
const pushStateToMiniWindow = (state: LX.MiniPlayer.PlayState) => {
  lastState = state
  sendEvent(MINI_PLAYER_RENDERER_EVENT_NAME.set_state, state)
}

/** 把迷你播放器的控制指令转发给主渲染进程 */
const forwardControl = (action: LX.MiniPlayer.Action, data?: number) => {
  getWebContents().send(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_control, { action, data })
}

export default () => {
  // 迷你播放器就绪：补发一次当前状态
  mainOn(MINI_PLAYER_RENDERER_EVENT_NAME.ready, () => {
    if (lastState) sendEvent(MINI_PLAYER_RENDERER_EVENT_NAME.set_state, lastState)
  })

  mainOn<{ action: LX.MiniPlayer.Action, data?: number }>(MINI_PLAYER_RENDERER_EVENT_NAME.control, ({ params }) => {
    forwardControl(params.action, params.data)
  })

  mainOn(MINI_PLAYER_RENDERER_EVENT_NAME.close, () => {
    closeWindow()
  })

  mainOn(MINI_PLAYER_RENDERER_EVENT_NAME.toggle_always_on_top, () => {
    toggleAlwaysOnTop()
    if (lastState) sendEvent(MINI_PLAYER_RENDERER_EVENT_NAME.set_state, lastState)
  })

  // 主渲染进程推送播放状态
  mainOn<LX.MiniPlayer.PlayState>(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_state, ({ params }) => {
    pushStateToMiniWindow(params)
  })

  // 主渲染进程开关迷你播放器
  mainHandle<boolean, boolean>(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_toggle, async({ params: show }) => {
    if (show && !isExistWindow()) createWindow()
    else if (!show && isExistWindow()) closeWindow()
    return isExistWindow()
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.mini_player_status, async() => {
    return { isOpen: isExistWindow() }
  })
}

export { createWindow, isExistWindow, closeWindow }
