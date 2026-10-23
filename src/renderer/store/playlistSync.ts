/**
 * 本地列表 ↔ 网易云歌单双向同步引擎
 *
 * 同步模型（基准线）：
 *   binding.baseLine = 上次同步完成时平台的曲目 id 序列
 *   回传时把「本地当前」与「基准线」做集合对比，得到要增/删的 id
 *   若「平台当前」与基准线也不一致，说明两端都改过 → 冲突，暂停并提示
 */
import { ref } from '@common/utils/vueTools'
import { rendererInvoke } from '@common/rendererIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { createUserList, getListMusics, getUserLists, addListMusics, removeListMusics } from '@renderer/store/list/action'
import { pickBestMatch } from '@renderer/utils/musicMatch'

export const bindings = ref<LX.Account.PlaylistBinding[]>([])

export const getBindings = () => bindings

export const loadBindings = async() => {
  bindings.value = await rendererInvoke<LX.Account.PlaylistBinding[]>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_bindings)
  return bindings.value
}

const saveBinding = async(binding: LX.Account.PlaylistBinding) => {
  await rendererInvoke<LX.Account.PlaylistBinding>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_bindings_save, binding)
  const index = bindings.value.findIndex(item => item.listId === binding.listId)
  if (index > -1) bindings.value[index] = { ...binding }
  else bindings.value.push({ ...binding })
}

export const removeBinding = async(listId: string) => {
  await rendererInvoke<string>(WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_bindings_remove, listId)
  bindings.value = bindings.value.filter(item => item.listId !== listId)
}

export const getBindingByList = (listId: string): LX.Account.PlaylistBinding | undefined => {
  return bindings.value.find(item => item.listId === listId)
}

/** 取曲目的平台歌曲 id，非平台曲目返回 null */
export const getPlatformSongId = (musicInfo: LX.Music.MusicInfo): string | null => {
  if (musicInfo.source !== 'wy') return null
  const songId = musicInfo.meta?.songId
  if (songId == null) return null
  const text = String(songId).trim()
  return /^\d+$/.test(text) ? text : null
}

const fetchPlaylistIds = async(accountId: string, playlistId: string): Promise<string[]> => {
  return rendererInvoke<{ accountId: string, playlistId: string }, string[]>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_ids,
    { accountId, playlistId },
  )
}

const fetchPlaylistSongs = async(accountId: string, playlistId: string): Promise<LX.Music.MusicInfoOnline[]> => {
  return rendererInvoke<{ accountId: string, playlistId: string }, LX.Music.MusicInfoOnline[]>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_songs,
    { accountId, playlistId },
  )
}

/** 本地列表里的平台曲目 id（保持列表顺序、去重） */
const getLocalPlatformIds = (list: LX.Music.MusicInfo[]): string[] => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const musicInfo of list) {
    const id = getPlatformSongId(musicInfo)
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

const sameSet = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every(item => set.has(item))
}

export type SyncOutcome = 'synced' | 'conflict' | 'pulled' | 'no-change'

export interface SyncResult {
  outcome: SyncOutcome
  added: number
  removed: number
  message?: string
}

const noChange = (): SyncResult => ({ outcome: 'no-change', added: 0, removed: 0 })

/**
 * 同步一个绑定：本地改动回传平台，平台改动拉回本地，两端都改则暂停提示。
 */
