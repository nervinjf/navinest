// routes/report.retry.routes.js
const router = require("express").Router();
const IngestionJob = require("../models/IngestionJob.models");
const IngestionAttempt = require("../models/IngestionAttempt.models"); // opcional
const {
  downloadBlobToBuffer,
  blobExists,
  findBlobByBasename,
} = require("../middlewares/azureBlob");
const { procesarPDFsDeCorreoConJob } = require("../services/attachment-processor.services");

function isHttpUrl(x){ return typeof x === "string" && /^https?:\/\//i.test(x); }
function safeBaseName(x,f){ if(typeof x!=="string"||!x) return f; try{const a=x.split("/").pop()||x; return a.split("?")[0]||f;}catch{return f;} }
function withTimeout(p,ms,l="timeout"){ let t; const tm=new Promise((_,r)=>{t=setTimeout(()=>r(new Error(l)),ms)}); return Promise.race([p.finally(()=>clearTimeout(t)),tm]); }

function sanitizeMsgId(x){ if(!x||typeof x!=="string") return null; return x.replace(/[<>]/g,"").replace(/\s+/g,"").replace(/[^a-zA-Z0-9._-]/g,"_"); }
function msgIdVariants(job){ const raw=job.sourceId||job.messageId||job.emailMessageId||job.msgId||""; const s=sanitizeMsgId(raw); const a=s? s.split("_at_")[0]:null; const b=s? s.split("@")[0]:null; return Array.from(new Set([s,a,b].filter(Boolean))); }
function yyyyMM(job){ const d=job?.createdAt||job?.startedAt||new Date(); const dt=new Date(d); const y=dt.getUTCFullYear(); const m=String(dt.getUTCMonth()+1).padStart(2,"0"); const dd=String(dt.getUTCDate()).padStart(2,"0"); return {y,m,dd}; }

function parseQualified(filePath){
  if(typeof filePath!=="string"||!filePath.includes("/")) return null;
  const [rawContainer,...rest]=filePath.split("/");
  if(!rawContainer||rest.length===0) return null;
  const container=rawContainer.replace(/^emails_procesados$/,"emails-procesados").trim();
  const blobName=rest.join("/").replace(/^\/+/,"");
  return {container, blobName};
}

function buildCandidates(job, baseName){
  const hint = job.container || process.env.BLOB_CONTAINER || "emails-procesados";
  const {y,m,dd}=yyyyMM(job);
  const basePrefixes=(process.env.AZ_IN_PREFIXES||"?,pdf/,attach/,processed/,archived/").split(",").map(s=>s.trim()).map(p=>p==="?"?"":p);
  const mids = msgIdVariants(job).map(v=>`${v}/`);
  const midsPdf = msgIdVariants(job).map(v=>`pdf/${v}/`);
  const midsAtt = msgIdVariants(job).map(v=>`attach/${v}/`);
  const datePrefixes=[`${y}/`,`${y}/${m}/`,`${y}/${m}/${dd}/`];

  const allPrefixes=Array.from(new Set([...basePrefixes,...datePrefixes,...mids,...midsPdf,...midsAtt]));
  const containers=(process.env.AZ_IN_CONTAINERS||`${hint},emails,input,output,emails-raw,emails-procesados`).split(",").map(s=>s.trim());

  const out=[];
  for(const c of containers){ for(const p of allPrefixes){ out.push({container:c, blobName:`${p}${baseName}`}); } }
  const seen=new Set();
  return out.filter(({container,blobName})=>{ const k=`${container}:::${blobName}`; if(seen.has(k)) return false; seen.add(k); return true; });
}

router.post("/jobs/:id/retry", async (req,res) => {
  const jobId = req.params.id;
  const startedAt = new Date();
  let job=null, attempt=null;

  try{
    job = await IngestionJob.findByPk(jobId);
    if(!job) return res.status(404).json({message:"Job no encontrado"});
    if(!job.filePath) return res.status(400).json({message:"Job sin filePath"});

    if (IngestionAttempt){
      attempt = await IngestionAttempt.create({ job_id: job.id, started_at: startedAt, status: "processing", note: "Retry manual" });
    }

    console.log(`[retry] job=${job.id} → processing`);
    await job.update({ status:"processing", startedAt, errorDetails:null });

    // ↓↓↓ Descarga buffer (igual que ya lo tenías) ↓↓↓
    let buffer;
    const rawPath = job.filePath;
    if (isHttpUrl(rawPath)) {
      buffer = await withTimeout(downloadBlobToBuffer({ blobUrl: rawPath }), 65_000, "timeout (URL)");
    } else {
      const q = parseQualified(rawPath);
      if (q) {
        const exists = await blobExists(q.container, q.blobName);
        if (!exists) throw new Error(`No existe: ${q.container}/${q.blobName}`);
        buffer = await withTimeout(downloadBlobToBuffer({ container:q.container, blobName:q.blobName }), 65_000, "timeout (SDK-Q)");
      } else {
        const base = safeBaseName(rawPath, `job-${job.id}.pdf`);
        const cands = buildCandidates(job, base);
        let found=null;
        for(const c of cands){ const ok = await blobExists(c.container, c.blobName); if(ok){ found=c; break; } }
        if (!found){
          const match = await findBlobByBasename(base, { maxPerContainer: 10000 });
          if(!match) throw new Error(`Blob no encontrado para basename=${base}`);
          found=match;
        }
        buffer = await withTimeout(downloadBlobToBuffer({ container:found.container, blobName:found.blobName }), 65_000, "timeout (SDK)");
      }
    }

    const nombre = job.pdfName || safeBaseName(job.filePath, `job-${job.id}.pdf`);

    // 👇 PASO CLAVE: reusar el job existente como “global”
    await withTimeout(
      procesarPDFsDeCorreoConJob({
        archivos: [{ buffer, nombre }],
        origen: job.source || "email",
        sourceId: job.sourceId,        // usa el mismo sourceId del job
        azureModelId: job.azureModelId || process.env.MODEL_ID,
        remitente: null,
        jobsSeed: [job.id],            // jobs por PDF a reusar
        globalJobId: job.id,           // <<<<<< usa ESTE job como global (NO crear otro)
        reuseGlobalJob: true,          // bandera explícita
      }),
      5*60_000,
      "timeout procesando PDF"
    );

    await job.update({ status:"processed", finishedAt: new Date(), errorDetails:null });
    if (attempt) await attempt.update({ status:"success", finished_at:new Date(), note:"OK" });
    res.json({ ok:true, jobId: job.id });

  }catch(err){
    console.error(`[retry] ERROR job=${jobId}:`, err?.message);
    try{
      if(job) await job.update({ status:"error", finishedAt:new Date(), errorDetails: err?.stack || err?.message || String(err) });
      if(attempt) await attempt.update({ status:"failed", finished_at:new Date(), note: err?.message?.slice(0,1000) || "Error" });
    }catch{}
    res.status(500).json({ ok:false, error: err?.message || "Error" });
  }
});

module.exports = router;
