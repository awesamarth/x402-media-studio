import {repairSubtitles} from './subtitles';
export type CaptionSource={kind:'manual'|'automatic';language:string;trackLanguage:string;pageUrl:string;extractor:string};
export function selectCaptions(metadata:any,requested='en') {
 const language=requested==='auto'&&typeof metadata.language==='string'?metadata.language:'en';
 if(!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*$/.test(language))throw Error('Unsupported caption language');
 for(const [field,kind] of [['subtitles','manual'],['automatic_captions','automatic']] as const){
  const tracks=metadata[field]||{};const keys=Object.keys(tracks).filter(k=>k.toLowerCase()===language.toLowerCase()||k.toLowerCase().startsWith(language.toLowerCase()+'-')).sort((a,b)=>(a===language?-1:b===language?1:a.localeCompare(b)));
  for(const key of keys){if(!/^[A-Za-z0-9_-]{2,30}$/.test(key))continue;const formats=tracks[key];if(!Array.isArray(formats))throw Error('Invalid subtitle metadata');const format=['vtt','srt'].find(ext=>formats.some((f:any)=>f.ext===ext));if(format)return {kind,language,trackLanguage:key,format};}
  if(keys.length)throw Error('Matching captions exist but no supported SRT/VTT format is offered');
 }
 return undefined;
}
export function captionDocument(text:string,provenance:CaptionSource){
 if(Buffer.byteLength(text)>2*1024*1024)throw Error('Caption file exceeds 2 MiB');
 // Strip WebVTT inline timestamps/formatting while retaining provider cue boundaries.
 const clean=text.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
 const parsed=repairSubtitles(clean,{overlap:'preserve'});const duration=Math.max(...parsed.cues.map(c=>c.end))/1000;
 if(duration>1800)throw Error('Source captions exceed 30 minutes');
 return {kind:'captions' as const,text:parsed.text,provenance,duration};
}
