// Configuration for client-side validation (matches backend)
const CLIENT_CONFIGS = {
  'word-to-pdf': { exts: ['.doc', '.docx'], label: 'DOC, DOCX', maxMB: 50, multi: false, outLabel: 'PDF' },
  'pdf-to-word': { exts: ['.pdf'], label: 'PDF', maxMB: 50, multi: false, outLabel: 'Word Document' },
  'ppt-to-pdf': { exts: ['.ppt', '.pptx'], label: 'PPT, PPTX', maxMB: 50, multi: false, outLabel: 'PDF' },
  'pdf-to-ppt': { exts: ['.pdf'], label: 'PDF', maxMB: 50, multi: false, outLabel: 'PowerPoint' },
  'jpg-to-pdf': { exts: ['.jpg', '.jpeg'], label: 'JPG, JPEG', maxMB: 20, multi: true, outLabel: 'PDF' },
  'png-to-pdf': { exts: ['.png'], label: 'PNG', maxMB: 20, multi: true, outLabel: 'PDF' },
  'webp-to-jpg': { exts: ['.webp'], label: 'WEBP', maxMB: 20, multi: false, outLabel: 'JPG' },
  'jpg-to-png': { exts: ['.jpg', '.jpeg'], label: 'JPG, JPEG', maxMB: 20, multi: false, outLabel: 'PNG' },
  'png-to-jpg': { exts: ['.png'], label: 'PNG', maxMB: 20, multi: false, outLabel: 'JPG' },
  'pdf-to-jpg': { exts: ['.pdf'], label: 'PDF', maxMB: 50, multi: false, outLabel: 'JPG Pages', isPdfToImg: true, imgFormat: 'jpg' },
  'pdf-to-png': { exts: ['.pdf'], label: 'PDF', maxMB: 50, multi: false, outLabel: 'PNG Pages', isPdfToImg: true, imgFormat: 'png' },
  'txt-to-pdf': { exts: ['.txt'], label: 'TXT', maxMB: 10, multi: false, outLabel: 'PDF' },
  'txt-to-word': { exts: ['.txt'], label: 'TXT', maxMB: 10, multi: false, outLabel: 'Word Document' }
};

// Global state for converter
let currentToolId = '';
let toolConfig = null;
let uploadedFilesList = []; // Stores { filename, originalname, size, rotation: 0 }

document.addEventListener('DOMContentLoaded', () => {
  // Extract tool name from path
  const path = window.location.pathname.replace(/^\//, '');
  currentToolId = path;
  toolConfig = CLIENT_CONFIGS[currentToolId];

  if (!toolConfig) {
    console.error('Invalid tool route loaded: ', path);
    return;
  }

  // Setup elements in detail pages dynamically
  initConverterUI();
});

function initConverterUI() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');

  if (!uploadArea || !fileInput) return;

  // Set drag-and-drop listeners
  uploadArea.addEventListener('click', () => fileInput.click());
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files);
    }
  });
}

// Client-side Validation
function validateSelectedFile(file) {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!toolConfig.exts.includes(ext)) {
    showError(`Unsupported file format. Please upload files with the extension: ${toolConfig.exts.join(', ').toUpperCase()}`);
    return false;
  }

  const maxBytes = toolConfig.maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    showError(`File size exceeds the allowed limit of ${toolConfig.maxMB}MB.`);
    return false;
  }

  if (file.size === 0) {
    showError('This file appears to be empty or corrupted.');
    return false;
  }

  return true;
}

// Handle File Select
async function handleFileSelection(files) {
  // Clear any existing panels
  hidePanels();

  const validFiles = [];
  
  if (toolConfig.multi) {
    for (let file of files) {
      if (validateSelectedFile(file)) {
        validFiles.push(file);
      }
    }
  } else {
    // Single file limit
    const file = files[0];
    if (validateSelectedFile(file)) {
      validFiles.push(file);
    }
  }

  if (validFiles.length === 0) return;

  // Process uploads
  if (toolConfig.multi) {
    await uploadMultipleFiles(validFiles);
  } else {
    await uploadSingleFile(validFiles[0]);
  }
}

