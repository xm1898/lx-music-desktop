declare namespace LX {
  namespace Account {
    type Source = 'wy'

    type QrCodeStatus = 'loading' | 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'failed'

    interface PlatformAccount {
      id: string
      source: Source
      nickname: string
      avatar?: string
      isLogin: boolean
    }

    interface LoginSession {
      source: Source
      cookies: Record<string, string>
      tokens: {
        userId: string
      }
    }

    interface EncryptedSession {
      data: string
      /** 系统安全存储不可用时降级为明文 base64 */
      plain?: boolean
    }

    interface LoginRequest {
      source: Source
      method: 'cookie'
      cookie: string
    }

    interface QrCodeLoginState {
      key: string
      qrUrl: string
      status: QrCodeStatus
      message?: string
    }

    interface QrCodeLoginResult extends QrCodeLoginState {
      account?: PlatformAccount
    }

    interface PlaylistInfo {
      id: string
      name: string
      author: string
      play_count: string
      img: string
      desc: string | null
      source: Source
      total: string
      isEditable: boolean
      /** 平台特殊歌单类型，网易云 5 = 我喜欢的音乐 */
      specialType?: number
    }

    interface PlaylistCreateRequest {
      accountId: string
      name: string
      privacy?: number
    }

    interface PlaylistUpdateRequest {
      accountId: string
      playlistId: string
      name?: string
      desc?: string
    }

    interface PlaylistTracksRequest {
      accountId: string
      playlistId: string
      songIds: string[]
    }

    interface SongLikeRequest {
      accountId: string
      songIds: string[]
      like: boolean
    }

    interface SongSearchRequest {
      accountId: string
      keyword: string
      limit?: number
    }

    /** 本地列表与平台歌单的同步绑定 */
    interface PlaylistBinding {
      /** 本地用户列表 id */
      listId: string
      accountId: string
      /** 平台歌单 id */
      playlistId: string
      /** 平台歌单名称快照，用于展示 */
      playlistName: string
      /** 上次同步时平台的曲目 id 序列，作为增量对比基准线 */
      baseLine: string[]
      lastSyncTime: number
      /** 开启后本地改动会回传到平台 */
      enabled: boolean
    }

    interface PlayHistoryRequest {
      accountId: string
      songIds: string[]
      /** 单曲播放秒数，默认 30 */
      playTime?: number
    }

    /** 歌曲写入结果：成功数 / 失败数 */
    interface WriteResult {
      success: number
      failed: number
      message?: string
    }
  }
}
