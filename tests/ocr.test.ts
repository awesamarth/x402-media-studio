import {test,expect} from 'bun:test';
import {ocrWords} from '../src/pipeline';
import {readFile} from 'node:fs/promises';
test('OCR summary excludes zero confidence, retains every positive score and leaves raw TSV untouched',()=>{
 const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
 const row=(confidence:number,text:string)=>`5\t1\t1\t1\t1\t1\t10\t20\t30\t40\t${confidence}\t${text}`;
 const raw=[header,row(-1,'nonword'),row(0,'junk'),row(0.01,'faint'),row(92.7,'Samarth'),row(96.7,'Saxena')].join('\n');
 const words=ocrWords(raw);expect(words.map(w=>w.text)).toEqual(['faint','Samarth','Saxena']);expect(words[0].confidence).toBe(0.01);expect(raw).toContain('\t0\tjunk');
});
