import { readFile } from "node:fs/promises"

import { fullDataset } from "./datasets/full.js"
import { smokeDataset } from "./datasets/smoke.js"
import { evalDatasetSchema, evaluateDataset, formatEvaluationSummary } from "./index.js"

const datasetPath = process.argv[2]
const defaultDataset = process.env.ARGUS_EVAL_DATASET === "smoke" ? smokeDataset : fullDataset
const dataset = datasetPath ? await readDataset(datasetPath) : defaultDataset
const summary = evaluateDataset(dataset)

console.log(formatEvaluationSummary(summary))

async function readDataset(path: string) {
  const raw = await readFile(path, "utf8")
  return evalDatasetSchema.parse(JSON.parse(raw))
}
