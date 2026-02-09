import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { homedir } from 'os'

// Load .env from services directory
const envPath = resolve(import.meta.dirname, '..', '.env')
if (existsSync(envPath)) {
  config({ path: envPath })
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

// Use getters to defer validation until values are actually accessed
export const sshConfig = {
  get host() {
    return required('SSH_HOST')
  },
  get port() {
    return parseInt(optional('SSH_PORT', '22'), 10)
  },
  get username() {
    return optional('SSH_USER', 'root')
  },
  get privateKeyPath() {
    return optional('SSH_KEY_PATH', resolve(homedir(), '.ssh', 'id_rsa'))
  },
}

export const prodDbConfig = {
  get host() {
    return required('PROD_DB_HOST')
  },
  get port() {
    return parseInt(optional('PROD_DB_PORT', '5432'), 10)
  },
  get user() {
    return required('PROD_DB_USER')
  },
  get password() {
    return required('PROD_DB_PASS')
  },
  get database() {
    return required('PROD_DB_NAME')
  },
}

export const localDbConfig = {
  get host() {
    return optional('LOCAL_DB_HOST', '127.0.0.1')
  },
  get port() {
    return parseInt(optional('LOCAL_DB_PORT', '5432'), 10)
  },
  get user() {
    return optional('LOCAL_DB_USER', 'postgres')
  },
  get password() {
    return optional('LOCAL_DB_PASS', 'postgres')
  },
  get database() {
    return optional('LOCAL_DB_NAME', 'myproject')
  },
}

export const testDbConfig = {
  get host() {
    return required('TEST_DB_HOST')
  },
  get port() {
    return parseInt(optional('TEST_DB_PORT', '5432'), 10)
  },
  get user() {
    return required('TEST_DB_USER')
  },
  get password() {
    return required('TEST_DB_PASS')
  },
  get database() {
    return required('TEST_DB_NAME')
  },
}

export const r2ProdConfig = {
  get accountId() {
    return required('R2_PROD_ACCOUNT_ID')
  },
  get accessKeyId() {
    return required('R2_PROD_ACCESS_KEY_ID')
  },
  get secretAccessKey() {
    return required('R2_PROD_SECRET_ACCESS_KEY')
  },
  get bucket() {
    return required('R2_PROD_BUCKET')
  },
  get endpoint() {
    return `https://${this.accountId}.r2.cloudflarestorage.com`
  },
}

export const r2DevConfig = {
  get accountId() {
    return required('R2_DEV_ACCOUNT_ID')
  },
  get accessKeyId() {
    return required('R2_DEV_ACCESS_KEY_ID')
  },
  get secretAccessKey() {
    return required('R2_DEV_SECRET_ACCESS_KEY')
  },
  get bucket() {
    return required('R2_DEV_BUCKET')
  },
  get endpoint() {
    return `https://${this.accountId}.r2.cloudflarestorage.com`
  },
}

export const r2TestConfig = {
  get accountId() {
    return required('R2_TEST_ACCOUNT_ID')
  },
  get accessKeyId() {
    return required('R2_TEST_ACCESS_KEY_ID')
  },
  get secretAccessKey() {
    return required('R2_TEST_SECRET_ACCESS_KEY')
  },
  get bucket() {
    return required('R2_TEST_BUCKET')
  },
  get endpoint() {
    return `https://${this.accountId}.r2.cloudflarestorage.com`
  },
}
