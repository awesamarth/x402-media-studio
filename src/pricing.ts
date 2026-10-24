/** Approved fixed price per billable step; no duration pricing. */
export const PAID_WORKFLOW_AMOUNT_ATOMIC='10000';
export const PAID_PRICING_MODEL='per-billable-operation-v1';
// Legacy quote verification only. New quotes/imports do not support YouTube.
// Keep saved zero-total asset quotes readable without repricing historical purchases.
export function youtubeVideoId(value:string):string|undefined{try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return;const host=u.hostname.toLowerCase();const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(host)?(u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]):undefined;return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:undefined}catch{return}}
export function workflowPricing(mode:'free'|'paid',steps:{type:string}[]){const billableSteps=steps.map(s=>s.type);return {amountAtomic:mode==='free'?'0':(BigInt(PAID_WORKFLOW_AMOUNT_ATOMIC)*BigInt(billableSteps.length)).toString(),pricingModel:mode==='free'?'free-demo':PAID_PRICING_MODEL,billableSteps,freeSteps:[]}}
export function workflowAmountAtomic(mode:'free'|'paid'){return mode==='free'?'0':PAID_WORKFLOW_AMOUNT_ATOMIC}
