import { app } from 'electron'
import './utils/logInit'
import '@common/error'
import {
  initGlobalData,
  initSingleInstanceHandle,
  applyElectronEnvParams,
  setUserDataPath,
  registerDeeplink,
  listenerAppEvent,
} from './app'
import { isLinux } from '@common/utils'
import { initAppSetting } from '@main/app'
import registerModules from '@main/modules'
import { registerImageCacheScheme, initImageCache } from '@main/modules/imageCache'

// 必须在 app ready 前注册，否则协议不生效
registerImageCacheScheme()

// 初始化应用
const init = () => {
  console.log('init')
  if (process.env.BUILD_WIN7 == 'true') import('./utils/winLegacy')
  void initAppSetting().then(() => {
    void initImageCache()
    registerModules()
    global.lx.event_app.app_inited()
  })
}

initGlobalData()
initSingleInstanceHandle()
applyElectronEnvParams()
setUserDataPath()
registerDeeplink(init)
listenerAppEvent(init)


// https://github.com/electron/electron/issues/16809
void app.whenReady().then(() => {
  isLinux ? setTimeout(init, 300) : init()
})
