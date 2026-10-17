import {test,expect} from 'bun:test';
import {connect} from 'node:net';
import {isPublicIPv4,validateRemoteUrl,startImportProxy} from '../src/import-proxy';
test('import proxy rejects special-use IPv4 and accepts global addresses',()=>{
  for(const ip of ['0.0.0.0','10.1.1.1','127.0.0.1','169.254.169.254','100.64.1.2','100.127.255.255','172.16.0.1','172.31.255.255','192.168.1.2','192.0.0.1','192.0.2.1','192.88.99.1','198.18.0.1','198.19.255.255','198.51.100.2','203.0.113.1','224.0.0.1','239.1.1.1','240.0.0.1','255.255.255.255','::1','bad']) expect(isPublicIPv4(ip)).toBe(false);
  for(const ip of ['1.1.1.1','8.8.8.8','100.128.0.1','172.32.0.1']) expect(isPublicIPv4(ip)).toBe(true);
});
test('submitted URLs restrict HTTPS hosts and reject playlists, live paths and literals',()=>{
  for(const url of ['http://media.w3.org/a.mp4','https://u:p@media.w3.org/a','https://media.w3.org:8443/a','https://127.0.0.1/a','https://[::1]/a','https://example.com/a','https://media.w3.org.evil.test/a','https://www.youtube.com/playlist?list=abc','https://youtu.be/abcdefghijk?list=abc','https://www.youtube.com/live/abcdefghijk','https://www.youtube.com/@channel','https://www.youtube.com/watch?v=x']) expect(()=>validateRemoteUrl(url)).toThrow();
  for(const url of ['https://raw.githubusercontent.com/owner/repo/main/a.wav','https://media.w3.org/a.mp4','https://www.youtube.com/watch?v=abcdefghijk','https://youtu.be/abcdefghijk']) expect(validateRemoteUrl(url).protocol).toBe('https:');
});
test('proxy denies disallowed CONNECT and plaintext requests without resolving upstream',async()=>{
  const proxy=await startImportProxy();
  try {
    for(const request of ['CONNECT localhost:443 HTTP/1.1\r\nHost: localhost\r\n\r\n','CONNECT media.w3.org:80 HTTP/1.1\r\nHost: media.w3.org\r\n\r\n','CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: localhost\r\n\r\n','GET http://media.w3.org/a HTTP/1.1\r\nHost: media.w3.org\r\nConnection: close\r\n\r\n']) {
      const response=await new Promise<string>((resolve,reject)=>{let result='';const socket=connect(proxy.port,'127.0.0.1',()=>socket.write(request));socket.on('data',chunk=>result+=chunk);socket.on('end',()=>resolve(result));socket.on('error',reject);socket.setTimeout(2000,()=>{socket.destroy();reject(Error('Proxy response timed out'));});});
      expect(response).toContain('403');
    }
  } finally {await proxy.close();}
});
