import { qualityList } from '@renderer/store'
import { assertApiSupport } from '@renderer/store/utils'
import musicSdk from '@renderer/utils/musicSdk'
import {
  // getOtherSource as getOtherSourceFromStore,
  // saveOtherSource as saveOtherSourceFromStore,
  getMusicUrl as getStoreMusicUrl,
  getPlayerLyric as getStoreLyric,
} from '@renderer/utils/ipc'
import { appSetting } from '@renderer/store/setting'
import { langS2T, toNewMusicInfo, toOldMusicInfo } from '@renderer/utils'
import { requestMsg } from '@renderer/utils/message'
import { apis } from '@renderer/utils/musicSdk/api-source'
import { getQualityFallbackChain, isQualityAvailable } from './qualityFallback'
import { isSourceCoolingDown, recordSourceFailure, recordSourceSuccess } from './sourceHealth'
import { filterMatchedSources } from './sourceMatch'

/** 恢复链默认顺序 */
export const DEFAULT_RECOVERY_CHAIN: Array<'refresh' | 'source' | 'quality' | 'next'> = ['refresh', 'source', 'quality', 'next']

/** 恢复链某一步是否启用（兼容旧配置缺失时回退默认值） */
export const isRecoveryEnabled = (step: 'refresh' | 'source' | 'quality' | 'next'): boolean => {
  const chain = appSetting['player.recoveryChain']
  if (!Array.isArray(chain) || !chain.length) return DEFAULT_RECOVERY_CHAIN.includes(step)
  return chain.includes(step)
}


const getOtherSourcePromises = new Map()
const otherSourceCache = new Map<LX.Music.MusicInfo | LX.Download.ListItem, LX.Music.MusicInfoOnline[]>()
export const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/

export const getOtherSource = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  // if (!isRefresh && musicInfo.id) {
  //   const cachedInfo = await getOtherSourceFromStore(musicInfo.id)
  //   if (cachedInfo.length) return cachedInfo
  // }
  if (otherSourceCache.has(musicInfo)) return otherSourceCache.get(musicInfo)!
  let key: string
  let searchMusicInfo: {
    name: string
    singer: string
    source: string
    albumName: string
    interval: string
  }
  if ('progress' in musicInfo) {
    key = `local_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.metadata.musicInfo.name,
      singer: musicInfo.metadata.musicInfo.singer,
      source: musicInfo.metadata.musicInfo.source,
      albumName: musicInfo.metadata.musicInfo.meta.albumName,
      interval: musicInfo.metadata.musicInfo.interval ?? '',
    }
  } else {
    key = `${musicInfo.source}_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval ?? '',
    }
  }
  if (getOtherSourcePromises.has(key)) return getOtherSourcePromises.get(key)

  const promise = new Promise<LX.Music.MusicInfoOnline[]>((resolve, reject) => {
    let timeout: null | NodeJS.Timeout = setTimeout(() => {
      timeout = null
      reject(new Error('find music timeout'))
    }, 15_000)
    musicSdk.findMusic(searchMusicInfo).then((otherSource) => {
      if (otherSourceCache.size > 10) otherSourceCache.clear()
      const source = otherSource.map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
      otherSourceCache.set(musicInfo, source)
      resolve(source)
    }).catch(reject).finally(() => {
      if (timeout) clearTimeout(timeout)
    })
  }).then((otherSource) => {
    // if (otherSource.length) void saveOtherSourceFromStore(musicInfo.id, otherSource)
    return otherSource
  }).finally(() => {
    if (getOtherSourcePromises.has(key)) getOtherSourcePromises.delete(key)
  })
  getOtherSourcePromises.set(key, promise)
  return promise
}


export const buildLyricInfo = async(lyricInfo: MakeOptional<LX.Player.LyricInfo, 'rawlrcInfo'>): Promise<LX.Player.LyricInfo> => {
  if (!appSetting['player.isS2t']) {
    // @ts-expect-error
    if (lyricInfo.rawlrcInfo) return lyricInfo
    return { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
  }

  if (appSetting['player.isS2t']) {
    const tasks = [
      lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''),
      lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''),
      lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''),
      lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''),
    ]
    if (lyricInfo.rawlrcInfo) {
      tasks.push(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''))
      tasks.push(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''))
    }
    return Promise.all(tasks).then(([lyric, tlyric, rlyric, lxlyric, lyric_raw, tlyric_raw, rlyric_raw, lxlyric_raw]) => {
      const rawlrcInfo = lyric_raw ? {
        lyric: lyric_raw,
        tlyric: tlyric_raw,
        rlyric: rlyric_raw,
        lxlyric: lxlyric_raw,
      } : {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
      }
      return {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
        rawlrcInfo,
      }
    })
  }

  // @ts-expect-error
  return lyricInfo.rawlrcInfo ? lyricInfo : { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
}

