document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const messageDiv = document.getElementById('message');
    const facilitiesList = document.getElementById('facilitiesList');
    const facilityNameSelect = document.getElementById('facility_name');
    const facilityCodeInput = document.getElementById('facility_code');

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
                            ${facility.file_path ? `
                                <button class="btn-restore" onclick="restoreDump(${facility.id})">Restore Dump</button>
                            ` : ''}
                            <button class="btn-delete" onclick="deleteFacility(${facility.id})">Delete</button>
                        </div>
                    </div>
                `).join('');
            } else {
                facilitiesList.innerHTML = '<div class="empty-state">No facilities uploaded yet</div>';
            }
        } catch (error) {
            facilitiesList.innerHTML = '<div class="empty-state">Error loading facilities</div>';
        }
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
    window.deleteFacility = async (id) => {
        if (confirm('Are you sure you want to delete this facility?')) {
            try {
                const response = await fetch(`/api/facilities/${id}`, {
                    method: 'DELETE'
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
        }
    };

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

    // Restore PostgreSQL dump
    window.restoreDump = async (id) => {
        if (confirm('This will restore the database from the dump file. Continue?')) {
            try {
                const response = await fetch(`/api/facilities/${id}/restore-dump`, {
                    method: 'POST'
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(`Database restored successfully! Tables: ${data.data.metadata.tables.length}`, 'success');
                } else {
                    showMessage(data.message || 'Restore failed', 'error');
                }
            } catch (error) {
                showMessage('Error: ' + error.message, 'error');
            }
        }
    };

    // Load facilities on page load
    loadFacilityList();
    loadFacilities();
});
