const fs = require("fs");
const {
    default: DocumentIntelligence,
    getLongRunningPoller,
    isUnexpected
} = require("@azure-rest/ai-document-intelligence");

async function extraerDatosDesdePDF(filePath) {
    console.log("📥 Procesando desde buffer, no desde filePath", filePath);

    if (!Buffer.isBuffer(filePath)) {
        throw new Error("❌ Se esperaba un buffer, no una ruta.");
    }

    const key = process.env.FORM_RECOGNIZER_KEY;
    const endpoint = process.env.FORM_RECOGNIZER_ENDPOINT;
    const modelId = process.env.MODEL_ID;

    // const imageBuffer = fs.readFileSync(filePath);
    const base64Image = filePath.toString("base64");

    const client = DocumentIntelligence(endpoint, { key });

    const t0 = Date.now();
    const initialResponse = await client
        .path("/documentModels/{modelId}:analyze", modelId)
        .post({
            contentType: "application/json",
            body: { base64Source: base64Image },
        });

    if (isUnexpected(initialResponse)) {
        throw new Error(initialResponse.body.error?.message || "Error inesperado al analizar PDF.");
    }

    const poller = getLongRunningPoller(client, initialResponse);
    const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;
    const azureMs = Date.now() - t0;

    const documents = analyzeResult?.documents || [];
    const fields = documents.length > 0 ? documents[0].fields : {};


    return { fields, azureMs }; // ⬅ devolvemos tiempo Azure
}

module.exports = { extraerDatosDesdePDF };
