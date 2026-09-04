const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const url = require('url');

const { fileValidator, cleanupUploadedFiles, CONVERTER_CONFIGS } = require('./middleware');
const { cleanTempFiles } = require('./cleanup');

const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories (use system temp dir in serverless environment)
const isServerless = !!(process.env.VERCEL || process.env.LAMBDA_TASK_ROOT);
const baseDir = isServerless ? os.tmpdir() : path.join(__dirname, '..');
const UPLOADS_DIR = path.join(baseDir, 'uploads');
const DOWNLOADS_DIR = path.join(baseDir, 'downloads');

[UPLOADS_DIR, DOWNLOADS_DIR].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error(`[Server] Directory creation failed for ${dir}:`, err);
  }
});

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Set views directory for rendering the pages
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Helper: Resolve cross-platform Python executable
function getPythonExecutable() {
  const winVenv = path.join(__dirname, '../.venv/Scripts/python.exe');
  const nixVenv = path.join(__dirname, '../.venv/bin/python');
  if (fs.existsSync(winVenv)) return winVenv;
  if (fs.existsSync(nixVenv)) return nixVenv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

// Helper: Run Python scripts from virtual environment or system Python
function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExecutable();
    const scriptPath = path.join(__dirname, '../scripts', scriptName);
    
    console.log(`[Python] Spawning: ${pythonExe} ${scriptPath} ${args.join(' ')}`);
    
    const env = { ...process.env };
    if (process.platform === 'linux') {
      const home = os.homedir();
      const userSites = [
        path.join(home, '.local/lib/python3.10/site-packages'),
        path.join(home, '.local/lib/python3.11/site-packages'),
        path.join(home, '.local/lib/python3.12/site-packages'),
        path.join(home, '.local/lib/python3.9/site-packages'),
        path.join(home, '.local/lib/python3.8/site-packages')
      ];
      env.PYTHONPATH = userSites.join(':') + (env.PYTHONPATH ? ':' + env.PYTHONPATH : '');
    }

    const pyProcess = spawn(pythonExe, [scriptPath, ...args], { env });
    
    let stdout = '';
    let stderr = '';
    
    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pyProcess.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        console.error(`[Python Error] Script ${scriptName} exited with code ${code}. Stderr: ${stderr}`);
        reject(new Error(stderr || `Python script exited with code ${code}`));
      }
    });
  });
}

// Helper: Robust Puppeteer browser launcher supporting cloud and local environments
async function launchPuppeteer() {
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu'
  ];

  const options = {
    headless: 'new',
    args: launchArgs
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    const candidatePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        options.executablePath = p;
        break;
      }
    }
  }

  return await puppeteer.launch(options);
}

// ----------------------------------------------------
// UI Routes
// ----------------------------------------------------
const viewPath = (file) => path.join(__dirname, '../views', file);

app.get('/', (req, res) => res.sendFile(viewPath('index.html')));
app.get('/all-tools', (req, res) => res.sendFile(viewPath('all-tools.html')));

