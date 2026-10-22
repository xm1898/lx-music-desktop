<template lang="pug">
div(:class="$style.container")
  template(v-if="!wyAccount")
    div(:class="$style.empty")
      p {{ $t('platform_music_no_account') }}
      base-btn(min @click="goSetting") {{ $t('platform_music_go_setting') }}
  template(v-else-if="detail")
    div(:class="$style.header")
      base-btn(min @click="back") {{ $t('platform_music_back') }}
      div(:class="$style.headerInfo")
        h3(:class="$style.headerTitle" :title="detail.name") {{ detail.name }}
        p(:class="$style.headerSub") {{ detail.sub }}
      base-btn(min :disabled="!detail.list.length || isLoading" @click="playAt(0)") {{ $t('platform_music_play_all') }}
    div(:class="$style.songList")
      p(v-if="isLoading" :class="$style.tip") {{ $t('platform_music_loading') }}
      p(v-else-if="!detail.list.length" :class="$style.tip") {{ $t('platform_music_empty') }}
      div(
        v-for="(item, index) in detail.list"
        :key="item.id"
        :class="$style.songRow"
        role="button"
        tabindex="0"
        @click="playAt(index)"
      )
        span(:class="$style.songIndex") {{ Number(index) + 1 }}
        span(:class="$style.songName" :title="item.name") {{ item.name }}
        span(:class="$style.songSinger" :title="item.singer") {{ item.singer }}
        span(:class="$style.songAlbum" :title="item.meta.albumName") {{ item.meta.albumName }}
        span(:class="$style.songInterval") {{ item.interval }}
  template(v-else)
    div(:class="$style.accountBar")
      img(v-if="wyAccount.avatar" :src="wyAccount.avatar" :class="$style.avatar" alt="")
      span(:class="$style.nickname") {{ wyAccount.nickname }}
      span(:class="$style.badge") {{ $t('platform_music_logged_in') }}
      base-btn(min :class="$style.refreshBtn" @click="loadPlaylists") {{ $t('platform_music_refresh') }}
    div(:class="$style.section")
      h3(:class="$style.sectionTitle") {{ $t('platform_music_daily') }}
      div(:class="$style.dailyCard" role="button" tabindex="0" @click="openDaily")
        span(:class="$style.dailyTitle") {{ $t('platform_music_daily_title') }}
        span(:class="$style.dailySub") {{ $t('platform_music_daily_sub') }}
    div(:class="$style.section")
      h3(:class="$style.sectionTitle") {{ $t('platform_music_my_playlists') }}
      p(v-if="isLoading" :class="$style.tip") {{ $t('platform_music_loading') }}
      p(v-else-if="!playlists.length" :class="$style.tip") {{ $t('platform_music_empty') }}
      div(:class="$style.grid")
        div(v-for="item in playlists" :key="item.id" :class="$style.card" role="button" tabindex="0" @click="openPlaylist(item)")
          img(v-if="item.img" :src="item.img" :class="$style.cover" alt="" loading="lazy")
          div(:class="$style.cardBody")
            p(:class="$style.cardName" :title="item.name") {{ item.name }}
            p(:class="$style.cardSub") {{ $t('platform_music_total', { count: item.total }) }}
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@root/lang'
import { LIST_IDS } from '@common/constants'
import { dialog } from '@renderer/plugins/Dialog'
import { getAccountDailySongs, getAccountPlaylistSongs, getAccountPlaylists } from '@renderer/utils/ipc'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { loadAccounts, wyAccount } from '@renderer/store/account'

interface DetailState {
  name: string
  sub: string
  list: LX.Music.MusicInfoOnline[]
}

const t = useI18n()
const router = useRouter()

const playlists = ref<LX.Account.PlaylistInfo[]>([])
const detail = ref<DetailState | null>(null)
const isLoading = ref(false)

const PLATFORM_LIST_ID = 'platform_music'

const handleError = (err: any) => {
  void dialog(err?.message ?? t('platform_music_load_failed'))
}

