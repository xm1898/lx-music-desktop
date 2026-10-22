/**
 * 音质降级链
 *
 * 当首选音质获取失败时，按「高 → 低」顺序依次重试，
 * 避免因为某一个音质档位不可用（音源没缓存、版权限制、接口限流等）
 * 就直接跳到换源甚至跳到下一曲。
 */

/**
 * 各音质档位不可用时的降级顺序（不含自身）
 */
export const QUALITY_DESCENT: Record<LX.Quality, LX.Quality[]> = {
  wav: ['flac24bit', 'flac', '320k', '192k', '128k'],
  ape: ['flac24bit', 'flac', '320k', '192k', '128k'],
  flac24bit: ['flac', '320k', '192k', '128k'],
  flac: ['320k', '192k', '128k'],
  '320k': ['192k', '128k'],
  '192k': ['128k'],
  '128k': [],
}

/**
 * 生成音质尝试链（含首选音质本身）
 * @param preferred 首选音质
 */
export const getQualityFallbackChain = (preferred: LX.Quality): LX.Quality[] => {
  return [preferred, ...(QUALITY_DESCENT[preferred] ?? [])]
}

/**
 * 音质档位排序权重，数字越大音质越高
 * @param quality 音质
 */
export const getQualityWeight = (quality: LX.Quality): number => {
  switch (quality) {
    case 'wav': return 70
    case 'ape': return 60
    case 'flac24bit': return 50
    case 'flac': return 40
    case '320k': return 30
    case '192k': return 20
    case '128k': return 10
    default: return 0
  }
}