export const syncBinding = async(listId: string): Promise<SyncResult> => {
  const binding = getBindingByList(listId)
  if (!binding) throw new Error('该列表没有同步绑定')
  if (!binding.enabled) throw new Error('该列表的同步回传已关闭')

  const localList = await getListMusics(listId)
  const localIds = getLocalPlatformIds(localList)
  const platformIds = await fetchPlaylistIds(binding.accountId, binding.playlistId)
  const baseLine = binding.baseLine

  const localChanged = !sameSet(localIds, baseLine)
  const platformChanged = !sameSet(platformIds, baseLine)

  if (localChanged && platformChanged) {
    return {
      outcome: 'conflict',
      added: 0,
      removed: 0,
      message: '本地与平台歌单都有改动，已暂停同步。请确认要以哪一端为准。',
    }
  }

  if (!localChanged && !platformChanged) return noChange()

  // 平台有改动、本地没有 → 拉回本地
  if (platformChanged && !localChanged) {
    const songs = await fetchPlaylistSongs(binding.accountId, binding.playlistId)
    if (songs.length) await removeListMusics({ listId, ids: localList.map(m => m.id) })
    if (songs.length) await addListMusics(listId, songs, 'top')
    await saveBinding({ ...binding, baseLine: platformIds, lastSyncTime: Date.now() })
    return { outcome: 'pulled', added: songs.length, removed: localList.length }
  }

  // 本地有改动 → 回传平台
  const baseSet = new Set(baseLine)
  const localSet = new Set(localIds)
  const added = localIds.filter(id => !baseSet.has(id))
  const removed = baseLine.filter(id => !localSet.has(id))

  if (added.length) {
    const result = await rendererInvoke<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(
      WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_add,
      { accountId: binding.accountId, playlistId: binding.playlistId, songIds: added },
    )
    if (result.failed) throw new Error(result.message ?? `有 ${result.failed} 首歌曲添加失败`)
  }
  if (removed.length) {
    const result = await rendererInvoke<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(
      WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_remove,
      { accountId: binding.accountId, playlistId: binding.playlistId, songIds: removed },
    )
    if (result.failed) throw new Error(result.message ?? `有 ${result.failed} 首歌曲移除失败`)
  }

  await saveBinding({ ...binding, baseLine: localIds, lastSyncTime: Date.now() })
  return { outcome: 'synced', added: added.length, removed: removed.length }
}

export interface ImportResult {
  listId: string
  total: number
}

/** 把平台歌单导入为本地用户列表，并建立同步绑定 */
export const importPlaylistToLocal = async(accountId: string, playlist: LX.Account.PlaylistInfo): Promise<ImportResult> => {
  if (bindings.value.some(item => item.playlistId === playlist.id && item.accountId === accountId)) {
    throw new Error('该平台歌单已导入过')
  }
  const songs = await fetchPlaylistSongs(accountId, playlist.id)
  const listId = `userlist_${Date.now()}`
  await createUserList({
    name: playlist.name,
    id: listId,
    list: songs,
    source: playlist.source,
    sourceListId: playlist.id,
    position: 0,
  })
  await saveBinding({
    listId,
    accountId,
    playlistId: playlist.id,
    playlistName: playlist.name,
    baseLine: songs.map(song => String(song.meta.songId)),
    lastSyncTime: Date.now(),
    enabled: true,
  })
  return { listId, total: songs.length }
}

