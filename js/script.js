// ==================== APPLICATION STATE ====================
class AppState {
    constructor() {
        this.currentSection = 'myDay';
        this.tasks = [];
        this.categories = new Set();
        this.darkMode = false;
    }
}

const state = new AppState();

// ==================== UTILITY FUNCTIONS ====================
const Utils = {
    generateID: () => Date.now() + Math.floor(Math.random() * 1000),

    isToday: (dateString) => {
        const today = new Date();
        const date = new Date(dateString);
        return date.toDateString() === today.toDateString();
    },

    formatDate: (dateString) => {
        if (Utils.isToday(dateString)) return 'Today';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ==================== LOCAL STORAGE MANAGER ====================
class StorageManager {
    static KEYS = {
        TASKS: 'tasks_v2',
        USER: 'userPreferences',
        DARK_MODE: 'darkMode'
    };

    static getTasks() {
        const tasksJSON = localStorage.getItem(this.KEYS.TASKS);
        return tasksJSON ? JSON.parse(tasksJSON) : [];
    }

    static saveTasks(tasks) {
        localStorage.setItem(this.KEYS.TASKS, JSON.stringify(tasks));
    }

    static getTask(id) {
        const tasks = this.getTasks();
        return tasks.find(task => task.id === id);
    }

    static saveTask(task) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === task.id);

        if (index !== -1) {
            tasks[index] = task;
        } else {
            tasks.push(task);
        }

        this.saveTasks(tasks);
    }

    static deleteTask(id) {
        const tasks = this.getTasks();
        const filtered = tasks.filter(task => task.id !== id);
        this.saveTasks(filtered);
    }

    static deleteAllTasks() {
        this.saveTasks([]);
    }

    static getUserPreferences() {
        const stored = localStorage.getItem(this.KEYS.USER);
        return stored ? JSON.parse(stored) : { name: 'John Doe', email: 'john@gmail.com' };
    }

    static saveUserPreferences(name, email) {
        localStorage.setItem(this.KEYS.USER, JSON.stringify({ name, email }));
    }

    static clearUserPreferences() {
        localStorage.removeItem(this.KEYS.USER);
    }

    static getDarkMode() {
        const stored = localStorage.getItem(this.KEYS.DARK_MODE);
        return stored === 'true';
    }

    static saveDarkMode(enabled) {
        localStorage.setItem(this.KEYS.DARK_MODE, enabled.toString());
    }

    static migrateOldData() {
        // Migrate old localStorage format to new format
        const oldKeys = Object.keys(localStorage).filter(key =>
            key !== 'userPreferences' &&
            key !== 'darkMode' &&
            key !== 'tasks_v2' &&
            !isNaN(key)
        );

        if (oldKeys.length > 0 && !localStorage.getItem(this.KEYS.TASKS)) {
            const oldTasks = oldKeys.map(key => {
                const task = JSON.parse(localStorage.getItem(key));
                return {
                    ...task,
                    priority: task.priority || 'medium',
                    category: task.category || ''
                };
            });

            this.saveTasks(oldTasks);
            oldKeys.forEach(key => localStorage.removeItem(key));
        }
    }
}

// ==================== TASK MANAGER ====================
class TaskManager {
    constructor() {
        this.container = document.getElementById('TaskContainer');
        StorageManager.migrateOldData();
        this.loadTasks();
    }

    loadTasks() {
        state.tasks = StorageManager.getTasks();
        state.tasks.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Extract unique categories
        state.categories = new Set(state.tasks.map(t => t.category).filter(c => c));
    }

    addTask(text, date, priority = 'medium', category = '') {
        const task = {
            id: Utils.generateID(),
            text,
            date,
            priority,
            category,
            completed: false,
            timestamp: Date.now()
        };

        StorageManager.saveTask(task);
        this.loadTasks();

        if (category) {
            state.categories.add(category);
            this.updateCategoryList();
        }

        return task;
    }

    updateTask(id, updates) {
        const task = StorageManager.getTask(id);
        if (task) {
            const updatedTask = { ...task, ...updates };
            StorageManager.saveTask(updatedTask);
            this.loadTasks();

            if (updates.category) {
                state.categories.add(updates.category);
                this.updateCategoryList();
            }
        }
    }

