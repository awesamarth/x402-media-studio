export async function command(args:string[],options:{input?:string;timeoutMs?:number; returnStderr?:boolean}={}) {
 const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe',stdin:options.input===undefined?'ignore':'pipe'}); if(options.input!==undefined&&p.stdin){p.stdin.write(options.input);p.stdin.end()}const timeout=setTimeout(()=>p.kill('SIGKILL'),options.timeoutMs||120000);
 const bounded=async(stream:ReadableStream<Uint8Array>)=>{const reader=stream.getReader();let size=0;const chunks:Uint8Array[]=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>2097152){p.kill('SIGKILL');throw Error('Subprocess output limit exceeded')}chunks.push(r.value)}return Buffer.concat(chunks).toString()};
 let out:string,err:string,code:number;try{[out,err,code]=await Promise.all([bounded(p.stdout),bounded(p.stderr),p.exited])}finally{clearTimeout(timeout)};
 if(code!==0) throw Error(`${args[0]} failed: ${err.slice(-1200)}`); return options.returnStderr?err:out;
}
