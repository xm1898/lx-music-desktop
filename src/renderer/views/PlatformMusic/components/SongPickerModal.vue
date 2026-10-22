<template lang="pug">
material-modal(:show="show" bg-close teleport="#view" max-width="720px" min-width="420px" max-height="82%" @close="handleClose")
  main(:class="$style.main")
    h2(:class="$style.title") {{ $t('platform_music_add_songs') }}
    div(:class="$style.tabs")
      button(
        v-for="item in tabs"
        :key="item.id"
        type="button"
        :class="[$style.tab, { [$style.tabActive]: tab === item.id }]"
        @click="switchTab(item.id)"
      ) {{ item.label }}

    template(v-if="tab === 'search'")
      div(:class="$style.searchBar")
        base-input(
          v-model="keyword"
          :placeholder="$t('platform_music_search_placeholder')"
          @submit="handleSearch"
        )
        base-btn(min :disabled="!keyword.trim() || isBusy" @click="handleSearch") {{ $t('platform_music_search') }}
      div.scroll(:class="$style.list")
        p(v-if="isBusy" :class="$style.tip") {{ $t('platform_music_loading') }}
        p(v-else-if="!results.length" :class="$style.tip") {{ $t('platform_music_search_empty') }}
        div(
          v-for="item in results"
          :key="item.id"
          :class="[$style.row, { [$style.rowDisabled]: isExisting(item) }]"
          role="button"
          tabindex="0"
          @click="toggleSong(item)"
        )
          base-checkbox(
            :id="`picker_${item.id}`"
            :model-value="selected.has(item.id) || isExisting(item)"
            :disabled="isExisting(item)"
            :label="''"
            @click.stop
            @update:model-value="toggleSong(item)"
          )
          span(:class="$style.rowName" :title="item.name") {{ item.name }}
          span(:class="$style.rowSinger" :title="item.singer") {{ item.singer }}
          span(:class="$style.rowAlbum" :title="item.meta.albumName") {{ item.meta.albumName }}
          span(v-if="isExisting(item)" :class="$style.rowBadge") {{ $t('platform_music_already_added') }}

    template(v-else)
      p(:class="$style.tip") {{ $t('platform_music_local_tip') }}
      div(:class="$style.chips")
        button(
          v-for="item in localLists"
          :key="item.id"
          type="button"
          :class="[$style.chip, { [$style.chipActive]: localListId === item.id }]"
          @click="selectLocalList(item.id)"
        ) {{ item.name }} ({{ item.total }})
      div(v-if="localListId" :class="$style.searchBar")
        base-btn(min :disabled="isBusy || !localSongs.length" @click="handleMatch") {{ $t('platform_music_start_match') }}
        span(v-if="matchProgress" :class="$style.progress") {{ $t('platform_music_match_progress', { done: matchProgress.done, total: matchProgress.total }) }}
      div.scroll(:class="$style.list")
        p(v-if="!localListId" :class="$style.tip") {{ $t('platform_music_local_pick') }}
        p(v-else-if="isBusy && !rows.length" :class="$style.tip") {{ $t('platform_music_loading') }}
        p(v-else-if="!rows.length" :class="$style.tip") {{ $t('platform_music_local_empty') }}
        div(
          v-for="row in rows"
          :key="row.key"
          :class="[$style.row, { [$style.rowDisabled]: !row.matched || isExistingId(row.songId) }]"
          role="button"
          tabindex="0"
          @click="toggleRow(row)"
        )
          base-checkbox(
            :id="`local_${row.key}`"
            :model-value="row.checked"
            :disabled="!row.matched || isExistingId(row.songId)"
            :label="''"
            @click.stop
            @update:model-value="toggleRow(row)"
          )
          span(:class="$style.rowName" :title="row.name") {{ row.name }}
          span(:class="$style.rowSinger" :title="row.singer") {{ row.singer }}
          span(:class="$style.rowAlbum" :title="row.matchLabel") {{ row.matchLabel }}
          span(v-if="!row.matched" :class="$style.rowBadge") {{ $t('platform_music_unmatched') }}
          span(v-else-if="isExistingId(row.songId)" :class="$style.rowBadge") {{ $t('platform_music_already_added') }}

    div(:class="$style.footer")
      span(:class="$style.count") {{ $t('platform_music_selected_count', { count: selectedCount }) }}
      base-btn(min @click="handleClose") {{ $t('platform_music_cancel') }}
      base-btn(min :disabled="!selectedCount || isSubmitting" @click="handleConfirm") {{ $t('platform_music_confirm') }}
