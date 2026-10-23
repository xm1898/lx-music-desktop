import { reactive } from '@common/utils/vueTools'

export const playerState = reactive<LX.MiniPlayer.PlayState>({
  name: '',
  singer: '',
  album: '',
  pic: '',
  isPlay: false,
  time: 0,
  duration: 0,
})
