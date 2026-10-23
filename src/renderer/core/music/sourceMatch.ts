/**
 * 换源匹配：把自定义源返回的候选按「歌名 + 歌手 + 时长」三维打分过滤，
 * 避免换源时跳到同名不同版本（现场版、翻唱、 remix）。
 */
import { nameScore, singerScore } from '@renderer/utils/musicMatch'

/** "mm:ss" → 秒，无法解析返回 0 */
export const parseInterval = (interval: string | null | undefined): number => {
  if (!interval) return 0
  const parts = interval.split(':')
  if (parts.length !== 2) return 0
  const minutes = Number(parts[0])
  const seconds = Number(parts[1])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0
  return minutes * 60 + seconds
}

export interface MatchTarget {
  name: string
  singer: string
  interval?: string | null
}

/**
 * 判断候选是否与目标匹配。
 * 歌名和歌手都要求达到阈值，时长在容差内（任一时长缺失时跳过时长校验）。
 */
export const isSourceMatch = (target: MatchTarget, candidate: MatchTarget, toleranceSeconds = 3): boolean => {
  if (nameScore(target.name, candidate.name) < 1.2) return false
  if (singerScore(target.singer, candidate.singer) < 0.6) return false
  const targetDuration = parseInterval(target.interval)
  const candidateDuration = parseInterval(candidate.interval)
  if (targetDuration && candidateDuration && Math.abs(targetDuration - candidateDuration) > toleranceSeconds) return false
  return true
}

/** 过滤出匹配的候选；全部不匹配时返回原列表，避免把用户能听的路彻底堵死 */
export const filterMatchedSources = <T extends MatchTarget>(list: T[], target: MatchTarget, toleranceSeconds = 3): T[] => {
  if (!list.length) return list
  const matched = list.filter(item => isSourceMatch(target, item, toleranceSeconds))
  return matched.length ? matched : list
}
