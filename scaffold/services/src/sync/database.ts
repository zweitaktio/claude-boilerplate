import { Client as SshClient } from 'ssh2'
import { readFileSync, createWriteStream, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import pg from 'pg'
import ora from 'ora'
import { sshConfig, prodDbConfig, localDbConfig, testDbConfig } from '../config.js'
import { logger } from '../utils/logger.js'

const { Client: PgClient } = pg

export type SyncTarget = 'local' | 'test'

interface SyncOptions {
  dryRun?: boolean
  target?: SyncTarget
}

export async function syncDatabase(options: SyncOptions = {}): Promise<void> {
  const { dryRun = false, target = 'local' } = options
  const targetConfig = target === 'test' ? testDbConfig : localDbConfig
  const targetName = target === 'test' ? 'test (staging)' : 'local'

  logger.section(`Database Sync: prod -> ${targetName}`)

  if (dryRun) {
    logger.info('[DRY RUN] Would SSH to server and run pg_dump')
    logger.info('[DRY RUN] Would download SQL dump')
    logger.info(`[DRY RUN] Would drop and recreate ${targetName} database`)
    logger.info(`[DRY RUN] Would restore dump to ${targetName} database`)
    return
  }

  const dumpFile = join(tmpdir(), `myproject-dump-${Date.now()}.sql`)

  try {
    // Step 1: Dump production database via SSH
    await dumpProductionDatabase(dumpFile)

    // Step 2: Recreate target database
    if (target === 'test') {
      await recreateRemoteDatabase(targetConfig)
    } else {
      await recreateLocalDatabase()
    }

    // Step 3: Restore dump to target database
    if (target === 'test') {
      await restoreToRemoteDatabase(dumpFile, targetConfig)
    } else {
      await restoreToLocalDatabase(dumpFile)
    }

    logger.success(`Database sync to ${targetName} complete`)
  } finally {
    // Cleanup dump file
    try {
      unlinkSync(dumpFile)
      logger.info('Cleaned up dump file')
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function dumpProductionDatabase(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const spinner = ora('Connecting to production server...').start()
    const sshClient = new SshClient()

    sshClient.on('error', (err) => {
      spinner.fail('SSH connection failed')
      reject(new Error(`SSH error: ${err.message}`))
    })

    sshClient.on('ready', () => {
      spinner.text = 'Running pg_dump on production...'

      // Run pg_dump inside the Docker container
      // The database container name is the same as PROD_DB_HOST
      const pgDumpCmd = [
        'docker exec',
        prodDbConfig.host,
        'pg_dump',
        `-U ${prodDbConfig.user}`,
        `-d ${prodDbConfig.database}`,
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
      ].join(' ')

      const writeStream = createWriteStream(outputPath)
      let dataSize = 0

      sshClient.exec(pgDumpCmd, (err, stream) => {
        if (err) {
          spinner.fail('Failed to execute pg_dump')
          sshClient.end()
          reject(err)
          return
        }

        stream.on('data', (chunk: Buffer) => {
          dataSize += chunk.length
          spinner.text = `Downloading dump... ${(dataSize / 1024 / 1024).toFixed(1)} MB`
          writeStream.write(chunk)
        })

        let stderrOutput = ''
        stream.stderr.on('data', (data: Buffer) => {
          const msg = data.toString()
          stderrOutput += msg
          // pg_dump outputs notices to stderr, ignore them
          if (!msg.includes('NOTICE:')) {
            logger.warn(`pg_dump stderr: ${msg}`)
          }
        })

        stream.on('close', (code: number) => {
          writeStream.end()
          sshClient.end()

          if (code === 0 && dataSize > 0) {
            spinner.succeed(`Dump complete (${(dataSize / 1024 / 1024).toFixed(1)} MB)`)
            resolve()
          } else if (dataSize === 0) {
            spinner.fail(`pg_dump produced no output`)
            if (stderrOutput) {
              logger.error(`stderr: ${stderrOutput}`)
            }
            reject(new Error(`pg_dump produced no output. Check container name and credentials.`))
          } else {
            spinner.fail(`pg_dump exited with code ${code}`)
            if (stderrOutput) {
              logger.error(`stderr: ${stderrOutput}`)
            }
            reject(new Error(`pg_dump failed with exit code ${code}`))
          }
        })
      })
    })

    // Read private key and connect
    let privateKey: Buffer
    try {
      privateKey = readFileSync(sshConfig.privateKeyPath)
    } catch {
      spinner.fail('Cannot read SSH key')
      reject(new Error(`Cannot read SSH private key from ${sshConfig.privateKeyPath}`))
      return
    }

    sshClient.connect({
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      privateKey,
    })
  })
}

async function recreateLocalDatabase(): Promise<void> {
  const spinner = ora('Recreating local database...').start()

  const adminClient = new PgClient({
    host: localDbConfig.host,
    port: localDbConfig.port,
    user: localDbConfig.user,
    password: localDbConfig.password,
    database: 'postgres',
  })

  try {
    await adminClient.connect()

    // Terminate existing connections
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
      AND pid <> pg_backend_pid()
    `, [localDbConfig.database])

    // Drop and recreate using template0 to avoid collation issues
    await adminClient.query(`DROP DATABASE IF EXISTS "${localDbConfig.database}"`)
    await adminClient.query(`CREATE DATABASE "${localDbConfig.database}" TEMPLATE template0`)

    spinner.succeed('Local database recreated')
  } catch (err) {
    spinner.fail('Failed to recreate database')
    throw err
  } finally {
    await adminClient.end()
  }
}

// Change 'myproject-postgres' to match your docker-compose container_name
const LOCAL_POSTGRES_CONTAINER = 'myproject-postgres'

async function restoreToLocalDatabase(dumpFile: string): Promise<void> {
  const spinner = ora('Restoring dump to local database...').start()

  const { execSync } = await import('child_process')

  try {
    // Copy dump file to docker container and restore using psql
    execSync(`docker cp "${dumpFile}" ${LOCAL_POSTGRES_CONTAINER}:/tmp/dump.sql`, { stdio: 'pipe' })

    const psqlCmd = [
      `docker exec ${LOCAL_POSTGRES_CONTAINER}`,
      'psql',
      `-U ${localDbConfig.user}`,
      `-d ${localDbConfig.database}`,
      '-f /tmp/dump.sql',
      '--quiet',
    ].join(' ')

    execSync(psqlCmd, { stdio: 'pipe' })

    // Clean up the dump file in the container
    execSync(`docker exec ${LOCAL_POSTGRES_CONTAINER} rm /tmp/dump.sql`, { stdio: 'pipe' })

    spinner.succeed('Database restored')
  } catch (err) {
    spinner.fail('Failed to restore database')
    throw err
  }
}

interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

async function recreateRemoteDatabase(config: DbConfig): Promise<void> {
  const spinner = ora('Recreating test database via SSH...').start()

  return new Promise((resolve, reject) => {
    const sshClient = new SshClient()

    sshClient.on('error', (err) => {
      spinner.fail('SSH connection failed')
      reject(new Error(`SSH error: ${err.message}`))
    })

    sshClient.on('ready', () => {
      const terminateCmd = `docker exec ${config.host} psql -U ${config.user} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${config.database}' AND pid <> pg_backend_pid()"`
      const dropCmd = `docker exec ${config.host} psql -U ${config.user} -d postgres -c "DROP DATABASE IF EXISTS \\"${config.database}\\""`
      const createCmd = `docker exec ${config.host} psql -U ${config.user} -d postgres -c "CREATE DATABASE \\"${config.database}\\" TEMPLATE template0"`

      const fullCmd = `${terminateCmd} && ${dropCmd} && ${createCmd}`

      sshClient.exec(fullCmd, (err, stream) => {
        if (err) {
          spinner.fail('Failed to recreate database')
          sshClient.end()
          reject(err)
          return
        }

        let stderrOutput = ''
        stream.stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString()
        })

        stream.on('close', (code: number) => {
          sshClient.end()
          if (code === 0) {
            spinner.succeed('Test database recreated')
            resolve()
          } else {
            spinner.fail(`Failed to recreate database (exit code ${code})`)
            if (stderrOutput) logger.error(stderrOutput)
            reject(new Error(`Database recreation failed with code ${code}`))
          }
        })
      })
    })

    let privateKey: Buffer
    try {
      privateKey = readFileSync(sshConfig.privateKeyPath)
    } catch {
      spinner.fail('Cannot read SSH key')
      reject(new Error(`Cannot read SSH private key from ${sshConfig.privateKeyPath}`))
      return
    }

    sshClient.connect({
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      privateKey,
    })
  })
}

