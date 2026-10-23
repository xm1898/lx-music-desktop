/**
 * 封面地址改写
 *
 * 把远端封面 URL 转成 lximg:// 协议地址，由主进程命中磁盘缓存后直接返回字节，
 * 未命中时才回源抓取。本地文件、data:、blob: 等非远端地址原样返回。
 */

const PIC_PROTOCOL = 'lximg'

/** 远端封面地址 → 缓存协议地址 */
export const toCachedPicUrl = (url: string | undefined | null): string => {
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return url
  return `${PIC_PROTOCOL}://pic/${encodeURIComponent(url)}`
}

/**
 * 封面加载失败或地址为空时的占位图。
 * 内联 SVG data URI，不依赖网络，保证卡片永远有图可见（而不是空白）。
 */
const FALLBACK_PIC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#999999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
)

/** 兜底占位图地址 */
export const FALLBACK_PIC_URL = FALLBACK_PIC

/**
 * 列表卡片封面地址：空值 → 占位图；远端地址 → 缓存协议地址。
 * 供歌单卡片等「接口可能不返回封面」的列表使用，避免 v-if 静默隐藏导致无图无提示。
 */
export const getCardPicUrl = (url: string | undefined | null): string => toCachedPicUrl(url) || FALLBACK_PIC

/** 卡片封面 onerror 兜底：加载失败（CDN 挂 / 防盗链 / 协议失败）时换成占位图 */
export const handleCardPicError = (e: Event): void => {
  const img = e.target as HTMLImageElement | null
  if (!img || img.src.startsWith('data:')) return
  img.src = FALLBACK_PIC
}
