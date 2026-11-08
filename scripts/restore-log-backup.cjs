/* Offline recovery. Secrets are read from environment only, never browser code. */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { Client } = require("pg");
const quote = (name) => '"' + name.replace(/"/g, '""') + '"';
const qualified = (name) => name.split(".").map(quote).join(".");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function verifyBackup(document) {
  const p = document.payload;
  if (!p || p.format !== "dnms-recovery" || p.version !== 1 || !["global", "specific"].includes(p.scope)) throw new Error("Formato de backup inválido");
  if (document.sha256 !== hash(canonical(p))) throw new Error("Checksum inválido: arquivo alterado ou corrompido");
  if (!p.snapshot?.tables || !p.snapshot.columns || !Array.isArray(p.snapshot.objects) || !Array.isArray(p.snapshot.buckets) || !Array.isArray(p.files)) throw new Error("Backup incompleto");
  for (const [name, rows] of Object.entries(p.snapshot.tables)) {
    if (!/^(public\.[a-zA-Z_][a-zA-Z_0-9]*|auth\.(users|identities|mfa_factors))$/.test(name) || !Array.isArray(rows) || !Array.isArray(p.snapshot.columns[name])) throw new Error("Tabela inválida");
  }
  for (const name of ["auth.users", "auth.identities"]) if (!p.snapshot.tables[name]) throw new Error("Contas ausentes no backup");
  const seen = new Set();
  for (const file of p.files) {
    const key = `${file.bucket}/${file.name}`;
    if (seen.has(key) || !p.snapshot.objects.some((o) => o.bucket_id === file.bucket && o.name === file.name)) throw new Error("Inventário de arquivos inconsistente");
    seen.add(key);
    if (hash(Buffer.from(file.base64, "base64")) !== file.sha256) throw new Error(`Arquivo corrompido: ${key}`);
  }
  if (seen.size !== p.snapshot.objects.length) throw new Error("Arquivos ausentes no backup");
  return p;
}

async function restoreTables(client, p) {
  await client.query("set local session_replication_role = replica");
  for (const [name, rows] of Object.entries(p.snapshot.tables)) {
    const metadata = await client.query(`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attgenerated as generated
      from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`, [name]);
    if (canonical(metadata.rows) !== canonical(p.snapshot.columns[name])) throw new Error(`Schema diferente: ${name}. Use a mesma versão de schema antes de restaurar.`);
    const keys = (await client.query(`select a.attname from pg_index i cross join lateral unnest(i.indkey) with ordinality k(num,ord)
      join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.num where i.indrelid=$1::regclass and i.indisprimary order by k.ord`, [name])).rows.map((r) => r.attname);
    if (!keys.length) throw new Error(`Tabela sem chave primária: ${name}`);
    const columns = metadata.rows.filter((c) => !c.generated).map((c) => c.name);
    const updates = columns.filter((c) => !keys.includes(c));
    if (rows.length) await client.query(`insert into ${qualified(name)} (${columns.map(quote)}) overriding system value
      select ${columns.map(quote)} from jsonb_populate_recordset(null::${qualified(name)}, $1::jsonb)
      on conflict (${keys.map(quote)}) do ${updates.length ? `update set ${updates.map((c) => `${quote(c)}=excluded.${quote(c)}`).join(",")}` : "nothing"}`, [JSON.stringify(rows)]);
    // Re-read restored records and compare every non-generated value, inside the transaction.
    const restored = await client.query(`select to_jsonb(t) as row from ${qualified(name)} t join jsonb_populate_recordset(null::${qualified(name)},$1::jsonb) s
      on ${keys.map((k) => `t.${quote(k)} is not distinct from s.${quote(k)}`).join(" and ")}`, [JSON.stringify(rows)]);
    const normalize = (list) => list.map((r) => canonical(Object.fromEntries(columns.map((c) => [c,r[c]])))).sort();
    if (canonical(normalize(restored.rows.map((r) => r.row))) !== canonical(normalize(rows))) throw new Error(`Falha ao conferir dados restaurados: ${name}`);
  }
  // Replica mode avoids audit, age recalculation and printing side effects. Validate all FK relationships explicitly.
  const fks = await client.query(`select c.conname, c.confmatchtype, c.conrelid::regclass::text child,c.confrelid::regclass::text parent,
    array(select attname::text from unnest(c.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by ord) ck,
    array(select attname::text from unnest(c.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by ord) pk
    from pg_constraint c where c.contype='f' and c.connamespace in ('public'::regnamespace,'auth'::regnamespace)`);
  for (const fk of fks.rows) {
    const required = fk.ck.map((k) => `r.${quote(k)} is not null`).join(fk.confmatchtype === "f" ? " or " : " and ");
    const join = fk.ck.map((k,i) => `r.${quote(k)}=p.${quote(fk.pk[i])}`).join(" and ");
    // regclass output is generated by PostgreSQL, not backup input.
    const bad = await client.query(`select 1 from ${fk.child} r where (${required}) and not exists(select 1 from ${fk.parent} p where ${join}) limit 1`);
    if (bad.rowCount) throw new Error(`Relacionamento inválido: ${fk.conname}`);
  }
}

async function restoreFiles(p, apply) {
  if (!p.files.length && !p.snapshot.buckets.length) return [];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL;
  if (!key || url !== p.source) throw new Error("Defina SUPABASE_URL igual à origem e SUPABASE_SERVICE_ROLE_KEY somente neste terminal administrativo.");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  for (const bucket of p.snapshot.buckets) {
    const endpoint = `${url}/storage/v1/bucket/${encodeURIComponent(bucket.id)}`;
    const response = await fetch(endpoint, {headers});
    if (!response.ok) {
      const error = await response.json().catch(()=>({}));
      if (!(response.status===404 || (response.status===400 && ["not_found","NoSuchBucket"].includes(error.error)))) throw new Error(`Falha ao verificar bucket: ${bucket.id}`);
      if (apply) {
        const created = await fetch(`${url}/storage/v1/bucket`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({id:bucket.id,name:bucket.name,public:bucket.public,file_size_limit:bucket.file_size_limit,allowed_mime_types:bucket.allowed_mime_types})});
        if (!created.ok) throw new Error(`Falha ao recuperar bucket: ${bucket.id}`);
      }
    } else {
      const actual=await response.json();
      for (const field of ["public","file_size_limit","allowed_mime_types"]) if (canonical(actual[field]??null)!==canonical(bucket[field]??null)) throw new Error(`Configuração do bucket ${bucket.id} difere do backup (${field}).`);
    }
  }
  // Preflight the whole inventory; never overwrite an existing different file.
  const missing = [];
  for (const file of p.files) {
    const path = `${url}/storage/v1/object/${encodeURIComponent(file.bucket)}/${file.name.split("/").map(encodeURIComponent).join("/")}`;
    const response = await fetch(path, { headers });
    if (response.ok) {
      if (hash(Buffer.from(await response.arrayBuffer())) !== file.sha256) throw new Error(`Arquivo existente difere do backup: ${file.name}. Restauração abortada sem sobrescrever.`);
    } else if (response.status === 404 || (response.status === 400 && (await response.json()).error === "not_found")) missing.push({file,path});
    else throw new Error(`Falha ao verificar arquivo: ${file.name}`);
  }
  for (const {file,path} of missing) {
    if (!apply) continue;
    const response = await fetch(path, { method: "POST", headers: {...headers,"Content-Type":file.content_type || "application/octet-stream","x-upsert":"false"}, body:Buffer.from(file.base64,"base64") });
    if (!response.ok) throw new Error(`Falha ao recuperar arquivo: ${file.name}. Dados do banco não foram confirmados.`);
    const check = await fetch(path,{headers});
    if (!check.ok || hash(Buffer.from(await check.arrayBuffer())) !== file.sha256) throw new Error(`Verificação de arquivo restaurado falhou: ${file.name}`);
  }
  return missing;
}

