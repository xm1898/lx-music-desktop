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
      base-btn(
        v-if="detail.playlistId && detail.isEditable"
        min
        :disabled="isLoading || isWriting"
        @click="openPicker"
      ) {{ $t('platform_music_add_songs') }}
      base-btn(
        v-if="!detail.playlistId && detail.list.length"
        min
        :disabled="isLoading || isWriting"
        @click="handleSaveDaily"
      ) {{ $t('platform_music_save_daily') }}
      base-btn(min :disabled="!detail.list.length || isLoading" @click="playAt(0)") {{ $t('platform_music_play_all') }}
    p(v-if="notice" :class="$style.notice") {{ notice }}
    div(:class="$style.songList")
      p(v-if="isLoading" :class="$style.tip") {{ $t('platform_music_loading') }}
      p(v-else-if="!detail.list.length" :class="$style.tip") {{ $t('platform_music_empty') }}
      div(
        v-for="(item, index) in detail.list"
        :key="item.id + '_' + Number(index)"
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
        div(:class="$style.rowActions")
          button(
            type="button"
            :class="$style.rowBtn"
            :title="$t('platform_music_like')"
            :disabled="isWriting"
            @click.stop="handleLike(item)"
          ) {{ $t('platform_music_like') }}
          button(
            v-if="detail.playlistId && detail.isEditable"
            type="button"
            :class="$style.rowBtn"
            :title="$t('platform_music_remove')"
            :disabled="isWriting"
            @click.stop="handleRemove(index)"
          ) {{ $t('platform_music_remove') }}
  template(v-else)
    div(:class="$style.accountBar")
      img(:src="toCachedPicUrl(wyAccount.avatar)" :class="$style.avatar" alt="" @error="handleCardPicError")
      span(:class="$style.nickname") {{ wyAccount.nickname }}
      span(:class="$style.badge") {{ $t('platform_music_logged_in') }}
      base-btn(min :class="$style.refreshBtn" :disabled="isLoading" @click="openCreate") {{ $t('platform_music_playlist_create') }}
      base-btn(min :disabled="isLoading" @click="loadPlaylists") {{ $t('platform_music_refresh') }}
    p(v-if="notice" :class="$style.notice") {{ notice }}
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
        div(
          v-for="item in playlists"
          :key="item.id"
          :class="$style.card"
          role="button"
          tabindex="0"
          @click="openPlaylist(item)"
        )
          img(:src="coverOf(item)" :class="$style.cover" alt="" loading="lazy" @error="handleCardPicError")
          div(:class="$style.cardBody")
            p(:class="$style.cardName" :title="item.name") {{ item.name }}
            p(:class="$style.cardSub") {{ $t('platform_music_total', { count: item.total }) }}
          div(v-if="item.isEditable && item.specialType !== 5" :class="$style.cardActions")
            button(type="button" :class="$style.cardBtn" :disabled="isWriting" @click.stop="handleImportLocal(item)") {{ $t('platform_music_import_local') }}
            button(type="button" :class="$style.cardBtn" :disabled="isWriting" @click.stop="openRename(item)") {{ $t('platform_music_playlist_rename') }}
            button(type="button" :class="$style.cardBtn" :disabled="isWriting" @click.stop="handleDeletePlaylist(item)") {{ $t('platform_music_playlist_delete') }}
    div(:class="$style.section")
      h3(:class="$style.sectionTitle") {{ $t('platform_music_sync_section') }}
      p(v-if="!localLists.length" :class="$style.tip") {{ $t('platform_music_sync_empty') }}
      div(v-else :class="$style.syncList")
        div(v-for="item in localLists" :key="item.id" :class="$style.syncRow")
          div(:class="$style.syncInfo")
            p(:class="$style.syncName" :title="item.name") {{ item.name }}
            p(:class="$style.syncMeta")
              span(:class="$style.syncState" :data-state="syncStateOf(item.id)") {{ syncStateLabel(item.id) }}
              span(v-if="bindingOf(item.id)" :class="$style.syncTime") {{ bindingTimeLabel(bindingOf(item.id)!.lastSyncTime) }}
          div(:class="$style.syncActions")
            template(v-if="bindingOf(item.id)")
              base-btn(min :disabled="isWriting || !bindingOf(item.id)!.enabled" @click="handleSyncNow(item)") {{ $t('platform_music_sync_now') }}
              base-btn(v-if="syncStateOf(item.id) === 'conflict'" min :disabled="isWriting" @click="handleForcePush(item)") {{ $t('platform_music_sync_conflict_local') }}
              base-btn(v-if="syncStateOf(item.id) === 'conflict'" min :disabled="isWriting" @click="handleForcePull(item)") {{ $t('platform_music_sync_conflict_platform') }}
              base-btn(min :disabled="isWriting" @click="handleUnbind(item)") {{ $t('platform_music_sync_unbind') }}
            base-btn(v-else min :disabled="isWriting" @click="handlePushLocal(item)") {{ $t('platform_music_sync_push_local') }}

  SongPickerModal(
    v-if="picker"
    :show="!!picker"
    :account-id="wyAccount.id"
    :existing-ids="picker.existingIds"
    :is-submitting="isWriting"
    @update:show="closePicker"
    @confirm="handleAddSongs"
  )
  PlaylistEditModal(
    v-if="editing"
    :show="!!editing"
    :mode="editing.mode"
    :initial-name="editing.name"
    :is-submitting="isWriting"
    @update:show="closeEdit"
    @submit="handleEditSubmit"
  )
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@root/lang'
import { LIST_IDS } from '@common/constants'
import { dialog } from '@renderer/plugins/Dialog'
import {
  addAccountPlaylistTracks,
  createAccountPlaylist,
  deleteAccountPlaylist,
  getAccountDailySongs,
  getAccountPlaylistSongs,
  getAccountPlaylists,
  likeAccountSongs,
  removeAccountPlaylistTracks,
  updateAccountPlaylist,
} from '@renderer/utils/ipc'
import { setTempList } from '@renderer/store/list/action'
import { getUserLists } from '@renderer/store/list/listManage'
import {
  bindings,
  forcePullBinding,
  forcePushBinding,
  importPlaylistToLocal,
  loadBindings,
  pushLocalListToPlatform,
  removeBinding,
  saveDailyToLocal,
  syncBinding,
  type SyncResult,
} from '@renderer/store/playlistSync'
import { playList } from '@renderer/core/player/action'
import { loadAccounts, wyAccount } from '@renderer/store/account'
import { getCardPicUrl, handleCardPicError, toCachedPicUrl } from '@renderer/utils/picCache'
import SongPickerModal from './components/SongPickerModal.vue'
import PlaylistEditModal from './components/PlaylistEditModal.vue'

interface DetailState {
  playlistId?: string
  isEditable: boolean
  specialType?: number
  name: string
  sub: string
  list: LX.Music.MusicInfoOnline[]
}

/** 网易云「我喜欢的音乐」specialType = 5，增删必须走 song/like，不能走 playlist/manipulate/tracks */
const LIKED_PLAYLIST_TYPE = 5

interface EditingState {
  mode: 'create' | 'rename'
  playlistId?: string
  name: string
}

const t = useI18n()
const router = useRouter()

const playlists = ref<LX.Account.PlaylistInfo[]>([])
const detail = ref<DetailState | null>(null)
const isLoading = ref(false)
const isWriting = ref(false)
const notice = ref('')
const picker = ref<{ existingIds: string[] } | null>(null)
const editing = ref<EditingState | null>(null)
const localLists = ref<LX.List.UserListInfo[]>([])
const syncStates = ref<Record<string, SyncResult['outcome']>>({})

const PLATFORM_LIST_ID = 'platform_music'
let noticeTimer: ReturnType<typeof setTimeout> | null = null

/** 歌单卡片封面：走磁盘缓存协议，空值 / 加载失败有占位兜底 */
const coverOf = (item: LX.Account.PlaylistInfo) => getCardPicUrl(item.img)

const showNotice = (message: string) => {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 4000)
}

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
  detail.value = { playlistId: item.id, isEditable: item.isEditable, specialType: item.specialType, name: item.name, sub: t('platform_music_total', { count: item.total }), list: [] }
  isLoading.value = true
  try {
    const list = await getAccountPlaylistSongs(wyAccount.value.id, item.id)
    if (detail.value) {
      detail.value = {
        playlistId: item.id,
        isEditable: item.isEditable,
        specialType: item.specialType,
        name: item.name,
        sub: t('platform_music_total', { count: String(list.length) }),
        list,
      }
    }
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const reloadDetail = async() => {
  const current = detail.value
  if (!current?.playlistId || !wyAccount.value) return
  const list = await getAccountPlaylistSongs(wyAccount.value.id, current.playlistId)
  if (!detail.value) return
  detail.value = {
    ...detail.value,
    sub: t('platform_music_total', { count: String(list.length) }),
    list,
  }
}

const openDaily = async() => {
  if (!wyAccount.value || isLoading.value) return
  detail.value = { isEditable: false, name: t('platform_music_daily_title'), sub: '', list: [] }
  isLoading.value = true
  try {
    const list = await getAccountDailySongs(wyAccount.value.id)
    if (detail.value) {
      detail.value = { isEditable: false, name: t('platform_music_daily_title'), sub: t('platform_music_total', { count: String(list.length) }), list }
    }
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const handleSaveDaily = async() => {
  const current = detail.value
  if (!current || isWriting.value) return
  isWriting.value = true
  try {
    const result = await saveDailyToLocal(wyAccount.value!.id, current.list)
    showNotice(t('platform_music_daily_saved', { name: current.name }))
    void result
    await loadLocalLists()
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const loadLocalLists = async() => {
  try {
    localLists.value = await getUserLists()
  } catch {
    localLists.value = []
  }
}

const bindingOf = (listId: string) => bindings.value.find(item => item.listId === listId)

const syncStateOf = (listId: string): SyncResult['outcome'] | 'idle' => {
  if (!bindingOf(listId)) return 'idle'
  return syncStates.value[listId] ?? 'no-change'
}

const syncStateLabel = (listId: string) => {
  const state = syncStateOf(listId)
  if (state === 'idle') return t('platform_music_sync_unbound')
  if (state === 'conflict') return t('platform_music_sync_state_conflict')
  if (state === 'no-change') return t('platform_music_sync_state_synced')
  return t('platform_music_sync_state_pending')
}

const bindingTimeLabel = (time: number) => {
  if (!time) return t('platform_music_sync_never')
  const date = new Date(time)
  return t('platform_music_sync_last', {
    time: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  })
}

const handleImportLocal = async(item: LX.Account.PlaylistInfo) => {
  if (!wyAccount.value || isWriting.value) return
  isWriting.value = true
  try {
    const result = await importPlaylistToLocal(wyAccount.value.id, item)
    showNotice(t('platform_music_import_success', { name: item.name, count: String(result.total) }))
    await loadLocalLists()
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handlePushLocal = async(item: LX.List.UserListInfo) => {
  if (!wyAccount.value || isWriting.value) return
  if (!await dialog({
    message: t('platform_music_sync_push_confirm', { name: item.name }),
    showCancel: true,
  })) return
  isWriting.value = true
  try {
    const result = await pushLocalListToPlatform(item.id, wyAccount.value.id)
    showNotice(result.total
      ? t('platform_music_sync_push_success', { name: item.name, count: String(result.total) })
      : t('platform_music_sync_push_partial', { name: item.name, count: '0' }))
    syncStates.value = { ...syncStates.value, [item.id]: 'no-change' }
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handleSyncNow = async(item: LX.List.UserListInfo) => {
  if (isWriting.value) return
  isWriting.value = true
  try {
    const result = await syncBinding(item.id)
    syncStates.value = { ...syncStates.value, [item.id]: result.outcome }
    showSyncNotice(item.name, result)
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const showSyncNotice = (listName: string, result: SyncResult) => {
  if (result.outcome === 'conflict') {
    showNotice(result.message ?? t('platform_music_sync_state_conflict'))
    return
  }
  if (result.outcome === 'no-change') {
    showNotice(t('platform_music_sync_state_synced'))
    return
  }
  if (result.outcome === 'pulled') {
    showNotice(t('platform_music_import_success', { name: listName, count: String(result.added) }))
    return
  }
  showNotice(t('platform_music_sync_push_success', { name: listName, count: String(result.added) }))
}

const handleForcePush = async(item: LX.List.UserListInfo) => {
  if (isWriting.value) return
  isWriting.value = true
  try {
    await forcePushBinding(item.id)
    syncStates.value = { ...syncStates.value, [item.id]: 'no-change' }
    showNotice(t('platform_music_sync_state_synced'))
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handleForcePull = async(item: LX.List.UserListInfo) => {
  if (isWriting.value) return
  isWriting.value = true
  try {
    await forcePullBinding(item.id)
    syncStates.value = { ...syncStates.value, [item.id]: 'no-change' }
    showNotice(t('platform_music_sync_state_synced'))
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handleUnbind = async(item: LX.List.UserListInfo) => {
  const binding = bindingOf(item.id)
  if (!binding || isWriting.value) return
  if (!await dialog({
    message: t('platform_music_sync_unbind_confirm', { name: binding.playlistName }),
    showCancel: true,
  })) return
  isWriting.value = true
  try {
    await removeBinding(item.id)
    const next = { ...syncStates.value }
    Reflect.deleteProperty(next, item.id)
    syncStates.value = next
    showNotice(t('platform_music_sync_unbound'))
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
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

const openCreate = () => {
  editing.value = { mode: 'create', name: '' }
}

const openRename = (item: LX.Account.PlaylistInfo) => {
  editing.value = { mode: 'rename', playlistId: item.id, name: item.name }
}

const closeEdit = () => {
  editing.value = null
}

const handleEditSubmit = async({ name, desc }: { name: string, desc: string }) => {
  if (!wyAccount.value || !editing.value || isWriting.value) return
  const current = editing.value
  isWriting.value = true
  try {
    if (current.mode === 'create') {
      const id = await createAccountPlaylist({ accountId: wyAccount.value.id, name, privacy: 0 })
      if (desc) await updateAccountPlaylist({ accountId: wyAccount.value.id, playlistId: id, desc })
      showNotice(t('platform_music_playlist_created', { name }))
    } else if (current.playlistId) {
      await updateAccountPlaylist({ accountId: wyAccount.value.id, playlistId: current.playlistId, name })
      if (detail.value?.playlistId === current.playlistId) detail.value = { ...detail.value, name }
      showNotice(t('platform_music_playlist_renamed', { name }))
    }
    editing.value = null
    await loadPlaylists()
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handleDeletePlaylist = async(item: LX.Account.PlaylistInfo) => {
  if (!wyAccount.value || isWriting.value) return
  if (!await dialog({
    message: t('platform_music_playlist_delete_confirm', { name: item.name }),
    showCancel: true,
  })) return
  isWriting.value = true
  try {
    await deleteAccountPlaylist({ accountId: wyAccount.value.id, playlistId: item.id })
    showNotice(t('platform_music_playlist_deleted', { name: item.name }))
    if (detail.value?.playlistId === item.id) detail.value = null
    await loadPlaylists()
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const openPicker = () => {
  const current = detail.value
  if (!current?.playlistId) return
  picker.value = { existingIds: current.list.map(item => String(item.meta.songId ?? '')).filter(Boolean) }
}

const closePicker = () => {
  picker.value = null
}

const handleAddSongs = async(songIds: string[]) => {
  const current = detail.value
  if (!wyAccount.value || !current?.playlistId || isWriting.value) return
  isWriting.value = true
  try {
    const result = current.specialType === LIKED_PLAYLIST_TYPE
      ? await likeAccountSongs({ accountId: wyAccount.value.id, songIds, like: true })
      : await addAccountPlaylistTracks({
        accountId: wyAccount.value.id,
        playlistId: current.playlistId,
        songIds,
      })
    picker.value = null
    if (result.failed) {
      showNotice(t('platform_music_add_partial', { success: result.success, failed: result.failed, message: result.message ?? '' }))
    } else {
      showNotice(t('platform_music_add_success', { count: result.success }))
    }
    await reloadDetail()
    await loadPlaylists()
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handleRemove = async(index: number) => {
  const current = detail.value
  const song = current?.list[index]
  if (!wyAccount.value || !current?.playlistId || !song || isWriting.value) return
  isWriting.value = true
  try {
    const result = current.specialType === LIKED_PLAYLIST_TYPE
      ? await likeAccountSongs({ accountId: wyAccount.value.id, songIds: [String(song.meta.songId)], like: false })
      : await removeAccountPlaylistTracks({
        accountId: wyAccount.value.id,
        playlistId: current.playlistId,
        songIds: [String(song.meta.songId)],
      })
    if (result.failed) {
      showNotice(t('platform_music_remove_failed', { message: result.message ?? '' }))
      return
    }
    const next = [...current.list]
    next.splice(index, 1)
    detail.value = { ...current, sub: t('platform_music_total', { count: String(next.length) }), list: next }
    showNotice(t('platform_music_remove_success', { name: song.name }))
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
}

const handleLike = async(song: LX.Music.MusicInfoOnline) => {
  if (!wyAccount.value || isWriting.value) return
  isWriting.value = true
  try {
    const result = await likeAccountSongs({ accountId: wyAccount.value.id, songIds: [String(song.meta.songId)], like: true })
    if (result.failed) showNotice(t('platform_music_like_failed', { message: result.message ?? '' }))
    else showNotice(t('platform_music_like_success', { name: song.name }))
  } catch (err) {
    handleError(err)
  } finally {
    isWriting.value = false
  }
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
  await loadBindings()
  await loadLocalLists()
  if (wyAccount.value) void loadPlaylists()
})

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
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
.notice {
  flex: none;
  margin: 8px 16px 0;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--color-font);
  border-radius: @radius-border;
  background-color: var(--color-primary-light-300-alpha-700);
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
    .rowActions {
      display: flex;
    }
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
.rowActions {
  display: none;
  flex: none;
  gap: 6px;
  margin-left: 10px;
}
.rowBtn {
  padding: 2px 8px;
  font-size: 11px;
  color: var(--color-font-label);
  border: var(--color-list-header-border-bottom);
  border-radius: 9px;
  background: none;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: color, border-color;
  &:hover {
    color: var(--color-primary);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
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
  position: relative;
  border-radius: @radius-border;
  overflow: hidden;
  cursor: pointer;
  background-color: var(--color-primary-light-400-alpha-700);
  transition: @transition-fast;
  transition-property: background-color;
  &:hover {
    background-color: var(--color-primary-light-300-alpha-700);
    .cardActions {
      display: flex;
    }
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
.cardActions {
  display: none;
  position: absolute;
  top: 6px;
  right: 6px;
  gap: 6px;
}
.cardBtn {
  padding: 2px 7px;
  font-size: 11px;
  color: #fff;
  border: none;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color;
  &:hover {
    background-color: var(--color-primary);
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
.tip {
  padding: 16px 0;
  font-size: 12px;
  color: var(--color-font-label);
}
.syncList {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
}
.syncRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: @radius-border;
  background-color: var(--color-primary-light-400-alpha-700);
}
.syncInfo {
  flex: auto;
  min-width: 0;
}
.syncName {
  font-size: 13px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.syncMeta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--color-font-label);
}
.syncState {
  padding: 1px 7px;
  border-radius: 8px;
  &[data-state='conflict'] {
    color: var(--color-primary);
    background-color: var(--color-primary-light-300-alpha-700);
  }
}
.syncTime {
  .mixin-ellipsis-1();
}
.syncActions {
  flex: none;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
