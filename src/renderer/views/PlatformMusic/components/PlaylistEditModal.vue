<template lang="pug">
material-modal(:show="show" bg-close teleport="#view" max-width="420px" min-width="300px" @close="handleClose")
  main(:class="$style.main")
    h2 {{ isCreate ? $t('platform_music_playlist_create') : $t('platform_music_playlist_rename') }}
    div(:class="$style.field")
      label(:class="$style.label") {{ $t('platform_music_playlist_name') }}
      base-input(
        v-model="name"
        :placeholder="$t('platform_music_playlist_name_placeholder')"
        @submit="handleSubmit"
      )
    div(v-if="isCreate" :class="$style.field")
      label(:class="$style.label") {{ $t('platform_music_playlist_desc') }}
      base-input(v-model="desc" :placeholder="$t('platform_music_playlist_desc_placeholder')")
    p(:class="$style.note") {{ $t('platform_music_playlist_edit_note') }}
    div(:class="$style.footer")
      base-btn(min @click="handleClose") {{ $t('platform_music_cancel') }}
      base-btn(min :disabled="!canSubmit || isSubmitting" @click="handleSubmit") {{ $t('platform_music_confirm') }}
</template>

<script setup lang="ts">
import { ref, watch, computed } from '@common/utils/vueTools'

const props = withDefaults(defineProps<{
  show: boolean
  mode?: 'create' | 'rename'
  initialName?: string
  initialDesc?: string
  isSubmitting?: boolean
}>(), {
  mode: 'create',
  initialName: '',
  initialDesc: '',
  isSubmitting: false,
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'submit', value: { name: string, desc: string }): void
}>()

const name = ref(props.initialName)
const desc = ref(props.initialDesc)

const isCreate = computed(() => props.mode === 'create')
const canSubmit = computed(() => !!name.value.trim())

watch(() => props.show, show => {
  if (!show) return
  name.value = props.initialName
  desc.value = props.initialDesc
})

const handleClose = () => {
  emit('update:show', false)
}

const handleSubmit = () => {
  if (!canSubmit.value || props.isSubmitting) return
  emit('submit', { name: name.value.trim(), desc: desc.value.trim() })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 18px 20px 16px;
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;

  h2 {
    font-size: 15px;
    font-weight: 500;
    color: var(--color-font);
  }
}
.field {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
}
.label {
  font-size: 12px;
  color: var(--color-font-label);
}
.note {
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-font-label);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
</style>
