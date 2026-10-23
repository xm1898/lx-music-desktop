import { safeStorage } from 'electron'
import { STORE_NAMES } from '@common/constants'
import getStore from '@main/utils/store'

const ACCOUNTS_KEY = 'accounts'
const BINDINGS_KEY = 'playlist_bindings'

let accountStore: ReturnType<typeof getStore> | null = null
const getAccountStore = () => {
  if (!accountStore) accountStore = getStore(STORE_NAMES.ACCOUNT_SESSIONS)
  return accountStore
}

const encrypt = (text: string): LX.Account.EncryptedSession => {
  // 系统安全存储不可用时（例如 Linux 没有 keyring）降级为明文 base64，
  // 仅在用户本机落盘，且会在日志中提示
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[account] 系统安全存储不可用，登录凭证将以明文保存')
    return { data: Buffer.from(text).toString('base64'), plain: true }
  }
  return { data: safeStorage.encryptString(text).toString('base64') }
}

const decrypt = (encrypted: LX.Account.EncryptedSession): string => {
  const buffer = Buffer.from(encrypted.data, 'base64')
  return encrypted.plain ? buffer.toString() : safeStorage.decryptString(buffer)
}

export const listAccounts = (): LX.Account.PlatformAccount[] => {
  return getAccountStore().get<LX.Account.PlatformAccount[]>(ACCOUNTS_KEY) ?? []
}

export const saveAccount = (account: LX.Account.PlatformAccount, session: LX.Account.LoginSession) => {
  const encryptedSession = encrypt(JSON.stringify(session))
  const accounts = listAccounts()
  const index = accounts.findIndex(item => item.id === account.id)
  if (index > -1) accounts[index] = account
  else accounts.push(account)
  const store = getAccountStore()
  store.set(ACCOUNTS_KEY, accounts)
  store.set(`session:${account.id}`, encryptedSession)
}

export const removeAccount = (id: string) => {
  const store = getAccountStore()
  store.set(ACCOUNTS_KEY, listAccounts().filter(item => item.id !== id))
  store.remove(`session:${id}`)
  // 同步绑定一并清理，避免残留指向已删除账号
  store.set(BINDINGS_KEY, listBindings().filter(item => item.accountId !== id))
}

export const listBindings = (): LX.Account.PlaylistBinding[] => {
  return getAccountStore().get<LX.Account.PlaylistBinding[]>(BINDINGS_KEY) ?? []
}

export const saveBinding = (binding: LX.Account.PlaylistBinding) => {
  const bindings = listBindings()
  const index = bindings.findIndex(item => item.listId === binding.listId)
  if (index > -1) bindings[index] = binding
  else bindings.push(binding)
  getAccountStore().set(BINDINGS_KEY, bindings)
}

export const removeBinding = (listId: string) => {
  getAccountStore().set(BINDINGS_KEY, listBindings().filter(item => item.listId !== listId))
}

export const getSession = (id: string): LX.Account.LoginSession | null => {
  const encrypted = getAccountStore().get<LX.Account.EncryptedSession>(`session:${id}`)
  if (!encrypted) return null
  try {
    return JSON.parse(decrypt(encrypted))
  } catch (err) {
    console.error('[account] 登录状态解密失败：', err)
    return null
  }
}
