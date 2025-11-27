// Load users on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    setupEventListeners();
});

function setupEventListeners() {
    // Create user modal buttons
    document.getElementById('btnCreateUser').addEventListener('click', openCreateUserModal);
    document.getElementById('closeCreateModal').addEventListener('click', closeCreateUserModal);
    document.getElementById('btnCancelCreate').addEventListener('click', closeCreateUserModal);
    
    // Reset password modal buttons
    document.getElementById('closeResetModal').addEventListener('click', closeResetPasswordModal);
    document.getElementById('btnCancelReset').addEventListener('click', closeResetPasswordModal);
    
    // Form submissions
    document.getElementById('createUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createUser();
    });

    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await resetPassword();
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        const createModal = document.getElementById('createUserModal');
        const resetModal = document.getElementById('resetPasswordModal');
        if (event.target === createModal) createModal.style.display = 'none';
        if (event.target === resetModal) resetModal.style.display = 'none';
    });
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            const tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        ${data.data.map(user => `
                            <tr>
                                <td>${escapeHtml(user.username)}</td>
                                <td>${user.email ? escapeHtml(user.email) : 'N/A'}</td>
                                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-small btn-reset reset-btn" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}">Reset Password</button>
                                        ${user.role === 'uploader' ? `<button class="btn-small btn-remove delete-btn" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}">Delete</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('usersTableContainer').innerHTML = tableHTML;
            attachTableButtonListeners();
        } else {
            document.getElementById('usersTableContainer').innerHTML = '<div class="empty-state">No users found</div>';
        }
    } catch (error) {
        showMessage('Error loading users: ' + error.message, 'error');
    }
}

function attachTableButtonListeners() {
    // Reset password buttons
    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            const username = e.target.getAttribute('data-username');
            openResetPasswordModal(userId, username);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            const username = e.target.getAttribute('data-username');
            deleteUser(userId, username);
        });
    });
}

async function createUser() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const role = document.getElementById('role').value;
    const csrfElement = document.querySelector('input[name="_csrf"]');
    const csrf = csrfElement ? csrfElement.value : null;

    // Validate inputs
    if (!username || !password) {
        showMessage('Error: Username and password are required', 'error');
        return;
    }

    if (!csrf) {
        showMessage('Error: CSRF token not found', 'error');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'csrf-token': csrf
            },
            body: JSON.stringify({ username, password, email: email || null, role })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('User created successfully', 'success');
            closeCreateUserModal();
            document.getElementById('createUserForm').reset();
            loadUsers();
        } else {
            showMessage(data.message || 'Failed to create user', 'error');
        }
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

async function resetPassword() {
    const userIdElement = document.getElementById('resetUserId');
    const newPasswordElement = document.getElementById('newPassword');
    const userId = userIdElement ? userIdElement.value : null;
    const newPassword = newPasswordElement ? newPasswordElement.value : null;
    const csrfElement = document.querySelector('input[name="_csrf"]');
    const csrf = csrfElement ? csrfElement.value : null;

    console.log('Reset Password Debug:', { userId, newPassword, csrf });

    // Validate inputs
    if (!userId) {
        showMessage('Error: User ID not found', 'error');
        return;
    }

    if (!newPassword) {
        showMessage('Error: Please enter a new password', 'error');
        return;
    }

    if (!csrf) {
        showMessage('Error: CSRF token not found', 'error');
        return;
    }

    try {
        const requestBody = { newPassword };
        console.log('Sending request body:', requestBody);

        const response = await fetch(`/api/users/${userId}/reset-password`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'csrf-token': csrf
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
            showMessage('Password reset successfully', 'success');
            closeResetPasswordModal();
            document.getElementById('resetPasswordForm').reset();
            loadUsers();
        } else {
            showMessage(data.message || 'Failed to reset password', 'error');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

async function deleteUser(id, username) {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
        const csrfElement = document.querySelector('input[name="_csrf"]');
        const csrf = csrfElement ? csrfElement.value : null;

        if (!csrf) {
            showMessage('Error: CSRF token not found', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/users/${id}`, { 
                method: 'DELETE',
                headers: { 'csrf-token': csrf }
            });
            const data = await response.json();

            if (response.ok) {
                showMessage('User deleted successfully', 'success');
                loadUsers();
            } else {
                showMessage(data.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            showMessage('Error: ' + error.message, 'error');
        }
    }
}

function openCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'block';
}

function closeCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'none';
}

function openResetPasswordModal(userId, username) {
    document.getElementById('resetUserId').value = userId;
    document.getElementById('resetPasswordModal').style.display = 'block';
}

function closeResetPasswordModal() {
    document.getElementById('resetPasswordModal').style.display = 'none';
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