async function main() {
  const file = process.argv[2]; const apply = process.argv.includes("--apply");
  if (!file) throw new Error("Uso: node scripts/restore-log-backup.cjs arquivo.json [--verify-only | --apply]. Sem --apply, a transação sempre sofre rollback.");
  const p = verifyBackup(JSON.parse(fs.readFileSync(file,"utf8")));
  if (process.argv.includes("--verify-only")) { console.log("Integridade do backup e de todos os arquivos validada."); return; }
  if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL em ambiente administrativo.");
  const dbUrl = new URL(process.env.DATABASE_URL);
  const ref = new URL(p.source).hostname.split(".")[0];
  if (!decodeURIComponent(dbUrl.username).includes(ref) && !dbUrl.hostname.startsWith(`db.${ref}.`)) throw new Error("O banco de destino deve ser o projeto de origem do backup.");
  const client = new Client({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await client.connect();
  try {
    await client.query("begin isolation level serializable");
    await client.query("set local lock_timeout='10s'");
    await restoreTables(client,p);
    await restoreFiles(p,apply);
    await client.query(apply ? "commit" : "rollback");
    console.log(apply ? "Registros restaurados e conferidos. Registros posteriores ao backup foram preservados." : "Simulação validada; rollback concluído, sem alterar dados do banco.");
  } catch (e) { await client.query("rollback"); throw e; }
  finally { await client.end(); }
}
module.exports = {canonical, hash, verifyBackup, restoreTables, restoreFiles};
if (require.main === module) main().catch((e) => { console.error(`Restauração não concluída: ${e.message}`); process.exitCode=1; });