export const getCachedLyricInfo = async(musicInfo: LX.Music.MusicInfo): Promise<LX.Player.LyricInfo | null> => {
  let lrcInfo = await getStoreLyric(musicInfo)
  // lrcInfo = {} as unknown as LX.Player.LyricInfo
  if (existTimeExp.test(lrcInfo.lyric)) {
    if (lrcInfo.tlyric != null) {
      // if (musicInfo.lrc.startsWith('\ufeff[id:$00000000]')) {
      //   let str = musicInfo.lrc.replace('\ufeff[id:$00000000]\n', '')
      //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
      // } else if (musicInfo.lrc.startsWith('[id:$00000000]')) {
      //   let str = musicInfo.lrc.replace('[id:$00000000]\n', '')
      //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
      // }

      if (lrcInfo.lxlyric == null) {
        switch (musicInfo.source) { // 以下源支持lxlyric 重新获取
          case 'kg':
          case 'kw':
          case 'mg':
          case 'wy':
          case 'tx':
            break
          default:
            return lrcInfo
        }
      } else if (lrcInfo.rlyric == null) {
        // 以下源支持 rlyric 重新获取
        if (!['wy', 'kg', 'tx'].includes(musicInfo.source)) return lrcInfo
      } else return lrcInfo
    }
    if (musicInfo.source == 'local') return lrcInfo
  }
  return null
}

export const getOnlineOtherSourceMusicUrlByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  url: string
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  const quality = '128k'

  const cachedUrl = await getStoreMusicUrl(musicInfo, quality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, quality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getMusicUrl(toOldMusicInfo(musicInfo), null).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then(({ url }: { url: string }) => {
    return { url, quality, isFromCache: false }
  })
}

export const getOnlineOtherSourceLyricByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  lyricInfo: LX.Music.LyricInfo
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  const lyricInfo = await getCachedLyricInfo(musicInfo)
  if (lyricInfo && !isRefresh) return { lyricInfo, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getLyric(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return { lyricInfo, isFromCache: false }
  })
}