    deleteTask(id) {
        StorageManager.deleteTask(id);
        this.loadTasks();
    }

    toggleComplete(id) {
        const task = StorageManager.getTask(id);
        if (task) {
            task.completed = !task.completed;
            StorageManager.saveTask(task);
            this.loadTasks();
        }
    }

    deleteAllTasks() {
        StorageManager.deleteAllTasks();
        this.loadTasks();
    }

    filterTasks(section, searchText = '') {
        const today = new Date();
        const todayStr = today.toLocaleDateString('en-CA');

        let filtered = state.tasks.filter(task => {
            // Search filter
            if (searchText && !task.text.toLowerCase().includes(searchText.toLowerCase())) {
                return false;
            }

            // Section filter
            switch (section) {
                case 'myDay':
                    return task.date === todayStr;

                case 'thisWeek': {
                    const taskDate = new Date(task.date);
                    const startOfWeek = new Date(today);
                    startOfWeek.setDate(today.getDate() - today.getDay());
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6);
                    return taskDate >= startOfWeek && taskDate <= endOfWeek;
                }

                case 'thisMonth': {
                    const taskDate = new Date(task.date);
                    return taskDate.getMonth() === today.getMonth() &&
                        taskDate.getFullYear() === today.getFullYear();
                }

                case 'other':
                default:
                    return true;
            }
        });

        return filtered;
    }

    updateCategoryList() {
        const datalist = document.getElementById('categoryList');
        datalist.innerHTML = Array.from(state.categories)
            .map(cat => `<option value="${cat}">`)
            .join('');
    }

    exportTasks() {
        const data = {
            tasks: state.tasks,
            exportDate: new Date().toISOString(),
            version: '2.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importTasks(jsonData) {
        try {
            const data = JSON.parse(jsonData);

            if (data.tasks && Array.isArray(data.tasks)) {
                // Merge with existing tasks, avoiding duplicates
                const existingIds = new Set(state.tasks.map(t => t.id));
                const newTasks = data.tasks.filter(task => !existingIds.has(task.id));

                state.tasks = [...state.tasks, ...newTasks];
                StorageManager.saveTasks(state.tasks);
                this.loadTasks();

                swal({
                    title: 'Success!',
                    text: `Imported ${newTasks.length} tasks successfully.`,
                    icon: 'success'
                });

                return true;
            } else {
                throw new Error('Invalid file format');
            }
        } catch (error) {
            swal({
                title: 'Error',
                text: 'Failed to import tasks. Please check the file format.',
                icon: 'error'
            });
            return false;
        }
    }
}