async function restoreToRemoteDatabase(dumpFile: string, config: DbConfig): Promise<void> {
  const spinner = ora('Restoring dump to test database via SSH...').start()

  return new Promise((resolve, reject) => {
    const sshClient = new SshClient()

    sshClient.on('error', (err) => {
      spinner.fail('SSH connection failed')
      reject(new Error(`SSH error: ${err.message}`))
    })

    sshClient.on('ready', () => {
      spinner.text = 'Uploading dump file to server...'

      sshClient.sftp((err, sftp) => {
        if (err) {
          spinner.fail('SFTP connection failed')
          sshClient.end()
          reject(err)
          return
        }

        const remoteDumpPath = '/tmp/myproject-dump-restore.sql'

        sftp.fastPut(dumpFile, remoteDumpPath, (err) => {
          if (err) {
            spinner.fail('Failed to upload dump file')
            sshClient.end()
            reject(err)
            return
          }

          spinner.text = 'Restoring database...'

          const restoreCmd = [
            `docker cp ${remoteDumpPath} ${config.host}:/tmp/dump.sql`,
            '&&',
            `docker exec ${config.host} psql -U ${config.user} -d ${config.database} -f /tmp/dump.sql --quiet`,
            '&&',
            `docker exec ${config.host} rm /tmp/dump.sql`,
            '&&',
            `rm ${remoteDumpPath}`,
          ].join(' ')

          sshClient.exec(restoreCmd, (err, stream) => {
            if (err) {
              spinner.fail('Failed to restore database')
              sshClient.end()
              reject(err)
              return
            }

            let stderrOutput = ''
            stream.stderr.on('data', (data: Buffer) => {
              const msg = data.toString()
              if (!msg.includes('NOTICE:')) {
                stderrOutput += msg
              }
            })

            stream.on('close', (code: number) => {
              sshClient.end()
              if (code === 0) {
                spinner.succeed('Database restored to test')
                resolve()
              } else {
                spinner.fail(`Failed to restore database (exit code ${code})`)
                if (stderrOutput) logger.error(stderrOutput)
                reject(new Error(`Database restore failed with code ${code}`))
              }
            })
          })
        })
      })
    })

    let privateKey: Buffer
    try {
      privateKey = readFileSync(sshConfig.privateKeyPath)
    } catch {
      spinner.fail('Cannot read SSH key')
      reject(new Error(`Cannot read SSH private key from ${sshConfig.privateKeyPath}`))
      return
    }

    sshClient.connect({
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      privateKey,
    })
  })
}

