document.addEventListener('DOMContentLoaded', () => {
    // Read user data from data attributes
    const userDataEl = document.getElementById('userData');
    const userData = {
        role: userDataEl ? userDataEl.getAttribute('data-role') : null,
        username: userDataEl ? userDataEl.getAttribute('data-username') : null
    };
    window.userData = userData;

    const uploadForm = document.getElementById('uploadForm');
    const messageDiv = document.getElementById('message');
    const facilitiesList = document.getElementById('facilitiesList');
    const facilityNameSelect = document.getElementById('facility_name');
    const facilityCodeInput = document.getElementById('facility_code');
    const resumableFacilityNameSelect = document.getElementById('resumable_facility_name');
    const resumableFacilityCodeInput = document.getElementById('resumable_facility_code');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const isAdmin = userData && userData.role === 'admin';

    // Load facility list from database
    async function loadFacilityList() {
        try {
            const response = await fetch('/api/facilities/facility-list');
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                // Clear and reload traditional form dropdown
                facilityNameSelect.innerHTML = '<option value="">-- Select a Facility --</option>';
                // Clear and reload resumable form dropdown
                resumableFacilityNameSelect.innerHTML = '<option value="">-- Select a Facility --</option>';
                
                data.data.forEach(facility => {
                    // Add to traditional form
                    const option1 = document.createElement('option');
                    option1.value = facility.facility_name;
                    option1.setAttribute('data-code', facility.facility_code);
                    option1.textContent = facility.facility_name;
                    facilityNameSelect.appendChild(option1);

                    // Add to resumable form
                    const option2 = document.createElement('option');
                    option2.value = facility.facility_name;
                    option2.setAttribute('data-code', facility.facility_code);
                    option2.textContent = facility.facility_name;
                    resumableFacilityNameSelect.appendChild(option2);
                });
            }
        } catch (error) {
            console.error('Error loading facility list:', error);
            facilityNameSelect.innerHTML = '<option value="">Error loading facilities</option>';
            resumableFacilityNameSelect.innerHTML = '<option value="">Error loading facilities</option>';
        }
    }

    // Handle facility name change to auto-populate facility code (traditional form)
    facilityNameSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const facilityCode = selectedOption.getAttribute('data-code');
        facilityCodeInput.value = facilityCode || '';
    });

    // Handle facility name change to auto-populate facility code (resumable form)
    resumableFacilityNameSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const facilityCode = selectedOption.getAttribute('data-code');
        resumableFacilityCodeInput.value = facilityCode || '';
    });

    // Handle form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(uploadForm);
        const fileInput = document.getElementById('file');
        const uploadProgressDiv = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressSize = document.getElementById('progressSize');

        // Show progress bar only if file is selected
        if (fileInput.files.length > 0) {
            uploadProgressDiv.style.display = 'block';
            progressFill.style.width = '0%';
            progressPercent.textContent = '0%';
            progressSize.textContent = '';
        }

        try {
            const xhr = new XMLHttpRequest();
            
            // Get CSRF token from form
            const csrfToken = document.querySelector('input[name="_csrf"]').value;

            // Handle upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    const sizeMB = (e.total / (1024 * 1024)).toFixed(2);
                    const loadedMB = (e.loaded / (1024 * 1024)).toFixed(2);
                    
                    progressFill.style.width = percentComplete + '%';
                    progressPercent.textContent = percentComplete + '%';
                    progressSize.textContent = `${loadedMB}MB / ${sizeMB}MB`;
                }
            });

            // Handle completion
            xhr.addEventListener('load', () => {
                uploadProgressDiv.style.display = 'none';
                
                if (xhr.status === 201 || xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    showMessage(data.message, 'success');
                    uploadForm.reset();
                    facilityCodeInput.value = '';
                    loadFacilities();
                } else {
                    const data = JSON.parse(xhr.responseText);
                    showMessage(data.message || 'Upload failed', 'error');
                }
            });

            // Handle error
            xhr.addEventListener('error', () => {
                uploadProgressDiv.style.display = 'none';
                showMessage('Upload failed - network error', 'error');
            });

            xhr.addEventListener('abort', () => {
                uploadProgressDiv.style.display = 'none';
                showMessage('Upload cancelled', 'error');
            });

            xhr.open('POST', '/api/facilities/upload', true);
            // Add CSRF token as header for multipart/form-data
            xhr.setRequestHeader('csrf-token', csrfToken);
            xhr.send(formData);
        } catch (error) {
            uploadProgressDiv.style.display = 'none';
            showMessage('Error: ' + error.message, 'error');
        }
    });

    // Load and display facilities
    async function loadFacilities() {
        try {
            const response = await fetch('/api/facilities/list');
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                facilitiesList.innerHTML = data.data.map(facility => `
                    <div class="facility-card">
                        <h3>${escapeHtml(facility.facility_name)}</h3>
                        <div class="facility-info">
                            <strong>Code:</strong> ${escapeHtml(facility.facility_code)}
                        </div>
                        ${facility.description ? `
                            <div class="facility-info">
                                <strong>Description:</strong> ${escapeHtml(facility.description)}
                            </div>
                        ` : ''}
                        <div class="facility-info">
                            <strong>Uploaded:</strong> ${new Date(facility.uploaded_at).toLocaleDateString()}
                        </div>
                        ${facility.file_path ? `
                            <div class="facility-info">
                                <strong>File:</strong> ${escapeHtml(getFileName(facility.file_path))}
                            </div>
                        ` : ''}
                        <div class="facility-actions">
                            ${isAdmin ? `
                                ${facility.file_path ? `
                                    <button class="btn-restore" data-action="restore" data-facility-id="${facility.id}">Restore Dump</button>
                                    <button class="btn-download" data-action="download" data-facility-id="${facility.id}">Download</button>
                                ` : ''}
                                <button class="btn-delete" data-action="delete" data-facility-id="${facility.id}">Delete</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
                
                // Attach event listeners to facility action buttons
                attachFacilityButtonListeners();
            } else {
                facilitiesList.innerHTML = '<div class="empty-state">No facilities uploaded yet</div>';
            }
        } catch (error) {
            facilitiesList.innerHTML = '<div class="empty-state">Error loading facilities</div>';
        }
    }

    // Attach event listeners to facility action buttons
    function attachFacilityButtonListeners() {
        // Restore dump buttons
        document.querySelectorAll('button[data-action="restore"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const facilityId = e.target.getAttribute('data-facility-id');
                restoreDump(facilityId);
            });
        });
        
        // Download buttons
        document.querySelectorAll('button[data-action="download"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const facilityId = e.target.getAttribute('data-facility-id');
                downloadDatabase(facilityId);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('button[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const facilityId = e.target.getAttribute('data-facility-id');
                deleteFacility(facilityId);
            });
        });
    }

    // Show message
    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 5000);
    }

    // Delete facility
    function deleteFacility(id) {
        if (confirm('Are you sure you want to delete this facility?')) {
            (async () => {
                try {
                    const csrfToken = document.querySelector('input[name="_csrf"]').value;
                    const response = await fetch(`/api/facilities/${id}`, {
                        method: 'DELETE',
                        headers: { 'csrf-token': csrfToken }
                    });

                    const data = await response.json();

                    if (response.ok) {
                        showMessage(data.message, 'success');
                        loadFacilities();
                    } else {
                        showMessage(data.message || 'Delete failed', 'error');
                    }
                } catch (error) {
                    showMessage('Error: ' + error.message, 'error');
                }
            })();
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get filename from full path
    function getFileName(filePath) {
        return filePath.split('\\').pop().split('/').pop();
    }

    // Restore PostgreSQL dump (admin only)
    function restoreDump(id) {
        if (confirm('View database dump details. Continue?')) {
            (async () => {
                try {
                    const csrfToken = document.querySelector('input[name="_csrf"]').value;
                    const response = await fetch(`/api/facilities/${id}/restore-dump`, {
                        method: 'POST',
                        headers: { 'csrf-token': csrfToken }
                    });

                    const data = await response.json();

                    if (response.ok && data.data && data.data.metadata) {
                        const metadata = data.data.metadata;
                        const tableList = metadata.tables && metadata.tables.length > 0 
                            ? metadata.tables.join(', ') 
                            : 'No tables found';
                        const dumpDate = metadata.dumpDate || 'Unknown';
                        const version = metadata.version || 'Unknown';
                        
                        const message = `Database Info - Version: ${version}, Dump Date: ${dumpDate}, Tables (${metadata.tables.length}): ${tableList}`;
                        showMessage(message, 'success');
                    } else {
                        showMessage(data.message || 'Failed to validate database dump', 'error');
                    }
                } catch (error) {
                    showMessage('Error: ' + error.message, 'error');
                }
            })();
        }
    }

    // Download database file (admin only)
    function downloadDatabase(id) {
        try {
            const downloadProgressDiv = document.getElementById('downloadProgress');
            const downloadFill = document.getElementById('downloadFill');
            const downloadPercent = document.getElementById('downloadPercent');
            const downloadSize = document.getElementById('downloadSize');
            const downloadSpeed = document.getElementById('downloadSpeed');
            const downloadFileName = document.getElementById('downloadFileName');

            downloadProgressDiv.style.display = 'block';
            downloadFill.style.width = '0%';
            downloadPercent.textContent = '0%';
            downloadSize.textContent = '';
            downloadSpeed.textContent = '';

            const xhr = new XMLHttpRequest();
            let lastTime = Date.now();
            let lastLoaded = 0;

            // Handle download progress
            xhr.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    const totalMB = (e.total / (1024 * 1024)).toFixed(2);
                    const loadedMB = (e.loaded / (1024 * 1024)).toFixed(2);
                    
                    // Calculate speed
                    const currentTime = Date.now();
                    const timeDiff = (currentTime - lastTime) / 1000; // seconds
                    const bytesDiff = e.loaded - lastLoaded;
                    const speed = (bytesDiff / (1024 * 1024)) / timeDiff; // MB/s
                    
                    downloadFill.style.width = percentComplete + '%';
                    downloadPercent.textContent = percentComplete + '%';
                    downloadSize.textContent = `${loadedMB}MB / ${totalMB}MB`;
                    downloadSpeed.textContent = speed.toFixed(2) + ' MB/s';
                    
                    lastTime = currentTime;
                    lastLoaded = e.loaded;
                }
            });

            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const blob = new Blob([xhr.response]);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `database-${id}.sql`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    
                    setTimeout(() => {
                        downloadProgressDiv.style.display = 'none';
                        showMessage('Database downloaded successfully', 'success');
                    }, 500);
                } else {
                    downloadProgressDiv.style.display = 'none';
                    showMessage('Failed to download database', 'error');
                }
            });

            // Handle error
            xhr.addEventListener('error', () => {
                downloadProgressDiv.style.display = 'none';
                showMessage('Download failed - network error', 'error');
            });

            xhr.addEventListener('abort', () => {
                downloadProgressDiv.style.display = 'none';
                showMessage('Download cancelled', 'error');
            });

            xhr.open('GET', `/api/facilities/download/${id}`, true);
            xhr.responseType = 'arraybuffer';
            downloadFileName.textContent = `Downloading database...`;
            xhr.send();
        } catch (error) {
            showMessage('Error: ' + error.message, 'error');
        }
    };

    // Download report (admin only)
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', async () => {
            try {
                const downloadProgressDiv = document.getElementById('downloadProgress');
                const downloadFill = document.getElementById('downloadFill');
                const downloadPercent = document.getElementById('downloadPercent');
                const downloadSize = document.getElementById('downloadSize');
                const downloadSpeed = document.getElementById('downloadSpeed');
                const downloadFileName = document.getElementById('downloadFileName');

                downloadProgressDiv.style.display = 'block';
                downloadFill.style.width = '0%';
                downloadPercent.textContent = '0%';
                downloadSize.textContent = '';
                downloadSpeed.textContent = '';
                downloadFileName.textContent = 'Downloading report...';

                const xhr = new XMLHttpRequest();
                let lastTime = Date.now();
                let lastLoaded = 0;

                // Handle download progress
                xhr.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        const totalMB = (e.total / (1024 * 1024)).toFixed(2);
                        const loadedMB = (e.loaded / (1024 * 1024)).toFixed(2);
                        
                        // Calculate speed
                        const currentTime = Date.now();
                        const timeDiff = (currentTime - lastTime) / 1000;
                        const bytesDiff = e.loaded - lastLoaded;
                        const speed = (bytesDiff / (1024 * 1024)) / timeDiff;
                        
                        downloadFill.style.width = percentComplete + '%';
                        downloadPercent.textContent = percentComplete + '%';
                        downloadSize.textContent = `${loadedMB}MB / ${totalMB}MB`;
                        downloadSpeed.textContent = speed.toFixed(2) + ' MB/s';
                        
                        lastTime = currentTime;
                        lastLoaded = e.loaded;
                    }
                });

                // Handle completion
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const blob = new Blob([xhr.response], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `upload-report-${new Date().getTime()}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                        
                        setTimeout(() => {
                            downloadProgressDiv.style.display = 'none';
                            showMessage('Report downloaded successfully', 'success');
                        }, 500);
                    } else {
                        downloadProgressDiv.style.display = 'none';
                        showMessage('Failed to download report', 'error');
                    }
                });

                // Handle error
                xhr.addEventListener('error', () => {
                    downloadProgressDiv.style.display = 'none';
                    showMessage('Download failed - network error', 'error');
                });

                xhr.addEventListener('abort', () => {
                    downloadProgressDiv.style.display = 'none';
                    showMessage('Download cancelled', 'error');
                });

                xhr.open('GET', '/api/facilities/report/download', true);
                xhr.responseType = 'arraybuffer';
                xhr.send();
            } catch (error) {
                showMessage('Error: ' + error.message, 'error');
            }
        });
    }

    // Load facilities on page load
    loadFacilityList();
    loadFacilities();

    // Setup resumable upload form
    const resumableForm = document.getElementById('resumableForm');
    const resumableFileInput = document.getElementById('resumable_file');
    const resumableFacilityName = document.getElementById('resumable_facility_name');
    const resumableFacilityCode = document.getElementById('resumable_facility_code');
    const resumableDescription = document.getElementById('resumable_description');
    const resumableProgress = document.getElementById('resumableProgress');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    let currentUploadManager = null;

    // Load facility list for resumable form
    resumableFacilityName.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const facilityCode = selectedOption.getAttribute('data-code');
        resumableFacilityCode.value = facilityCode || '';
    });

    // Handle resumable form submission
    resumableForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = resumableFileInput.files[0];
        if (!file) {
            showMessage('Please select a file', 'error');
            return;
        }

        const facilityName = resumableFacilityName.value;
        const facilityCode = resumableFacilityCode.value;
        const description = resumableDescription.value;

        if (!facilityName || !facilityCode) {
            showMessage('Please select a facility', 'error');
            return;
        }

        resumableProgress.style.display = 'block';
        cancelUploadBtn.style.display = 'inline-block';
        document.getElementById('resumableFileName').textContent = file.name;

        // Create upload manager instance
        currentUploadManager = new ResumableUploadManager({
            chunkSize: 5 * 1024 * 1024, // 5MB chunks
            maxRetries: 3,
            retryDelay: 500, // 500ms retry delay
            chunkDelay: 100 // 100ms delay between chunks to avoid rate limiting
        });

        // Setup event handlers
        currentUploadManager.onProgress = (progress) => {
            const percent = Math.round((progress.uploadedBytes / progress.totalBytes) * 100);
            document.getElementById('resumableProgressPercent').textContent = percent + '%';
            document.getElementById('resumableProgressFill').style.width = percent + '%';
            
            const uploadedMB = (progress.uploadedBytes / (1024 * 1024)).toFixed(2);
            const totalMB = (progress.totalBytes / (1024 * 1024)).toFixed(2);
            document.getElementById('resumableChunkProgress').textContent = `${uploadedMB}MB / ${totalMB}MB`;
        };

        currentUploadManager.onChunkComplete = (chunkNumber, totalChunks) => {
            console.log(`Chunk ${chunkNumber}/${totalChunks} uploaded`);
        };

        currentUploadManager.onError = (error) => {
            showMessage('Upload error: ' + error.message, 'error');
            resumableProgress.style.display = 'none';
            cancelUploadBtn.style.display = 'none';
        };

        currentUploadManager.onComplete = async () => {
            try {
                // Preflight completeness verification
                const csrfTokenElement = resumableForm.querySelector('input[name="_csrf"]');
                const csrfToken = csrfTokenElement ? csrfTokenElement.value : '';

                const progressResp = await fetch('/api/facilities/resumable/' + currentUploadManager.uploadId + '/progress', {
                    credentials: 'same-origin',
                    headers: { 'csrf-token': csrfToken }
                });
                let progressData = null;
                try {
                    progressData = await progressResp.json();
                } catch {}

                if (!progressResp.ok || !progressData || !progressData.success) {
                    showMessage('Could not verify upload progress before finalize.', 'error');
                    console.warn('Finalize preflight failed', progressResp.status, progressData);
                    return;
                }

                const meta = progressData.progress;
                if (!meta || meta.uploadedChunks.length !== meta.totalChunks) {
                    showMessage(`Upload incomplete: ${meta ? meta.uploadedChunks.length : 0}/${meta ? meta.totalChunks : '?'} chunks. Not finalizing.`, 'error');
                    console.warn('Finalize blocked due to incomplete upload', meta);
                    return;
                }

                // Complete the upload on server only after verification
                const finalizeResponse = await fetch('/api/facilities/resumable/' + currentUploadManager.uploadId + '/complete', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'csrf-token': csrfToken
                    },
                    body: JSON.stringify({
                        uploadId: currentUploadManager.uploadId,
                        facilityName,
                        facilityCode,
                        description
                    })
                });

                let finalizeData = null;
                try {
                    finalizeData = await finalizeResponse.json();
                } catch (parseErr) {
                    console.error('Finalize response parse error', parseErr);
                }

                if (!finalizeResponse.ok) {
                    const msg = (finalizeData && finalizeData.message) ? finalizeData.message : 'Finalize failed';
                    showMessage('Finalize error: ' + msg, 'error');
                    console.error('Finalize error status', finalizeResponse.status, finalizeData);
                    resumableProgress.style.display = 'none';
                    cancelUploadBtn.style.display = 'none';
                    return;
                }

                if (finalizeData && finalizeData.success) {
                    showMessage('Upload completed successfully! Facility added.', 'success');
                    resumableForm.reset();
                    resumableProgress.style.display = 'none';
                    cancelUploadBtn.style.display = 'none';
                    loadFacilities();
                } else {
                    showMessage('Error: ' + (finalizeData ? finalizeData.message : 'Unknown finalize error'), 'error');
                    resumableProgress.style.display = 'none';
                    cancelUploadBtn.style.display = 'none';
                }
            } catch (error) {
                showMessage('Error completing upload: ' + error.message, 'error');
                resumableProgress.style.display = 'none';
                cancelUploadBtn.style.display = 'none';
            }
        };

        try {
            // Get CSRF token from resumable form
            const csrfTokenElement = resumableForm.querySelector('input[name="_csrf"]');
            const csrfToken = csrfTokenElement ? csrfTokenElement.value : '';
            
            // Start the upload
            await currentUploadManager.startUpload(file, '/api/facilities/resumable', csrfToken);
        } catch (error) {
            showMessage('Upload failed: ' + error.message, 'error');
            resumableProgress.style.display = 'none';
            cancelUploadBtn.style.display = 'none';
        }
    });

    // Handle cancel upload
    cancelUploadBtn.addEventListener('click', async () => {
        if (currentUploadManager && currentUploadManager.uploadId) {
            try {
                const csrfTokenElement = resumableForm.querySelector('input[name="_csrf"]');
                const csrfToken = csrfTokenElement ? csrfTokenElement.value : '';
                await currentUploadManager.cancelUpload('/api/facilities/resumable', csrfToken);
                showMessage('Upload cancelled', 'success');
                resumableProgress.style.display = 'none';
                cancelUploadBtn.style.display = 'none';
                resumableForm.reset();
            } catch (error) {
                showMessage('Error cancelling upload: ' + error.message, 'error');
            }
        }
    });
});
