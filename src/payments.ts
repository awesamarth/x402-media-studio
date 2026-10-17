import {HTTPFacilitatorClient} from '@x402/core/server';
import {VerifyError,SettleError} from '@x402/core/types';
import {createHash} from 'node:crypto';
import type {Studio} from './core';
export type PaymentConfig={recipient:string;facilitator:string;origin:string;network:'eip155:8453'};
export const USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export function billingMode():'free'|'paid'{const mode=process.env.BILLING_MODE||'free';if(mode!=='free'&&mode!=='paid')throw Error('BILLING_MODE must be free or paid');return mode}
export function paymentConfig():PaymentConfig|undefined {
 if(billingMode()!=='paid')return;
 const recipient=process.env.PAYMENT_RECIPIENT||'',facilitator=process.env.PAYMENT_FACILITATOR||'',origin=process.env.PUBLIC_API_ORIGIN||'';
 if(!/^0x[\da-fA-F]{40}$/.test(recipient)||/^0x0{40}$/.test(recipient))throw Error('Set a valid public PAYMENT_RECIPIENT');
 for(const value of [facilitator,origin]){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.port)throw Error('Payment URLs must be exact HTTPS origins on port 443')}
 if(process.env.PAYMENT_NETWORK!=='eip155:8453')throw Error('Set PAYMENT_NETWORK=eip155:8453; only Base USDC is implemented');
 return {recipient,facilitator,origin,network:'eip155:8453'};
}
export const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64');
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
function canonical(v:any):string{return v&&typeof v==='object'?Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v)}
/** Public settlement fields only; never expose payloads, authorization or signatures. */
export function settlementReceipt(state:any){const r=state?.settlement;if(state?.status!=='settled'||r?.success!==true||!/^0x[\da-fA-F]{64}$/.test(r.transaction)||r.network!=='eip155:8453')return;return {success:true,transaction:r.transaction,network:r.network,...(/^0x[\da-fA-F]{40}$/.test(r.payer)?{payer:r.payer}:{})}}
export class Payments {
 onFreeAdmission?: (owner:string,quoteId:string)=>Promise<unknown>;
 tail:Promise<unknown>=Promise.resolve();
 private client?:HTTPFacilitatorClient;
 constructor(public studio:Studio,public config?:PaymentConfig,public transport?:typeof fetch){if(config&&!transport)this.client=new HTTPFacilitatorClient({url:config.facilitator,timeoutMs:8000})}
 async facilitator(action:string,payload:any){if(this.client){try{if(action==='verify')return await this.client.verify(payload.paymentPayload,payload.paymentRequirements);if(action==='settle')return await this.client.settle(payload.paymentPayload,payload.paymentRequirements);throw Error('Unsupported facilitator action')}catch(e){if(e instanceof VerifyError)return {isValid:false,invalidReason:e.invalidReason,payer:e.payer};if(e instanceof SettleError)return {success:false,errorReason:e.errorReason,transaction:e.transaction,network:e.network,payer:e.payer};throw e}}const r=await (this.transport||fetch)(`${this.config!.facilitator}/${action}`,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Facilitator response unavailable');const text=await r.text();if(text.length>65536)throw Error('Facilitator response too large');return JSON.parse(text)}
 purchase(body:any,signature:string|null){const next=this.tail.then(()=>this.run(body,signature));this.tail=next.catch(()=>{});return next}
 freePurchase(owner:string,body:any){const next=this.tail.then(async()=>{if(!body||typeof body.quoteId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(body.idempotencyKey)||Object.keys(body).some(k=>!['quoteId','idempotencyKey'].includes(k)))return Response.json({error:'Use quoteId and idempotencyKey only'},{status:400});const q=await this.studio.read('quotes',body.quoteId);if(q.owner!==owner)return Response.json({error:'Not found'},{status:404});if(q.mode!=='free'&&!(q.mode==='paid'&&q.amountAtomic==='0'&&q.paymentRequired===false&&q.verifiedSource?.verifiedBy==='server-extractor'&&q.verifiedSource?.platform==='youtube'&&q.workflow.steps.every((s:any)=>s.type==='clip')))return Response.json({error:'Quote mode changed; request a new free quote'},{status:409});let prior;try{prior=await this.studio.read('payments',q.id)}catch(e:any){if(e.code!=='ENOENT')throw e}if(prior&&prior.key!==body.idempotencyKey)return Response.json({error:'Quote already used with another idempotency key'},{status:409});const jobKey='free-'+q.id;if(!prior)await this.onFreeAdmission?.(owner,q.id);await this.studio.enqueue(q.id,jobKey);await this.studio.save('payments',q.id,{id:q.id,owner,key:body.idempotencyKey,jobKey,status:'free'});return Response.json({purchaseId:q.id,mode:'free',paymentStatus:'not_required'},{status:202})});this.tail=next.catch(()=>{});return next}
 async fulfill(state:any){try{const job=await this.studio.enqueue(state.id,state.jobKey,true);state.fulfillmentStatus=job.expiresAt&&Date.parse(job.expiresAt)<=Date.now()?'expired':job.status;delete state.fulfillmentError;await this.studio.save('payments',state.id,state);return {paymentStatus:'settled',fulfillmentStatus:state.fulfillmentStatus,jobId:job.id}}catch(error){const message=String(error);state.fulfillmentStatus=/Queue is full|storage quota|Job count limit/.test(message)?'awaiting_capacity':'enqueue_failed';state.fulfillmentError=state.fulfillmentStatus==='awaiting_capacity'?'Release queue/storage capacity and poll the owned purchase again':'Enqueue failed; operator must inspect backend. Do not pay again';await this.studio.save('payments',state.id,state);return {paymentStatus:'settled',fulfillmentStatus:state.fulfillmentStatus,message:state.fulfillmentError}}}
 resume(owner:string,quoteId:string){const next=this.tail.then(async()=>{const q=await this.studio.read('quotes',quoteId);if(q.owner!==owner)return {notFound:true};const state=await this.studio.read('payments',quoteId);if(state.owner!==owner)return {notFound:true};if(state.status!=='settled')return {paymentStatus:state.status};return this.fulfill(state)});this.tail=next.catch(()=>{});return next}
 async run(body:any,signature:string|null):Promise<Response>{
 const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers});
 if(!this.config)return json({error:'Payment is unconfigured; no payment accepted'},503);
 if(!body||typeof body.quoteId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(body.idempotencyKey)||Object.keys(body).some(k=>!['quoteId','idempotencyKey'].includes(k)))return json({error:'Use quoteId and a stable idempotencyKey only'},400);
 let q;try{q=await this.studio.read('quotes',body.quoteId)}catch{return json({error:'Quote not found'},404)}
 // Quote ownership is retained server-side. The public paid request does not disclose its workflow or bearer token.
 if(q.amountAtomic==='0')return json({error:'This workflow requires no payment; use authenticated POST /workflows'},409);
 if(q.mode!=='paid')return json({error:'Quote is not a paid quote; request a new quote for current mode'},409);
 if(!q.owner)return json({error:'Quote requires authenticated ownership'},409);
 let prior:any;try{prior=await this.studio.read('payments',q.id)}catch(e:any){if(e.code!=='ENOENT')throw e}
 if(prior){if(prior.key!==body.idempotencyKey)return json({error:'Quote already bound to a purchase; inspect authenticated quote status'},409);
 if(prior.status==='settled'){const fulfillment=await this.fulfill(prior);return json({purchaseId:q.id,paymentStatus:'settled',settlementReceipt:settlementReceipt(prior),fulfillmentStatus:fulfillment.fulfillmentStatus,...(fulfillment.jobId?{jobId:fulfillment.jobId}:{})},200,{'PAYMENT-RESPONSE':encoded(prior.settlement)})}
 return json({paymentStatus:'reconciliation_required',quoteId:q.id,message:'Do not purchase again. Settlement may have been broadcast; operator must reconcile.'},202)}
 if(Date.parse(q.expiresAt)<=Date.now())return json({error:'Quote expired'},410);
 const requirements={scheme:'exact',network:this.config.network,amount:q.amountAtomic,asset:USDC,payTo:this.config.recipient,maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}};
 const resource={url:new URL('/purchases/'+q.id,this.config.origin).toString(),description:'Enqueue quoted media workflow',mimeType:'application/json'};
 const challenge={x402Version:2,resource,accepts:[requirements]};
 if(!signature)return json(challenge,402,{'PAYMENT-REQUIRED':encoded(challenge)});
 let payment:any;try{if(signature.length>32768||!/^[A-Za-z0-9+/]+={0,2}$/.test(signature))throw Error();payment=JSON.parse(Buffer.from(signature,'base64').toString());if(payment.x402Version!==2||canonical(payment.accepted)!==canonical(requirements)||!payment.payload)throw Error()}catch{return json({error:'Invalid x402 payload or mismatched requirements'},400)}
 const auth=payment.payload.authorization;
 if(!auth||!/^0x[\da-fA-F]{64}$/.test(auth.nonce)||!/^0x[\da-fA-F]{40}$/.test(auth.from)||auth.to?.toLowerCase()!==this.config.recipient.toLowerCase()||auth.value!==q.amountAtomic)return json({error:'Invalid exact EVM authorization'},400);
 const replayId=digest(`${this.config.network}:${USDC.toLowerCase()}:${auth.from.toLowerCase()}:${auth.nonce.toLowerCase()}`);
 try{await this.studio.read('receipts',replayId);return json({error:'Authorization already reserved for a purchase; do not pay again'},409)}catch(e:any){if(e.code!=='ENOENT')throw e}
 try{await this.studio.assertAdmission()}catch{return json({paymentStatus:'not_attempted',fulfillmentStatus:'awaiting_capacity',message:'No settlement attempted; retry after capacity returns'},503)}
 const request={x402Version:2,paymentPayload:payment,paymentRequirements:requirements};let verified;
 try{verified=await this.facilitator('verify',request)}catch{return json({error:'Verification unavailable; no settlement attempted'},503)}
 if(verified.isValid!==true||verified.payer?.toLowerCase()!==auth.from.toLowerCase())return json({error:'Payment verification rejected'},402,{'PAYMENT-REQUIRED':encoded(challenge)});
 // Persist reservation BEFORE settlement. Any unknown outcome remains pending, never automatically re-settled.
 const state={id:q.id,owner:q.owner,key:body.idempotencyKey,jobKey:'paid-'+q.id,status:'pending',payer:verified.payer,replayId,settlement:undefined as any};
 await this.studio.save('receipts',replayId,{quoteId:q.id});await this.studio.save('payments',q.id,state);
 let settled;try{settled=await this.facilitator('settle',request)}catch{return json({paymentStatus:'reconciliation_required',quoteId:q.id},202)}
 state.settlement=settled;
 if(settled.success!==true||!/^0x[\da-fA-F]{64}$/.test(settled.transaction)||settled.network!==this.config.network||settled.payer?.toLowerCase()!==auth.from.toLowerCase()){
 await this.studio.save('payments',q.id,state);return json({paymentStatus:'reconciliation_required',quoteId:q.id,message:'No job enqueued. Inspect facilitator outcome before any new payment.'},202)}
 state.status='settled';await this.studio.save('payments',q.id,state);const fulfillment=await this.fulfill(state);
 return json({purchaseId:q.id,paymentStatus:'settled',settlementReceipt:settlementReceipt(state),fulfillmentStatus:fulfillment.fulfillmentStatus,...(fulfillment.jobId?{jobId:fulfillment.jobId}:{})},202,{'PAYMENT-RESPONSE':encoded(settled)});
 }
}
