import fs from 'fs/promises'
import path from 'path'
import { Client as MinioClient } from 'minio'

/**
 * Storage-Abstraktion: "local" (Dateisystem, MVP-Default) oder "minio"
 * (selbst gehostetes, S3-kompatibles MinIO).
 */

let minio: MinioClient | null = null
let bucketReady = false

function getMinio(): MinioClient {
  if (!minio) {
    minio = new MinioClient({
      endPoint: process.env.S3_ENDPOINT ?? 'localhost',
      port: Number(process.env.S3_PORT ?? 9000),
      useSSL: process.env.S3_USE_SSL === 'true',
      accessKey: process.env.S3_ACCESS_KEY ?? '',
      secretKey: process.env.S3_SECRET_KEY ?? '',
    })
  }
  return minio
}

function bucket(): string {
  return process.env.S3_BUCKET ?? 'reviewpilot'
}

async function ensureBucket() {
  if (bucketReady) return
  const client = getMinio()
  const exists = await client.bucketExists(bucket())
  if (!exists) await client.makeBucket(bucket())
  bucketReady = true
}

function localDir(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR ?? './storage')
}

function useMinio(): boolean {
  return process.env.STORAGE_DRIVER === 'minio'
}

export async function saveFile(key: string, data: Buffer, contentType: string): Promise<void> {
  if (useMinio()) {
    await ensureBucket()
    await getMinio().putObject(bucket(), key, data, data.length, {
      'Content-Type': contentType,
    })
    return
  }
  const filePath = path.join(localDir(), key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, data)
}

export async function readFile(key: string): Promise<Buffer | null> {
  try {
    if (useMinio()) {
      const stream = await getMinio().getObject(bucket(), key)
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      return Buffer.concat(chunks)
    }
    return await fs.readFile(path.join(localDir(), key))
  } catch {
    return null
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    if (useMinio()) {
      await getMinio().removeObject(bucket(), key)
      return
    }
    await fs.unlink(path.join(localDir(), key))
  } catch {
    // Datei existiert nicht – ignorieren
  }
}
