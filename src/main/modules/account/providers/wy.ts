import { randomBytes, randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { eapi } from '@common/utils/neteaseCrypto'
import { httpFetch, type RequestOptions } from '@main/utils/request'

const BASE_URL = 'https://music.163.com'
const INTERFACE_URL = 'https://interface.music.163.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const DESKTOP_USER_AGENT = 'NeteaseMusic/9.1.65.240927161425 CFNetwork/1496.0.7 Darwin/23.5.0'
const DETAIL_BATCH_SIZE = 500
const ignoredCookieKeys = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'])

interface PendingQrLogin {
  key: string
  cookies: Record<string, string>
}

interface AccountResponse {
  code: number
  message?: string
  profile?: {
    userId: number
    nickname: string
    avatarUrl?: string
  }
}

interface SongRaw {
  id: number
  name?: string
  ar?: Array<{ name?: string }>
  al?: { id?: number, name?: string, picUrl?: string }
  dt?: number
  h?: { size?: number }
  m?: { size?: number }
  l?: { size?: number }
  sq?: { size?: number }
  hr?: { size?: number }
}

const pendingQrLogins = new Map<string, PendingQrLogin>()

const parseCookieString = (value: string): Record<string, string> => {
  const cookies: Record<string, string> = {}
  for (const part of value.split(/;;|;/)) {
    const [rawKey, ...valueParts] = part.trim().split('=')
    const key = rawKey?.trim()
    if (!key || !valueParts.length || ignoredCookieKeys.has(key.toLowerCase())) continue
    cookies[key] = valueParts.join('=').trim()
  }
  return cookies
}

const parseSetCookies = (values?: string[] | string): Record<string, string> => {
  const cookies: Record<string, string> = {}
  const list = values == null ? [] : Array.isArray(values) ? values : [values]
  for (const value of list) Object.assign(cookies, parseCookieString(value.split(';')[0]))
  return cookies
}

const cookieStringify = (cookies: Record<string, string>): string => {
  return Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
}

const commonHeaders = (cookies: Record<string, string> = {}) => ({
  'User-Agent': USER_AGENT,
  Referer: `${BASE_URL}/`,
  Cookie: cookieStringify(cookies),
})

const createAnonymousCookies = (): Record<string, string> => {
  const anonymousId = randomBytes(16).toString('hex')
  return {
    __remember_me: 'true',
    _ntes_nuid: anonymousId,
    _ntes_nnid: `${anonymousId},${Date.now()}`,
    deviceId: randomBytes(26).toString('hex').toUpperCase(),
    os: 'pc',
    osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
    appver: '3.1.17.204416',
    channel: 'netease',
  }
}

const eapiPost = async<T>(uri: string, data: Record<string, unknown>, cookies: Record<string, string>, fallbackMethod: 'GET' | 'POST' = 'POST') => {
  const header: Record<string, string> = {
    osver: cookies.osver ?? 'Microsoft-Windows-10-Professional-build-19045-64bit',
    deviceId: cookies.deviceId ?? randomBytes(26).toString('hex').toUpperCase(),
    os: cookies.os ?? 'pc',
    appver: cookies.appver ?? '3.1.17.204416',
    versioncode: cookies.versioncode ?? '140',
    mobilename: '',
    buildver: Date.now().toString().slice(0, 10),
    resolution: '1920x1080',
    __csrf: cookies.__csrf ?? '',
    channel: cookies.channel ?? 'netease',
    requestId: `${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
  }
  if (cookies.MUSIC_U) header.MUSIC_U = cookies.MUSIC_U
  if (cookies.MUSIC_A) header.MUSIC_A = cookies.MUSIC_A
  const payload = { ...data, e_r: false, header }
  const response = await httpFetch<T>(`${INTERFACE_URL}${uri.replace(/^\/api/, '/eapi')}`, {
    method: 'POST',
    headers: {
      'User-Agent': DESKTOP_USER_AGENT,
      Cookie: Object.entries(header).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('; '),
    },
    form: eapi(uri, payload),
  })
  // 空响应降级：interface 域对部分账号返回 200 空 body（code 解析为 undefined），
  // 此时改走 music.163.com 普通接口用同一份参数重试
  const body = response.body as { code?: number } | null | undefined
  const isEmptyBody = response.statusCode === 200 && (body == null || typeof body !== 'object' || body.code === undefined)
  if (!isEmptyBody) return response
  const plainHeaders = {
    'User-Agent': USER_AGENT,
    Cookie: Object.entries(cookies).filter(([key]) => !ignoredCookieKeys.has(key)).map(([key, value]) => `${key}=${value}`).join('; '),
    Referer: 'https://music.163.com/',
  }
  const plainOptions: RequestOptions = fallbackMethod === 'GET'
    ? { method: 'GET', query: data as unknown as RequestOptions['query'], headers: plainHeaders }
    : { method: 'POST', form: data as unknown as RequestOptions['form'], headers: plainHeaders }
  return httpFetch<T>(`${BASE_URL}${uri}`, plainOptions)
}

const formatPlayCount = (value: number): string => {
  if (value >= 100_000_000) return `${Math.floor(value / 10_000_000) / 10}亿`
  if (value >= 10_000) return `${Math.floor(value / 1_000) / 10}万`
  return String(value || 0)
}

const formatInterval = (duration: number) => {
  const seconds = Math.max(0, Math.floor(duration / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

const formatSize = (size: number): string => `${Math.round(size / 1024 / 1024 * 100) / 100}M`

const toMusicInfo = (item: SongRaw): LX.Music.MusicInfoOnline => {
  const qualitys: LX.Music.MusicQualityType[] = []
  const _qualitys: LX.Music._MusicQualityType = {}
  const addQuality = (type: LX.Quality, size?: number) => {
    if (!size) return
    const formatted = formatSize(size)
    qualitys.push({ type, size: formatted })
    _qualitys[type] = { size: formatted }
  }
  addQuality('128k', item.l?.size ?? item.m?.size)
  addQuality('320k', item.h?.size)
  addQuality('flac', item.sq?.size)
  addQuality('flac24bit', item.hr?.size)

  const songId = String(item.id)
  return {
    id: `wy_${songId}`,
    name: item.name ?? '',
    singer: (item.ar ?? []).map(artist => artist.name).filter(Boolean).join('、'),
    source: 'wy',
    interval: formatInterval(item.dt ?? 0),
    meta: {
      songId,
      albumId: item.al?.id,
      albumName: item.al?.name ?? '',
      picUrl: item.al?.picUrl ?? null,
      qualitys,
      _qualitys,
    },
  }
}

const getAccount = async(cookies: Record<string, string>) => {
  const response = await httpFetch<AccountResponse>(`${BASE_URL}/api/nuser/account/get`, {
    method: 'GET',
    headers: commonHeaders(cookies),
  })
  if (response.statusCode !== 200 || response.body.code !== 200 || !response.body.profile?.userId) {
    throw new Error(response.body.message || '登录失败，请检查 Cookie 是否有效')
  }
  const profile = response.body.profile
  const account: LX.Account.PlatformAccount = {
    id: `wy_${profile.userId}`,
    source: 'wy',
    nickname: profile.nickname,
    avatar: profile.avatarUrl,
    isLogin: true,
  }
  const session: LX.Account.LoginSession = {
    source: 'wy',
    cookies,
    tokens: { userId: String(profile.userId) },
  }
  return { account, session }
}

export const loginByCookie = async(cookie: string) => {
  const cookies = parseCookieString(cookie)
  if (!cookies.MUSIC_U && !cookies.MUSIC_A) throw new Error('Cookie 中缺少 MUSIC_U 或 MUSIC_A')
  return getAccount(cookies)
}

export const createQrCode = async(): Promise<LX.Account.QrCodeLoginState> => {
  const cookies = createAnonymousCookies()
  const response = await eapiPost<{ code: number, data?: { unikey?: string }, unikey?: string, message?: string }>(
    '/api/login/qrcode/unikey',
    { type: 3 },
    cookies,
  )
  const key = response.body.data?.unikey ?? response.body.unikey
  if (response.statusCode !== 200 || response.body.code !== 200 || !key) {
    const rawBody = typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
    const detail = response.body.message ?? `HTTP ${response.statusCode ?? 0}, code ${response.body.code ?? 0}, body ${rawBody.slice(0, 120)}`
    throw new Error(`获取二维码密钥失败：${detail}`)
  }
  Object.assign(cookies, parseSetCookies(response.headers['set-cookie']))
  const requestId = randomUUID()
  pendingQrLogins.set(requestId, { key, cookies })
  setTimeout(() => pendingQrLogins.delete(requestId), 10 * 60 * 1000).unref()
  return {
    key: requestId,
    qrUrl: await QRCode.toDataURL(`${BASE_URL}/login?codekey=${key}`, { width: 220, margin: 2 }),
    status: 'waiting',
  }
}

const qrStatusMap: Record<number, LX.Account.QrCodeStatus> = {
  800: 'expired',
  801: 'waiting',
  802: 'scanned',
  803: 'confirmed',
}

export const checkQrCodeStatus = async(requestId: string): Promise<LX.Account.QrCodeLoginResult & { session?: LX.Account.LoginSession }> => {
  const pending = pendingQrLogins.get(requestId)
  if (!pending) return { key: requestId, qrUrl: '', status: 'expired', message: '二维码已过期' }
  const response = await eapiPost<{ code: number, cookie?: string, message?: string }>(
    '/api/login/qrcode/client/login',
    { key: pending.key, type: 3 },
    pending.cookies,
  )
  const status = qrStatusMap[response.body.code] ?? 'failed'
  if (status !== 'confirmed') {
    if (status === 'expired' || status === 'failed') pendingQrLogins.delete(requestId)
    return { key: requestId, qrUrl: '', status, message: response.body.message }
  }
  const cookies = {
    ...pending.cookies,
    ...parseSetCookies(response.headers['set-cookie']),
    ...(response.body.cookie ? parseCookieString(response.body.cookie) : {}),
  }
  pendingQrLogins.delete(requestId)
  const result = await getAccount(cookies)
  return { key: requestId, qrUrl: '', status: 'confirmed', account: result.account, session: result.session }
}

const requireSession = (session: LX.Account.LoginSession | null): LX.Account.LoginSession => {
  if (!session || session.source !== 'wy') throw new Error('网易云登录状态不存在或已失效')
  return session
}

const getRequestError = (message: string | undefined, fallback: string, statusCode: number | undefined, code: number) => {
  return message ?? `${fallback}（HTTP ${statusCode ?? 0}，code ${code}）`
}

const assertOk = (body: { code: number, message?: string, msg?: string }, fallback: string, statusCode: number | undefined) => {
  if (statusCode !== 200 || body.code !== 200) {
    throw new Error(getRequestError(body.message ?? body.msg, fallback, statusCode, body.code))
  }
}

export const getUserPlaylists = async(sessionValue: LX.Account.LoginSession | null): Promise<LX.Account.PlaylistInfo[]> => {
  const session = requireSession(sessionValue)
  const response = await eapiPost<{ code: number, message?: string, playlist?: any[] }>(
    '/api/user/playlist',
    { uid: session.tokens.userId, limit: 1000, offset: 0 },
    session.cookies,
    'GET',
  )
  if (response.statusCode !== 200 || response.body.code !== 200) {
    throw new Error(getRequestError(response.body.message, '获取用户歌单失败', response.statusCode, response.body.code))
  }
  return (response.body.playlist ?? []).map(item => ({
    id: String(item.id),
    name: item.name ?? '',
    author: item.creator?.nickname ?? '',
    play_count: formatPlayCount(Number(item.playCount)),
    img: item.coverImgUrl ?? '',
    desc: item.description ?? null,
    source: 'wy' as const,
    total: String(item.trackCount ?? 0),
    isEditable: String(item.creator?.userId ?? '') === session.tokens.userId,
    specialType: Number(item.specialType ?? 0),
  }))
}

const getPlaylistTrackIds = async(session: LX.Account.LoginSession, playlistId: string): Promise<string[]> => {
  const response = await eapiPost<{ code: number, message?: string, playlist?: { trackIds?: Array<{ id: number }> } }>(
    '/api/v3/playlist/detail',
    { id: playlistId, n: 100000, s: 8 },
    session.cookies,
    'GET',
  )
  if (response.statusCode !== 200 || response.body.code !== 200) {
    throw new Error(getRequestError(response.body.message, '获取歌单歌曲失败', response.statusCode, response.body.code))
  }
  return (response.body.playlist?.trackIds ?? []).map(item => String(item.id))
}

const getSongDetails = async(ids: string[], cookies: Record<string, string>): Promise<LX.Music.MusicInfoOnline[]> => {
  const list: LX.Music.MusicInfoOnline[] = []
  for (let index = 0; index < ids.length; index += DETAIL_BATCH_SIZE) {
    const batch = ids.slice(index, index + DETAIL_BATCH_SIZE)
    const response = await eapiPost<{ code: number, message?: string, songs?: SongRaw[] }>(
      '/api/v3/song/detail',
      { c: `[${batch.map(id => `{"id":${id}}`).join(',')}]` },
      cookies,
      'GET',
    )
    if (response.statusCode !== 200 || response.body.code !== 200) {
      throw new Error(getRequestError(response.body.message, '获取歌曲详情失败', response.statusCode, response.body.code))
    }
    for (const item of response.body.songs ?? []) {
      const info = toMusicInfo(item)
      if (info.name) list.push(info)
    }
  }
  return list
}

/** 拉取平台歌单的曲目 id 序列（不取详情，用于同步对比） */
export const getPlaylistIds = async(sessionValue: LX.Account.LoginSession | null, playlistId: string): Promise<string[]> => {
  const session = requireSession(sessionValue)
  return getPlaylistTrackIds(session, playlistId)
}

export const getPlaylistSongs = async(sessionValue: LX.Account.LoginSession | null, playlistId: string): Promise<LX.Music.MusicInfoOnline[]> => {
  const session = requireSession(sessionValue)
  const ids = await getPlaylistTrackIds(session, playlistId)
  if (!ids.length) return []
  return getSongDetails(ids, session.cookies)
}

export const getDailySongs = async(sessionValue: LX.Account.LoginSession | null): Promise<LX.Music.MusicInfoOnline[]> => {
  const session = requireSession(sessionValue)
  const response = await eapiPost<{ code: number, message?: string, data?: { dailySongs?: Array<{ id: number }> } }>(
    '/api/v3/discovery/recommend/songs',
    {},
    session.cookies,
    'GET',
  )
  if (response.statusCode !== 200 || response.body.code !== 200) {
    throw new Error(getRequestError(response.body.message, '获取每日推荐失败', response.statusCode, response.body.code))
  }
  const ids = (response.body.data?.dailySongs ?? []).map(item => String(item.id))
  if (!ids.length) return []
  return getSongDetails(ids, session.cookies)
}

const WRITE_BATCH_SIZE = 500

/** 网易云「我喜欢的音乐」歌单 specialType */
const LIKED_PLAYLIST_SPECIAL_TYPE = 5

/** 相似歌曲：以一首歌为种子取相似歌曲（心动模式的基础接口） */
const getSimilarSongs = async(cookies: Record<string, string>, songId: string, limit = 20): Promise<LX.Music.MusicInfoOnline[]> => {
  const response = await eapiPost<{ code: number, message?: string, songs?: SongRaw[] }>(
    '/api/v1/discovery/simiSong',
    { songid: songId, limit, offset: 0 },
    cookies,
  )
  if (response.statusCode !== 200 || response.body.code !== 200) {
    throw new Error(getRequestError(response.body.message, '获取相似歌曲失败', response.statusCode, response.body.code))
  }
  const list: LX.Music.MusicInfoOnline[] = []
  for (const item of response.body.songs ?? []) {
    const info = toMusicInfo(item)
    if (info.name) list.push(info)
  }
  return list
}

const shuffle = <T>(list: T[]): T[] => {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

/**
 * 心动模式：以「我喜欢的音乐」随机几首为种子取相似歌曲，混合成无限流。
 * 不走官方「私人 FM」接口（那个风控最狠），用相似歌曲拼，稳定且不会误伤账号。
 * @param seedSongId 传了就以这首歌为种子，否则从「我喜欢的音乐」里随机挑
 */
export const getHeartModeList = async(sessionValue: LX.Account.LoginSession | null, seedSongId?: string, size = 40): Promise<LX.Music.MusicInfoOnline[]> => {
  const session = requireSession(sessionValue)
  let seeds: string[]
  if (seedSongId) {
    seeds = [String(seedSongId)]
  } else {
    const playlists = await getUserPlaylists(sessionValue)
    const liked = playlists.find(item => item.specialType === LIKED_PLAYLIST_SPECIAL_TYPE)
    const likedIds = liked ? await getPlaylistTrackIds(session, liked.id) : []
    if (!likedIds.length) throw new Error('心动模式需要先从网易云音乐收藏几首喜欢的歌')
    seeds = shuffle(likedIds).slice(0, 3)
  }
  const batches = await Promise.all(seeds.map(id => getSimilarSongs(session.cookies, id, 20).catch(() => [])))
  const seen = new Set<string>()
  const list: LX.Music.MusicInfoOnline[] = []
  for (const song of batches.flat()) {
    const songId = String(song.meta.songId)
    if (seen.has(songId)) continue
    seen.add(songId)
    list.push(song)
    if (list.length >= size) break
  }
  if (!list.length) throw new Error('心动模式获取失败，请稍后重试')
  return list
}

const chunk = <T>(list: T[], size: number): T[][] => {
  const result: T[][] = []
  for (let index = 0; index < list.length; index += size) result.push(list.slice(index, index + size))
  return result
}

/** 搜索网易云歌曲，用于把本地曲目匹配成平台曲目 id */
export const searchSongs = async(sessionValue: LX.Account.LoginSession | null, keyword: string, limit = 30): Promise<LX.Music.MusicInfoOnline[]> => {
  const session = requireSession(sessionValue)
  const text = keyword.trim()
  if (!text) return []
  const response = await eapiPost<{ code: number, message?: string, result?: { songs?: SongRaw[] } }>(
    '/api/cloudsearch/pc',
    { s: text, type: 1, limit, offset: 0, total: true },
    session.cookies,
    'GET',
  )
  assertOk(response.body, '搜索歌曲失败', response.statusCode)
  return (response.body.result?.songs ?? []).map(toMusicInfo).filter(item => item.name)
}

/** 新建歌单，返回新歌单 id */
export const createPlaylist = async(sessionValue: LX.Account.LoginSession | null, name: string, privacy = 0): Promise<string> => {
  const session = requireSession(sessionValue)
  const response = await eapiPost<{ code: number, message?: string, id?: number | string, playlist?: { id?: number | string } }>(
    '/api/playlist/create',
    { name: name.trim(), privacy, type: 'NORMAL' },
    session.cookies,
  )
  assertOk(response.body, '新建歌单失败', response.statusCode)
  const id = response.body.id ?? response.body.playlist?.id
  if (!id) throw new Error('新建歌单失败：平台未返回歌单 id')
  return String(id)
}

export const renamePlaylist = async(sessionValue: LX.Account.LoginSession | null, playlistId: string, name: string): Promise<void> => {
  const session = requireSession(sessionValue)
  const response = await eapiPost<{ code: number, message?: string }>(
    '/api/playlist/update/name',
    { id: playlistId, name: name.trim() },
    session.cookies,
  )
  assertOk(response.body, '重命名歌单失败', response.statusCode)
}

export const updatePlaylistDesc = async(sessionValue: LX.Account.LoginSession | null, playlistId: string, desc: string): Promise<void> => {
  const session = requireSession(sessionValue)
  const response = await eapiPost<{ code: number, message?: string }>(
    '/api/playlist/desc/update',
    { id: playlistId, desc },
    session.cookies,
  )
  assertOk(response.body, '修改歌单简介失败', response.statusCode)
}

export const deletePlaylist = async(sessionValue: LX.Account.LoginSession | null, playlistId: string): Promise<void> => {
  const session = requireSession(sessionValue)
  const response = await eapiPost<{ code: number, message?: string }>(
    '/api/playlist/remove',
    { ids: JSON.stringify([playlistId]) },
    session.cookies,
  )
  assertOk(response.body, '删除歌单失败', response.statusCode)
}

const manipulateTracks = async(
  session: LX.Account.LoginSession,
  playlistId: string,
  songIds: string[],
  op: 'add' | 'del',
): Promise<LX.Account.WriteResult> => {
  const ids = [...new Set(songIds.map(id => String(id).trim()).filter(id => /^\d+$/.test(id)))]
  if (!ids.length) throw new Error('没有可写入的歌曲')
  let success = 0
  let failed = 0
  let lastError = ''
  for (const batch of chunk(ids, WRITE_BATCH_SIZE)) {
    try {
      const response = await eapiPost<{ code: number, message?: string, trackIds?: unknown[] }>(
        '/api/playlist/manipulate/tracks',
        { op, pid: playlistId, trackIds: JSON.stringify(batch.map(Number)), imme: 'true' },
        session.cookies,
      )
      if (response.statusCode !== 200 || response.body.code !== 200) {
        lastError = getRequestError(response.body.message, op === 'add' ? '添加歌曲失败' : '移除歌曲失败', response.statusCode, response.body.code)
        failed += batch.length
        continue
      }
      success += batch.length
    } catch (err: any) {
      lastError = err.message ?? String(err)
      failed += batch.length
    }
  }
  return { success, failed, message: lastError || undefined }
}

export const addPlaylistTracks = async(sessionValue: LX.Account.LoginSession | null, playlistId: string, songIds: string[]) => {
  return manipulateTracks(requireSession(sessionValue), playlistId, songIds, 'add')
}

export const removePlaylistTracks = async(sessionValue: LX.Account.LoginSession | null, playlistId: string, songIds: string[]) => {
  return manipulateTracks(requireSession(sessionValue), playlistId, songIds, 'del')
}

/** 上报播放记录，写入平台的「最近播放」（weblog 未登录也返回 success，登录后真正生效） */
export const reportPlayHistory = async(
  sessionValue: LX.Account.LoginSession | null,
  songIds: string[],
  playTime = 30,
): Promise<LX.Account.WriteResult> => {
  const session = requireSession(sessionValue)
  const ids = [...new Set(songIds.map(id => String(id).trim()).filter(id => /^\d+$/.test(id)))]
  if (!ids.length) return { success: 0, failed: 0 }
  const logs = ids.map(id => ({
    action: 'play',
    json: {
      id,
      source: 'p_default',
      time: String(playTime),
      type: 'song',
      wifi: 0,
      download: 0,
      end: 'playend',
    },
  }))
  try {
    const response = await eapiPost<{ code: number, message?: string, data?: string }>(
      '/api/feedback/weblog',
      { logs: JSON.stringify(logs) },
      session.cookies,
    )
    if (response.statusCode !== 200 || response.body.code !== 200) {
      return { success: 0, failed: ids.length, message: getRequestError(response.body.message, '上报播放记录失败', response.statusCode, response.body.code) }
    }
    return { success: ids.length, failed: 0 }
  } catch (err: any) {
    return { success: 0, failed: ids.length, message: err.message ?? String(err) }
  }
}

/** 喜欢 / 取消喜欢（写入「我喜欢的音乐」） */
export const likeSongs = async(sessionValue: LX.Account.LoginSession | null, songIds: string[], like: boolean): Promise<LX.Account.WriteResult> => {
  const session = requireSession(sessionValue)
  const ids = [...new Set(songIds.map(id => String(id).trim()).filter(id => /^\d+$/.test(id)))]
  if (!ids.length) throw new Error('没有可操作的歌曲')
  let success = 0
  let failed = 0
  let lastError = ''
  for (const id of ids) {
    try {
      const response = await eapiPost<{ code: number, message?: string }>(
        '/api/song/like',
        { trackId: id, like: like ? 'true' : 'false', alg: 'itembased', time: '3' },
        session.cookies,
      )
      if (response.statusCode !== 200 || response.body.code !== 200) {
        lastError = getRequestError(response.body.message, like ? '收藏失败' : '取消收藏失败', response.statusCode, response.body.code)
        failed++
        continue
      }
      success++
    } catch (err: any) {
      lastError = err.message ?? String(err)
      failed++
    }
  }
  return { success, failed, message: lastError || undefined }
}
