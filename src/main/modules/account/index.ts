import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle } from '@common/mainIpc'
import * as sessions from './sessions'
import * as wyProvider from './providers/wy'

const providers = {
  wy: wyProvider,
}

let isInitialized = false

export default () => {
  if (isInitialized) return
  isInitialized = true

  sessions.loadAccounts()

  mainHandle<LX.Account.PlatformAccount[]>(WIN_MAIN_RENDERER_EVENT_NAME.account_list, async() => {
    return sessions.listAccounts()
  })

  mainHandle<string>(WIN_MAIN_RENDERER_EVENT_NAME.account_remove, async({ params: id }) => {
    sessions.removeAccount(id)
  })

  mainHandle<LX.Account.LoginRequest, LX.Account.PlatformAccount>(WIN_MAIN_RENDERER_EVENT_NAME.account_login, async({ params }) => {
    if (params.method !== 'cookie' || !params.cookie) throw new Error('当前登录方式不可用')
    const result = await providers[params.source].loginByCookie(params.cookie)
    sessions.saveAccount(result.account, result.session)
    return result.account
  })

  mainHandle<LX.Account.Source, LX.Account.QrCodeLoginState>(WIN_MAIN_RENDERER_EVENT_NAME.account_qr_create, async({ params: source }) => {
    return providers[source].createQrCode()
  })

  mainHandle<{ source: LX.Account.Source, requestId: string }, LX.Account.QrCodeLoginResult>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_qr_check,
    async({ params }) => {
      const result = await providers[params.source].checkQrCodeStatus(params.requestId)
      if (result.account && result.session) sessions.saveAccount(result.account, result.session)
      const { session, ...publicResult } = result
      return publicResult
    },
  )

  mainHandle<string, LX.Account.PlaylistInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlists, async({ params: accountId }) => {
    const session = sessions.getSession(accountId)
    if (!session) throw new Error('账号登录状态不存在或已失效')
    return providers[session.source].getUserPlaylists(session)
  })

  mainHandle<{ accountId: string, playlistId: string }, LX.Music.MusicInfoOnline[]>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_songs,
    async({ params }) => {
      const session = sessions.getSession(params.accountId)
      if (!session) throw new Error('账号登录状态不存在或已失效')
      return providers[session.source].getPlaylistSongs(session, params.playlistId)
    },
  )

  mainHandle<string, LX.Music.MusicInfoOnline[]>(WIN_MAIN_RENDERER_EVENT_NAME.account_daily_songs, async({ params: accountId }) => {
    const session = sessions.getSession(accountId)
    if (!session) throw new Error('账号登录状态不存在或已失效')
    return providers[session.source].getDailySongs(session)
  })
}
