import type { createArgusInngestClient } from "../inngest.js"

import {
  type InvestigationRequestedWorkflowDeps,
  createInvestigationRequestedWorkflow,
} from "./investigation-requested.js"

type ArgusInngestClient = ReturnType<typeof createArgusInngestClient>

export type ArgusFunctionsDeps = InvestigationRequestedWorkflowDeps

export function createArgusFunctions(inngest: ArgusInngestClient, deps: ArgusFunctionsDeps) {
  return [createInvestigationRequestedWorkflow(inngest, deps)]
}
