/**
 * 封面磁盘缓存
 *
 * 把远端封面地址改写为 lximg:// 协议地址，由主进程负责：
 * 命中磁盘缓存 → 直接返回字节；未命中 → 回源抓取后落盘再返回。
 * 解决每次启动、每次滚动列表都重新拉封面，以及 CDN 限流导致封面裂图的问题。
 *
 * 淘汰策略：LRU，上限 256 MiB / 10000 张。
 */
import { app, net, protocol } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, readdir, unlink, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle } from '@common/mainIpc'

const SCHEME = 'lximg'
const MAX_CACHE_SIZE = 256 * 1024 * 1024
const MAX_CACHE_COUNT = 10000
const FETCH_TIMEOUT = 15000

interface CacheItem {
  /** 原始远端地址 */
  url: string
  /** 磁盘文件名（哈希） */
  file: string
  /** 字节数 */
  size: number
  /** 内容类型 */
  type: string
  /** 最近一次访问时间戳，LRU 依据 */
  time: number
}

let cacheDir = ''
let indexPath = ''
let index = new Map<string, CacheItem>()
let indexWriteTimer: NodeJS.Timeout | null = null
let inited = false

const getCacheDir = (): string => {
  if (cacheDir) return cacheDir
  cacheDir = join(app.getPath('userData'), 'images')
  indexPath = join(cacheDir, 'index.json')
  return cacheDir
}

const hashUrl = (url: string): string => createHash('sha1').update(url).digest('hex')

/** 索引落盘，合并短时间内的多次写入 */
const scheduleIndexSave = () => {
  if (indexWriteTimer) return
  indexWriteTimer = setTimeout(() => {
    indexWriteTimer = null
    void writeFile(indexPath, JSON.stringify([...index.values()]), 'utf8').catch(() => {})
  }, 2000)
}

const loadIndex = async() => {
  try {
    const raw = await readFile(indexPath, 'utf8')
    const list = JSON.parse(raw) as CacheItem[]
    index = new Map(list.map(item => [item.file, item]))
  } catch {
    index = new Map()
  }
}

/** LRU 淘汰：超总量或超数量时，按访问时间从旧到新删 */
const evict = async() => {
  let totalSize = 0
  for (const item of index.values()) totalSize += item.size
  if (totalSize <= MAX_CACHE_SIZE && index.size <= MAX_CACHE_COUNT) return

  const sorted = [...index.values()].sort((a, b) => a.time - b.time)
  for (const item of sorted) {
    if (totalSize <= MAX_CACHE_SIZE && index.size <= MAX_CACHE_COUNT) break
    index.delete(item.file)
    totalSize -= item.size
    await unlink(join(cacheDir, item.file)).catch(() => {})
  }
  scheduleIndexSave()
}

/**
 * 索引与磁盘对账：
 * 1. 删掉索引里文件已丢失的条目（避免僵尸条目占额度）
 * 2. 删掉磁盘上索引没有的孤儿文件（索引未持久化就被杀掉时会漏下来）
 */
const reconcile = async() => {
  let files: string[]
  try {
    files = await readdir(cacheDir)
  } catch {
    return
  }
  const exists = new Set(files)
  for (const [key, item] of index) {
    if (!exists.has(item.file)) index.delete(key)
  }
  const orphans = files.filter(name => name !== 'index.json' && !index.has(name))
  for (const name of orphans) await unlink(join(cacheDir, name)).catch(() => {})
  if (index.size || orphans.length) scheduleIndexSave()
}

/** 命中缓存：更新访问时间并刷新文件 mtime，供外部工具核对 */
const hit = (item: CacheItem) => {
  item.time = Date.now()
  scheduleIndexSave()
  void utimes(join(cacheDir, item.file), new Date(), new Date()).catch(() => {})
}

/** 回源抓取并落盘 */
const fetchAndStore = async(url: string, key: string): Promise<CacheItem | null> => {
  let response: Response
  try {
    response = await net.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  } catch {
    return null
  }
  if (!response.ok) return null

  const type = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
  // 只缓存图片，避免把错误页 / 重定向页写进缓存
  if (!type.startsWith('image/')) return null

  let buffer: Buffer
  try {
    buffer = Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
  if (!buffer.length) return null

  const item: CacheItem = { url, file: key, size: buffer.length, type, time: Date.now() }
  try {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(join(cacheDir, key), buffer)
  } catch {
    return null
  }
  index.set(key, item)
  scheduleIndexSave()
  void evict()
  return item
}

const handleRequest = async(request: Request): Promise<Response> => {
  let targetUrl: string
  try {
    const parsed = new URL(request.url)
    if (parsed.host !== 'pic') throw new Error('bad host')
    targetUrl = decodeURIComponent(parsed.pathname.slice(1))
    if (!/^https?:\/\//.test(targetUrl)) throw new Error('bad url')
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const key = hashUrl(targetUrl)
  const cached = index.get(key)
  if (cached) {
    hit(cached)
    try {
      const data = await readFile(join(cacheDir, cached.file))
      return new Response(data, { headers: { 'content-type': cached.type, 'cache-control': 'max-age=31536000' } })
    } catch {
      index.delete(key)
    }
  }

  const item = await fetchAndStore(targetUrl, key)
  if (!item) return new Response('fetch failed', { status: 502 })
  try {
    const data = await readFile(join(cacheDir, item.file))
    return new Response(data, { headers: { 'content-type': item.type, 'cache-control': 'max-age=31536000' } })
  } catch {
    return new Response('read failed', { status: 500 })
  }
}

/** 注册协议并加载索引，须在 app.whenReady 之后调用 */
export const initImageCache = async() => {
  if (inited) return
  inited = true
  getCacheDir()
  await loadIndex()
  await reconcile()
  protocol.handle(SCHEME, handleRequest)
}

/** 注册 IPC，供设置页查看与清理缓存 */
export default () => {
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.image_cache_info, async() => {
    return getImageCacheInfo()
  })
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.image_cache_clear, async() => {
    await clearImageCache()
    return getImageCacheInfo()
  })
}

/** 供渲染进程使用：把远端封面地址改写为缓存协议地址 */
export const toCacheProtocolUrl = (url: string): string => {
  if (!url || !/^https?:\/\//.test(url)) return url
  return `${SCHEME}://pic/${encodeURIComponent(url)}`
}

/** 缓存占用信息，设置页展示用 */
export const getImageCacheInfo = async(): Promise<{ count: number, size: number }> => {
  let size = 0
  for (const item of index.values()) size += item.size
  return { count: index.size, size }
}

/** 清空封面缓存 */
export const clearImageCache = async(): Promise<void> => {
  const keys = [...index.keys()]
  index.clear()
  for (const key of keys) await unlink(join(cacheDir, key)).catch(() => {})
  await unlink(indexPath).catch(() => {})
}

/** 供 main/index.ts 在 app ready 前注册特权协议 */
export const registerImageCacheScheme = () => {
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, supportFetchAPI: true, stream: true, corsEnabled: true, secure: true },
  }])
}

// 供调试 / 测试：当前缓存目录
export const getImageCacheDir = (): string => getCacheDir()
