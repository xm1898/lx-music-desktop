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

  mainHandle<{ accountId: string, playlistId: string }, string[]>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_ids,
    async({ params }) => {
      const session = sessions.getSession(params.accountId)
      if (!session) throw new Error('账号登录状态不存在或已失效')
      return providers[session.source].getPlaylistIds(session, params.playlistId)
    },
  )

  mainHandle<string, LX.Music.MusicInfoOnline[]>(WIN_MAIN_RENDERER_EVENT_NAME.account_daily_songs, async({ params: accountId }) => {
    const session = sessions.getSession(accountId)
    if (!session) throw new Error('账号登录状态不存在或已失效')
    return providers[session.source].getDailySongs(session)
  })

  const requireSession = (accountId: string): LX.Account.LoginSession => {
    const session = sessions.getSession(accountId)
    if (!session) throw new Error('账号登录状态不存在或已失效')
    return session
  }

  mainHandle<LX.Account.PlaylistCreateRequest, string>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_create, async({ params }) => {
    const session = requireSession(params.accountId)
    return providers[session.source].createPlaylist(session, params.name, params.privacy)
  })

  mainHandle<LX.Account.PlaylistUpdateRequest>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_update, async({ params }) => {
    const session = requireSession(params.accountId)
    const provider = providers[session.source]
    if (params.name != null) await provider.renamePlaylist(session, params.playlistId, params.name)
    if (params.desc != null) await provider.updatePlaylistDesc(session, params.playlistId, params.desc)
  })

  mainHandle<LX.Account.PlaylistUpdateRequest>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_delete, async({ params }) => {
    const session = requireSession(params.accountId)
    await providers[session.source].deletePlaylist(session, params.playlistId)
  })

  mainHandle<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_add, async({ params }) => {
    const session = requireSession(params.accountId)
    return providers[session.source].addPlaylistTracks(session, params.playlistId, params.songIds)
  })

  mainHandle<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_remove, async({ params }) => {
    const session = requireSession(params.accountId)
    return providers[session.source].removePlaylistTracks(session, params.playlistId, params.songIds)
  })

  mainHandle<LX.Account.SongLikeRequest, LX.Account.WriteResult>(WIN_MAIN_RENDERER_EVENT_NAME.account_song_like, async({ params }) => {
    const session = requireSession(params.accountId)
    return providers[session.source].likeSongs(session, params.songIds, params.like)
  })

  mainHandle<LX.Account.SongSearchRequest, LX.Music.MusicInfoOnline[]>(WIN_MAIN_RENDERER_EVENT_NAME.account_search, async({ params }) => {
    const session = requireSession(params.accountId)
    return providers[session.source].searchSongs(session, params.keyword, params.limit)
  })

  mainHandle<LX.Account.PlayHistoryRequest, LX.Account.WriteResult>(WIN_MAIN_RENDERER_EVENT_NAME.account_play_history, async({ params }) => {
    const session = requireSession(params.accountId)
    return providers[session.source].reportPlayHistory(session, params.songIds, params.playTime)
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_bindings, async() => {
    return sessions.listBindings()
  })

  mainHandle<LX.Account.PlaylistBinding>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_bindings_save, async({ params }) => {
    sessions.saveBinding(params)
  })

  mainHandle<string>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_bindings_remove, async({ params: listId }) => {
    sessions.removeBinding(listId)
  })
}
