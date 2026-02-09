#!/usr/bin/env node

import { program } from 'commander'
import { syncDatabase, checkLocalDatabase, checkProductionDatabase, checkTestDatabase, type SyncTarget as DbSyncTarget } from './sync/database.js'
import { syncR2, checkR2Connection, type SyncTarget as R2SyncTarget } from './sync/r2.js'
import { confirm } from './utils/confirm.js'
import { logger } from './utils/logger.js'

program
  .name('myproject-tools')
  .description('Development and operations tools')
  .version('1.0.0')

program
  .command('sync')
  .description('Sync production data to local or test environment')
  .option('--db-only', 'Only sync database')
  .option('--r2-only', 'Only sync R2 storage')
  .option('--target <target>', 'Sync target: local (default) or test (staging)', 'local')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    const target = options.target as 'local' | 'test'
    const targetName = target === 'test' ? 'test (staging)' : 'local'

    logger.header(`Production Sync -> ${targetName}`)

    const syncDb = !options.r2Only
    const syncStorage = !options.dbOnly
    const { dryRun = false, yes = false } = options

    if (dryRun) {
      logger.warn('DRY RUN MODE - No changes will be made')
    }

    // Pre-flight checks
    logger.section('Pre-flight Checks')

    if (syncDb) {
      if (target === 'local') {
        const localDbOk = await checkLocalDatabase()
        if (localDbOk) {
          logger.success('Local PostgreSQL connection OK')
        } else {
          logger.error('Cannot connect to local PostgreSQL')
          logger.info('Make sure PostgreSQL is running: cd services && yarn start')
          process.exit(1)
        }
      } else {
        const testDbOk = await checkTestDatabase()
        if (testDbOk) {
          logger.success('Test PostgreSQL connection OK')
        } else {
          logger.error('Cannot connect to test PostgreSQL')
          logger.info('Check SSH connection and TEST_DB_* environment variables')
          process.exit(1)
        }
      }

      const prodDbOk = await checkProductionDatabase()
      if (prodDbOk) {
        logger.success('Production PostgreSQL connection OK')
      } else {
        logger.error('Cannot connect to production PostgreSQL')
        logger.info('Check SSH connection and database credentials')
        process.exit(1)
      }
    }

    if (syncStorage) {
      const r2Status = await checkR2Connection()
      if (r2Status.prod) {
        logger.success('Production R2 connection OK')
      } else {
        logger.error('Cannot connect to production R2')
        logger.info('Check R2_PROD_* environment variables')
        process.exit(1)
      }

      if (target === 'local') {
        if (r2Status.dev) {
          logger.success('Dev R2 connection OK')
        } else {
          logger.error('Cannot connect to dev R2')
          logger.info('Check R2_DEV_* environment variables')
          process.exit(1)
        }
      } else {
        if (r2Status.test) {
          logger.success('Test R2 connection OK')
        } else {
          logger.error('Cannot connect to test R2')
          logger.info('Check R2_TEST_* environment variables')
          process.exit(1)
        }
      }
    }

    // Confirmation
    if (!dryRun && !yes) {
      console.log('')
      logger.warn('This will:')
      if (syncDb) {
        logger.warn(`  - DROP and recreate ${targetName} database`)
        logger.warn(`  - Replace all ${targetName} data with production data`)
      }
      if (syncStorage) {
        logger.warn(`  - Copy all files from production R2 to ${targetName} R2`)
      }
      console.log('')

      const confirmed = await confirm('Are you sure you want to continue?')
      if (!confirmed) {
        logger.info('Sync cancelled')
        process.exit(0)
      }
    }

    // Execute sync
    try {
      if (syncDb) {
        const dbTarget: DbSyncTarget = target === 'test' ? 'test' : 'local'
        await syncDatabase({ dryRun, target: dbTarget })
      }

      if (syncStorage) {
        const r2Target: R2SyncTarget = target === 'test' ? 'test' : 'dev'
        await syncR2({ dryRun, target: r2Target })
      }

      logger.complete()
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('check')
  .description('Check connections to all services')
  .action(async () => {
    logger.header('Connection Check')

    logger.section('Database')
    const localDbOk = await checkLocalDatabase()
    if (localDbOk) {
      logger.success('Local PostgreSQL: OK')
    } else {
      logger.error('Local PostgreSQL: FAILED')
    }

    const testDbOk = await checkTestDatabase()
    if (testDbOk) {
      logger.success('Test PostgreSQL: OK')
    } else {
      logger.error('Test PostgreSQL: FAILED')
    }

    const prodDbOk = await checkProductionDatabase()
    if (prodDbOk) {
      logger.success('Production PostgreSQL: OK')
    } else {
      logger.error('Production PostgreSQL: FAILED')
    }

    logger.section('R2 Storage')
    const r2Status = await checkR2Connection()
    if (r2Status.prod) {
      logger.success('Production R2: OK')
    } else {
      logger.error('Production R2: FAILED')
    }
    if (r2Status.test) {
      logger.success('Test R2: OK')
    } else {
      logger.error('Test R2: FAILED')
    }
    if (r2Status.dev) {
      logger.success('Dev R2: OK')
    } else {
      logger.error('Dev R2: FAILED')
    }

    console.log('')
  })

program.parse()
