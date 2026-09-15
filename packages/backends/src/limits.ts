import { type JsonValue, jsonValueSchema } from "@argus/shared-types"

export type BackendLimits = {
  timeoutMs: number
  maxResultBytes: number
}

export const defaultBackendLimits: BackendLimits = {
  timeoutMs: 5000,
  maxResultBytes: 64 * 1024,
}

export function mergeBackendLimits(limits?: Partial<BackendLimits>): BackendLimits {
  return {
    timeoutMs: limits?.timeoutMs ?? defaultBackendLimits.timeoutMs,
    maxResultBytes: limits?.maxResultBytes ?? defaultBackendLimits.maxResultBytes,
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation, timeoutPromise])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

export function enforceResultLimit<T extends JsonValue>(
  value: T,
  maxResultBytes: number,
  label: string,
): T {
  const json = JSON.stringify(value)
  const byteLength = Buffer.byteLength(json, "utf8")

  if (byteLength > maxResultBytes) {
    throw new Error(`${label} result exceeded ${maxResultBytes} bytes`)
  }

  return jsonValueSchema.parse(value) as T
}
