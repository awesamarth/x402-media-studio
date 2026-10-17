import {test,expect} from 'bun:test';
import {linuxImportCommand} from '../src/import-runner';
test('Linux runner has no network or credentials and only mounts work plus proxy socket',()=>{
 const cmd=linuxImportCommand('/tmp/work','/tmp/proxy',['--version']);const a=cmd.args;
 expect(a[a.indexOf('--network')+1]).toBe('none');expect(a).toContain('--read-only');expect(a[a.indexOf('--cap-drop')+1]).toBe('ALL');expect(a[a.indexOf('--pull')+1]).toBe('never');expect(a.filter(x=>x.startsWith('type=bind'))).toEqual(['type=bind,source=/tmp/work,target=/work','type=bind,source=/tmp/proxy,target=/proxy,readonly']);expect(a.join(' ')).not.toContain('docker.sock');expect(a).not.toContain('--privileged');expect(a.at(-1)).toBe('--version');
});