// Tool page titles, descriptions, FAQs, and navigation metadata for SEO
const TOOL_METADATA = {
  'word-to-pdf': {
    title: 'Word to PDF Converter',
    desc: 'Convert DOC and DOCX files to professional PDF documents online.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Will the document formatting remain intact?</div>
        <div class="faq-answer">We preserve layout elements, tables, and images as closely as possible during the Word-to-PDF compilation process.</div>
      </div>
      <div class="faq-item">
        <div class="faq-question">Does it support old .doc format?</div>
        <div class="faq-answer">Yes, we support both .doc and .docx. Legacy .doc files are processed using a special conversion engine.</div>
      </div>
    `,
    related: ['pdf-to-word', 'ppt-to-pdf', 'jpg-to-pdf']
  },
  'pdf-to-word': {
    title: 'PDF to Word Converter',
    desc: 'Convert PDF documents into editable DOCX Microsoft Word documents.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Is the generated Word file editable?</div>
        <div class="faq-answer">Yes! The output is a standard .docx document. The layout is reconstructed into editable paragraphs and tables.</div>
      </div>
    `,
    related: ['word-to-pdf', 'pdf-to-ppt', 'pdf-to-jpg']
  },
  'ppt-to-pdf': {
    title: 'PowerPoint to PDF Converter',
    desc: 'Convert PPT and PPTX presentation slides into landscape PDF documents.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Will it split my presentation pages?</div>
        <div class="faq-answer">No, each PowerPoint slide represents exactly one page of the compiled landscape PDF.</div>
      </div>
    `,
    related: ['pdf-to-ppt', 'word-to-pdf', 'jpg-to-pdf']
  },
  'pdf-to-ppt': {
    title: 'PDF to PowerPoint Converter',
    desc: 'Convert PDF files back into editable PowerPoint presentation slides.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Can I edit the text and shapes in the generated PowerPoint?</div>
        <div class="faq-answer">Yes! Where technically possible, text blocks are imported as editable PowerPoint text frames, and images are placed in corresponding positions.</div>
      </div>
    `,
    related: ['ppt-to-pdf', 'pdf-to-word', 'pdf-to-png']
  },
  'jpg-to-pdf': {
    title: 'JPG to PDF Converter',
    desc: 'Convert JPG/JPEG images into a single, high-quality PDF document.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Can I merge multiple images at once?</div>
        <div class="faq-answer">Yes, you can upload multiple JPG/JPEG images, rotate individual images, and drag them to arrange page order before compiling.</div>
      </div>
    `,
    related: ['png-to-pdf', 'pdf-to-jpg', 'jpg-to-png']
  },
  'png-to-pdf': {
    title: 'PNG to PDF Converter',
    desc: 'Convert PNG images into a single PDF document.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Does it preserve PNG transparency?</div>
        <div class="faq-answer">Yes, PNG transparency is preserved in the final PDF document.</div>
      </div>
    `,
    related: ['jpg-to-pdf', 'pdf-to-png', 'png-to-jpg']
  },
  'webp-to-jpg': {
    title: 'WEBP to JPG Converter',
    desc: 'Convert Google WEBP images into standard JPG images.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Will the converted JPG file be smaller?</div>
        <div class="faq-answer">JPG uses lossy compression. We set it to high quality (90%) so you preserve details while ensuring universal compatibility.</div>
      </div>
    `,
    related: ['jpg-to-png', 'png-to-jpg', 'webp-to-jpg']
  },
  'jpg-to-png': {
    title: 'JPG to PNG Converter',
    desc: 'Convert JPG images to PNG format.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Will my PNG image have transparent elements?</div>
        <div class="faq-answer">Since JPG does not support transparency, the output PNG will have a solid background, but it will be in the lossless PNG format.</div>
      </div>
    `,
    related: ['png-to-jpg', 'jpg-to-pdf', 'webp-to-jpg']
  },
  'png-to-jpg': {
    title: 'PNG to JPG Converter',
    desc: 'Convert PNG images into universally supported JPG format.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">What happens to transparent backgrounds in PNG?</div>
        <div class="faq-answer">Transparent areas are automatically filled with a white background during compilation into the JPG format.</div>
      </div>
    `,
    related: ['jpg-to-png', 'png-to-pdf', 'webp-to-jpg']
  },
  'pdf-to-jpg': {
    title: 'PDF to JPG Converter',
    desc: 'Convert and extract PDF document pages into high-quality JPG images.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Can I download pages separately?</div>
        <div class="faq-answer">Yes, each page is converted to an image and listed for download separately in the results panel.</div>
      </div>
    `,
    related: ['pdf-to-png', 'pdf-to-word', 'jpg-to-pdf']
  },
  'pdf-to-png': {
    title: 'PDF to PNG Converter',
    desc: 'Convert PDF document pages into high-quality PNG images.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Are the extracted page images high resolution?</div>
        <div class="faq-answer">Yes! We render pages at double resolution (approx. 150 DPI) to ensure text remains crisp and highly legible.</div>
      </div>
    `,
    related: ['pdf-to-jpg', 'pdf-to-ppt', 'png-to-pdf']
  },
  'txt-to-pdf': {
    title: 'TXT to PDF Converter',
    desc: 'Convert plain text files (.txt) into structured PDF documents.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">How does it handle text spacing and fonts?</div>
        <div class="faq-answer">We render text with a standard monospace layout and preserve all tabs, indentations, and newline breaks.</div>
      </div>
    `,
    related: ['txt-to-word', 'word-to-pdf', 'pdf-to-word']
  },
  'txt-to-word': {
    title: 'TXT to Word Converter',
    desc: 'Convert plain text files (.txt) into editable Microsoft Word DOCX documents.',
    faq: `
      <div class="faq-item">
        <div class="faq-question">Will spacing be preserved?</div>
        <div class="faq-answer">Yes! Each line break in your text file will be translated into a paragraph inside the Word document.</div>
      </div>
    `,
    related: ['txt-to-pdf', 'word-to-pdf', 'pdf-to-word']
  }
};

