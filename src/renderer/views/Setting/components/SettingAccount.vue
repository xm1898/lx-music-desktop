<template lang="pug">
dt#account {{ $t('setting__account') }}
dd
  div(:class="$style.card")
    div(:class="$style.head")
      img(v-if="wyAccount && wyAccount.avatar" :src="wyAccount.avatar" :class="$style.avatar" alt="")
      div(:class="$style.headInfo")
        h3(:class="$style.platform") {{ $t('setting__account_wy') }}
        p(:class="$style.sub") {{ wyAccount ? wyAccount.nickname : $t('setting__account_not_login') }}
      base-btn(v-if="wyAccount" min @click="handleLogout") {{ $t('setting__account_logout') }}
    div(v-if="!wyAccount" :class="$style.body")
      div(:class="$style.tabs" role="tablist")
        button(
          :class="[$style.tab, { [$style.active]: tab === 'qr' }]"
          role="tab"
          :aria-selected="tab === 'qr'"
          @click="switchTab('qr')"
        ) {{ $t('setting__account_qr') }}
        button(
          :class="[$style.tab, { [$style.active]: tab === 'cookie' }]"
          role="tab"
          :aria-selected="tab === 'cookie'"
          @click="switchTab('cookie')"
        ) {{ $t('setting__account_cookie') }}
      div(v-if="tab === 'qr'" :class="$style.qrBox")
        img(v-if="qr.qrUrl" :src="qr.qrUrl" :class="$style.qrImg" alt="网易云音乐登录二维码")
        p(:class="$style.tip") {{ qrTip }}
        base-btn(min :disabled="qr.status === 'loading'" @click="refreshQr") {{ $t('setting__account_qr_refresh') }}
      div(v-else :class="$style.cookieBox")
        base-input(v-model="cookie" :placeholder="$t('setting__account_cookie_placeholder')")
        base-btn(min :disabled="isLogging" @click="handleCookieLogin") {{ $t('setting__account_login') }}
      p(v-if="cookieError" :class="$style.error") {{ cookieError }}
    p(:class="$style.note") {{ $t('setting__account_tip') }}
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useI18n } from '@root/lang'
import { dialog } from '@renderer/plugins/Dialog'
import { checkAccountQrCode, createAccountQrCode, loginAccountByCookie } from '@renderer/utils/ipc'
import { loadAccounts, removeAccount, wyAccount } from '@renderer/store/account'

const t = useI18n()

const tab = ref<'qr' | 'cookie'>('qr')
const cookie = ref('')
const isLogging = ref(false)
const qr = ref<LX.Account.QrCodeLoginState>({ key: '', qrUrl: '', status: 'waiting' })
const qrError = ref('')
const cookieError = ref('')

let timer: number | null = null

const stopPolling = () => {
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
}

const qrTip = computed(() => {
  if (qrError.value) return qrError.value
  switch (qr.value.status) {
    case 'scanned':
      return t('setting__account_qr_scanned')
    case 'expired':
      return t('setting__account_qr_expired')
    case 'failed':
      return qr.value.message ?? t('setting__account_qr_expired')
    default:
      return t('setting__account_qr_tip')
  }
})

const pollQr = async() => {
  if (!qr.value.key) return
  try {
    const result = await checkAccountQrCode('wy', qr.value.key)
    qr.value = { ...qr.value, status: result.status, message: result.message }
    if (result.status === 'confirmed') {
      stopPolling()
      await loadAccounts()
    } else if (result.status === 'expired' || result.status === 'failed') {
      stopPolling()
    }
  } catch (err: any) {
    stopPolling()
    qrError.value = err.message ?? t('setting__account_login_failed')
  }
}

const refreshQr = async() => {
  stopPolling()
  qrError.value = ''
  qr.value = { key: '', qrUrl: '', status: 'loading' as LX.Account.QrCodeStatus }
  try {
    qr.value = await createAccountQrCode('wy')
    timer = window.setInterval(() => { void pollQr() }, 2000)
  } catch (err: any) {
    qr.value = { key: '', qrUrl: '', status: 'failed' }
    qrError.value = err.message ?? t('setting__account_login_failed')
  }
}

const switchTab = (value: 'qr' | 'cookie') => {
  tab.value = value
  if (value === 'qr' && !qr.value.qrUrl) void refreshQr()
  else if (value === 'cookie') stopPolling()
}

const handleCookieLogin = async() => {
  if (!cookie.value.trim() || isLogging.value) return
  isLogging.value = true
  cookieError.value = ''
  try {
    await loginAccountByCookie({ source: 'wy', method: 'cookie', cookie: cookie.value.trim() })
    cookie.value = ''
    await loadAccounts()
  } catch (err: any) {
    cookieError.value = err.message ?? t('setting__account_login_failed')
    void dialog(cookieError.value)
  } finally {
    isLogging.value = false
  }
}

const handleLogout = async() => {
  if (!wyAccount.value) return
  await removeAccount(wyAccount.value.id)
}

onMounted(() => {
  void loadAccounts()
  void refreshQr()
})

onBeforeUnmount(stopPolling)
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.card {
  border: var(--color-list-header-border-bottom);
  border-radius: @radius-border;
  padding: 12px;
}
.head {
  display: flex;
  align-items: center;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex: none;
  object-fit: cover;
}
.headInfo {
  flex: auto;
  margin-left: 10px;
  overflow: hidden;
}
.platform {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-font);
}
.sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.body {
  margin-top: 12px;
}
.tabs {
  display: flex;
  gap: 8px;
}
.tab {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--color-font);
  border: var(--color-list-header-border-bottom);
  border-radius: @radius-border;
  cursor: pointer;
  background-color: transparent;
  transition: @transition-fast;
  transition-property: background-color, color;
  &.active {
    background-color: var(--color-primary-light-300-alpha-700);
  }
}
.qrBox {
  margin-top: 12px;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 10px;
}
.qrImg {
  width: 160px;
  height: 160px;
  border-radius: @radius-border;
  background-color: #fff;
}
.tip {
  font-size: 12px;
  color: var(--color-font-label);
  text-align: center;
}
.cookieBox {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.note {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-font-label);
}
.error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-error);
}
</style>
