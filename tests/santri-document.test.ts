import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NextApiRequest, NextApiResponse } from 'next';
import { encryptSantriSession } from '../src/lib/santri-token';

// Isolated in this test process; never connect to a project database.
Object.assign(globalThis, {prismaGlobal:{riwayatSantri:{findUnique:async()=>({
  santriId:'DOK-1',santri:{nama:'Santri Dokumen'},program:{nama_indo:'Program Uji',
    programMapels:[{mapel:{id:'b',nama_indo:'Bahasa Uji',jumlah_tes:1,bobot:1}}]},
  nilaiList:[{mapelId:'b',nilaiAkhir:82}]})}}});
process.env.JWT_SECRET='test-only-mobile-document-session-secret-2026';
async function request(user:string){
  const { default: handle } = await import('../src/pages/api/mobile/dokumen/[jenis]/[id]');
  const cookie=await encryptSantriSession({santriId:user,nama:'Uji',isAktif:true});
  let code=200, data:Record<string,unknown>={},cache='';
  const res={setHeader(k:string,v:string){if(k==='Cache-Control')cache=v;},status(c:number){code=c;return this;},json(d:Record<string,unknown>){data=d;}};
  await handle({method:'GET',cookies:{'santri-session':cookie},query:{jenis:'transkrip',id:'riwayat-uji'}} as unknown as NextApiRequest,res as unknown as NextApiResponse);
  return {code,data,cache};
}
test('transkrip milik akun dirender dari template; akses akun lain ditolak',async()=>{
  const valid=await request('DOK-1');
  assert.equal(valid.code,200);assert.equal(valid.cache,'private, no-store');
  assert.match(String(valid.data.html),/Bahasa Uji/);assert.match(String(valid.data.html),/SANTRI DOKUMEN/);
  const foreign=await request('DOK-2');
  assert.equal(foreign.code,404);assert.equal(foreign.data.html,undefined);
});
