/**
 * ATLANTIS-AI Frontend Application
 * Handles all UI interactions, WebSocket connections, and API calls
 */

class AtlantisApp {
    constructor() {
        this.apiUrl = window.location.origin + '/api';
        this.ws = null;
        this.currentUser = localStorage.getItem('atlantis-user') || '';
        this.currentTask = null;
        this.selectedComponents = new Set();
        this.uploadedFiles = [];
        
        this.init();
    }

    async init() {
        console.log('🌟 Initializing ATLANTIS-AI...');
        
        // Set user from localStorage
        if (this.currentUser) {
            document.getElementById('username').value = this.currentUser;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup WebSocket
        this.connectWebSocket();
        
        // Setup drag and drop
        this.setupDragAndDrop();
        
        // Load initial data
        await this.loadMetrics();
        await this.loadAgents();
        
        if (this.currentUser) {
            await this.loadUserTasks();
        }
        
        console.log('✅ ATLANTIS-AI initialized');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // User input
        document.getElementById('username').addEventListener('change', (e) => {
            this.currentUser = e.target.value;
            localStorage.setItem('atlantis-user', this.currentUser);
            if (this.currentUser) {
                this.loadUserTasks();
            }
        });

        // Task submission
        document.getElementById('submit-task').addEventListener('click', () => this.submitTask());

        // File upload
        const fileUploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        
        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        
        // Drag and drop for files
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('drag-over');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            this.handleFileUpload(e.dataTransfer.files);
        });

        // Chat
        document.getElementById('chat-toggle').addEventListener('click', () => {
            const chatBody = document.getElementById('chat-body');
            chatBody.style.display = chatBody.style.display === 'none' ? 'flex' : 'none';
        });
        
