/**
 * 音源健康度 / 熔断
 *
 * 连续多次取不到播放链接的音源，在冷却期内会被换源逻辑降权跳过，
 * 避免每次都把时间浪费在同一个已经挂掉的音源上。
 * 冷却结束后自动恢复参与。
 */

/** 冷却时长（毫秒） */
const COOLDOWN_TIME = 5 * 60 * 1000
/** 连续失败多少次后进入冷却 */
const FAIL_THRESHOLD = 2

interface SourceHealthRecord {
  failCount: number
  coolingUntil: number
}

const records = new Map<string, SourceHealthRecord>()

/**
 * 记录一次取链接成功，清空该音源的失败计数
 * @param source 音源 id
 */
export const recordSourceSuccess = (source: string) => {
  if (!records.size) return
  records.delete(source)
}

/**
 * 记录一次取链接失败，连续失败达到阈值则进入冷却期
 * @param source 音源 id
 */
export const recordSourceFailure = (source: string) => {
  if (!source || source == 'local') return
  const record = records.get(source) ?? { failCount: 0, coolingUntil: 0 }
  record.failCount++
  if (record.failCount >= FAIL_THRESHOLD) {
    record.failCount = 0
    record.coolingUntil = Date.now() + COOLDOWN_TIME
  }
  records.set(source, record)
}

/**
 * 判断音源是否处于冷却期
 * @param source 音源 id
 */
export const isSourceCoolingDown = (source: string): boolean => {
  const record = records.get(source)
  if (!record) return false
  if (record.coolingUntil > Date.now()) return true
  if (record.coolingUntil) records.delete(source)
  return false
}

/**
 * 获取当前处于冷却期的音源列表
 */
export const getCoolingDownSources = (): string[] => {
  const sources: string[] = []
  const now = Date.now()
  for (const [source, record] of records) {
    if (record.coolingUntil > now) sources.push(source)
  }
  return sources
}

/**
 * 清空全部健康度记录
 */
export const resetSourceHealth = () => {
  records.clear()
}
