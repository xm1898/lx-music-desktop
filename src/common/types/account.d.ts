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
    }
  }
}