        document.getElementById('chat-send').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Modal
        document.querySelector('.modal-close')?.addEventListener('click', () => {
            document.getElementById('task-modal').classList.remove('active');
        });
    }

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(`${viewName}-view`).classList.add('active');
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('drop-zone');
        const draggableItems = document.querySelectorAll('.drag-item');

        draggableItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('component', e.target.dataset.component);
            });
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const component = e.dataTransfer.getData('component');
            if (component && !this.selectedComponents.has(component)) {
                this.addComponent(component);
            }
        });
    }

    addComponent(component) {
        this.selectedComponents.add(component);
        
        const dropZone = document.getElementById('drop-zone');
        const dropHint = dropZone.querySelector('.drop-hint');
        if (dropHint) dropHint.remove();

        const componentNames = {
            frontend: '🎨 Frontend UI',
            backend: '⚙️ Backend API',
            database: '🗄️ Database',
            authentication: '🔐 Authentication',
            testing: '🧪 Testing Suite',
            documentation: '📚 Documentation',
            deployment: '🚀 Deployment',
            security: '🛡️ Security Audit'
        };

        const droppedItem = document.createElement('div');
        droppedItem.className = 'dropped-item';
        droppedItem.innerHTML = `
            <span>${componentNames[component]}</span>
            <button class="remove-item" data-component="${component}">×</button>
        `;

        droppedItem.querySelector('.remove-item').addEventListener('click', (e) => {
            this.selectedComponents.delete(e.target.dataset.component);
            droppedItem.remove();
            if (this.selectedComponents.size === 0) {
                dropZone.innerHTML = '<p class="drop-hint">Drag components here</p>';
            }
        });

        dropZone.appendChild(droppedItem);
    }

    async handleFileUpload(files) {
        const uploadedFilesDiv = document.getElementById('uploaded-files');
        
        for (const file of files) {
            this.uploadedFiles.push(file);
            
            const fileBadge = document.createElement('div');
            fileBadge.className = 'file-badge';
            fileBadge.innerHTML = `
                <span>📎 ${file.name}</span>
                <button class="file-remove" data-filename="${file.name}">×</button>
            `;
            
            fileBadge.querySelector('.file-remove').addEventListener('click', (e) => {
                this.uploadedFiles = this.uploadedFiles.filter(f => f.name !== e.target.dataset.filename);
                fileBadge.remove();
            });
            
            uploadedFilesDiv.appendChild(fileBadge);
        }
        
        this.showToast('Files ready for upload', 'success');
    }

    async submitTask() {
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const timeline = document.getElementById('task-timeline').value;
        const outcomes = document.getElementById('task-outcomes').value;
        const resources = document.getElementById('task-resources').value;
        const priority = document.getElementById('task-priority').value;

        if (!this.currentUser) {
            this.showToast('Please enter your GitHub username', 'error');
            return;
        }

        if (!title || !description) {
            this.showToast('Title and description are required', 'error');
            return;
        }

        // Upload files first if any
        const uploadedFileIds = [];
        for (const file of this.uploadedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', this.currentUser);
            
            try {
                const response = await fetch(`${this.apiUrl}/upload`, {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    uploadedFileIds.push(result.fileId);
                }
            } catch (error) {
                console.error('File upload error:', error);
            }
        }

        // Add selected components to resources
        let fullResources = resources;
        if (this.selectedComponents.size > 0) {
            fullResources += '\n\nSelected Components:\n';
            fullResources += Array.from(this.selectedComponents).join(', ');
        }
        
        if (uploadedFileIds.length > 0) {
            fullResources += '\n\nUploaded Files: ' + uploadedFileIds.join(', ');
        }

        // Create task
        const taskData = {
            userId: this.currentUser,
            title,
            description,
            timeline,
            desiredOutcomes: outcomes,
            availableResources: fullResources,
            priority
        };

        try {
            this.showToast('Submitting task to ATLANTIS...', 'info');
            
            const response = await fetch(`${this.apiUrl}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Task submitted successfully! ATLANTIS is processing...', 'success');
                
                // Clear form
                document.getElementById('task-title').value = '';
                document.getElementById('task-description').value = '';
                document.getElementById('task-timeline').value = '';
                document.getElementById('task-outcomes').value = '';
                document.getElementById('task-resources').value = '';
                document.getElementById('drop-zone').innerHTML = '<p class="drop-hint">Drag components here</p>';
                document.getElementById('uploaded-files').innerHTML = '';
                this.selectedComponents.clear();
                this.uploadedFiles = [];
                
                // Switch to dashboard
                this.switchView('dashboard');
                await this.loadUserTasks();
                await this.loadMetrics();
            } else {
                this.showToast('Error: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Task submission error:', error);
            this.showToast('Failed to submit task', 'error');
        }
    }

    async loadUserTasks() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`${this.apiUrl}/users/${this.currentUser}/tasks`);
            const tasks = await response.json();

            const tasksList = document.getElementById('tasks-list');
            
            if (tasks.length === 0) {
                tasksList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📝</div>
                        <p>No tasks yet. Create your first task to get started!</p>
                    </div>
                `;
                return;
            }

            tasksList.innerHTML = tasks.map(task => `
                <div class="task-card" onclick="app.showTaskDetails('${task.task_id}')">
                    <div class="task-header">
                        <div class="task-title">${task.title}</div>
                        <div class="task-status ${task.status}">${task.status.replace('-', ' ')}</div>
                    </div>
                    <div class="task-description">${task.description?.substring(0, 150)}...</div>
                    <div class="task-meta">
                        <span>📅 ${new Date(task.created_at).toLocaleDateString()}</span>
                        <span>⚡ ${task.priority}</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async showTaskDetails(taskId) {
        try {
            const response = await fetch(`${this.apiUrl}/tasks/${taskId}`);
            const data = await response.json();

            const modal = document.getElementById('task-modal');
            const modalTitle = document.getElementById('modal-title');
            const modalBody = document.getElementById('modal-body');

            modalTitle.textContent = data.task.title;
            
            const updates = data.updates.slice(0, 10);
            
            modalBody.innerHTML = `
                <div style="margin-bottom: 1.5rem;">
                    <h4>Status: ${data.task.status}</h4>
                    <p><strong>Priority:</strong> ${data.task.priority}</p>
                    <p><strong>Created:</strong> ${new Date(data.task.created_at).toLocaleString()}</p>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <h4>Description</h4>
                    <p>${data.task.description}</p>
                </div>
                
                ${data.assignments.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4>Assigned Sub-AIs</h4>
                    ${data.assignments.map(a => `
                        <div style="padding: 0.5rem; background: var(--gray-lighter); margin-bottom: 0.5rem; border-radius: 4px;">
                            <strong>${a.agent_name}</strong> - ${a.status}
                            ${a.progress ? `<div class="progress-bar"><div class="progress-fill" style="width: ${a.progress}%"></div></div>` : ''}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${updates.length > 0 ? `
                <div>
                    <h4>Progress Updates</h4>
                    ${updates.map(u => `
                        <div style="padding: 0.75rem; background: var(--gray-lighter); margin-bottom: 0.5rem; border-radius: 4px;">
                            <div style="font-size: 0.85rem; color: var(--gray); margin-bottom: 0.25rem;">
                                ${new Date(u.created_at).toLocaleString()} - ${u.source_type}
                            </div>
                            <div>${u.message}</div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            `;

            modal.classList.add('active');
        } catch (error) {
            console.error('Error loading task details:', error);
        }
    }

    async loadMetrics() {
        try {
            const response = await fetch(`${this.apiUrl}/metrics`);
            const metrics = await response.json();

            document.getElementById('total-tasks').textContent = metrics.tasks.total;
            document.getElementById('active-tasks').textContent = metrics.tasks.active;
            document.getElementById('completed-tasks').textContent = metrics.tasks.completed;
            document.getElementById('work-bots').textContent = metrics.workBots;
        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    }

    async loadAgents() {
        try {
            const response = await fetch(`${this.apiUrl}/agents`);
            const agents = await response.json();

            const agentsGrid = document.getElementById('agents-grid');
            agentsGrid.innerHTML = agents.map(agent => {
                const loadPercentage = (agent.current_load / agent.max_capacity) * 100;
                return `
                    <div class="agent-card">
                        <div class="agent-header">
                            <div class="agent-avatar">🤖</div>
                            <div>
                                <div class="agent-name">${agent.name}</div>
                                <div class="agent-specialization">${agent.specialization}</div>
                            </div>
                        </div>
                        <div class="agent-load">
                            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.25rem;">
                                <span>Load: ${agent.current_load}/${agent.max_capacity}</span>
                                <span>${Math.round(loadPercentage)}%</span>
                            </div>
                            <div class="load-bar">
                                <div class="load-fill" style="width: ${loadPercentage}%"></div>
                            </div>
                        </div>
                        <div style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--gray);">
                            Performance: ${agent.performance_score.toFixed(1)}%
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading agents:', error);
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('🔌 WebSocket connected');
            document.getElementById('connection-status').style.color = 'var(--success)';
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message:', data.type);

            if (data.type === 'task-created') {
                this.showToast('New task created!', 'success');
                this.loadUserTasks();
                this.loadMetrics();
            } else if (data.type === 'progress-update') {
                this.showToast(data.message, 'info');
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            document.getElementById('connection-status').style.color = 'var(--danger)';
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            document.getElementById('connection-status').style.color = 'var(--warning)';
            
            // Reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message to chat
        this.addChatMessage(message, 'user');
        input.value = '';

        // If there's a current task, interact with it
        if (this.currentTask) {
            try {
                const response = await fetch(`${this.apiUrl}/tasks/${this.currentTask}/interact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });

                const result = await response.json();
                this.addChatMessage(result.response, 'bot');
            } catch (error) {
                this.addChatMessage('Sorry, I encountered an error processing your message.', 'bot');
            }
        } else {
            this.addChatMessage('Create a task first, and I can help you track its progress!', 'bot');
        }
    }

    addChatMessage(content, type) {
        const messagesDiv = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-avatar">${type === 'bot' ? '🌟' : '👤'}</div>
            <div class="message-content">
                <p>${content}</p>
            </div>
        `;
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AtlantisApp();
});
