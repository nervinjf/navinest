// middlewares/azureBlob.js
const {
  BlobServiceClient, BlobClient,
  generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol, StorageSharedKeyCredential,
} = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

function getBlobServiceClient() {
  const conn = process.env.AZ_QUEUE_CONN;
  if (conn) return BlobServiceClient.fromConnectionString(conn);
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  if (!account) throw new Error("Falta AZ_QUEUE_CONN o AZURE_STORAGE_ACCOUNT");
  const url = `https://${account}.blob.core.windows.net`;
  return new BlobServiceClient(url, new DefaultAzureCredential());
}
const blobSvc = getBlobServiceClient();
const DEFAULT_CONTAINER = process.env.BLOB_CONTAINER || "emails-procesados";
const getContainerName = () => (process.env.BLOB_CONTAINER || "emails-procesados");
const containerClient = (containerName = DEFAULT_CONTAINER) => blobSvc.getContainerClient(containerName);
const ensureContainer = async (containerName = DEFAULT_CONTAINER) => { await containerClient(containerName).createIfNotExists(); };

async function uploadBufferToBlob({ buffer, blobName, contentType = "application/pdf", container }) {
  const cont = container || getContainerName();
  await ensureContainer(cont);
  const block = containerClient(cont).getBlockBlobClient(blobName);
  await block.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  const props = await block.getProperties();
  return { url: block.url, eTag: props.etag || null, contentLength: buffer.length, contentType, container: cont, blobName };
}
async function getBufferFromBlob(blobName, container) {
  const cont = container || getContainerName();
  const resp = await containerClient(cont).getBlockBlobClient(blobName).download();
  const chunks = []; for await (const c of resp.readableStreamBody) chunks.push(c);
  return Buffer.concat(chunks);
}
async function blobExists(a, b) {
  const cont = (b !== undefined) ? (a || getContainerName()) : getContainerName();
  const blob = (b !== undefined) ? b : a;
  return await containerClient(cont).getBlockBlobClient(blob).exists();
}
async function downloadBlobToBuffer({ blobUrl, blobName, container }) {
  if (!blobUrl && !blobName) throw new Error("Falta blobUrl o blobName");
  const client = (blobUrl && /^https?:\/\//i.test(String(blobUrl)))
    ? new BlobClient(blobUrl)
    : containerClient(container || getContainerName()).getBlobClient(blobName);
  const resp = await client.download();
  const chunks = []; for await (const c of resp.readableStreamBody) chunks.push(c);
  return Buffer.concat(chunks);
}

// búsqueda por basename (fallback)
async function listContainers() { const r=[]; for await (const c of blobSvc.listContainers()) r.push(c.name); return r; }
async function findBlobByBasename(basename, { containers, maxPerContainer = 8000 } = {}) {
  const goal = String(basename).toLowerCase();
  const arr = Array.isArray(containers) && containers.length
    ? containers
    : (process.env.AZ_IN_CONTAINERS || "emails-procesados,emails,input,output,emails-raw").split(",").map(s => s.trim()).filter(Boolean);
  for (const cont of arr) {
    const cc = containerClient(cont);
    let scanned = 0;
    for await (const b of cc.listBlobsFlat()) {
      scanned++; if (scanned > maxPerContainer) break;
      const name = (b?.name || "").toLowerCase();
      if (name.endsWith("/" + goal) || name === goal || name.endsWith(goal)) return { container: cont, blobName: b.name };
    }
  }
  return null;
}

function accountFromConnString(connStr) {
  const parts = Object.fromEntries(connStr.split(";").map(kv => kv.split("=", 2)).filter(x => x[0] && x[1]));
  return { name: parts.AccountName, key: parts.AccountKey };
}
async function getBlobReadSasUrl(blobName, { expiresInMin = 15, attachmentName, container } = {}) {
  const conn = process.env.AZ_QUEUE_CONN; if (!conn) throw new Error("AZ_QUEUE_CONN requerido para SAS");
  const { name: accountName, key: accountKey } = accountFromConnString(conn);
  const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);
  const containerName = container || getContainerName();
  const startsOn = new Date(); const expiresOn = new Date(startsOn.getTime() + expiresInMin * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    { containerName, blobName, permissions: BlobSASPermissions.parse("r"), startsOn, expiresOn, protocol: SASProtocol.Https },
    sharedKey
  ).toString();
  const baseUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}`;
  let url = `${baseUrl}?${sas}`;
  if (attachmentName) { const disp = `attachment; filename="${encodeURIComponent(attachmentName)}"`; url += `&response-content-disposition=${encodeURIComponent(disp)}`; }
  return url;
}

module.exports = {
  uploadBufferToBlob, getBufferFromBlob, blobExists, downloadBlobToBuffer,
  getBlobReadSasUrl, ensureContainer, listContainers, findBlobByBasename,
};
