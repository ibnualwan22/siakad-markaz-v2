// Pages API runs the existing print components with React DOM's server renderer.
// The phone receives inert print markup only; no website scripts or admin editor.
import type { NextApiRequest, NextApiResponse } from 'next';
import { renderToStaticMarkup } from 'react-dom/server';
import prisma from '@/lib/prisma';
import { decryptSantriSession } from '@/lib/santri-token';
import { getSantriTranskrip } from '@/lib/santri-transkrip';
import { getSantriOverview } from '@/lib/santri-overview';
import { getCertificateData } from '@/lib/app-data';
import { getLayoutForRiwayat, getMusyarokahLayoutForRiwayat } from '@/lib/syahadah-layout';
import { TranskripDocument } from '@/components/admin/transkrip-document';
import { SyahadahDocument } from '@/components/syahadah-document';
import { SyahadahTuratsDocument } from '@/components/syahadah-turats-document';
import { defaultFieldPositions, formatJuzTeks, formatPeriodeArab } from '@/lib/nadi-hufadz';
export default async function handler(req:NextApiRequest,res:NextApiResponse) {
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).end();
 const s=await decryptSantriSession(req.cookies['santri-session']||'');
 if(!s)return res.status(401).json({error:'Silakan masuk.'});
 const {jenis,id}=req.query;
 if(typeof id!=='string')return res.status(400).end();
 const missing=()=>res.status(404).json({error:'Dokumen belum tersedia.'});
 let content, width=210,height=297;
 if(jenis==='transkrip'){
  const d=await getSantriTranskrip(id,s.santriId);if(!d)return missing();
  content=<TranskripDocument {...d} staticPrint/>;
 }else if(jenis==='syahadah'){
  const me=await (await getSantriOverview(s.santriId)).json();
  if(!me.riwayat?.some((r:{id:string,canDownloadSyahadah:boolean})=>r.id===id&&r.canDownloadSyahadah))return missing();
  const d=await getCertificateData(id);if(!d||d.status==='TIDAK_LULUS'||!d.program)return missing();
  const layout=await (d.status==='MUSYAROKAH'?getMusyarokahLayoutForRiwayat:getLayoutForRiwayat)(id,d.program.id);
  const Doc=d.program.kategori==='TURATS'?SyahadahTuratsDocument:SyahadahDocument;
  content=<Doc data={d as Parameters<typeof Doc>[0]['data']} layout={layout} qrUrl={'https://siakad.markazarabiyah.site/ijazah/'+encodeURIComponent(id)}/>; width=330;height=215;
 }else if(jenis==='nadi'){
  const p=await prisma.nadiHufadzPeserta.findFirst({where:{id,santriId:s.santriId},include:{santri:{select:{nama:true}},setoran:{orderBy:{pertemuanKe:'asc'},take:1},tasmi:true}});
  if(!p?.tasmi)return missing();
  const t=await prisma.templateCetak.findUnique({where:{programKey:'nadi-hufadz'}});
  const f=(t?.fieldPositions??defaultFieldPositions()) as ReturnType<typeof defaultFieldPositions>;
  const text:Record<string,string>={nama:p.santri.nama||'-',juz:formatJuzTeks(p.tasmi.juzTeks),predikat:p.tasmi.predikat,periode:formatPeriodeArab((p.setoran[0]?.tanggal??p.tasmi.tanggal).toISOString().slice(0,10),p.tasmi.tanggal.toISOString().slice(0,10))};
  width=320;height=180;
  content=<div dir="rtl" style={{width:'320mm',height:'180mm',position:'relative'}}>{t?.backgroundUrl&&<img alt="" src={t.backgroundUrl} style={{width:'100%',height:'100%'}}/>}{Object.entries(f).map(([k,c])=><strong key={k} style={{position:'absolute',left:c.x+'%',top:c.y+'%',width:(c.maxWidth||80)+'%',textAlign:'center',transform:'translate(-50%, -50%)',fontSize:(c.fontSize*.2)+'mm'}}>{text[k]}</strong>)}</div>;
 }else return missing();
 const html='<!doctype html><meta charset="utf-8"><style>@page{margin:0}body{margin:0;color:black;background:white}*{box-sizing:border-box}.print-hidden{display:none}table{width:100%;border-collapse:collapse}th,td{border:1px solid;padding:2px}.text-center{text-align:center}p{margin:0}</style>'+renderToStaticMarkup(content);
 return res.json({html,width,height});
}
