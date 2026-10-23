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
