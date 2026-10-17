/** Approved pre-final payment test price: one charge for the entire workflow.
 * Duration-based final pricing has no approved rates and is deliberately not implemented here.
 */
export const PAID_WORKFLOW_AMOUNT_ATOMIC='10000'; // USDC has six decimals: 0.01 USDC.
export const PAID_PRICING_MODEL='pre-final-flat-workflow';
export function workflowAmountAtomic(mode:'free'|'paid'){return mode==='free'?'0':PAID_WORKFLOW_AMOUNT_ATOMIC}
