import * as accountStore from './store'

const inMemorySessions = new Map<string, LX.Account.LoginSession>()

export const loadAccounts = () => {
  const accounts = accountStore.listAccounts()
  for (const account of accounts) {
    const session = accountStore.getSession(account.id)
    if (session) inMemorySessions.set(account.id, session)
  }
  return accounts
}

export const listAccounts = (): LX.Account.PlatformAccount[] => {
  return accountStore.listAccounts().map(account => ({
    ...account,
    isLogin: inMemorySessions.has(account.id),
  }))
}

export const saveAccount = (account: LX.Account.PlatformAccount, session: LX.Account.LoginSession) => {
  accountStore.saveAccount(account, session)
  inMemorySessions.set(account.id, session)
}

export const removeAccount = (id: string) => {
  accountStore.removeAccount(id)
  inMemorySessions.delete(id)
}

export const getSession = (id: string): LX.Account.LoginSession | null => {
  const cached = inMemorySessions.get(id)
  if (cached) return cached
  const session = accountStore.getSession(id)
  if (session) inMemorySessions.set(id, session)
  return session
}

export const getSessionBySource = (source: LX.Account.Source): LX.Account.LoginSession | null => {
  const account = accountStore.listAccounts().find(item => item.source === source)
  return account ? getSession(account.id) : null
}

export const listBindings = (): LX.Account.PlaylistBinding[] => {
  return accountStore.listBindings()
}

export const saveBinding = (binding: LX.Account.PlaylistBinding) => {
  accountStore.saveBinding(binding)
}

export const removeBinding = (listId: string) => {
  accountStore.removeBinding(listId)
}
