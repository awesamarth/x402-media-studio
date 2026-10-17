export type SubtitleOptions={format?:'srt'|'vtt';overlap?:'error'|'trim'|'preserve';sort?:boolean;maxChars?:number;maxLines?:number};
export type Cue={start:number;end:number;text:string};
function time(s:string){const m=/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(s);if(!m)throw Error(`Invalid timestamp: ${s}`);return ((Number(m[1]||0)*60+Number(m[2]))*60+Number(m[3]))*1000+Number(m[4])}
export function stamp(t:number,vtt:boolean){const h=Math.floor(t/3600000),m=Math.floor(t/60000)%60,s=Math.floor(t/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${vtt?'.':','}${String(t%1000).padStart(3,'0')}`}
export function repairSubtitles(text:string,options:SubtitleOptions={}){
 const {format='srt',overlap='error',sort=false,maxChars=42,maxLines=2}=options;
 if(!['srt','vtt'].includes(format)||!['error','trim','preserve'].includes(overlap)||typeof sort!=='boolean'||!Number.isInteger(maxChars)||maxChars<10||maxChars>100||!Number.isInteger(maxLines)||maxLines<1||maxLines>5)throw Error('Invalid subtitle options');
 const warnings:string[]=[];const cues:Cue[]=[];const normalized=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
 for(const [index,block] of normalized.split(/\n\s*\n/).entries()){
 const lines=block.split('\n');if(/^WEBVTT(?:\s|$)/.test(lines[0]!)){if(lines.length>1)warnings.push('WEBVTT header metadata omitted');continue}
 if(/^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0]!)){warnings.push(`Block ${index+1}: metadata omitted`);continue}
 const n=lines.findIndex(l=>l.includes('-->'));if(n<0||n>1)throw Error(`Block ${index+1}: expected cue identifier and timing line`);
 const match=/^(\S+)\s+-->\s+(\S+)(.*)$/.exec(lines[n]!);if(!match)throw Error(`Block ${index+1}: malformed timing line`);
 const start=time(match[1]!),end=time(match[2]!);if(end<=start)throw Error(`Block ${index+1}: end must follow start`);if(match[3]!.trim())warnings.push(`Cue ${cues.length+1}: position settings omitted`);
 const body=lines.slice(n+1).join(' ').replace(/\s+/g,' ').trim();if(!body)throw Error(`Block ${index+1}: cue text is empty`);cues.push({start,end,text:body});
 }
 if(!cues.length)throw Error('No subtitle cues found');if(cues.length>5000)throw Error('At most 5000 cues');
 if(sort){cues.sort((a,b)=>a.start-b.start);warnings.push('Cues sorted by start time')}
 for(let i=1;i<cues.length;i++){const prev=cues[i-1]!,cue=cues[i]!;if(cue.start<prev.start)throw Error(`Cue ${i+1}: out of order; enable sort to reorder`);if(cue.start<prev.end){if(overlap==='error')throw Error(`Cue ${i+1}: overlaps previous cue; choose trim or preserve`);if(overlap==='trim'){if(cue.start<=prev.start)throw Error(`Cue ${i+1}: cannot trim equal start times`);prev.end=cue.start;warnings.push(`Cue ${i}: end trimmed to next start`)}else warnings.push(`Cue ${i+1}: overlap preserved`)}}
 const bodies=cues.map((cue,i)=>{const lines:string[]=[];let current='';for(const word of cue.text.split(' ')){if(word.length>maxChars)warnings.push(`Cue ${i+1}: word exceeds ${maxChars} characters`);if(current&&current.length+1+word.length>maxChars){lines.push(current);current=word}else current=current?current+' '+word:word}if(current)lines.push(current);if(lines.length>maxLines)warnings.push(`Cue ${i+1}: ${lines.length} lines exceeds ${maxLines}; split cue or shorten text`);return `${format==='srt'?`${i+1}\n`:''}${stamp(cue.start,format==='vtt')} --> ${stamp(cue.end,format==='vtt')}\n${lines.join('\n')}`});
 return {text:(format==='vtt'?'WEBVTT\n\n':'')+bodies.join('\n\n')+'\n',warnings,cueCount:cues.length,format,cues};
}
