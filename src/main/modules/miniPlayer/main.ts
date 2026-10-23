import path from 'node:path'
import { BrowserWindow } from 'electron'
import { debounce, getPlatform } from '@common/utils'
import { mainSend } from '@common/mainIpc'
import { encodePath } from '@common/utils/electron'
import { initWindowSize } from './utils'

let browserWindow: Electron.BrowserWindow | null = null
let isAlwaysOnTop = false

const saveBoundsConfig = debounce((config: Partial<LX.AppSetting>) => {
  global.lx.event_app.update_config(config)
}, 500)

const winEvent = () => {
  if (!browserWindow) return

  browserWindow.on('closed', () => {
    browserWindow = null
  })

  browserWindow.on('move', () => {
    if (!browserWindow) return
    const bounds = browserWindow.getBounds()
    saveBoundsConfig({
      'miniPlayer.x': bounds.x,
      'miniPlayer.y': bounds.y,
    })
  })

  browserWindow.on('resize', () => {
    if (!browserWindow) return
    const bounds = browserWindow.getBounds()
    saveBoundsConfig({
      'miniPlayer.width': bounds.width,
      'miniPlayer.height': bounds.height,
    })
  })

  browserWindow.on('always-on-top-changed', (_event, onTop) => {
    isAlwaysOnTop = onTop
  })
}

export const isExistWindow = (): boolean => !!browserWindow

export const createWindow = () => {
  closeWindow()
  let x = global.lx.appSetting['miniPlayer.x']
  let y = global.lx.appSetting['miniPlayer.y']
  let width = global.lx.appSetting['miniPlayer.width']
  let height = global.lx.appSetting['miniPlayer.height']
  isAlwaysOnTop = global.lx.appSetting['miniPlayer.isAlwaysOnTop']

  const winSize = initWindowSize(x, y, width, height)
  global.lx.event_app.update_config({
    'miniPlayer.x': winSize.x,
    'miniPlayer.y': winSize.y,
    'miniPlayer.width': winSize.width,
    'miniPlayer.height': winSize.height,
  })

  const { shouldUseDarkColors, theme } = global.lx.theme

  browserWindow = new BrowserWindow({
    height: winSize.height,
    width: winSize.width,
    x: winSize.x,
    y: winSize.y,
    minWidth: 240,
    minHeight: 64,
    useContentSize: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    roundedCorners: false,
    show: false,
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: false,
      webSecurity: false,
      sandbox: false,
      nodeIntegration: true,
      enableWebSQL: false,
      webgl: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  const winURL = process.env.NODE_ENV !== 'production'
    ? 'http://localhost:9082/mini-player.html'
    : `file://${path.join(encodePath(__dirname), 'mini-player.html')}`
  const params = new URLSearchParams({
    os: getPlatform(),
    dark: String(shouldUseDarkColors),
    theme: encodeURIComponent(JSON.stringify(theme)),
    lang: global.lx.appSetting['common.langId'] ?? '',
    pin: isAlwaysOnTop ? '1' : '0',
  })
  void browserWindow.loadURL(`${winURL}?${params.toString()}`)

  browserWindow.once('ready-to-show', () => {
    showWindow()
    browserWindow!.blur()
  })

  winEvent()
}

export const closeWindow = () => {
  if (!browserWindow) return
  browserWindow.close()
}

export const showWindow = () => {
  if (!browserWindow) return
  browserWindow.show()
}

export const sendEvent = <T = any>(name: string, params?: T) => {
  if (!browserWindow) return
  mainSend(browserWindow, name, params)
}

export const getBounds = (): Electron.Rectangle | null => {
  if (!browserWindow) return null
  return browserWindow.getBounds()
}

/** 切换置顶状态，返回切换后的状态 */
export const toggleAlwaysOnTop = (): boolean => {
  if (!browserWindow) return isAlwaysOnTop
  isAlwaysOnTop = !isAlwaysOnTop
  browserWindow.setAlwaysOnTop(isAlwaysOnTop)
  global.lx.event_app.update_config({ 'miniPlayer.isAlwaysOnTop': isAlwaysOnTop })
  return isAlwaysOnTop
}

export const isMiniPlayerAlwaysOnTop = (): boolean => isAlwaysOnTop
