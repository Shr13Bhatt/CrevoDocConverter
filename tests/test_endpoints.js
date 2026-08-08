const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function uploadFile(toolType, filePath, fieldName = 'file') {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  
  const formData = new FormData();
  formData.append(fieldName, blob, fileName);

  const res = await fetch(`${BASE_URL}/api/upload/${toolType}`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for ${fileName}: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.file;
}

async function convertFile(toolType, uploadedFileInfo) {
  const res = await fetch(`${BASE_URL}/api/convert/${toolType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: uploadedFileInfo.filename,
      originalname: uploadedFileInfo.originalname
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Conversion failed for ${toolType}: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data;
}

async function downloadFile(downloadUrl, outputPath) {
  const res = await fetch(`${BASE_URL}${downloadUrl}`);
  if (!res.ok) {
    throw new Error(`Download failed for ${downloadUrl}: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

// Multi-image upload and conversion test
async function testImagesToPdf() {
  console.log('\n--- Testing Images to PDF Converter ---');
  const imgPath = path.join(__dirname, 'dummy.jpg');
  const fileBuffer = fs.readFileSync(imgPath);
  
  const formData = new FormData();
  formData.append('files', new Blob([fileBuffer]), 'dummy1.jpg');
  formData.append('files', new Blob([fileBuffer]), 'dummy2.jpg');

  // Upload multiple
  const uploadRes = await fetch(`${BASE_URL}/api/upload-multiple/jpg-to-pdf`, {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload multiple failed: ${uploadRes.status}`);
  }

  const uploadData = await uploadRes.json();
  console.log('Uploaded multiple:', uploadData.files);

  // Convert with reordering & rotation
  const convertRes = await fetch(`${BASE_URL}/api/convert/images-to-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: [
        { filename: uploadData.files[1].filename, rotation: 90 }, // swap order
        { filename: uploadData.files[0].filename, rotation: 0 }
      ],
      outputFilename: 'combined_images.pdf'
    })
  });

  if (!convertRes.ok) {
    throw new Error(`Conversion failed: ${convertRes.status}`);
  }

  const convertData = await convertRes.json();
  const pdfOut = path.join(__dirname, 'combined_images.pdf');
  await downloadFile(convertData.downloadUrl, pdfOut);
  
  const stats = fs.statSync(pdfOut);
  console.log(`[PASS] Images to PDF conversion complete. Size: ${stats.size} bytes`);
}

async function runTests() {
  console.log('--- Starting CrevoDoc End-to-End Endpoints Verification ---');
  
  try {
    // 1. Word -> PDF
    console.log('\n--- Testing Word to PDF Converter ---');
    const wordFile = path.join(__dirname, 'dummy.docx');
    const uploadedWord = await uploadFile('word-to-pdf', wordFile);
    console.log('Uploaded file metadata:', uploadedWord);
    
    const wordResult = await convertFile('word-to-pdf', uploadedWord);
    const pdfPath = path.join(__dirname, 'dummy_word.pdf');
    await downloadFile(wordResult.downloadUrl, pdfPath);
    console.log(`[PASS] Word -> PDF conversion complete. Output saved: ${pdfPath}`);

    // 2. PDF -> Word
    console.log('\n--- Testing PDF to Word Converter ---');
    const uploadedPdf = await uploadFile('pdf-to-word', pdfPath);
    const pdfResult = await convertFile('pdf-to-word', uploadedPdf);
    const docxBackPath = path.join(__dirname, 'dummy_back.docx');
    await downloadFile(pdfResult.downloadUrl, docxBackPath);
    console.log(`[PASS] PDF -> Word conversion complete. Output saved: ${docxBackPath}`);

    // 3. PPTX -> PDF
    console.log('\n--- Testing PowerPoint to PDF Converter ---');
    const pptxFile = path.join(__dirname, 'dummy.pptx');
    const uploadedPptx = await uploadFile('ppt-to-pdf', pptxFile);
    const pptxResult = await convertFile('ppt-to-pdf', uploadedPptx);
    const pptxPdfPath = path.join(__dirname, 'dummy_pptx.pdf');
    await downloadFile(pptxResult.downloadUrl, pptxPdfPath);
    console.log(`[PASS] PPTX -> PDF conversion complete. Output saved: ${pptxPdfPath}`);

    // 4. PDF -> PPTX
    console.log('\n--- Testing PDF to PowerPoint Converter ---');
    const uploadedPptxPdf = await uploadFile('pdf-to-ppt', pptxPdfPath);
    const pdfPptxResult = await convertFile('pdf-to-ppt', uploadedPptxPdf);
    const pptxBackPath = path.join(__dirname, 'dummy_back.pptx');
    await downloadFile(pdfPptxResult.downloadUrl, pptxBackPath);
    console.log(`[PASS] PDF -> PPTX conversion complete. Output saved: ${pptxBackPath}`);

    // 5. Images -> PDF
    await testImagesToPdf();

    console.log('\n======================================');
    console.log('ALL API CONVERTERS TESTED & FUNCTIONAL!');
    console.log('======================================');
    process.exit(0);

  } catch (err) {
    console.error('\n[FAIL] An integration test failed:', err);
    process.exit(1);
  }
}

// Start tests
runTests();
