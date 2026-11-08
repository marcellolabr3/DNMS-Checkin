// Integration test against the configured DB. Always rolls back; does not save backups.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const {Client} = require("pg");
const {restoreTables} = require("./restore-log-backup.cjs");
(async () => {
  const client = new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read");
    await client.query(fs.readFileSync("supabase/patch_log_data_center.sql","utf8"));
    const users = (await client.query("select u.id,p.role,lower(u.email)='marvinlabre@gmail.com' sadmin from auth.users u join public.profiles p on p.id=u.id")).rows;
    const setActor = async (user) => {
      await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user?.id || "",JSON.stringify({sub:user?.id,role:"authenticated"})]);
    };
    for (const user of [null,users.find((u)=>u.role==='responsavel'),users.find((u)=>u.role==='admin'&&!u.sadmin)].filter((u,i)=>u||!i)) {
      await setActor(user); await client.query("savepoint denied");
      await client.query("set local role authenticated");
      await assert.rejects(client.query("select public.log_recovery_snapshot(null)"),/superadministrador/);
      await client.query("rollback to savepoint denied"); await client.query("reset role");
    }
    await setActor(users.find((u)=>u.sadmin));
    await client.query("set local role authenticated");
    const catalog = (await client.query("select public.log_data_catalog() result")).rows[0].result;
    assert(catalog.some((t)=>t.name==='students'));
    const report = (await client.query("select public.log_report_snapshot() result")).rows[0].result;
    const extract = (await client.query("select public.log_extract_data(array['students']) result")).rows[0].result;
    const snapshot = (await client.query("select public.log_recovery_snapshot(null) result")).rows[0].result;
    assert.equal(extract.students.length,snapshot.tables['public.students'].length);
    assert.equal(report.checkins.length,snapshot.tables['public.checkins'].length);
    const specific = (await client.query("select public.log_recovery_snapshot(array['checkins']) result")).rows[0].result;
    for (const t of ['public.checkins','public.students','public.rooms','public.profiles','auth.users']) assert(t in specific.tables, `Missing ${t}; actual: ${Object.keys(specific.tables).join(",")}`);
    await client.query("reset role");
    await restoreTables(client,{snapshot});
    // Release all database locks before any potentially slow Storage downloads.
    await client.query("rollback");
    if (process.argv.includes("--with-files")) {
      const {canonical,hash,verifyBackup}=require('./restore-log-backup.cjs');
      const files=[];
      const source='https://ziuezwtmmnspkycixqtf.supabase.co';
      for (const object of snapshot.objects) {
        assert(snapshot.buckets.find((b)=>b.id===object.bucket_id)?.public, 'Private bucket requires an administrative download validation');
        const path=source+'/storage/v1/object/public/'+encodeURIComponent(object.bucket_id)+'/'+object.name.split('/').map(encodeURIComponent).join('/');
        const response=await fetch(path,{signal:AbortSignal.timeout(15000)});assert(response.ok,'Storage download failed');
        const bytes=Buffer.from(await response.arrayBuffer());
        if(object.metadata?.size!=null) assert.equal(bytes.length,Number(object.metadata.size));
        files.push({bucket:object.bucket_id,name:object.name,sha256:hash(bytes),base64:bytes.toString('base64')});
      }
      const payload={format:'dnms-recovery',version:1,scope:'global',source,snapshot,files};
      verifyBackup(JSON.parse(JSON.stringify({payload,sha256:hash(canonical(payload))})));
      console.log(`Storage OK: ${files.length} arquivos reais baixados, tamanhos e checksums conferidos somente em memória.`);
    }
    console.log(`Backend OK: ${catalog.length} tabelas; permissÃµes negativas, snapshot global, dependÃªncias e restauraÃ§Ã£o transacional conferidos.`);
  } finally { await client.query("rollback"); await client.end(); }
})().catch((e)=>{console.error(e.message);process.exitCode=1;});
