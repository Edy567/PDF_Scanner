const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas, Image, ImageData, Canvas, DOMMatrix } = require('canvas');
const { createWorker } = require('tesseract.js');

global.Image = Image;
global.ImageData = ImageData;
global.Canvas = Canvas;
global.DOMMatrix = DOMMatrix;

pdfjsLib.GlobalWorkerOptions.workerSrc = false;

class NodeCanvasFactory {
    create(width, height) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return { canvas, context };
    }
    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 150 * 1024 * 1024 }
});

function formatDate(raw) {
    if (raw && raw.startsWith('D:')) {
        return `${raw.substring(8, 10)}.${raw.substring(6, 8)}.${raw.substring(2, 6)}`;
    }
    return raw || 'Necunoscuta';
}

function sampleText(text, maxLen = 3000) {
    if (text.length <= maxLen) return text;
    const chunk = Math.floor(maxLen / 3);
    const mid = Math.floor(text.length / 2);
    return (
        text.substring(0, chunk) +
        ' [...] ' +
        text.substring(mid - Math.floor(chunk / 2), mid + Math.floor(chunk / 2)) +
        ' [...] ' +
        text.substring(text.length - chunk)
    );
}

async function processPdf(fileBuffer, fileName) {
    const standardFontDataUrl = path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';

    const pdfDoc = await pdfjsLib.getDocument({
        data: new Uint8Array(fileBuffer),
        canvasFactory: new NodeCanvasFactory(),
        standardFontDataUrl: standardFontDataUrl
    }).promise;

    const numPages = pdfDoc.numPages;
    const metaData = await pdfDoc.getMetadata().catch(() => ({ info: {} }));
    const meta = metaData && metaData.info ? metaData.info : {};

    let textStr = '';
    const pagesToCheck = Math.min(3, numPages);

    for (let i = 1; i <= pagesToCheck; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        textStr += textContent.items.map(item => item.str).join(' ') + ' ';
    }

    textStr = textStr.trim();
    console.log(`${fileName} Text extras direct (primele 3 pagini): "${textStr.substring(0, 200)}"`);
    console.log(`${fileName} Lungime text direct: ${textStr.length} caractere`);

    if (textStr.length >= 100) {
        for (let i = pagesToCheck + 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            textStr += textContent.items.map(item => item.str).join(' ') + ' ';
        }
        console.log(`${fileName} : PDF normal`);
        return { text: textStr, meta };
    }

    console.log(`${fileName} Text insuficient, pornim OCR cu model vizual...`);

    const canvasFactory = new NodeCanvasFactory();
    const MAX_PAGES = 16;
    const step = numPages > MAX_PAGES ? Math.floor(numPages / MAX_PAGES) : 1;
    let ocrText = '';

    const worker = await createWorker('ron');

    for (let i = 1; i <= numPages; i += step) {
        console.log(`${fileName} : pagina ${i} din ${numPages}...`);
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
        const ctx = canvasAndContext.context;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({
            canvasContext: ctx,
            viewport,
            canvasFactory
        }).promise;

        const imgBuffer = canvasAndContext.canvas.toBuffer('image/png');

        canvasFactory.destroy(canvasAndContext);

        try {
            const result = await worker.recognize(imgBuffer);
            let cleanedResponse = result.data.text.trim();
            console.log(`${fileName} Text OCR pagina ${i}: "${cleanedResponse.substring(0, 200)}"`);
            ocrText += cleanedResponse + '\n';
        } catch (err) {
            console.log(`${fileName} Pagina ${i} n-a fost procesata: ${err.message}`);
            ocrText += `[pagina ${i} needitabila]\n`;
        }
    }

    await worker.terminate();
    return { text: ocrText.trim(), meta };
}
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434'; 

app.post('/api/upload-folder', upload.array('documents'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Fara fisiere primite.' });
        }

        const rezultateFinale = [];

        for (const file of files) {
            if (file.mimetype !== 'application/pdf') continue;

            try {
                const { text, meta } = await processPdf(file.buffer, file.originalname);
                const textStr = sampleText(text.replace(/\s+/g, ' '));

                console.log(`[${file.originalname}] TEXT FINAL catre llama3: "${textStr.substring(0, 300)}"`);

                const systemPrompt =
                    'Ești un asistent de analiză date. Răspunzi DOAR cu un JSON valid, în limba română, completând exact câmpurile cerute.';

                const userPrompt = `Extrage informațiile din acest document:\nNume fisier: ${file.originalname}\nAutor din metadate: ${meta.Author || 'Necunoscut'}\nData din metadate: ${formatDate(meta.CreationDate)}\n\nTEXT EXTRAS:\n${textStr}\n\nCompletează acest format JSON cu informațiile găsite. Nu adăuga niciun alt cuvânt în afara JSON-ului!\n{\n  "nume_fisier": "${file.originalname}",\n  "subiect": "scrie aici despre ce este vorba",\n  "autor": "scrie aici cine l-a creat",\n  "data_crearii": "scrie aici data",\n  "rezumat": "rezumat de cateva propozitii"\n}`;

                const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
                    model: 'llama3',
                    system: systemPrompt,
                    prompt: userPrompt,
                    format: 'json',
                    stream: false,
                    options: { num_ctx: 8192 }
                });

                const rawAiResponse = response.data.response;
                console.log(`[${file.originalname}] Raspuns llama3: ${rawAiResponse.substring(0, 300)}`);

                const jsonMatch = rawAiResponse.match(/\{[\s\S]*\}/);
                const cleanJson = jsonMatch ? jsonMatch[0] : rawAiResponse;

                rezultateFinale.push(JSON.parse(cleanJson));
            } catch (err) {
                console.log(`[${file.originalname}] EROARE: ${err.message}`);
                rezultateFinale.push({ nume_fisier: file.originalname, eroare: err.message });
            }
        }

        res.json(rezultateFinale);
    } catch (error) {
        res.status(500).json({ error: 'Eroare la server.' });
    }
});

app.listen(5000);