// Upload Single File to Server
function uploadSingleFile(file) {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload/${currentToolId}`, true);

    // Progress Bar
    showProgress('Uploading file...', 0);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        updateProgress('Uploading file...', percent * 0.9); // reserve 10% for server completion check
      }
    });

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          uploadedFilesList = [{
            filename: response.file.filename,
            originalname: response.file.originalname,
            size: response.file.size,
            rotation: 0
          }];
          updateProgress('Upload Complete ✓', 100);
          setTimeout(() => {
            hideProgress();
            renderFileListPanel();
          }, 300);
        } else {
          showError(response.error || 'Failed to upload file.');
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          showError(res.error || `Server upload failed (${xhr.status}).`);
        } catch {
          if (xhr.status === 404) {
            showError('API endpoint not found (404). Please ensure backend API routes are configured.');
          } else if (xhr.status >= 500) {
            showError(`Server error (${xhr.status}). Please check server logs.`);
          } else {
            showError('We couldn\'t connect to the server. Please try again.');
          }
        }
      }
      resolve();
    };

    xhr.onerror = () => {
      showError('Network error during upload.');
      resolve();
    };

    xhr.send(formData);
  });
}

// Upload Multiple Files
function uploadMultipleFiles(files) {
  return new Promise((resolve) => {
    const formData = new FormData();
    for (let file of files) {
      formData.append('files', file);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload-multiple/${currentToolId}`, true);

    showProgress('Uploading files...', 0);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        updateProgress('Uploading files...', percent * 0.9);
      }
    });

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          // Append or replace files
          const newFiles = response.files.map(f => ({
            filename: f.filename,
            originalname: f.originalname,
            size: f.size,
            rotation: 0
          }));
          uploadedFilesList = [...uploadedFilesList, ...newFiles];
          updateProgress('Upload Complete ✓', 100);
          setTimeout(() => {
            hideProgress();
            renderImageReorderGrid();
          }, 300);
        } else {
          showError(response.error || 'Multiple files upload failed.');
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          showError(res.error || `Server upload failed (${xhr.status}).`);
        } catch {
          if (xhr.status === 404) {
            showError('API endpoint not found (404). Please ensure backend API routes are configured.');
          } else if (xhr.status >= 500) {
            showError(`Server error (${xhr.status}). Please check server logs.`);
          } else {
            showError('We couldn\'t upload your files.');
          }
        }
      }
      resolve();
    };

    xhr.onerror = () => {
      showError('Network error during upload.');
      resolve();
    };

    xhr.send(formData);
  });
}

// Render uploaded file list panel (for single files)
function renderFileListPanel() {
  const listPanel = document.getElementById('file-list-panel');
  const actionArea = document.getElementById('action-area');
  
  if (!listPanel || !actionArea || uploadedFilesList.length === 0) return;

  const file = uploadedFilesList[0];
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  
  listPanel.innerHTML = `
    <div class="file-item">
      <div class="file-info">
        <span class="file-icon">📄</span>
        <div class="file-meta">
          <div class="file-name" title="${escapeHtml(file.originalname)}">${escapeHtml(file.originalname)}</div>
          <div class="file-size">${sizeMB} MB</div>
        </div>
      </div>
      <button class="remove-file-btn" onclick="clearSelectedFiles()" title="Remove file">✕</button>
    </div>
  `;
  listPanel.style.display = 'block';

  actionArea.innerHTML = `
    <button class="btn btn-primary" onclick="startConversion()">Convert to ${toolConfig.outLabel}</button>
  `;
  actionArea.style.display = 'flex';
  
  document.getElementById('upload-area').style.display = 'none';
}