// Serve tool pages dynamically with SEO replacements
const tools = Object.keys(CONVERTER_CONFIGS);
tools.forEach(tool => {
  app.get(`/${tool}`, (req, res) => {
    const config = CONVERTER_CONFIGS[tool];
    const metadata = TOOL_METADATA[tool];
    
    if (!config || !metadata) {
      return res.status(404).send('Page not found');
    }

    try {
      const templatePath = path.join(__dirname, '../views/converter-template.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf8');

      // Replace placeholders
      htmlContent = htmlContent.replace(/{{PAGE_TITLE}}/g, metadata.title);
      htmlContent = htmlContent.replace(/{{TOOL_TITLE}}/g, metadata.title);
      htmlContent = htmlContent.replace(/{{TOOL_DESC}}/g, metadata.desc);
      
      const formats = config.allowedExtensions.join(', ').toUpperCase().replace(/\./g, '');
      htmlContent = htmlContent.replace(/{{SUPPORTED_FORMATS}}/g, formats);
      htmlContent = htmlContent.replace(/{{FILE_ACCEPT}}/g, config.allowedExtensions.join(','));
      
      const isMulti = config.maxSize > 0 && tool.includes('-pdf') && (tool.startsWith('jpg') || tool.startsWith('png'));
      htmlContent = htmlContent.replace(/{{INPUT_MULTIPLE}}/g, isMulti ? 'multiple' : '');
      htmlContent = htmlContent.replace(/{{TOOL_FAQ}}/g, metadata.faq);

      // Render Related Tools
      let relatedHtml = '';
      metadata.related.forEach(relKey => {
        const relMeta = TOOL_METADATA[relKey];
        if (relMeta) {
          relatedHtml += `
            <div class="tool-card" style="padding: 20px;">
              <h4 style="font-size: 1.1rem; margin-bottom: 6px;">${relMeta.title}</h4>
              <p style="font-size: 0.85rem; margin-bottom: 16px; color: var(--text-secondary);">${relMeta.desc}</p>
              <a href="/${relKey}" class="btn btn-secondary" style="font-size: 0.85rem; padding: 8px 16px;">Use Tool</a>
            </div>
          `;
        }
      });
      htmlContent = htmlContent.replace(/{{RELATED_TOOLS}}/g, relatedHtml);

      res.send(htmlContent);
    } catch (err) {
      console.error('Error rendering template:', err);
      res.status(500).send('Server Error');
    }
  });
});


// ----------------------------------------------------
// API Endpoints
// ----------------------------------------------------

// 1. General Upload (for single files)
app.post('/api/upload/:toolType', upload.single('file'), (req, res, next) => {
  const tool = req.params.toolType;
  fileValidator(tool)(req, res, next);
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size
    }
  });
});

// Helper for validating tool types inside request paths
function getToolType(req) {
  return req.params.toolType || '';
}

// 2. Multiple File Upload (for image converters)
app.post('/api/upload-multiple/:toolType', upload.array('files', 50), (req, res, next) => {
  const tool = req.params.toolType;
  fileValidator(tool)(req, res, next);
}, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }
  const uploadedFiles = req.files.map(file => ({
    filename: file.filename,
    originalname: file.originalname,
    size: file.size
  }));
  res.json({
    success: true,
    files: uploadedFiles
  });
});

// 4. Advanced Image list to PDF (Supports custom reordering and rotation)
app.post('/api/convert/images-to-pdf', async (req, res) => {
  const { images, outputFilename } = req.body;  // images: [{ filename, rotation }]
  
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided for PDF conversion.' });
  }

  const fileId = uuidv4();
  const pdfFilename = `${fileId}.pdf`;
  const outputPath = path.join(DOWNLOADS_DIR, pdfFilename);

  try {
    console.log(`[Server] Generating PDF from ${images.length} images...`);
    const pdfDoc = await PDFDocument.create();

    for (const imgSpec of images) {
      const imgPath = path.join(UPLOADS_DIR, imgSpec.filename);
      if (!fs.existsSync(imgPath)) continue;

      let processedImgBuffer = fs.readFileSync(imgPath);
      
      // Handle image rotation and preprocessing via sharp if specified
      if (imgSpec.rotation && imgSpec.rotation !== 0) {
        processedImgBuffer = await sharp(imgPath)
          .rotate(imgSpec.rotation)
          .toBuffer();
      }

      // Embed image into pdf
      let embeddedImage;
      const ext = path.extname(imgSpec.filename).toLowerCase();
      
      if (ext === '.png') {
        embeddedImage = await pdfDoc.embedPng(processedImgBuffer);
      } else {
        embeddedImage = await pdfDoc.embedJpg(processedImgBuffer);
      }

      // Create page with matching size
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height
      });

      // Cleanup source image immediately
      try {
        fs.unlinkSync(imgPath);
      } catch (err) {
        console.error('[Clean Image] Failed to delete:', err);
      }
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    const clientFilename = outputFilename || 'converted_images.pdf';
    res.json({
      success: true,
      downloadUrl: `/api/download/${pdfFilename}?name=${encodeURIComponent(clientFilename)}`,
      filename: pdfFilename,
      size: pdfBytes.length
    });

  } catch (error) {
    console.error('[Images -> PDF Error]', error);
    res.status(500).json({ error: 'Failed to compile images into PDF. Please try again.' });
  }
});

