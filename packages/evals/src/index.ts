import type { Citation, ReporterOutput } from "@argus/shared-types"
import { reporterOutputSchema, zeroToOneSchema } from "@argus/shared-types"
import { z } from "zod"

const expectedSourceTypeSchema = z.enum([
  "tool_call",
  "review_finding",
  "timeline_event",
  "dissent_entry",
])

export const evalCaseSchema = z
  .object({
    id: z.string().trim().min(1),
    incidentId: z.string().trim().min(1),
    description: z.string().trim().min(1),
    expectedRootCauseTerms: z.array(z.string().trim().min(1)).min(1),
    expectedEvidenceSourceTypes: z.array(expectedSourceTypeSchema).min(1),
    expectedCounselCatch: z.boolean(),
    expectedConfidence: zeroToOneSchema,
    actualReport: reporterOutputSchema,
    baselineReport: reporterOutputSchema.optional(),
    costUsd: z.number().nonnegative(),
    latencyMs: z.number().int().nonnegative(),
  })
  .strict()
export type EvalCase = z.infer<typeof evalCaseSchema>

export const evalDatasetSchema = z.array(evalCaseSchema).min(1)
export type EvalDataset = z.infer<typeof evalDatasetSchema>

export type EvaluationMetrics = {
  accuracy: number
  baselineAccuracy: number | null
  calibrationError: number
  counselCatchRate: number
  evidenceQuality: number
  totalCostUsd: number
  averageLatencyMs: number
}

export type EvaluationSummary = {
  caseCount: number
  metrics: EvaluationMetrics
  baselineDelta: {
    accuracy: number | null
    evidenceQuality: number | null
    calibrationError: number | null
  }
}

export function evaluateDataset(dataset: EvalDataset): EvaluationSummary {
  const parsedDataset = evalDatasetSchema.parse(dataset)
  const metrics = computeMetrics(parsedDataset, "actualReport")
  const baselineMetrics = parsedDataset.some((testCase) => testCase.baselineReport)
    ? computeMetrics(parsedDataset, "baselineReport")
    : null

  return {
    caseCount: parsedDataset.length,
    metrics: {
      ...metrics,
      baselineAccuracy: baselineMetrics?.accuracy ?? null,
    },
    baselineDelta: {
      accuracy: baselineMetrics ? round(metrics.accuracy - baselineMetrics.accuracy) : null,
      calibrationError: baselineMetrics
        ? round(baselineMetrics.calibrationError - metrics.calibrationError)
        : null,
      evidenceQuality: baselineMetrics
        ? round(metrics.evidenceQuality - baselineMetrics.evidenceQuality)
        : null,
    },
  }
}

export function formatEvaluationSummary(summary: EvaluationSummary): string {
  const lines = [
    `cases=${summary.caseCount}`,
    `accuracy=${summary.metrics.accuracy.toFixed(3)}`,
    `evidence_quality=${summary.metrics.evidenceQuality.toFixed(3)}`,
    `counsel_catch_rate=${summary.metrics.counselCatchRate.toFixed(3)}`,
    `calibration_error=${summary.metrics.calibrationError.toFixed(3)}`,
    `total_cost_usd=${summary.metrics.totalCostUsd.toFixed(4)}`,
    `average_latency_ms=${summary.metrics.averageLatencyMs.toFixed(0)}`,
  ]

  if (summary.metrics.baselineAccuracy !== null) {
    lines.push(`baseline_accuracy=${summary.metrics.baselineAccuracy.toFixed(3)}`)
    lines.push(`accuracy_delta=${summary.baselineDelta.accuracy?.toFixed(3)}`)
    lines.push(`evidence_quality_delta=${summary.baselineDelta.evidenceQuality?.toFixed(3)}`)
    lines.push(
      `calibration_error_improvement=${summary.baselineDelta.calibrationError?.toFixed(3)}`,
    )
  }

  return lines.join("\n")
}

function computeMetrics(
  dataset: EvalDataset,
  reportKey: "actualReport" | "baselineReport",
): Omit<EvaluationMetrics, "baselineAccuracy"> {
  const scoredCases = dataset.map((testCase) => {
    const report = reportKey === "actualReport" ? testCase.actualReport : testCase.baselineReport
    return report ? scoreCase(testCase, report) : null
  })
  const presentScores = scoredCases.filter((score): score is CaseScore => score !== null)

  return {
    accuracy: mean(presentScores.map((score) => score.accuracy)),
    averageLatencyMs: mean(dataset.map((testCase) => testCase.latencyMs)),
    calibrationError: mean(presentScores.map((score) => score.calibrationError)),
    counselCatchRate: mean(presentScores.map((score) => score.counselCatch)),
    evidenceQuality: mean(presentScores.map((score) => score.evidenceQuality)),
    totalCostUsd: round(
      dataset.reduce((total, testCase) => total + testCase.costUsd, 0),
      4,
    ),
  }
}

type CaseScore = {
  accuracy: number
  calibrationError: number
  counselCatch: number
  evidenceQuality: number
}

function scoreCase(testCase: EvalCase, report: ReporterOutput): CaseScore {
  const verdictText = normalize(
    [
      report.verdict,
      report.recommended_fix.immediate,
      report.recommended_fix.long_term,
      report.timeline.map((event) => event.text).join(" "),
    ].join(" "),
  )
  const rootCauseMatches = testCase.expectedRootCauseTerms.filter((term) =>
    verdictText.includes(normalize(term)),
  ).length
  const accuracy = rootCauseMatches / testCase.expectedRootCauseTerms.length

  return {
    accuracy: round(accuracy),
    calibrationError: round(Math.abs(report.confidence - testCase.expectedConfidence)),
    counselCatch: scoreCounselCatch(testCase, report),
    evidenceQuality: scoreEvidenceQuality(testCase, report.evidence_chain),
  }
}

function scoreEvidenceQuality(testCase: EvalCase, citations: Citation[]): number {
  if (citations.length === 0) {
    return 0
  }

  const expectedTypes = new Set(testCase.expectedEvidenceSourceTypes)
  const presentTypes = new Set(citations.map((citation) => citation.sourceType))
  const sourceCoverage =
    [...expectedTypes].filter((sourceType) => presentTypes.has(sourceType)).length /
    expectedTypes.size
  const directCitationShare =
    citations.filter(
      (citation) => citation.relevance === "direct" || citation.relevance === "supporting",
    ).length / citations.length

  return round(sourceCoverage * 0.7 + directCitationShare * 0.3)
}

function scoreCounselCatch(testCase: EvalCase, report: ReporterOutput): number {
  if (!testCase.expectedCounselCatch) {
    return 1
  }

  const dissentCitationExists = report.evidence_chain.some(
    (citation) => citation.sourceType === "dissent_entry",
  )
  const dissentText = normalize(report.dissent_considered)
  return dissentCitationExists || dissentText.includes("dissent") || dissentText.includes("counsel")
    ? 1
    : 0
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return round(values.reduce((total, value) => total + value, 0) / values.length)
}

function normalize(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9_ -]/g, " ")
}

function round(value: number, digits = 3): number {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}
