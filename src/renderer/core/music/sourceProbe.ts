/**
 * 音源主动体检：对每个平台源各取一首样本歌曲试取播放地址，
 * 用于在设置里一键检测「这个源现在还能不能用、能拿到什么音质」。
 */
import musicSdk from '@renderer/utils/musicSdk'
import { assertApiSupport } from '@renderer/store/utils'
import { toOldMusicInfo } from '@renderer/utils'
import { appSetting } from '@renderer/store/setting'
import { getPlayQuality, getOtherSource } from './utils'
import { getQualityFallbackChain, isQualityAvailable } from './qualityFallback'

export interface SourceProbeResult {
  source: LX.OnlineSource
  ok: boolean
  quality?: LX.Quality
  durationMs: number
  message?: string
}

const probeTimeout = async(promise: Promise<{ url: string, type?: LX.Quality }>, ms = 15000): Promise<{ url: string, type?: LX.Quality }> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('检测超时'))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 检测单个音源：用目标曲目在该源上的匹配版本试取地址 */
export const probeSource = async(target: LX.Music.MusicInfoOnline): Promise<SourceProbeResult> => {
  const startedAt = Date.now()
  const result: SourceProbeResult = { source: target.source, ok: false, durationMs: 0 }
  if (!assertApiSupport(target.source)) {
    result.message = '音源未启用'
    return result
  }
  try {
    const preferredQuality = getPlayQuality(appSetting['player.playQuality'], target)
    let qualitys = appSetting['player.qualityFallback'] ? getQualityFallbackChain(preferredQuality) : [preferredQuality]
    qualitys = qualitys.filter(q => isQualityAvailable(target, q))
    if (!qualitys.length) qualitys = [preferredQuality]
    const request = musicSdk[target.source].getMusicUrl(toOldMusicInfo(target), qualitys[0]).promise
    const { url, type } = await probeTimeout(request)
    result.ok = !!url
    result.quality = type ?? qualitys[0]
  } catch (err: any) {
    result.message = err?.message ?? String(err)
  }
  result.durationMs = Date.now() - startedAt
  return result
}

/**
 * 体检所有音源：先用当前歌曲找到各平台的匹配版本（取前 maxSources 个），逐个试取地址。
 * @param musicInfo 样本歌曲
 * @param maxSources 最多检测几个源
 */
export const probeAllSources = async(musicInfo: LX.Music.MusicInfo, maxSources = 5): Promise<SourceProbeResult[]> => {
  let candidates: LX.Music.MusicInfoOnline[] = []
  try {
    const otherSource = await getOtherSource(musicInfo, true)
    candidates = otherSource.slice(0, maxSources)
  } catch {
    candidates = []
  }
  const results: SourceProbeResult[] = []
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await probeSource(candidate))
  }
  return results
}