export async function checkLocalDatabase(): Promise<boolean> {
  const client = new PgClient({
    host: localDbConfig.host,
    port: localDbConfig.port,
    user: localDbConfig.user,
    password: localDbConfig.password,
    database: 'postgres',
  })

  try {
    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    return true
  } catch {
    return false
  }
}

export async function checkTestDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    const sshClient = new SshClient()

    const timeout = setTimeout(() => {
      sshClient.end()
      resolve(false)
    }, 10000)

    sshClient.on('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })

    sshClient.on('ready', () => {
      const testCmd = [
        'docker exec',
        testDbConfig.host,
        'psql',
        `-U ${testDbConfig.user}`,
        `-d ${testDbConfig.database}`,
        '-c "SELECT 1"',
      ].join(' ')

      sshClient.exec(testCmd, (err, stream) => {
        if (err) {
          clearTimeout(timeout)
          sshClient.end()
          resolve(false)
          return
        }

        let success = false

        stream.on('data', () => {
          success = true
        })

        stream.on('close', () => {
          clearTimeout(timeout)
          sshClient.end()
          resolve(success)
        })
      })
    })

    let privateKey: Buffer
    try {
      privateKey = readFileSync(sshConfig.privateKeyPath)
    } catch {
      clearTimeout(timeout)
      resolve(false)
      return
    }

    sshClient.connect({
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      privateKey,
    })
  })
}

export async function checkProductionDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    const sshClient = new SshClient()

    const timeout = setTimeout(() => {
      sshClient.end()
      resolve(false)
    }, 10000)

    sshClient.on('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })

    sshClient.on('ready', () => {
      const testCmd = [
        'docker exec',
        prodDbConfig.host,
        'psql',
        `-U ${prodDbConfig.user}`,
        `-d ${prodDbConfig.database}`,
        '-c "SELECT 1"',
      ].join(' ')

      sshClient.exec(testCmd, (err, stream) => {
        if (err) {
          clearTimeout(timeout)
          sshClient.end()
          resolve(false)
          return
        }

        let success = false

        stream.on('data', () => {
          success = true
        })

        stream.on('close', () => {
          clearTimeout(timeout)
          sshClient.end()
          resolve(success)
        })
      })
    })

    let privateKey: Buffer
    try {
      privateKey = readFileSync(sshConfig.privateKeyPath)
    } catch {
      clearTimeout(timeout)
      resolve(false)
      return
    }

    sshClient.connect({
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      privateKey,
    })
  })
}