const loadPlaylists = async() => {
  if (!wyAccount.value || isLoading.value) return
  isLoading.value = true
  try {
    playlists.value = await getAccountPlaylists(wyAccount.value.id)
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const openPlaylist = async(item: LX.Account.PlaylistInfo) => {
  if (!wyAccount.value || isLoading.value) return
  detail.value = { name: item.name, sub: t('platform_music_total', { count: item.total }), list: [] }
  isLoading.value = true
  try {
    const list = await getAccountPlaylistSongs(wyAccount.value.id, item.id)
    if (detail.value) detail.value = { name: item.name, sub: t('platform_music_total', { count: String(list.length) }), list }
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const openDaily = async() => {
  if (!wyAccount.value || isLoading.value) return
  detail.value = { name: t('platform_music_daily_title'), sub: '', list: [] }
  isLoading.value = true
  try {
    const list = await getAccountDailySongs(wyAccount.value.id)
    if (detail.value) detail.value = { name: t('platform_music_daily_title'), sub: t('platform_music_total', { count: String(list.length) }), list }
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const playAt = async(index: number) => {
  const list = detail.value?.list
  if (!list?.length) return
  await setTempList(PLATFORM_LIST_ID, [...list])
  playList(LIST_IDS.TEMP, index)
}

const back = () => {
  detail.value = null
}

const goSetting = () => {
  void router.push({ path: '/setting', query: { name: 'SettingAccount' } })
}

watch(wyAccount, account => {
  if (account) void loadPlaylists()
  else {
    playlists.value = []
    detail.value = null
  }
})

onMounted(async() => {
  await loadAccounts()
  if (wyAccount.value) void loadPlaylists()
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
}
.empty {
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--color-font-label);
  font-size: 13px;
}
.header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: var(--color-list-header-border-bottom);
}
.headerInfo {
  flex: auto;
  overflow: hidden;
}
.headerTitle {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.headerSub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-font-label);
}
.songList {
  flex: auto;
  overflow-y: auto;
  padding: 0 8px 12px;
}
.songRow {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 8px;
  font-size: 13px;
  color: var(--color-font);
  border-radius: @radius-border;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color;
  &:hover {
    background-color: var(--color-primary-light-400-alpha-700);
  }
}
.songIndex {
  flex: 0 0 34px;
  color: var(--color-font-label);
  font-size: 12px;
}
.songName {
  flex: 3 1 0;
  .mixin-ellipsis-1();
}
.songSinger {
  flex: 2 1 0;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.songAlbum {
  flex: 2 1 0;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.songInterval {
  flex: 0 0 56px;
  text-align: right;
  color: var(--color-font-label);
  font-size: 12px;
}
.accountBar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}
.nickname {
  font-size: 14px;
  color: var(--color-font);
}
.badge {
  font-size: 11px;
  color: var(--color-font-label);
  border: var(--color-list-header-border-bottom);
  border-radius: 10px;
  padding: 1px 8px;
}
.refreshBtn {
  margin-left: auto;
}
.section {
  padding: 0 16px 16px;
}
.sectionTitle {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-font);
  margin-bottom: 10px;
}
.dailyCard {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  padding: 14px 16px;
  border-radius: @radius-border;
  background-color: var(--color-primary-light-300-alpha-700);
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color;
  &:hover {
    background-color: var(--color-primary-light-300-alpha-800);
  }
}
.dailyTitle {
  font-size: 14px;
  color: var(--color-font);
}
.dailySub {
  font-size: 12px;
  color: var(--color-font-label);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.card {
  border-radius: @radius-border;
  overflow: hidden;
  cursor: pointer;
  background-color: var(--color-primary-light-400-alpha-700);
  transition: @transition-fast;
  transition-property: background-color;
  &:hover {
    background-color: var(--color-primary-light-300-alpha-700);
  }
}
.cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}
.cardBody {
  padding: 8px 10px 10px;
}
.cardName {
  font-size: 12px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.cardSub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-font-label);
}
.tip {
  padding: 16px 0;
  font-size: 12px;
  color: var(--color-font-label);
}
</style>