/** 保存每日推荐为本地列表（不建立绑定，推荐歌单每天都会变） */
export const saveDailyToLocal = async(accountId: string, songs: LX.Music.MusicInfoOnline[]): Promise<ImportResult> => {
  if (!songs.length) throw new Error('每日推荐为空')
  const now = new Date()
  const name = `每日推荐 ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const listId = `userlist_${Date.now()}`
  await createUserList({ name, id: listId, list: songs, position: 0 })
  return { listId, total: songs.length }
}

const SEARCH_MATCH_LIMIT = 8
const SEARCH_CONCURRENCY = 4

/** 把本地列表推送到平台：新建同名歌单，非平台曲目走搜索匹配 */
export const pushLocalListToPlatform = async(listId: string, accountId: string): Promise<ImportResult> => {
  if (bindings.value.some(item => item.listId === listId)) throw new Error('该列表已绑定平台歌单')
  const lists = await getUserLists()
  const target = lists.find(item => item.id === listId)
  if (!target) throw new Error('本地列表不存在')

  const localList = await getListMusics(listId)
  if (!localList.length) throw new Error('列表为空，无可同步的歌曲')

  // 直接是平台曲目的
  const directIds: string[] = []
  const needMatch: LX.Music.MusicInfo[] = []
  for (const musicInfo of localList) {
    const id = getPlatformSongId(musicInfo)
    if (id) directIds.push(id)
    else needMatch.push(musicInfo)
  }

  const matchedIds: string[] = []
  if (needMatch.length) {
    let cursor = 0
    const runners = Array.from({ length: Math.min(SEARCH_CONCURRENCY, needMatch.length) }, async() => {
      while (cursor < needMatch.length) {
        const musicInfo = needMatch[cursor++]
        try {
          const candidates = await rendererInvoke<LX.Account.SongSearchRequest, LX.Music.MusicInfoOnline[]>(
            WIN_MAIN_RENDERER_EVENT_NAME.account_search,
            { accountId, keyword: `${musicInfo.name} ${musicInfo.singer}`, limit: SEARCH_MATCH_LIMIT },
          )
          const best = pickBestMatch(
            { name: musicInfo.name, singer: musicInfo.singer },
            candidates.map(item => ({ id: String(item.meta.songId), name: item.name, singer: item.singer })),
          )
          if (best) matchedIds.push(best.id)
        } catch {
          // 单曲匹配失败不阻断整体
        }
      }
    })
    await Promise.all(runners)
  }

  const playlistId = await rendererInvoke<LX.Account.PlaylistCreateRequest, string>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_create,
    { accountId, name: target.name, privacy: 0 },
  )
  const allIds = [...new Set([...directIds, ...matchedIds])]
  if (allIds.length) {
    const result = await rendererInvoke<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(
      WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_add,
      { accountId, playlistId, songIds: allIds },
    )
    if (result.failed && !result.success) throw new Error(result.message ?? '写入平台歌单失败')
  }
  await saveBinding({
    listId,
    accountId,
    playlistId,
    playlistName: target.name,
    baseLine: allIds,
    lastSyncTime: Date.now(),
    enabled: true,
  })
  return { listId, total: allIds.length }
}

/** 同步冲突时的强制以本地为准 */
export const forcePushBinding = async(listId: string): Promise<SyncResult> => {
  const binding = getBindingByList(listId)
  if (!binding) throw new Error('该列表没有同步绑定')
  const localList = await getListMusics(listId)
  const localIds = getLocalPlatformIds(localList)
  const platformIds = await fetchPlaylistIds(binding.accountId, binding.playlistId)

  const platformSet = new Set(platformIds)
  const localSet = new Set(localIds)
  const added = localIds.filter(id => !platformSet.has(id))
  const removed = platformIds.filter(id => !localSet.has(id))

  if (added.length) {
    const result = await rendererInvoke<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(
      WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_add,
      { accountId: binding.accountId, playlistId: binding.playlistId, songIds: added },
    )
    if (result.failed) throw new Error(result.message ?? `有 ${result.failed} 首歌曲添加失败`)
  }
  if (removed.length) {
    const result = await rendererInvoke<LX.Account.PlaylistTracksRequest, LX.Account.WriteResult>(
      WIN_MAIN_RENDERER_EVENT_NAME.account_playlist_tracks_remove,
      { accountId: binding.accountId, playlistId: binding.playlistId, songIds: removed },
    )
    if (result.failed) throw new Error(result.message ?? `有 ${result.failed} 首歌曲移除失败`)
  }
  await saveBinding({ ...binding, baseLine: localIds, lastSyncTime: Date.now() })
  return { outcome: 'synced', added: added.length, removed: removed.length }
}

/** 强制以平台为准拉回本地 */
export const forcePullBinding = async(listId: string): Promise<SyncResult> => {
  const binding = getBindingByList(listId)
  if (!binding) throw new Error('该列表没有同步绑定')
  const localList = await getListMusics(listId)
  const songs = await fetchPlaylistSongs(binding.accountId, binding.playlistId)
  if (localList.length) await removeListMusics({ listId, ids: localList.map(m => m.id) })
  if (songs.length) await addListMusics(listId, songs, 'top')
  await saveBinding({ ...binding, baseLine: songs.map(song => String(song.meta.songId)), lastSyncTime: Date.now() })
  return { outcome: 'pulled', added: songs.length, removed: localList.length }
}

// ---- 播放记录上报 ----

const SCROBBLE_INTERVAL = 30 * 60 * 1000
const reportedMap = new Map<string, number>()

/** 上报播放记录，同一首歌 30 分钟内只报一次 */
export const reportPlayed = (musicInfo: LX.Music.MusicInfo | null) => {
  if (!musicInfo) return
  const songId = getPlatformSongId(musicInfo)
  if (!songId) return
  const accountId = bindings.value.find(item => item.enabled)?.accountId
  if (!accountId) return
  const last = reportedMap.get(songId) ?? 0
  if (Date.now() - last < SCROBBLE_INTERVAL) return
  reportedMap.set(songId, Date.now())
  void rendererInvoke<LX.Account.PlayHistoryRequest, LX.Account.WriteResult>(
    WIN_MAIN_RENDERER_EVENT_NAME.account_play_history,
    { accountId, songIds: [songId] },
  ).catch(() => {
    reportedMap.delete(songId)
  })
}