export const getOnlineOtherSourcePicByLocal = async(musicInfo: LX.Music.MusicInfoLocal): Promise<{
  url: string
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  let reqPromise
  try {
    reqPromise = apis('local').getPic(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((url: string) => {
    return { url }
  })
}

export const TRY_QUALITYS_LIST = ['flac24bit', 'flac', '320k'] as const
type TryQualityType = typeof TRY_QUALITYS_LIST[number]
export const getPlayQuality = (highQuality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality => {
  let type: LX.Quality = '128k'
  if (TRY_QUALITYS_LIST.includes(highQuality as TryQualityType)) {
    let list = qualityList.value[musicInfo.source]

    let t = TRY_QUALITYS_LIST
      .slice(TRY_QUALITYS_LIST.indexOf(highQuality as TryQualityType))
      .find(q => musicInfo.meta._qualitys[q] && list?.includes(q))

    if (t) type = t
  }
  return type
}

/**
 * 按音质链依次尝试获取播放链接
 *
 * 同一音源内先按「高 → 低」降级重试，只有整条链都失败才认为该音源不可用。
 * 若连续两次失败的错误信息完全一致，判定为该音源级故障，提前结束降级，避免无谓等待。
 * @param musicInfo 歌曲信息
 * @param qualitys 音质尝试链
 */
const getMusicUrlWithQualityFallback = async(musicInfo: LX.Music.MusicInfoOnline, qualitys: LX.Quality[]): Promise<{ url: string, quality: LX.Quality }> => {
  let lastError: any
  let prevErrorMsg = ''
  let sameErrorCount = 0

  for (const quality of qualitys) {
    let reqPromise
    try {
      reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), quality).promise
    } catch (err: any) {
      reqPromise = Promise.reject(err)
    }

    try {
      const { url, type } = await reqPromise as { url: string, type: LX.Quality }
      if (qualitys.length > 1 && quality != qualitys[0]) console.log(`[quality-fallback] ${musicInfo.source} 降级到 ${quality} 成功`)
      return { url, quality: type ?? quality }
    } catch (err: any) {
      if (err?.message == requestMsg.tooManyRequests) throw err
      lastError = err
      const msg = err?.message ?? ''
      if (msg && msg == prevErrorMsg) {
        sameErrorCount++
        if (sameErrorCount >= 2) throw err
      } else {
        prevErrorMsg = msg
        sameErrorCount = 0
      }
      if (qualitys.length > 1) console.log(`[quality-fallback] ${musicInfo.source} ${quality} 失败：`, msg)
    }
  }

  throw lastError ?? new Error('failed')
}

export const getOnlineOtherSourceMusicUrl = async({ musicInfos, quality, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  // 恢复链里没有换源这一步时，不进入换源流程，把失败交给上层处理
  if (!isRecoveryEnabled('source')) throw new Error(window.i18n.t('toggle_source_failed'))

  const candidates = musicInfos.filter(musicInfo => !retryedSource.includes(musicInfo.source) && assertApiSupport(musicInfo.source))
  if (!candidates.length) throw new Error(window.i18n.t('toggle_source_failed'))

  // 换源匹配过滤：只保留歌名 + 歌手 + 时长都对得上的候选，避免跳到现场版 / 翻唱
  const matchedCandidates = appSetting['player.sourceMatchFilter']
    ? filterMatchedSources<LX.Music.MusicInfoOnline>(candidates, candidates[0])
    : candidates

  // 优先跳过处于冷却期的音源，全部冷却时退回完整列表
  const usableCandidates = appSetting['player.sourceCooldown'] ? matchedCandidates.filter(musicInfo => !isSourceCoolingDown(musicInfo.source)) : matchedCandidates
  const tryList = usableCandidates.length ? usableCandidates : matchedCandidates

  // 并发竞速：同时打 N 个源，取最快返回可用地址的那个
  if (appSetting['player.sourceRace'] && tryList.length > 1 && !isRefresh) {
    const raceCount = Math.max(2, Math.min(appSetting['player.sourceRaceCount'] || 2, tryList.length))
    const pool = tryList.slice(0, raceCount)
    try {
      return await raceSourceUrls(pool, { quality, onToggleSource, retryedSource })
    } catch (err: any) {
      if (err?.message == requestMsg.tooManyRequests) throw err
      console.log('[source-race] 竞速全部失败，回退串行：', err?.message)
    }
  }

  let lastError: any
  for (const musicInfo of tryList) {
    retryedSource.push(musicInfo.source)

    const preferredQuality = quality ?? getPlayQuality(appSetting['player.playQuality'], musicInfo)
    let tryQualitys = isRecoveryEnabled('quality') && appSetting['player.qualityFallback']
      ? getQualityFallbackChain(preferredQuality)
      : [preferredQuality]
    tryQualitys = tryQualitys.filter(q => isQualityAvailable(musicInfo, q))
    if (!tryQualitys.length) tryQualitys = [preferredQuality]

    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)

    const cachedUrl = await getStoreMusicUrl(musicInfo, tryQualitys[0])
    if (cachedUrl && !isRefresh) return { url: cachedUrl, musicInfo, quality: tryQualitys[0], isFromCache: true }

    try {
      const result = await getMusicUrlWithQualityFallback(musicInfo, tryQualitys)
      recordSourceSuccess(musicInfo.source)
      return { musicInfo, url: result.url, quality: result.quality, isFromCache: false }
    } catch (err: any) {
      if (err?.message == requestMsg.tooManyRequests) throw err
      console.log(err)
      recordSourceFailure(musicInfo.source)
      lastError = err
    }
  }

  throw lastError ?? new Error(window.i18n.t('toggle_source_failed'))
}

/** 并发竞速：多个源同时请求，第一个成功的获胜，其余按实际成败记录熔断 */
const raceSourceUrls = async(pool: LX.Music.MusicInfoOnline[], { quality, onToggleSource, retryedSource }: {
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  retryedSource: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  const tasks = pool.map(async musicInfo => {
    retryedSource.push(musicInfo.source)
    const preferredQuality = quality ?? getPlayQuality(appSetting['player.playQuality'], musicInfo)
    let tryQualitys = appSetting['player.qualityFallback'] ? getQualityFallbackChain(preferredQuality) : [preferredQuality]
    tryQualitys = tryQualitys.filter(q => isQualityAvailable(musicInfo, q))
    if (!tryQualitys.length) tryQualitys = [preferredQuality]

    const cachedUrl = await getStoreMusicUrl(musicInfo, tryQualitys[0])
    if (cachedUrl) return { url: cachedUrl, musicInfo, quality: tryQualitys[0], isFromCache: true }

    const result = await getMusicUrlWithQualityFallback(musicInfo, tryQualitys)
    return { musicInfo, url: result.url, quality: result.quality, isFromCache: false }
  })

  // 等所有任务落定再结算，避免产生未处理的 Promise 拒绝
  const settled = await Promise.allSettled(tasks)
  let winner: { url: string, musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality, isFromCache: boolean } | null = null
  let lastError: any
  for (let index = 0; index < settled.length; index++) {
    const item = settled[index]
    if (item.status === 'fulfilled') {
      if (!winner) winner = item.value
      recordSourceSuccess(pool[index].source)
    } else {
      recordSourceFailure(pool[index].source)
      lastError ??= item.reason
    }
  }
  if (!winner) throw lastError ?? new Error(window.i18n.t('toggle_source_failed'))
  onToggleSource(winner.musicInfo)
  console.log('[source-race] 获胜音源：', winner.musicInfo.source)
  return winner
}

/**
 * 获取在线音乐URL
 */
export const handleGetOnlineMusicUrl = async({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource: boolean
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')
  // console.log(musicInfo.source)
  const targetQuality = quality ?? getPlayQuality(appSetting['player.playQuality'], musicInfo)

  // 首选音质不可用时按音质链降级，避免直接跳到换源
  let tryQualitys = isRecoveryEnabled('quality') && appSetting['player.qualityFallback']
    ? getQualityFallbackChain(targetQuality)
    : [targetQuality]
  tryQualitys = tryQualitys.filter(q => isQualityAvailable(musicInfo, q))
  if (!tryQualitys.length) tryQualitys = [targetQuality]

  try {
    const result = await getMusicUrlWithQualityFallback(musicInfo, tryQualitys)
    recordSourceSuccess(musicInfo.source)
    return { musicInfo, url: result.url, quality: result.quality, isFromCache: false }
  } catch (err: any) {
    console.log(err)
    if (err?.message == requestMsg.tooManyRequests) throw err
    recordSourceFailure(musicInfo.source)
    // 恢复链里没有换源这一步时直接抛出，交给上层走「下一曲」等后续步骤
    if (!allowToggleSource || !isRecoveryEnabled('source')) throw err
    onToggleSource()

    const otherSource = await getOtherSource(musicInfo)
    console.log('find otherSource', otherSource)
    if (otherSource.length) {
      return getOnlineOtherSourceMusicUrl({
        musicInfos: [...otherSource],
        onToggleSource,
        quality,
        isRefresh,
        retryedSource: [musicInfo.source],
      })
    }
    throw err
  }
}


export const getOnlineOtherSourcePicUrl = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(window.i18n.t('toggle_source_failed'))

  if (musicInfo.meta.picUrl && !isRefresh) return { musicInfo, url: musicInfo.meta.picUrl, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourcePicUrl({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌曲封面
 */
export const handleGetOnlinePicUrl = async({ musicInfo, isRefresh, onToggleSource, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      console.log('find otherSource', otherSource)
      if (otherSource.length) {
        return getOnlineOtherSourcePicUrl({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourceLyricInfo = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(window.i18n.t('toggle_source_failed'))

  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return { musicInfo, lyricInfo, isFromCache: true }
  }

  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      lyricInfo,
      musicInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourceLyricInfo({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌词信息
 */
export const handleGetOnlineLyricInfo = async({ musicInfo, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  musicInfo: LX.Music.MusicInfoOnline
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      musicInfo,
      lyricInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err

    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      console.log('find otherSource', otherSource)
      if (otherSource.length) {
        return getOnlineOtherSourceLyricInfo({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}
