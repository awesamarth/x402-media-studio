/** Approved testing tariff; final duration rates are not configured. */
export const PAID_WORKFLOW_AMOUNT_ATOMIC='10000';
export const PAID_PRICING_MODEL='pre-final-flat-workflow';
export type VerifiedSource={platform:'youtube';videoId:string;verifiedBy:'server-extractor';assetId:string};
export function youtubeVideoId(value:string):string|undefined{try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return;const host=u.hostname.toLowerCase();const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(host)?(u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]):undefined;return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:undefined}catch{return}}
export function workflowPricing(mode:'free'|'paid',steps:{type:string}[],source?:VerifiedSource){const exempt=source?.platform==='youtube'&&source.verifiedBy==='server-extractor';const billableSteps=steps.filter(s=>!(exempt&&s.type==='clip')).map(s=>s.type);return {amountAtomic:mode==='free'||!billableSteps.length?'0':PAID_WORKFLOW_AMOUNT_ATOMIC,pricingModel:mode==='free'?'free-demo':PAID_PRICING_MODEL,billableSteps,freeSteps:exempt?steps.filter(s=>s.type==='clip').map(s=>s.type):[]}}
export function workflowAmountAtomic(mode:'free'|'paid'){return mode==='free'?'0':PAID_WORKFLOW_AMOUNT_ATOMIC}