// Render multi-images sorting and rotation gallery
function renderImageReorderGrid() {
  const grid = document.getElementById('images-reorder-grid');
  const actionArea = document.getElementById('action-area');
  
  if (!grid || !actionArea || uploadedFilesList.length === 0) return;

  grid.innerHTML = '';
  uploadedFilesList.forEach((file, idx) => {
    const card = document.createElement('div');
    card.className = 'image-card-wrapper';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-index', idx);

    // Setup drag & drop sorting listeners
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);

    card.innerHTML = `
      <div class="image-thumbnail-container">
        <img src="/assets/logo.png" class="image-thumbnail" style="transform: rotate(${file.rotation}deg); opacity: 0.6;" />
        <span style="position:absolute; bottom:4px; left:4px; font-size:10px; padding:2px 4px; background:rgba(0,0,0,0.6); color:white; border-radius:2px;">#${idx+1}</span>
      </div>
      <div style="font-size: 11px; font-weight:600; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center;" title="${escapeHtml(file.originalname)}">
        ${escapeHtml(file.originalname)}
      </div>
      <div class="image-actions">
        <button class="image-btn" onclick="rotateImage(${idx})" title="Rotate 90°">🔄</button>
        <button class="image-btn delete" onclick="removeImage(${idx})" title="Remove">🗑️</button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.style.display = 'grid';

  // Add layout action controls
  actionArea.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; width:100%; align-items:center;">
      <div style="display:flex; gap:16px;">
        <button class="btn btn-secondary" onclick="document.getElementById('file-input').click()">+ Add More Images</button>
        <button class="btn btn-primary" onclick="startImageConversion()">Convert to PDF</button>
      </div>
      <p style="font-size:12px; color:var(--text-secondary);">Tip: Drag thumbnails to reorder pages</p>
    </div>
  `;
  actionArea.style.display = 'flex';
  
  document.getElementById('upload-area').style.display = 'none';
}

// Drag & Drop HTML5 Reordering
let dragSourceEl = null;

function handleDragStart(e) {
  this.classList.add('dragging');
  dragSourceEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.getAttribute('data-index'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  e.preventDefault();
  const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
  const targetIdx = parseInt(this.getAttribute('data-index'));

  if (sourceIdx !== targetIdx) {
    // Reorder array
    const movedItem = uploadedFilesList.splice(sourceIdx, 1)[0];
    uploadedFilesList.splice(targetIdx, 0, movedItem);
    renderImageReorderGrid();
  }
}

function handleDragEnd() {
  this.classList.remove('dragging');
}

// Rotate Image Card
function rotateImage(idx) {
  uploadedFilesList[idx].rotation = (uploadedFilesList[idx].rotation + 90) % 360;
  renderImageReorderGrid();
}

// Remove Image Card
function removeImage(idx) {
  uploadedFilesList.splice(idx, 1);
  if (uploadedFilesList.length === 0) {
    clearSelectedFiles();
  } else {
    renderImageReorderGrid();
  }
}

// Start Standard Single File Conversion
async function startConversion() {
  const file = uploadedFilesList[0];
  hidePanels();
  showProgress('Converting... 0%', 0);

  // Simulate progress bar movement during processing
  let progress = 0;
  const progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 8) + 2;
      updateProgress(`Converting... ${progress}%`, progress);
    }
  }, 300);

  try {
    const res = await fetch(`/api/convert/${currentToolId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: file.filename,
        originalname: file.originalname
      })
    });

    clearInterval(progressInterval);

    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        updateProgress('Conversion Complete ✓', 100);
        setTimeout(() => {
          hideProgress();
          
          if (toolConfig.isPdfToImg) {
            // PDF to JPEG/PNG requires page images presentation
            startPdfToImagesExtraction(file);
          } else {
            showResult(file.originalname, result.downloadUrl, result.size);
          }
        }, 300);
      } else {
        showError(result.error || 'Conversion process failed.');
      }
    } else {
      try {
        const err = await res.json();
        showError(err.error || 'Conversion failed. Please verify files are correct.');
      } catch {
        showError(`Server error (${res.status}). Conversion failed.`);
      }
    }
  } catch (err) {
    clearInterval(progressInterval);
    showError('Could not process conversion due to a connection drop.');
  }
}

// Start Multiple Image Conversion
async function startImageConversion() {
  hidePanels();
  showProgress('Compiling Images to PDF... 0%', 0);

  let progress = 0;
  const progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 10) + 1;
      updateProgress(`Compiling Images... ${progress}%`, progress);
    }
  }, 250);

  try {
    const res = await fetch('/api/convert/images-to-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: uploadedFilesList.map(f => ({ filename: f.filename, rotation: f.rotation })),
        outputFilename: 'converted_images.pdf'
      })
    });

    clearInterval(progressInterval);

    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        updateProgress('Conversion Complete ✓', 100);
        setTimeout(() => {
          hideProgress();
          showResult('Images PDF', result.downloadUrl, result.size);
        }, 300);
      } else {
        showError(result.error || 'Failed to merge images.');
      }
    } else {
      const err = await res.json();
      showError(err.error || 'Merging images failed.');
    }
  } catch {
    clearInterval(progressInterval);
    showError('Network error while merging images.');
  }
}

// Handle PDF to Images extraction response display
async function startPdfToImagesExtraction(file) {
  showProgress('Extracting PDF pages as images...', 0);
  
  let progress = 0;
  const progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += 5;
      updateProgress(`Extracting pages... ${progress}%`, progress);
    }
  }, 200);

  try {
    const res = await fetch(`/api/convert/pdf-to-images/${toolConfig.imgFormat}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: file.filename
      })
    });

    clearInterval(progressInterval);

    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        updateProgress('Extraction Complete ✓', 100);
        setTimeout(() => {
          hideProgress();
          showPdfPagesResult(file.originalname, result.images);
        }, 300);
      } else {
        showError(result.error || 'Failed to extract images.');
      }
    } else {
      const err = await res.json();
      showError(err.error || 'Failed to extract pages.');
    }
  } catch {
    clearInterval(progressInterval);
    showError('Network connection failed.');
  }
}

