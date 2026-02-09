import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  type _Object,
} from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import ora from 'ora'
import { r2ProdConfig, r2DevConfig, r2TestConfig } from '../config.js'
import { logger } from '../utils/logger.js'

export type SyncTarget = 'dev' | 'test'

interface SyncOptions {
  dryRun?: boolean
  target?: SyncTarget
}

interface SyncStats {
  copied: number
  skipped: number
  errors: number
  totalBytes: number
}

export async function syncR2(options: SyncOptions = {}): Promise<void> {
  const { dryRun = false, target = 'dev' } = options
  const targetConfig = target === 'test' ? r2TestConfig : r2DevConfig
  const targetName = target === 'test' ? 'test (staging)' : 'dev'

  logger.section(`R2 Storage Sync: prod -> ${targetName}`)

  const prodClient = new S3Client({
    region: 'auto',
    endpoint: r2ProdConfig.endpoint,
    credentials: {
      accessKeyId: r2ProdConfig.accessKeyId,
      secretAccessKey: r2ProdConfig.secretAccessKey,
    },
  })

  const targetClient = new S3Client({
    region: 'auto',
    endpoint: targetConfig.endpoint,
    credentials: {
      accessKeyId: targetConfig.accessKeyId,
      secretAccessKey: targetConfig.secretAccessKey,
    },
  })

  const spinner = ora('Listing production objects...').start()

  try {
    // List all objects in production bucket
    const prodObjects = await listAllObjects(prodClient, r2ProdConfig.bucket)
    spinner.succeed(`Found ${prodObjects.length} objects in production`)

    if (dryRun) {
      logger.info(`[DRY RUN] Would copy ${prodObjects.length} objects to ${targetName} bucket`)
      for (const obj of prodObjects.slice(0, 10)) {
        logger.info(`[DRY RUN]   ${obj.Key} (${formatBytes(obj.Size || 0)})`)
      }
      if (prodObjects.length > 10) {
        logger.info(`[DRY RUN]   ... and ${prodObjects.length - 10} more`)
      }
      return
    }

    // Get existing objects in target bucket for comparison
    spinner.start(`Listing ${targetName} objects...`)
    const targetObjects = await listAllObjects(targetClient, targetConfig.bucket)
    const targetObjectMap = new Map(targetObjects.map((obj) => [obj.Key, obj]))
    spinner.succeed(`Found ${targetObjects.length} objects in ${targetName}`)

    // Sync objects
    const stats: SyncStats = { copied: 0, skipped: 0, errors: 0, totalBytes: 0 }

    for (let i = 0; i < prodObjects.length; i++) {
      const obj = prodObjects[i]
      if (!obj.Key) continue

      spinner.start(`[${i + 1}/${prodObjects.length}] ${obj.Key}`)

      // Check if object exists in target with same size and ETag
      const targetObj = targetObjectMap.get(obj.Key)
      if (targetObj && targetObj.Size === obj.Size && targetObj.ETag === obj.ETag) {
        stats.skipped++
        continue
      }

      try {
        await copyObject(prodClient, targetClient, obj.Key, r2ProdConfig.bucket, targetConfig.bucket)
        stats.copied++
        stats.totalBytes += obj.Size || 0
      } catch (err) {
        stats.errors++
        logger.error(`Failed to copy ${obj.Key}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    spinner.succeed(`R2 sync to ${targetName} complete`)
    logger.info(`Copied: ${stats.copied}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`)
    logger.info(`Total transferred: ${formatBytes(stats.totalBytes)}`)
  } catch (err) {
    spinner.fail('R2 sync failed')
    throw err
  }
}

async function listAllObjects(client: S3Client, bucket: string): Promise<_Object[]> {
  const objects: _Object[] = []
  let continuationToken: string | undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    })

    const response = await client.send(command)
    if (response.Contents) {
      objects.push(...response.Contents)
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return objects
}

async function copyObject(
  sourceClient: S3Client,
  destClient: S3Client,
  key: string,
  sourceBucket: string,
  destBucket: string
): Promise<void> {
  // Get object from source
  const getCommand = new GetObjectCommand({
    Bucket: sourceBucket,
    Key: key,
  })

  const response = await sourceClient.send(getCommand)
  if (!response.Body) {
    throw new Error('Empty response body')
  }

  // Read into buffer
  const body = response.Body as Readable
  const chunks: Buffer[] = []

  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk))
  }

  const buffer = Buffer.concat(chunks)

  // Put object to destination
  const putCommand = new PutObjectCommand({
    Bucket: destBucket,
    Key: key,
    Body: buffer,
    ContentType: response.ContentType,
  })

  await destClient.send(putCommand)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export async function checkR2Connection(): Promise<{ prod: boolean; dev: boolean; test: boolean }> {
  const result = { prod: false, dev: false, test: false }

  try {
    const prodClient = new S3Client({
      region: 'auto',
      endpoint: r2ProdConfig.endpoint,
      credentials: {
        accessKeyId: r2ProdConfig.accessKeyId,
        secretAccessKey: r2ProdConfig.secretAccessKey,
      },
    })

    await prodClient.send(
      new ListObjectsV2Command({
        Bucket: r2ProdConfig.bucket,
        MaxKeys: 1,
      })
    )
    result.prod = true
  } catch {
    // Connection failed
  }

  try {
    const devClient = new S3Client({
      region: 'auto',
      endpoint: r2DevConfig.endpoint,
      credentials: {
        accessKeyId: r2DevConfig.accessKeyId,
        secretAccessKey: r2DevConfig.secretAccessKey,
      },
    })

    await devClient.send(
      new ListObjectsV2Command({
        Bucket: r2DevConfig.bucket,
        MaxKeys: 1,
      })
    )
    result.dev = true
  } catch {
    // Connection failed
  }

  try {
    const testClient = new S3Client({
      region: 'auto',
      endpoint: r2TestConfig.endpoint,
      credentials: {
        accessKeyId: r2TestConfig.accessKeyId,
        secretAccessKey: r2TestConfig.secretAccessKey,
      },
    })

    await testClient.send(
      new ListObjectsV2Command({
        Bucket: r2TestConfig.bucket,
        MaxKeys: 1,
      })
    )
    result.test = true
  } catch {
    // Connection failed
  }

  return result
}
