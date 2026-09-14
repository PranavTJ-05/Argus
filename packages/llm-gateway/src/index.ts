import Anthropic from "@anthropic-ai/sdk"
import type { z } from "zod"

export type LlmUsage = {
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
}

export type StrictJsonResult<T> = {
  modelId: string
  output: T
  rawText: string
  repaired: boolean
  usage: LlmUsage
  validationError: string | null
}

export type StrictJsonRequest<T> = {
  maxTokens?: number
  modelId: string
  prompt: string
  promptVersion: string
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
  system: string
  temperature?: number
}

export type LlmGateway = {
  generateStrictJson: <T>(request: StrictJsonRequest<T>) => Promise<StrictJsonResult<T>>
}

export class StrictJsonGenerationError extends Error {
  constructor(
    message: string,
    readonly validationError: string,
  ) {
    super(message)
  }
}

export function createAnthropicGateway(input: { apiKey: string }): LlmGateway {
  const client = new Anthropic({ apiKey: input.apiKey })

  return {
    async generateStrictJson<T>(request: StrictJsonRequest<T>): Promise<StrictJsonResult<T>> {
      const first = await callAnthropic(client, request)
      const firstParsed = parseAndValidate(request.schema, first.rawText)

      if (firstParsed.success) {
        return {
          modelId: request.modelId,
          output: firstParsed.output,
          rawText: first.rawText,
          repaired: false,
          usage: first.usage,
          validationError: null,
        }
      }

      const repair = await callAnthropic(client, {
        ...request,
        prompt: [
          request.prompt,
          "",
          "Your previous response failed validation.",
          `Validation error: ${firstParsed.error}`,
          "Return corrected JSON only. Do not add markdown or prose.",
          "Previous response:",
          first.rawText,
        ].join("\n"),
      })
      const repairedParsed = parseAndValidate(request.schema, repair.rawText)

      if (!repairedParsed.success) {
        throw new StrictJsonGenerationError(
          "LLM response failed strict JSON validation after repair retry",
          repairedParsed.error,
        )
      }

      return {
        modelId: request.modelId,
        output: repairedParsed.output,
        rawText: repair.rawText,
        repaired: true,
        usage: combineUsage(first.usage, repair.usage),
        validationError: firstParsed.error,
      }
    },
  }
}

type AnthropicCallResult = {
  rawText: string
  usage: LlmUsage
}

async function callAnthropic<T>(
  client: Anthropic,
  request: StrictJsonRequest<T>,
): Promise<AnthropicCallResult> {
  const startedAt = Date.now()
  const message = await client.messages.create({
    max_tokens: request.maxTokens ?? 1200,
    messages: [
      {
        role: "user",
        content: request.prompt,
      },
    ],
    model: request.modelId,
    system: [
      request.system,
      "Return strict JSON only. Do not wrap it in markdown. Do not include prose outside JSON.",
    ].join("\n"),
    temperature: request.temperature ?? 0,
  })
  const durationMs = Date.now() - startedAt
  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim()

  return {
    rawText,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      costUsd: estimateCostUsd(
        request.modelId,
        message.usage.input_tokens,
        message.usage.output_tokens,
      ),
      durationMs,
    },
  }
}

function parseAndValidate<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  rawText: string,
): { success: true; output: T } | { success: false; error: string } {
  try {
    const parsedJson = JSON.parse(extractJson(rawText))
    const result = schema.safeParse(parsedJson)

    if (!result.success) {
      return {
        success: false,
        error: result.error.message,
      }
    }

    return {
      success: true,
      output: result.data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "invalid JSON",
    }
  }
}

function extractJson(rawText: string): string {
  const trimmed = rawText.trim()
  const firstObject = trimmed.indexOf("{")
  const lastObject = trimmed.lastIndexOf("}")
  const firstArray = trimmed.indexOf("[")
  const lastArray = trimmed.lastIndexOf("]")

  if (firstObject !== -1 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1)
  }

  if (firstArray !== -1 && lastArray > firstArray) {
    return trimmed.slice(firstArray, lastArray + 1)
  }

  return trimmed
}

function combineUsage(left: LlmUsage, right: LlmUsage): LlmUsage {
  return {
    costUsd: round(left.costUsd + right.costUsd, 6),
    durationMs: left.durationMs + right.durationMs,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  }
}

function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const pricing = pricingForModel(modelId)

  return round(
    (inputTokens / 1_000_000) * pricing.inputUsdPerMillion +
      (outputTokens / 1_000_000) * pricing.outputUsdPerMillion,
    6,
  )
}

function pricingForModel(modelId: string): {
  inputUsdPerMillion: number
  outputUsdPerMillion: number
} {
  if (modelId.includes("haiku")) {
    return {
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 5,
    }
  }

  if (modelId.includes("sonnet")) {
    return {
      inputUsdPerMillion: 5,
      outputUsdPerMillion: 25,
    }
  }

  return {
    inputUsdPerMillion: 15,
    outputUsdPerMillion: 75,
  }
}

function round(value: number, digits = 6): number {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}
