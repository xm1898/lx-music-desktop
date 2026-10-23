<template lang="pug">
dt#play {{ $t('setting__play') }}
dd
  .gap-top
    base-checkbox(id="setting_player_startup_auto_play" :model-value="appSetting['player.startupAutoPlay']" :label="$t('setting__play_startup_auto_play')" @update:model-value="updateSetting({'player.startupAutoPlay': $event})")
  .gap-top
    base-checkbox(id="setting_player_power_save_blocker" :model-value="appSetting['player.powerSaveBlocker']" :label="$t('setting__play_power_save_blocker')" @update:model-value="handleUpdatePowerSaveBlocker")
  .gap-top
    base-checkbox(id="setting_player_save_play_time" :model-value="appSetting['player.isSavePlayTime']" :label="$t('setting__play_save_play_time')" @update:model-value="updateSetting({'player.isSavePlayTime': $event})")
  .gap-top
    base-checkbox(id="setting_player_auto_clean_played_list" :model-value="appSetting['player.isAutoCleanPlayedList']" :label="$t('setting__play_auto_clean_played_list')" @update:model-value="updateSetting({'player.isAutoCleanPlayedList': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_auto_clean_played_list_tip')")
  .gap-top
    base-checkbox(id="setting_player_lyric_transition" :model-value="appSetting['player.isShowLyricTranslation']" :label="$t('setting__play_lyric_transition')" @update:model-value="updateSetting({'player.isShowLyricTranslation': $event})")
  .gap-top
    base-checkbox(id="setting_player_lyric_roma" :model-value="appSetting['player.isShowLyricRoma']" :label="$t('setting__play_lyric_roma')" @update:model-value="updateSetting({'player.isShowLyricRoma': $event})")
  .gap-top
    base-checkbox(id="setting_player_awap_lyric_trans_roma" :model-value="appSetting['player.isSwapLyricTranslationAndRoma']" :label="$t('setting__player_swap_lyric_trans_roma')" @update:model-value="updateSetting({'player.isSwapLyricTranslationAndRoma': $event})")
  .gap-top
    base-checkbox(id="setting_player_auto_skip_on_error" :model-value="appSetting['player.autoSkipOnError']" :label="$t('setting__play_auto_skip_on_error')" @update:model-value="updateSetting({'player.autoSkipOnError': $event})")
  .gap-top
    base-checkbox(id="setting_player_quality_fallback" :model-value="appSetting['player.qualityFallback']" :label="$t('setting__play_quality_fallback')" @update:model-value="updateSetting({'player.qualityFallback': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_quality_fallback_tip')")
  .gap-top
    base-checkbox(id="setting_player_source_cooldown" :model-value="appSetting['player.sourceCooldown']" :label="$t('setting__play_source_cooldown')" @update:model-value="updateSetting({'player.sourceCooldown': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_source_cooldown_tip')")
  .gap-top
    base-checkbox(id="setting_player_source_match_filter" :model-value="appSetting['player.sourceMatchFilter']" :label="$t('setting__play_source_match_filter')" @update:model-value="updateSetting({'player.sourceMatchFilter': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_source_match_filter_tip')")
  .gap-top
    base-checkbox(id="setting_player_source_race" :model-value="appSetting['player.sourceRace']" :label="$t('setting__play_source_race')" @update:model-value="updateSetting({'player.sourceRace': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_source_race_tip')")
  .gap-top(v-if="appSetting['player.sourceRace']")
    span {{ $t('setting__play_source_race_count') }}
    .race-count
      base-btn(v-for="count in [2, 3, 4]" :key="count" min :class="{ 'race-count-active': appSetting['player.sourceRaceCount'] === count }" @click="updateSetting({ 'player.sourceRaceCount': count })") {{ count }}
  .gap-top
    div {{ $t('setting__play_gapless_fade') }}
    p.recovery-tip {{ $t('setting__play_gapless_fade_tip') }}
    .race-count
      base-btn(v-for="ms in [0, 200, 500, 1000, 2000, 3000]" :key="ms" min :class="{ 'race-count-active': appSetting['player.gaplessFade'] === ms }" @click="updateSetting({ 'player.gaplessFade': ms })") {{ ms === 0 ? $t('setting__play_gapless_off') : ms + 'ms' }}
  .gap-top
    div {{ $t('setting__play_recovery_chain') }}
    p.recovery-tip {{ $t('setting__play_recovery_chain_tip') }}
    .recovery-chain
      div(v-for="(step, index) in recoveryChain" :key="step.key" class="recovery-row")
        base-checkbox(:model-value="step.enabled" :label="$t('setting__play_recovery_' + step.key)" @update:model-value="toggleRecoveryStep(index, $event)")
        .recovery-order
          base-btn(min :disabled="index === 0" @click="moveRecoveryStep(index, -1)") ↑
          base-btn(min :disabled="index === recoveryChain.length - 1" @click="moveRecoveryStep(index, 1)") ↓
  .gap-top
    base-checkbox(id="setting_player_lyric_s2t" :model-value="appSetting['player.isS2t']" :label="$t('setting__play_lyric_s2t')" @update:model-value="updateSetting({'player.isS2t': $event})")
  .gap-top
    base-checkbox(id="setting_player_lyric_play_lxlrc" :model-value="appSetting['player.isPlayLxlrc']" :label="$t('setting__play_lyric_lxlrc')" @update:model-value="updateSetting({'player.isPlayLxlrc': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_lyric_lxlrc_tip')")
  .gap-top
    base-checkbox(id="setting_player_showTaskProgess" :model-value="appSetting['player.isShowTaskProgess']" :label="$t('setting__play_task_bar')" @update:model-value="updateSetting({'player.isShowTaskProgess': $event})")
  .gap-top(v-if="isMac")
    base-checkbox(id="setting_player_showStatusBarLyric" :model-value="appSetting['player.isShowStatusBarLyric']" :label="$t('setting__play_statusbar_lyric')" @update:model-value="updateSetting({'player.isShowStatusBarLyric': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_statusbar_lyric_tip')")
  .gap-top
    base-checkbox(id="setting_player_isMaxOutputChannelCount" :model-value="isMaxOutputChannelCount" :label="$t('setting__play_max_output_channel_count')" @update:model-value="handleUpdateMaxOutputChannelCount")
  .gap-top
    base-checkbox(id="setting_player_isMediaDeviceRemovedStopPlay" :model-value="appSetting['player.isMediaDeviceRemovedStopPlay']" :label="$t('setting__play_mediaDevice_remove_stop_play')" @update:model-value="updateSetting({'player.isMediaDeviceRemovedStopPlay': $event})")

