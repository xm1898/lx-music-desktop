import { constants, createCipheriv, createHash, publicEncrypt, randomBytes } from 'node:crypto'

// 这些是网易云接口公开的固定协议参数，不是应用密钥，改动会导致接口不兼容
const PROTOCOL_IV = Buffer.from('0102030405060708')
const WEAPI_PRESET_KEY = Buffer.from('0CoJUm6Qyw8W8jud')
const LINUXAPI_KEY = Buffer.from('rFgB&h#%2?^eDg:Q')
const EAPI_KEY = 'e82ckenh8dichen8'
const WEAPI_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----'
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// 以下仅用于还原平台的历史报文格式，不可用于密码存储等通用加密场景
const aesEncrypt = (buffer: Buffer, mode: string, key: Buffer | string, initializationVector: Buffer | string) => {
  const cipher = createCipheriv(mode, key, initializationVector)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

const rsaEncrypt = (buffer: Buffer) => {
  const padded = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer])
  return publicEncrypt({ key: WEAPI_PUBLIC_KEY, padding: constants.RSA_NO_PADDING }, padded)
}

export const weapi = (value: Record<string, unknown>): Record<string, string> => {
  const text = JSON.stringify(value)
  const secretKey = Buffer.from(randomBytes(16).map(byte => BASE62.charAt(byte % 62).charCodeAt(0)))
  const firstPass = aesEncrypt(Buffer.from(text), 'aes-128-cbc', WEAPI_PRESET_KEY, PROTOCOL_IV).toString('base64')
  return {
    params: aesEncrypt(Buffer.from(firstPass), 'aes-128-cbc', secretKey, PROTOCOL_IV).toString('base64'),
    encSecKey: rsaEncrypt(secretKey.reverse()).toString('hex'),
  }
}

export const linuxapi = (value: Record<string, unknown>): Record<string, string> => ({
  eparams: aesEncrypt(Buffer.from(JSON.stringify(value)), 'aes-128-ecb', LINUXAPI_KEY, '').toString('hex').toUpperCase(),
})

export const eapi = (url: string, value: Record<string, unknown> | string): Record<string, string> => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const digest = createHash('md5').update(`nobody${url}use${text}md5forencrypt`).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: aesEncrypt(Buffer.from(data), 'aes-128-ecb', EAPI_KEY, '').toString('hex').toUpperCase(),
  }
}