// 5. PDF to Images endpoint (returns individual image paths)
app.post('/api/convert/pdf-to-images/:format', async (req, res) => {
  const format = req.params.format.toLowerCase(); // 'jpg' or 'png'
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'Filename is required.' });
  }

  const inputPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    return res.status(400).json({ error: 'Uploaded file not found.' });
  }

  const fileId = uuidv4();
  const outputDir = path.join(DOWNLOADS_DIR, fileId);

  try {
    console.log(`[Server] Converting PDF ${filename} to ${format} images...`);
    const resultStr = await runPythonScript('pdf_to_images.py', [inputPath, outputDir, format]);
    const result = JSON.parse(resultStr);

    if (result.success) {
      // Map generated images to download URLs
      const imagesWithUrls = result.images.map(imgName => ({
        name: imgName,
        url: `/api/download/${fileId}/${imgName}`
      }));
      
      res.json({
        success: true,
        images: imagesWithUrls
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to extract images.' });
    }
  } catch (err) {
    console.error('[PDF to Images Error]', err);
    res.status(500).json({ error: 'An error occurred while converting PDF to images.' });
  } finally {
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (err) {}
  }
});

// 3. Document/Image Conversion Route
app.post('/api/convert/:toolType', async (req, res) => {
  const toolType = req.params.toolType;
  const { filename, originalname } = req.body;
  
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required for conversion.' });
  }

  const inputPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    return res.status(400).json({ error: 'Uploaded file not found on the server. Please try again.' });
  }

  const fileId = uuidv4();
  const extMap = {
    'word-to-pdf': '.pdf',
    'pdf-to-word': '.docx',
    'ppt-to-pdf': '.pdf',
    'pdf-to-ppt': '.pptx',
    'webp-to-jpg': '.jpg',
    'jpg-to-png': '.png',
    'png-to-jpg': '.jpg',
    'txt-to-pdf': '.pdf',
    'txt-to-word': '.docx'
  };

  const outputExt = extMap[toolType];
  if (!outputExt) {
    return res.status(400).json({ error: 'Invalid tool type.' });
  }

  const outputFilename = `${fileId}${outputExt}`;
  const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

  try {
    console.log(`[Server] Starting conversion: ${toolType} for ${filename}`);

    if (toolType === 'word-to-pdf') {
      const origExt = path.extname(originalname).toLowerCase();
      if (origExt === '.doc') {
        // Legacy doc -> pdf via doc_converter python script
        await runPythonScript('doc_converter.py', ['doc2pdf', inputPath, outputPath]);
      } else {
        // High fidelity Docx -> HTML (Mammoth) -> PDF (Puppeteer)
        const result = await mammoth.convertToHtml({ path: inputPath });
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: 'Times New Roman', Times, serif, Arial, sans-serif;
                line-height: 1.5;
                padding: 1in;
                background-color: #ffffff;
                color: #000000;
              }
              p { margin-bottom: 1em; }
              table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 1em;
              }
              table, th, td {
                border: 1px solid #000000;
              }
              th, td {
                padding: 8px;
                text-align: left;
              }
              img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 1em auto;
              }
            </style>
          </head>
          <body>
            ${result.value}
          </body>
          </html>
        `;
        
        const browser = await launchPuppeteer();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({
          path: outputPath,
          format: 'A4',
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
          printBackground: true
        });
        await browser.close();
      }
    } 
    
    else if (toolType === 'pdf-to-word') {
      await runPythonScript('pdf_to_docx.py', [inputPath, outputPath]);
    } 
    
    else if (toolType === 'ppt-to-pdf') {
      const origExt = path.extname(originalname).toLowerCase();
      if (origExt === '.ppt') {
        // Legacy ppt -> pdf via doc_converter
        await runPythonScript('doc_converter.py', ['ppt2pdf', inputPath, outputPath]);
      } else {
        // PPTX -> Positioned HTML -> PDF (Puppeteer)
        const assetsDirName = `${fileId}_assets`;
        const assetsDir = path.join(DOWNLOADS_DIR, assetsDirName);
        const tempHtmlPath = path.join(DOWNLOADS_DIR, `${fileId}.html`);
        
        // 1. Run PPTX parser python script to extract HTML/Images
        await runPythonScript('pptx_to_html.py', [inputPath, tempHtmlPath, assetsDir]);
        
        // 2. Puppeteer loads the local HTML file and prints to PDF
        const browser = await launchPuppeteer();
        const page = await browser.newPage();
        const fileUrl = url.pathToFileURL(tempHtmlPath).href;
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });
        
        const slideSize = await page.evaluate(() => {
          const el = document.querySelector('.slide');
          if (el) {
            const style = window.getComputedStyle(el);
            return { width: style.width, height: style.height };
          }
          return { width: '10in', height: '5.625in' };
        });
        
        await page.pdf({
          path: outputPath,
          width: slideSize.width,
          height: slideSize.height,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          printBackground: true,
          preferCSSPageSize: true
        });
        await browser.close();
        
        // Clean up temporary HTML and slide asset directories
        try {
          fs.unlinkSync(tempHtmlPath);
          fs.rmSync(assetsDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error('[Conversion Cleanup] Failed to delete temp pptx artifacts:', cleanupErr);
        }
      }
    } 
    
    else if (toolType === 'pdf-to-ppt') {
      await runPythonScript('pdf_to_pptx.py', [inputPath, outputPath]);
    } 
    
    else if (toolType === 'webp-to-jpg' || toolType === 'png-to-jpg') {
      await sharp(inputPath).jpeg({ quality: 90 }).toFile(outputPath);
    } 
    
    else if (toolType === 'jpg-to-png') {
      await sharp(inputPath).png().toFile(outputPath);
    } 
    
    else if (toolType === 'txt-to-pdf') {
      const txtContent = fs.readFileSync(inputPath, 'utf8');
      const escapedText = txtContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              white-space: pre-wrap;
              font-size: 11pt;
              line-height: 1.4;
              padding: 1.2in;
              background-color: #ffffff;
            }
          </style>
        </head>
        <body>${escapedText}</body>
        </html>
      `;
      
      const browser = await launchPuppeteer();
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true
      });
      await browser.close();
    } 
    
    else if (toolType === 'txt-to-word') {
      await runPythonScript('txt_to_docx.py', [inputPath, outputPath]);
    }

    // Success response
    const downloadOriginalName = path.basename(originalname, path.extname(originalname)) + outputExt;
    res.json({
      success: true,
      downloadUrl: `/api/download/${outputFilename}?name=${encodeURIComponent(downloadOriginalName)}`,
      filename: outputFilename,
      size: fs.statSync(outputPath).size
    });

  } catch (error) {
    console.error(`[Conversion Error] ${toolType} failed:`, error);
    res.status(500).json({ error: error.message || 'An error occurred during file conversion. Please verify the file structure and try again.' });
  } finally {
    // Delete the original uploaded file from /uploads immediately after conversion to preserve storage
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (err) {
      console.error('[Clean Uploads] Failed to delete file:', err);
    }
  }
});

