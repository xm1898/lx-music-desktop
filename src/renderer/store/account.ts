import { ref, computed } from '@common/utils/vueTools'
import { getAccounts, removeAccount as ipcRemoveAccount } from '@renderer/utils/ipc'

export const accounts = ref<LX.Account.PlatformAccount[]>([])
export const currentAccountId = ref<string | null>(null)

export const currentAccount = computed(() =>
  accounts.value.find(account => account.id === currentAccountId.value) ?? null,
)

export const wyAccount = computed(() =>
  accounts.value.find(account => account.source === 'wy' && account.isLogin) ?? null,
)

export const loadAccounts = async() => {
  accounts.value = await getAccounts()
  if (!currentAccount.value) currentAccountId.value = wyAccount.value?.id ?? null
}

export const removeAccount = async(id: string) => {
  await ipcRemoveAccount(id)
  if (currentAccountId.value === id) currentAccountId.value = null
  await loadAccounts()
}