</template>

<script setup lang="ts">
import { ref, computed, watch } from '@common/utils/vueTools'
import { useI18n } from '@root/lang'
import { allMusicList, defaultList, loveList, userLists } from '@renderer/store/list/state'
import { searchAccountSongs } from '@renderer/utils/ipc'

interface LocalRow {
  key: string
  name: string
  singer: string
  songId: string
  matched: boolean
  matchLabel: string
  checked: boolean
}

const props = withDefaults(defineProps<{
  show: boolean
  accountId: string
  existingIds?: string[]
  isSubmitting?: boolean
}>(), {
  existingIds: () => [],
  isSubmitting: false,
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm', songIds: string[]): void
}>()

const t = useI18n()

const tab = ref<'search' | 'local'>('search')
const keyword = ref('')
const results = ref<LX.Music.MusicInfoOnline[]>([])
const selected = ref(new Set<string>())
const isBusy = ref(false)

const localListId = ref('')
const rows = ref<LocalRow[]>([])
const matchProgress = ref<{ done: number, total: number } | null>(null)

const MAX_LOCAL_MATCH = 300
const CONCURRENCY = 4

const tabs = computed(() => [
  { id: 'search' as const, label: t('platform_music_tab_search') },
  { id: 'local' as const, label: t('platform_music_tab_local') },
])

const existingSet = computed(() => new Set(props.existingIds))

const localLists = computed(() => {
  const lists: Array<{ id: string, name: string, total: number }> = []
  const push = (id: string, name: string) => {
    const list = allMusicList.get(id) ?? []
    if (list.length) lists.push({ id, name, total: list.length })
  }
  push(defaultList.id, t('platform_music_local_default'))
  push(loveList.id, t('platform_music_local_love'))
  for (const item of userLists) push(item.id, item.name)
  return lists
})

const localSongs = computed<LX.Music.MusicInfo[]>(() => localListId.value ? allMusicList.get(localListId.value) ?? [] : [])

const isExisting = (item: LX.Music.MusicInfoOnline) => existingSet.value.has(String(item.meta.songId))

const isExistingId = (songId: string) => !!songId && existingSet.value.has(songId)

const selectedCount = computed(() => {
  if (tab.value === 'search') return selected.value.size
  return rows.value.filter(row => row.checked && row.matched && !isExistingId(row.songId)).length
})

const toggleSong = (item: LX.Music.MusicInfoOnline) => {
  if (isExisting(item)) return
  const next = new Set(selected.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  selected.value = next
}

const toggleRow = (row: LocalRow) => {
  if (!row.matched || isExistingId(row.songId)) return
  row.checked = !row.checked
}

const switchTab = (id: 'search' | 'local') => {
  if (isBusy.value) return
  tab.value = id
}

const handleSearch = async() => {
  const text = keyword.value.trim()
  if (!text || isBusy.value) return
  isBusy.value = true
  results.value = []
  try {
    results.value = await searchAccountSongs({ accountId: props.accountId, keyword: text, limit: 50 })
  } catch {
    results.value = []
  } finally {
    isBusy.value = false
  }
}

const selectLocalList = (id: string) => {
  if (isBusy.value) return
  localListId.value = id
  rows.value = []
  matchProgress.value = null
}

const normalize = (value: string) => (value ?? '').toLowerCase().replace(/[\s\-_()（）[\]【】.,，。·'"!！?？/\\]/g, '')

const nameScore = (a: string, b: string) => {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0
  if (left === right) return 2
  if (left.includes(right) || right.includes(left)) return 1.2
  return 0
}

const singerScore = (a: string, b: string) => {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0
  return left === right ? 1 : (left.includes(right) || right.includes(left) ? 0.6 : 0)
}

const runLimited = async<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) => {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async() => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

const handleMatch = async() => {
  if (isBusy.value) return
  const source = localSongs.value.slice(0, MAX_LOCAL_MATCH)
  if (!source.length) return
  isBusy.value = true
  rows.value = []
  matchProgress.value = { done: 0, total: source.length }
  const result: LocalRow[] = new Array(source.length)
  try {
    await runLimited(source, CONCURRENCY, async(song, index) => {
      const key = `${index}_${song.id}`
      const base = { key, name: song.name, singer: song.singer }
      const directId = song.source === 'wy' ? String(song.meta.songId ?? '') : ''
      if (directId && /^\d+$/.test(directId)) {
        result[index] = { ...base, songId: directId, matched: true, matchLabel: t('platform_music_match_direct'), checked: !isExistingId(directId) }
      } else {
        let best: { songId: string, label: string, score: number } | null = null
        try {
          const list = await searchAccountSongs({
            accountId: props.accountId,
            keyword: `${song.name} ${song.singer}`.trim(),
            limit: 5,
          })
          for (const candidate of list) {
            const score = nameScore(song.name, candidate.name) + singerScore(song.singer, candidate.singer)
            if (!best || score > best.score) {
              best = { songId: String(candidate.meta.songId), label: `${candidate.name} - ${candidate.singer}`, score }
            }
          }
        } catch {}
        if (best && best.score >= 1.8) {
          result[index] = { ...base, songId: best.songId, matched: true, matchLabel: best.label, checked: !isExistingId(best.songId) }
        } else {
          result[index] = { ...base, songId: '', matched: false, matchLabel: t('platform_music_unmatched'), checked: false }
        }
      }
      matchProgress.value = { done: index + 1, total: source.length }
      if ((index + 1) % 10 === 0 || index + 1 === source.length) rows.value = result.filter(Boolean)
    })
    rows.value = result.filter(Boolean)
  } finally {
    isBusy.value = false
    matchProgress.value = null
  }
}

const handleConfirm = () => {
  if (isBusy.value || props.isSubmitting) return
  if (tab.value === 'search') {
    const ids = results.value.filter(item => selected.value.has(item.id)).map(item => String(item.meta.songId))
    if (ids.length) emit('confirm', ids)
    return
  }
  const ids = rows.value.filter(row => row.checked && row.matched && !isExistingId(row.songId)).map(row => row.songId)
  if (ids.length) emit('confirm', ids)
}

const handleClose = () => {
  if (isBusy.value) return
  emit('update:show', false)
}

watch(() => props.show, show => {
  if (show) return
  tab.value = 'search'
  keyword.value = ''
  results.value = []
  selected.value = new Set()
  localListId.value = ''
  rows.value = []
  matchProgress.value = null
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 18px 20px 14px;
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
  max-height: 78vh;
}
.title {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-font);
}
.tabs {
  display: flex;
  gap: 8px;
}
.tab {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--color-font-label);
  border: none;
  border-radius: 12px;
  background-color: var(--color-primary-light-400-alpha-700);
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color, color;
  &:hover {
    color: var(--color-font);
  }
}
.tabActive {
  color: var(--color-button-font);
  background-color: var(--color-primary);
}
.searchBar {
  display: flex;
  align-items: center;
  gap: 10px;
  > input {
    flex: auto;
  }
}
.progress {
  font-size: 11px;
  color: var(--color-font-label);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 88px;
  overflow-y: auto;
}
.chip {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--color-font);
  border: none;
  border-radius: 10px;
  background-color: var(--color-primary-light-400-alpha-700);
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color;
  &:hover {
    background-color: var(--color-primary-light-300-alpha-700);
  }
}
.chipActive {
  background-color: var(--color-primary-light-300-alpha-800);
}
.list {
  flex: auto;
  min-height: 180px;
  max-height: 46vh;
  overflow-y: auto;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 6px;
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
.rowDisabled {
  cursor: default;
  opacity: 0.55;
}
.rowName {
  flex: 3 1 0;
  .mixin-ellipsis-1();
}
.rowSinger {
  flex: 2 1 0;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.rowAlbum {
  flex: 2 1 0;
  font-size: 12px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.rowBadge {
  flex: none;
  font-size: 11px;
  color: var(--color-font-label);
  border: var(--color-list-header-border-bottom);
  border-radius: 9px;
  padding: 1px 6px;
}
.tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-font-label);
  padding: 6px 0;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}
.count {
  margin-right: auto;
  font-size: 12px;
  color: var(--color-font-label);
}
</style>