// Specific conversion endpoints moved above general route

// 6. Serve individual extracted image files
app.get('/api/download/:dirId/:filename', (req, res) => {
  const { dirId, filename } = req.params;
  const filePath = path.join(DOWNLOADS_DIR, dirId, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  res.download(filePath, filename, (err) => {
    if (!err) {
      try {
        fs.unlinkSync(filePath);
        // Clean up the parent directory if empty
        const dirPath = path.join(DOWNLOADS_DIR, dirId);
        if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
          fs.rmdirSync(dirPath);
        }
      } catch (unlinkErr) {
        console.error('[Clean Image Download] Failed to delete:', unlinkErr);
      }
    }
  });
});

// 7. General download route for completed files
app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  const clientName = req.query.name || filename;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('The requested file is expired or does not exist.');
  }

  res.download(filePath, clientName, (err) => {
    if (!err) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[Server] Cleaned up completed download file: ${filename}`);
      } catch (unlinkErr) {
        console.error('[Clean Complete Download] Failed to delete:', unlinkErr);
      }
    }
  });
});

// Start cleanup background service: Runs every 5 minutes when running standalone
if (require.main === module) {
  setInterval(cleanTempFiles, 5 * 60 * 1000);
  cleanTempFiles();

  app.listen(PORT, () => {
    console.log(`[Server] CrevoDoc Converter is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
