// 迷你播放器默认尺寸与位置计算
export const minWidth = 240
export const minHeight = 64
export const defaultWidth = 300
export const defaultHeight = 72

/**
 * 初始化窗口位置、大小
 *
 * 已保存过位置则沿用（并夹到最小尺寸），否则放到屏幕右下角。
 */
export const initWindowSize = (
  x: LX.AppSetting['miniPlayer.x'],
  y: LX.AppSetting['miniPlayer.y'],
  width: LX.AppSetting['miniPlayer.width'],
  height: LX.AppSetting['miniPlayer.height'],
) => {
  if (width < minWidth) width = defaultWidth
  if (height < minHeight) height = defaultHeight

  if (x == null || y == null) {
    if (global.envParams.workAreaSize) {
      x = global.envParams.workAreaSize.width - width - 16
      y = global.envParams.workAreaSize.height - height - 16
    } else {
      x = y = 0
    }
  }
  return { x, y, width, height }
}