// Reset workspace
function clearSelectedFiles() {
  uploadedFilesList = [];
  hidePanels();
  
  document.getElementById('upload-area').style.display = 'block';
  document.getElementById('file-input').value = '';
}

// Show Panels helpers
function showProgress(label, percent) {
  const panel = document.getElementById('progress-panel');
  if (!panel) return;
  panel.style.display = 'block';
  updateProgress(label, percent);
}

function updateProgress(label, percent) {
  const txt = document.getElementById('progress-text');
  const bar = document.getElementById('progress-bar');
  if (txt) txt.innerText = label;
  if (bar) bar.style.width = `${percent}%`;
}

function hideProgress() {
  const panel = document.getElementById('progress-panel');
  if (panel) panel.style.display = 'none';
}

function showResult(origName, url, sizeBytes) {
  const panel = document.getElementById('result-panel');
  if (!panel) return;

  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
  const outExt = url.substring(url.lastIndexOf('.'));
  const convertedName = origName.substring(0, origName.lastIndexOf('.')) + outExt;

  panel.innerHTML = `
    <div class="result-header">
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Conversion Complete ✓
    </div>
    <div class="result-meta-card">
      <div class="file-icon">🎁</div>
      <div>
        <div style="font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">${escapeHtml(convertedName)}</div>
        <div style="font-size:12px; color:var(--text-secondary);">${sizeMB} MB &bull; ${toolConfig.outLabel}</div>
      </div>
    </div>
    <div class="result-actions">
      <a href="${url}" download="${escapeHtml(convertedName)}" class="btn btn-primary" style="width: 250px;">Download File</a>
      <button class="btn btn-secondary" onclick="clearSelectedFiles()" style="width: 250px;">Convert Another File</button>
    </div>
  `;
  panel.style.display = 'block';
}

// Custom page render for multiple pages PDF image extraction
function showPdfPagesResult(origName, imagesList) {
  const panel = document.getElementById('result-panel');
  if (!panel) return;

  let listHtml = '';
  imagesList.forEach(img => {
    listHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-primary); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; margin-bottom:8px;">
        <span style="font-size:13px; font-weight:600;">${escapeHtml(img.name)}</span>
        <a href="${img.url}" download="${escapeHtml(img.name)}" class="btn btn-secondary" style="padding:6px 12px; font-size:12px;">Download Page</a>
      </div>
    `;
  });

  panel.innerHTML = `
    <div class="result-header">
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Extracted ${imagesList.length} Pages Successfully ✓
    </div>
    <div style="text-align:left; max-width:400px; margin: 0 auto 20px; max-height:220px; overflow-y:auto; padding-right:4px;">
      ${listHtml}
    </div>
    <div class="result-actions">
      <button class="btn btn-primary" onclick="clearSelectedFiles()" style="width: 250px;">Convert Another File</button>
    </div>
  `;
  panel.style.display = 'block';
}

function showError(msg) {
  const panel = document.getElementById('error-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="error-header">Something went wrong</div>
    <p class="error-msg">${escapeHtml(msg)}</p>
    <div style="display:flex; justify-content:center; gap:12px;">
      <button class="btn btn-danger" onclick="clearSelectedFiles()">Choose Another File</button>
    </div>
  `;
  panel.style.display = 'block';
}

function hidePanels() {
  const panels = ['file-list-panel', 'images-reorder-grid', 'progress-panel', 'result-panel', 'error-panel', 'action-area'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
