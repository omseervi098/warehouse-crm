let currentDataUri = '';
let currentFileName = '';

const filenameEl = document.getElementById('filename');
const statusEl = document.getElementById('status');
const viewerFrame = document.getElementById('viewer-frame');
const fallback = document.getElementById('fallback');
const downloadBtn = document.getElementById('download-btn');
const fallbackDownloadBtn = document.getElementById('fallback-download');
const maximizeBtn = document.getElementById('maximize-btn');
const controls = document.getElementById('titlebar-right');

function dataUriToBlob(dataUri) {
    const parts = dataUri.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
}

async function downloadCurrentPdf() {
    if (!currentDataUri) return;
    const result = await window.pdfPreview.download(currentDataUri, currentFileName);
    if (result && result.ok) {
        const original = downloadBtn.textContent;
        downloadBtn.textContent = 'Saved';
        setTimeout(() => {
            downloadBtn.textContent = original;
        }, 1600);
    }
}

downloadBtn.addEventListener('click', downloadCurrentPdf);
fallbackDownloadBtn.addEventListener('click', downloadCurrentPdf);
document.getElementById('minimize-btn').addEventListener('click', () => window.pdfPreview.minimize());
document.getElementById('close-btn').addEventListener('click', () => window.pdfPreview.close());
maximizeBtn.addEventListener('click', async () => {
    const result = await window.pdfPreview.toggleMaximize();
    if (result && result.ok) {
        maximizeBtn.textContent = result.maximized ? '❐' : '□';
    }
});

window.pdfPreview.onPdfData(({ dataUri, fileName, platform }) => {
    currentDataUri = dataUri;
    currentFileName = fileName;
    filenameEl.textContent = fileName;
    document.title = fileName;
    document.body.classList.toggle('macos', platform === 'darwin');

    if (platform === 'darwin') {
        controls.classList.add('macos-controls');
    }

    try {
        const blob = dataUriToBlob(dataUri);
        const blobUrl = URL.createObjectURL(blob);
        viewerFrame.src = blobUrl;
        statusEl.textContent = 'Preview loaded';
        viewerFrame.addEventListener('load', () => {
            statusEl.style.display = 'none';
        }, { once: true });
    } catch (err) {
        console.error('Error loading PDF preview:', err);
        statusEl.textContent = 'Preview unavailable';
        viewerFrame.style.display = 'none';
        fallback.style.display = 'block';
    }
});

window.pdfPreview.ready();
