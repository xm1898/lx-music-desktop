import registerUserApi from './userApi'
import registerWinMain from './winMain'
import registerHotKey from './hotKey'
import registerTray from './tray'
import registerAppMenu from './appMenu'
import registerWinLyric from './winLyric'
import registerCommonRenderers from './commonRenderers'
import registerAccount from './account'
import registerImageCache from './imageCache'

let isRegistered = false
export default () => {
  if (isRegistered) return
  registerUserApi()
  registerCommonRenderers()
  registerAccount()
  registerImageCache()
  registerWinMain()
  registerHotKey()
  registerTray()
  registerAppMenu()
  registerWinLyric()
  isRegistered = true
}
