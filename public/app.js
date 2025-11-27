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
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const isAdmin = userData && userData.role === 'admin';

    // Load facility list from database
    async function loadFacilityList() {
        try {
            const response = await fetch('/api/facilities/facility-list');
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                facilityNameSelect.innerHTML = '<option value="">-- Select a Facility --</option>';
                data.data.forEach(facility => {
                    const option = document.createElement('option');
                    option.value = facility.facility_name;
                    option.setAttribute('data-code', facility.facility_code);
                    option.textContent = facility.facility_name;
                    facilityNameSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading facility list:', error);
            facilityNameSelect.innerHTML = '<option value="">Error loading facilities</option>';
        }
    }

    // Handle facility name change to auto-populate facility code
    facilityNameSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const facilityCode = selectedOption.getAttribute('data-code');
        facilityCodeInput.value = facilityCode || '';
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
});