// ==================== UI MANAGER ====================
class UIManager {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.container = document.getElementById('TaskContainer');
        this.draggedElement = null;
    }

    render(section = state.currentSection, searchText = '') {
        const tasks = this.taskManager.filterTasks(section, searchText);

        // Update header title
        const titles = {
            'myDay': 'My Day',
            'thisWeek': 'Current Week',
            'thisMonth': 'Current Month',
            'other': 'All Tasks'
        };
        document.getElementById('header_title').textContent = titles[section] || 'My Day';

        // Update task statistics
        document.getElementById('totalCount').textContent = tasks.length;
        document.getElementById('completedCount').textContent = tasks.filter(t => t.completed).length;

        // Render tasks
        if (tasks.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class='bx bx-task' style="font-size: 48px; opacity: 0.3;"></i>
                    <p style="margin-top: 1rem;">No tasks found</p>
                </div>
            `;
            return;
        }

        this.container.innerHTML = tasks.map((task, index) => this.createTaskHTML(task, index)).join('');

        // Add staggered animation
        this.animateTasks();

        // Setup drag and drop
        this.setupDragAndDrop();
    }

    createTaskHTML(task, index) {
        const priorityBadge = task.priority ?
            `<span class="priority-badge ${task.priority}">${task.priority}</span>` : '';

        const categoryBadge = task.category ?
            `<span class="category-badge">${task.category}</span>` : '';

        const dateDisplay = Utils.isToday(task.date) ?
            'Today' :
            `<i class='bx bx-calendar-alt'></i> ${Utils.formatDate(task.date)}`;

        return `
            <div class="card" 
                 data-task-id="${task.id}" 
                 draggable="true"
                 role="listitem">
                <input type="checkbox" 
                       name="task" 
                       id="task-${task.id}" 
                       ${task.completed ? 'checked' : ''}
                       aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}">
                
                <div class="marker ${task.completed ? 'done' : ''}">
                    <div class="task-title-row">
                        <span class="task-text" data-task-id="${task.id}" contenteditable="false">${task.text}</span>
                        ${priorityBadge}
                        ${categoryBadge}
                    </div>
                    <div class="task-meta-row">
                        <span class="date ${Utils.isToday(task.date) ? 'today' : ''}" data-task-id="${task.id}">
                            ${dateDisplay}
                        </span>
                    </div>
                </div>
                
                <div class="task-actions">
                    <i class='bx bx-edit' data-task-id="${task.id}" title="Edit task"></i>
                    <i class='bx bx-copy' data-task-id="${task.id}" title="Duplicate task"></i>
                    <i class='bx bx-trash-alt' data-task-id="${task.id}" title="Delete task"></i>
                </div>
            </div>
        `;
    }

    animateTasks() {
        const cards = this.container.querySelectorAll('.card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
            }, index * 50);
        });
    }

    setupDragAndDrop() {
        const cards = this.container.querySelectorAll('.card');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedElement = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedElement = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = this.getDragAfterElement(e.clientY);
                if (afterElement == null) {
                    this.container.appendChild(this.draggedElement);
                } else {
                    this.container.insertBefore(this.draggedElement, afterElement);
                }
            });
        });
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.container.querySelectorAll('.card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

// ==================== THEME MANAGER ====================
class ThemeManager {
    constructor() {
        this.darkMode = StorageManager.getDarkMode();
        this.toggle = document.getElementById('darkModeToggle');
        this.init();
    }

    init() {
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
            this.updateIcon(true);
        }

        this.toggle.addEventListener('click', () => this.toggleTheme());
    }

    toggleTheme() {
        this.darkMode = !this.darkMode;
        document.body.classList.toggle('dark-mode');
        StorageManager.saveDarkMode(this.darkMode);
        this.updateIcon(this.darkMode);
    }

    updateIcon(isDark) {
        const icon = this.toggle.querySelector('i');
        icon.className = isDark ? 'bx bx-sun' : 'bx bx-moon';
    }
}

// ==================== USER PROFILE MANAGER ====================
class UserProfileManager {
    constructor() {
        this.nameEl = document.getElementById('name');
        this.emailEl = document.getElementById('email');
        this.init();
    }

    init() {
        const prefs = StorageManager.getUserPreferences();

        if (prefs.name === 'John Doe' && prefs.email === 'john@gmail.com') {
            this.promptForProfile();
        } else {
            this.display(prefs);
        }
    }

    display(prefs) {
        this.nameEl.textContent = prefs.name;
        this.emailEl.textContent = prefs.email;
    }

    promptForProfile() {
        swal({
            title: 'Welcome!',
            text: 'Let\'s personalize your experience',
            content: {
                element: 'div',
                attributes: {
                    innerHTML: `
                        <input type="text" id="swal-name" class="swal-input" placeholder="Your Name" style="margin: 10px 0; padding: 12px; width: 100%; border: 1px solid #ddd; border-radius: 8px;">
                        <input type="email" id="swal-email" class="swal-input" placeholder="Your Email" style="margin: 10px 0; padding: 12px; width: 100%; border: 1px solid #ddd; border-radius: 8px;">
                    `
                }
            },
            buttons: {
                cancel: 'Skip',
                confirm: 'Save'
            },
            closeOnClickOutside: false
        }).then((confirmed) => {
            if (confirmed) {
                const name = document.getElementById('swal-name').value || 'User';
                const email = document.getElementById('swal-email').value || 'user@example.com';

                StorageManager.saveUserPreferences(name, email);
                this.display({ name, email });
            } else {
                this.display({ name: 'User', email: 'user@example.com' });
                StorageManager.saveUserPreferences('User', 'user@example.com');
            }
        });
    }

    logout() {
        swal({
            title: 'Logout?',
            text: 'This will clear your profile information.',
            icon: 'warning',
            buttons: ['Cancel', 'Logout'],
            dangerMode: true
        }).then((confirmed) => {
            if (confirmed) {
                StorageManager.clearUserPreferences();
                window.location.reload();
            }
        });
    }
}

// ==================== EVENT HANDLERS ====================
class EventHandlers {
    constructor(taskManager, uiManager) {
        this.taskManager = taskManager;
        this.uiManager = uiManager;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('taskForm');
        const todoInput = document.getElementById('todo');
        const dateInput = document.getElementById('duedate');
        const prioritySelect = document.getElementById('priority');
        const categoryInput = document.getElementById('category');

        // Set default date to today
        dateInput.valueAsDate = new Date();

        // Add task on Enter or click
        const addTask = (e) => {
            e?.preventDefault();

            const text = todoInput.value.trim();
            const date = dateInput.value;
            const priority = prioritySelect.value;
            const category = categoryInput.value.trim();

            if (!text || !date) {
                swal({
                    title: 'Validation Error',
                    text: 'Please enter both task description and due date!',
                    icon: 'error'
                });
                return;
            }

            this.taskManager.addTask(text, date, priority, category);
            this.uiManager.render();

            // Clear form
            todoInput.value = '';
            dateInput.valueAsDate = new Date();
            prioritySelect.value = 'medium';
            categoryInput.value = '';
            todoInput.focus();
        };

        form.addEventListener('submit', addTask);

        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask(e);
        });

        // Task container events (delegation)
        this.uiManager.container.addEventListener('click', (e) => {
            const taskId = parseInt(e.target.dataset.taskId);
            if (!taskId) return;

            // Checkbox toggle
            if (e.target.type === 'checkbox') {
                this.taskManager.toggleComplete(taskId);
                this.uiManager.render();
            }

            // Delete task
            if (e.target.classList.contains('bx-trash-alt')) {
                this.deleteTask(taskId);
            }

            // Edit task
            if (e.target.classList.contains('bx-edit')) {
                this.editTask(taskId, e.target);
            }

            // Duplicate task
            if (e.target.classList.contains('bx-copy')) {
                this.duplicateTask(taskId);
            }

            // Edit date
            if (e.target.classList.contains('date')) {
                this.editDate(taskId);
            }
        });

        // Section navigation
        ['o1', 'o2', 'o3', 'o4'].forEach((id, index) => {
            const sections = ['myDay', 'thisWeek', 'thisMonth', 'other'];
            document.getElementById(id).addEventListener('click', (e) => {
                e.preventDefault();
                state.currentSection = sections[index];
                this.uiManager.render(state.currentSection);
                this.toggleMobileMenu();
            });
        });

        // Search functionality
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', Utils.debounce((e) => {
            this.uiManager.render(state.currentSection, e.target.value);
        }, 300));

        // Delete all tasks
        document.getElementById('deleteAllBtn').addEventListener('click', () => {
            this.deleteAllTasks();
        });

        // Export tasks
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.taskManager.exportTasks();
        });

        // Import tasks
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (this.taskManager.importTasks(event.target.result)) {
                        this.uiManager.render();
                    }
                };
                reader.readAsText(file);
            }
            e.target.value = ''; // Reset input
        });

        // Logout
        document.getElementById('logoutLink').addEventListener('click', (e) => {
            e.preventDefault();
            new UserProfileManager().logout();
        });

        // Mobile hamburger menu
        const burgerIcon = document.getElementById('burgerIcon');
        burgerIcon.addEventListener('click', () => this.toggleMobileMenu());

        // Close mobile menu on outside click
        document.body.addEventListener('click', (e) => {
            const containerLeft = document.getElementById('containerLeft');
            if (!containerLeft.contains(e.target) && !burgerIcon.contains(e.target)) {
                containerLeft.classList.remove('v-class');
                burgerIcon.classList.remove('cross');
                burgerIcon.setAttribute('aria-expanded', 'false');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // 'n' or 'N' to focus new task input
            if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey &&
                e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                todoInput.focus();
            }
        });
    }

    toggleMobileMenu() {
        const containerLeft = document.getElementById('containerLeft');
        const burgerIcon = document.getElementById('burgerIcon');
        containerLeft.classList.toggle('v-class');
        burgerIcon.classList.toggle('cross');
        const isExpanded = containerLeft.classList.contains('v-class');
        burgerIcon.setAttribute('aria-expanded', isExpanded.toString());
    }

    deleteTask(taskId) {
        swal({
            title: 'Delete Task?',
            text: 'This action cannot be undone!',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true
        }).then((confirmed) => {
            if (confirmed) {
                this.taskManager.deleteTask(taskId);
                this.uiManager.render();
                swal('Deleted!', 'Task has been removed.', 'success');
            }
        });
    }

    deleteAllTasks() {
        swal({
            title: 'Delete All Tasks?',
            text: 'This will permanently delete ALL tasks!',
            icon: 'warning',
            buttons: ['Cancel', 'Delete All'],
            dangerMode: true
        }).then((confirmed) => {
            if (confirmed) {
                this.taskManager.deleteAllTasks();
                this.uiManager.render();
                swal('Cleared!', 'All tasks have been deleted.', 'success');
            }
        });
    }

    editTask(taskId, element) {
        const task = StorageManager.getTask(taskId);
        if (!task) return;

        const card = element.closest('.card');
        const taskTextEl = card.querySelector('.task-text');

        taskTextEl.setAttribute('contenteditable', 'true');
        taskTextEl.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(taskTextEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const saveEdit = () => {
            const newText = taskTextEl.textContent.trim();
            if (newText && newText !== task.text) {
                this.taskManager.updateTask(taskId, { text: newText });
                this.uiManager.render();
                swal('Updated!', 'Task has been updated.', 'success');
            } else {
                taskTextEl.textContent = task.text;
            }
            taskTextEl.setAttribute('contenteditable', 'false');
        };

        taskTextEl.addEventListener('blur', saveEdit, { once: true });
        taskTextEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                taskTextEl.blur();
            }
            if (e.key === 'Escape') {
                taskTextEl.textContent = task.text;
                taskTextEl.blur();
            }
        }, { once: true });
    }

    duplicateTask(taskId) {
        const task = StorageManager.getTask(taskId);
        if (task) {
            this.taskManager.addTask(
                task.text + ' (copy)',
                task.date,
                task.priority,
                task.category
            );
            this.uiManager.render();
            swal('Duplicated!', 'Task has been copied.', 'success');
        }
    }

    editDate(taskId) {
        const task = StorageManager.getTask(taskId);
        if (!task) return;

        const input = document.createElement('input');
        input.type = 'date';
        input.value = task.date;
        input.style.position = 'fixed';
        input.style.top = '-1000px';
        document.body.appendChild(input);

        input.showPicker();

        input.addEventListener('change', () => {
            const newDate = input.value;
            if (newDate && newDate !== task.date) {
                swal({
                    title: 'Update Date?',
                    text: `Change due date from ${task.date} to ${newDate}?`,
                    icon: 'info',
                    buttons: ['Cancel', 'Update']
                }).then((confirmed) => {
                    if (confirmed) {
                        this.taskManager.updateTask(taskId, { date: newDate });
                        this.uiManager.render();
                    }
                });
            }
            document.body.removeChild(input);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
            }, 100);
        });
    }
}

// ==================== APPLICATION INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize managers
    const taskManager = new TaskManager();
    const uiManager = new UIManager(taskManager);
    const themeManager = new ThemeManager();
    const userProfile = new UserProfileManager();
    const eventHandlers = new EventHandlers(taskManager, uiManager);

    // Initial render
    uiManager.render();

    console.log('✨ Modern To-Do List App Initialized!');
});
