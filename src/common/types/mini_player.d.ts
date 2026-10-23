declare namespace LX {
  namespace MiniPlayer {
    /** 迷你播放器展示的播放状态 */
    interface PlayState {
      name: string
      singer: string
      album: string
      /** 封面地址，已由主进程改写为缓存协议地址 */
      pic: string
      isPlay: boolean
      /** 当前进度（秒） */
      time: number
      /** 总时长（秒） */
      duration: number
    }

    /** 迷你播放器 → 主进程 的控制指令 */
    type Action = 'play' | 'pause' | 'toggle' | 'next' | 'prev' | 'seek'

    /** 主进程 → 迷你播放器 的状态推送 */
    type StateAction = 'set_state'
  }
}