dd
  h3#basic_play_quality {{ $t('setting__play_playQuality') }}
  div
    base-checkbox.gap-left(
      v-for="item in playQualityList" :id="`setting_play_quality_${item}`" :key="item"
      name="setting_play_quality" need :model-value="appSetting['player.playQuality']" :value="item" :label="item"
      @update:model-value="updateSetting({'player.playQuality': $event})")

dd(:aria-label="$t('setting__play_mediaDevice_title')")
  h3#play_mediaDevice {{ $t('setting__play_mediaDevice') }}
  div
    base-selection.gap-left(v-model="mediaDeviceId" :list="mediaDevices" item-key="deviceId" item-name="label" @change="handleMediaDeviceIdChnage")
</template>

<script>
import { ref, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { hasInitedAdvancedAudioFeatures, setMediaDeviceId } from '@renderer/plugins/player'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import { setPowerSaveBlocker } from '@renderer/core/player/utils'
import { isPlay } from '@renderer/store/player/state'
import { TRY_QUALITYS_LIST, DEFAULT_RECOVERY_CHAIN } from '@renderer/core/music/utils'
import { isMac } from '@common/utils'


export default {
  name: 'SettingPlay',
  setup() {
    const t = useI18n()
    const playQualityList = [...TRY_QUALITYS_LIST, '128k'].reverse()

    const RECOVERY_KEYS = DEFAULT_RECOVERY_CHAIN
    const recoveryChain = ref(RECOVERY_KEYS.map(key => ({ key, enabled: true })))

    const syncRecoveryChain = () => {
      const saved = appSetting['player.recoveryChain']
      const enabled = Array.isArray(saved) && saved.length ? saved : RECOVERY_KEYS
      // 以固定 key 顺序展示，勾选状态来自保存值；未保存的 key 追加到末尾
      const known = RECOVERY_KEYS.map(key => ({ key, enabled: enabled.includes(key) }))
      const extra = enabled.filter(key => !RECOVERY_KEYS.includes(key)).map(key => ({ key, enabled: true }))
      recoveryChain.value = [...known, ...extra]
    }
    syncRecoveryChain()

    const persistRecoveryChain = (list) => {
      const enabled = list.filter(item => item.enabled).map(item => item.key)
      updateSetting({ 'player.recoveryChain': enabled })
    }

    const toggleRecoveryStep = (index, value) => {
      const next = [...recoveryChain.value]
      next[index] = { ...next[index], enabled: !!value }
      recoveryChain.value = next
      persistRecoveryChain(next)
    }

    const moveRecoveryStep = (index, offset) => {
      const target = index + offset
      if (target < 0 || target >= recoveryChain.value.length) return
      const next = [...recoveryChain.value]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      recoveryChain.value = next
      persistRecoveryChain(next)
    }

    const mediaDevices = ref([])
    const getMediaDevice = async() => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      let audioDevices = devices.filter(device => device.kind === 'audiooutput')
      mediaDevices.value = audioDevices
      // console.log(this.mediaDevices)
    }
    void getMediaDevice()

    navigator.mediaDevices.addEventListener('devicechange', getMediaDevice)
    onBeforeUnmount(() => {
      navigator.mediaDevices.removeEventListener('devicechange', getMediaDevice)
    })

    const mediaDeviceId = ref(appSetting['player.mediaDeviceId'])
    const handleMediaDeviceIdChnage = async() => {
      if (hasInitedAdvancedAudioFeatures()) {
        await dialog({
          message: t('setting__play_media_device_error_tip'),
          confirmButtonText: t('alert_button_text'),
        })
        mediaDeviceId.value = appSetting['player.mediaDeviceId']
      } else if (appSetting['player.audioVisualization']) {
        const confirm = await dialog.confirm({
          message: t('setting__play_media_device_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (confirm) {
          updateSetting({
            'player.audioVisualization': false,
            'player.mediaDeviceId': mediaDeviceId.value,
          })
        } else {
          mediaDeviceId.value = appSetting['player.mediaDeviceId']
        }
      } else {
        appSetting['player.mediaDeviceId'] = mediaDeviceId.value
      }
    }
    watch(() => appSetting['player.mediaDeviceId'], val => {
      mediaDeviceId.value = val
    })

    const handleUpdatePowerSaveBlocker = (enabled) => {
      if (enabled) {
        if (isPlay.value) setPowerSaveBlocker(true, true)
      } else {
        setPowerSaveBlocker(false, true)
      }
      updateSetting({ 'player.powerSaveBlocker': enabled })
    }

    const isMaxOutputChannelCount = ref(appSetting['player.isMaxOutputChannelCount'])
    const handleUpdateMaxOutputChannelCount = async(enabled) => {
      isMaxOutputChannelCount.value = enabled
      if (appSetting['player.mediaDeviceId'] != 'default') {
        const confirm = await dialog.confirm({
          message: t('setting__play_advanced_audio_features_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) {
          isMaxOutputChannelCount.value = false
          return
        }
        await setMediaDeviceId('default').catch(_ => _)
        saveMediaDeviceId('default')
      }
      updateSetting({ 'player.isMaxOutputChannelCount': enabled })
    }


    return {
      appSetting,
      updateSetting,
      mediaDevices,
      mediaDeviceId,
      handleMediaDeviceIdChnage,
      handleUpdatePowerSaveBlocker,
      isMaxOutputChannelCount,
      handleUpdateMaxOutputChannelCount,
      playQualityList,
      isMac,
      recoveryChain,
      toggleRecoveryStep,
      moveRecoveryStep,
    }
  },
}
</script>
