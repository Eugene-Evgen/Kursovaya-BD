// ============================================
// ТехУчёт — Главный JS файл приложения
// ============================================

const SUPABASE_URL = 'https://tgipxwohlqggswizzvif.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pEjjlbyyoclTDy_L3YE_kQ_QI77mjLC';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ СОСТОЯНИЕ ============
const state = {
    currentPage: 'dashboard',
    equipment: [],
    employees: [],
    assignments: [],
    departments: [],
    equipmentTypes: [],
    deleteCallback: null,
    notifications: [],
};

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', async () => {
    initNav();
    initModals();
    initAddButton();
    initNotifications();

    await Promise.all([
        loadDepartments(),
        loadEquipmentTypes(),
    ]);

    await navigateTo('dashboard');
    await loadNotifications();
});

// ============ НАВИГАЦИЯ (top tabs + bottom nav) ============
function initNav() {
    // Top nav tabs + bottom nav items — все элементы с data-page
    document.querySelectorAll('[data-page]').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) await navigateTo(page);
        });
    });
}

async function navigateTo(page) {
    state.currentPage = page;

    // Highlight nav tabs (desktop)
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.page === page);
    });

    // Highlight bottom nav (mobile)
    document.querySelectorAll('.bnav-item').forEach(t => {
        t.classList.toggle('active', t.dataset.page === page);
    });

    // Show correct view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`page-${page}`);
    if (viewEl) viewEl.classList.add('active');

    // Update hidden pageTitle for any legacy reads
    const titles = {
        dashboard:   'Общие сведения',
        equipment:   'Техника',
        employees:   'Сотрудники',
        assignments: 'Назначения',
        departments: 'Отделы',
    };
    const titleText = titles[page] || page;
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = titleText;

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (page) {
        case 'dashboard':   await loadDashboard(); break;
        case 'equipment':   await loadEquipment(); break;
        case 'employees':   await loadEmployees(); break;
        case 'assignments': await loadAssignments(); break;
        case 'departments': await loadDepartmentsPage(); break;
    }
}

// ============ КНОПКИ ДОБАВИТЬ (по страницам) ============
function initAddButton() {
    const map = {
        addEquipBtn:  () => openEquipmentModal(),
        addEmpBtn:    () => openEmployeeModal(),
        addAssignBtn: () => openAssignmentModal(),
        addDeptBtn:   () => openDeptModal(),
    };
    Object.entries(map).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    });

    // Widget «Все →» links
    document.querySelectorAll('.widget-link[data-page]').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            await navigateTo(link.dataset.page);
        });
    });
}

// ============ ЗАГРУЗКА СПРАВОЧНИКОВ ============
async function loadDepartments() {
    const { data, error } = await db.from('departments').select('*').order('name');
    if (error) { console.error(error); return; }
    state.departments = data || [];
    populateSelect('employeeDeptFilter', data, 'id', 'name', 'Все отделы');
    populateSelect('empDepartment', data, 'id', 'name', 'Не указан');
}

async function loadEquipmentTypes() {
    const { data, error } = await db.from('equipment_types').select('*').order('name');
    if (error) { console.error(error); return; }
    state.equipmentTypes = data || [];
    populateSelect('equipmentTypeFilter', data, 'id', 'name', 'Все типы');
    populateSelect('equipType', data, 'id', 'name', 'Выберите тип');
}

function populateSelect(selectId, items, valField, labelField, defaultLabel) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const firstOption = sel.options[0];
    sel.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = defaultLabel;
    sel.appendChild(def);
    (items || []).forEach(item => {
        const opt = document.createElement('option');
        opt.value = item[valField];
        opt.textContent = item[labelField];
        sel.appendChild(opt);
    });
}

// ============ DASHBOARD ============
async function loadDashboard() {
    const [equipRes, empRes, assignRes] = await Promise.all([
        db.from('equipment').select('id, status'),
        db.from('employees').select('id, is_active').eq('is_active', true),
        db.from('assignments')
            .select('id, assigned_date, returned_date, equipment(name), employees(full_name, departments(name))')
            .order('assigned_date', { ascending: false })
            .limit(8),
    ]);

    const equip = equipRes.data || [];
    const total = equip.length;
    const available = equip.filter(e => e.status === 'available').length;
    const assigned = equip.filter(e => e.status === 'assigned').length;
    const repair = equip.filter(e => e.status === 'repair').length;
    const writtenOff = equip.filter(e => e.status === 'written_off').length;
    const empCount = (empRes.data || []).length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAvailable').textContent = available;
    document.getElementById('statAssigned').textContent = assigned;
    document.getElementById('statRepair').textContent = repair;
    document.getElementById('statWrittenOff').textContent = writtenOff;
    document.getElementById('statEmployees').textContent = empCount;

    // Recent assignments
    const raEl = document.getElementById('recentAssignments');
    const assignments = assignRes.data || [];
    if (assignments.length === 0) {
        raEl.innerHTML = '<div class="empty-box"><div class="empty-ico">🔗</div><p>Нет назначений</p></div>';
    } else {
        raEl.innerHTML = assignments.map(a => {
            const isActive = !a.returned_date;
            const statusHtml = isActive
                ? '<span class="badge badge-active" style="font-size:11px">Активно</span>'
                : '<span class="badge badge-written_off" style="font-size:11px">Возвращено</span>';
            const dateLabel = isActive
                ? `Выдано: ${formatDate(a.assigned_date)}`
                : `Возвращено: ${formatDate(a.returned_date)}`;
            return `
            <div class="assign-item">
                <div class="assign-avi">${isActive ? '💻' : '↩️'}</div>
                <div class="assign-info">
                    <div class="assign-eq">${esc(a.equipment?.name || '—')}</div>
                    <div class="assign-who">${esc(a.employees?.full_name || '—')} · ${esc(a.employees?.departments?.name || 'Без отдела')}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                    ${statusHtml}
                    <span class="assign-date">${dateLabel}</span>
                </div>
            </div>`;
        }).join('');
    }

    // Equipment by type
    const { data: typeData } = await db.from('equipment')
        .select('type_id, equipment_types(name)')
        .not('status', 'eq', 'written_off');

    const typeMap = {};
    (typeData || []).forEach(e => {
        const name = e.equipment_types?.name || 'Прочее';
        typeMap[name] = (typeMap[name] || 0) + 1;
    });
    const sorted = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
    const maxVal = sorted[0]?.[1] || 1;
    const ebtEl = document.getElementById('equipmentByType');
    if (sorted.length === 0) {
        ebtEl.innerHTML = '<div class="empty-box"><div class="empty-ico">📊</div><p>Нет данных</p></div>';
    } else {
        ebtEl.innerHTML = sorted.map(([name, count]) => `
            <div class="bar-item">
                <div class="bar-head">
                    <span class="bar-label">${esc(name)}</span>
                    <span class="bar-count">${count}</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${Math.round(count/maxVal*100)}%"></div>
                </div>
            </div>
        `).join('');
    }
}

// ============ EQUIPMENT ============
async function loadEquipment() {
    const tbody = document.getElementById('equipmentBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spin"></div> Загрузка...</div></td></tr>';

    let query = db.from('equipment')
        .select('*, equipment_types(name)')
        .order('name');

    const statusFilter = document.getElementById('equipmentStatusFilter').value;
    const typeFilter = document.getElementById('equipmentTypeFilter').value;
    const search = document.getElementById('equipmentSearch').value.trim();

    if (statusFilter) query = query.eq('status', statusFilter);
    if (typeFilter) query = query.eq('type_id', typeFilter);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) { showToast('Ошибка загрузки техники', 'error'); return; }
    state.equipment = data || [];
    renderEquipmentTable(state.equipment);

    // Attach filter/search listeners (once)
    attachOnce('equipmentStatusFilter', 'change', loadEquipment);
    attachOnce('equipmentTypeFilter', 'change', loadEquipment);
    attachOnce('equipmentSearch', 'input', debounce(loadEquipment, 300));
}

function renderEquipmentTable(items) {
    const tbody = document.getElementById('equipmentBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-box"><div class="empty-ico">💻</div><p>Техника не найдена</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = items.map(e => `
        <tr>
            <td class="tbl-bold">${esc(e.name)}</td>
            <td>${esc(e.equipment_types?.name || '—')}</td>
            <td>${esc([e.brand, e.model].filter(Boolean).join(' ') || '—')}</td>
            <td>${esc(e.serial_number || '—')}</td>
            <td>${esc(e.inventory_number || '—')}</td>
            <td>${statusBadge(e.status)}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-icon-sm" onclick="openEquipmentModal(${e.id})" title="Редактировать">✏️</button>
                    <button class="btn btn-icon-sm btn-icon-del" onclick="deleteEquipment(${e.id})" title="Удалить">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function openEquipmentModal(id = null) {
    await loadEquipmentTypes();
    const form = document.getElementById('equipmentForm');
    form.reset();
    document.getElementById('equipmentId').value = '';

    if (id) {
        document.getElementById('equipmentModalTitle').textContent = 'Редактировать технику';
        const item = state.equipment.find(e => e.id === id);
        if (item) {
            document.getElementById('equipmentId').value = item.id;
            document.getElementById('equipName').value = item.name || '';
            document.getElementById('equipType').value = item.type_id || '';
            document.getElementById('equipBrand').value = item.brand || '';
            document.getElementById('equipModel').value = item.model || '';
            document.getElementById('equipSerial').value = item.serial_number || '';
            document.getElementById('equipInventory').value = item.inventory_number || '';
            document.getElementById('equipPurchaseDate').value = item.purchase_date || '';
            document.getElementById('equipWarranty').value = item.warranty_until || '';
            document.getElementById('equipStatus').value = item.status || 'available';
            document.getElementById('equipNotes').value = item.notes || '';
        }
    } else {
        document.getElementById('equipmentModalTitle').textContent = 'Добавить технику';
    }
    openModal('equipmentModal');
}

document.getElementById('saveEquipment').addEventListener('click', async () => {
    const name = document.getElementById('equipName').value.trim();
    const typeId = document.getElementById('equipType').value;
    if (!name || !typeId) { showToast('Заполните обязательные поля', 'error'); return; }

    const payload = {
        name,
        type_id: typeId || null,
        brand: document.getElementById('equipBrand').value.trim() || null,
        model: document.getElementById('equipModel').value.trim() || null,
        serial_number: document.getElementById('equipSerial').value.trim() || null,
        inventory_number: document.getElementById('equipInventory').value.trim() || null,
        purchase_date: document.getElementById('equipPurchaseDate').value || null,
        warranty_until: document.getElementById('equipWarranty').value || null,
        status: document.getElementById('equipStatus').value,
        notes: document.getElementById('equipNotes').value.trim() || null,
        updated_at: new Date().toISOString(),
    };

    const id = document.getElementById('equipmentId').value;
    let error;
    if (id) {
        ({ error } = await db.from('equipment').update(payload).eq('id', id));
    } else {
        ({ error } = await db.from('equipment').insert(payload));
    }

    if (error) { showToast('Ошибка сохранения: ' + error.message, 'error'); return; }
    showToast(id ? 'Техника обновлена' : 'Техника добавлена', 'success');
    closeModal('equipmentModal');
    await loadEquipment();
});

async function deleteEquipment(id) {
    confirmAction('Удалить эту технику? Связанные назначения также будут удалены.', async () => {
        const { error } = await db.from('equipment').delete().eq('id', id);
        if (error) { showToast('Ошибка удаления: ' + error.message, 'error'); return; }
        showToast('Техника удалена', 'success');
        await loadEquipment();
    });
}

// ============ EMPLOYEES ============
async function loadEmployees() {
    const tbody = document.getElementById('employeesBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spin"></div> Загрузка...</div></td></tr>';

    let query = db.from('employees')
        .select('*, departments(name)')
        .order('full_name');

    const deptFilter = document.getElementById('employeeDeptFilter').value;
    const search = document.getElementById('employeeSearch').value.trim();

    if (deptFilter) query = query.eq('department_id', deptFilter);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error } = await query;
    if (error) { showToast('Ошибка загрузки сотрудников', 'error'); return; }
    state.employees = data || [];
    renderEmployeesTable(state.employees);

    attachOnce('employeeDeptFilter', 'change', loadEmployees);
    attachOnce('employeeSearch', 'input', debounce(loadEmployees, 300));
}

function renderEmployeesTable(items) {
    const tbody = document.getElementById('employeesBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-box"><div class="empty-ico">👥</div><p>Сотрудники не найдены</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = items.map(e => `
        <tr>
            <td class="tbl-bold">${esc(e.full_name)}</td>
            <td>${esc(e.departments?.name || '—')}</td>
            <td>${esc(e.position || '—')}</td>
            <td>${e.email ? `<a class="tbl-link" href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : '—'}</td>
            <td>${esc(e.phone || '—')}</td>
            <td><span class="badge ${e.is_active ? 'badge-active' : 'badge-inactive'}">${e.is_active ? 'Активен' : 'Уволен'}</span></td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-icon-sm" onclick="openEmployeeModal(${e.id})" title="Редактировать">✏️</button>
                    <button class="btn btn-icon-sm btn-icon-del" onclick="deleteEmployee(${e.id})" title="Удалить">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function openEmployeeModal(id = null) {
    await loadDepartments();
    const form = document.getElementById('employeeForm');
    form.reset();
    document.getElementById('employeeId').value = '';

    if (id) {
        document.getElementById('employeeModalTitle').textContent = 'Редактировать сотрудника';
        const item = state.employees.find(e => e.id === id);
        if (item) {
            document.getElementById('employeeId').value = item.id;
            document.getElementById('empFullName').value = item.full_name || '';
            document.getElementById('empDepartment').value = item.department_id || '';
            document.getElementById('empPosition').value = item.position || '';
            document.getElementById('empEmail').value = item.email || '';
            document.getElementById('empPhone').value = item.phone || '';
            document.getElementById('empStatus').value = String(item.is_active);
        }
    } else {
        document.getElementById('employeeModalTitle').textContent = 'Добавить сотрудника';
        document.getElementById('empStatus').value = 'true';
    }
    openModal('employeeModal');
}

document.getElementById('saveEmployee').addEventListener('click', async () => {
    const fullName = document.getElementById('empFullName').value.trim();
    if (!fullName) { showToast('Введите ФИО', 'error'); return; }

    const payload = {
        full_name: fullName,
        department_id: document.getElementById('empDepartment').value || null,
        position: document.getElementById('empPosition').value.trim() || null,
        email: document.getElementById('empEmail').value.trim() || null,
        phone: document.getElementById('empPhone').value.trim() || null,
        is_active: document.getElementById('empStatus').value === 'true',
        updated_at: new Date().toISOString(),
    };

    const id = document.getElementById('employeeId').value;
    let error;
    if (id) {
        ({ error } = await db.from('employees').update(payload).eq('id', id));
    } else {
        ({ error } = await db.from('employees').insert(payload));
    }

    if (error) { showToast('Ошибка сохранения: ' + error.message, 'error'); return; }
    showToast(id ? 'Сотрудник обновлён' : 'Сотрудник добавлен', 'success');
    closeModal('employeeModal');
    await loadEmployees();
});

async function deleteEmployee(id) {
    confirmAction('Удалить этого сотрудника? Связанные назначения также будут удалены.', async () => {
        const { error } = await db.from('employees').delete().eq('id', id);
        if (error) { showToast('Ошибка удаления: ' + error.message, 'error'); return; }
        showToast('Сотрудник удалён', 'success');
        await loadEmployees();
    });
}

// ============ ASSIGNMENTS ============
async function loadAssignments() {
    const tbody = document.getElementById('assignmentsBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spin"></div> Загрузка...</div></td></tr>';

    let query = db.from('assignments')
        .select('*, equipment(name), employees(full_name, departments(name))')
        .order('assigned_date', { ascending: false });

    const statusFilter = document.getElementById('assignmentStatusFilter').value;
    const search = document.getElementById('assignmentSearch').value.trim();

    if (statusFilter === 'active') query = query.is('returned_date', null);
    if (statusFilter === 'returned') query = query.not('returned_date', 'is', null);

    const { data, error } = await query;
    if (error) { showToast('Ошибка загрузки назначений', 'error'); return; }

    let items = data || [];
    if (search) {
        const q = search.toLowerCase();
        items = items.filter(a =>
            a.equipment?.name?.toLowerCase().includes(q) ||
            a.employees?.full_name?.toLowerCase().includes(q)
        );
    }

    state.assignments = items;
    renderAssignmentsTable(items);

    attachOnce('assignmentStatusFilter', 'change', loadAssignments);
    attachOnce('assignmentSearch', 'input', debounce(loadAssignments, 300));
}

function renderAssignmentsTable(items) {
    const tbody = document.getElementById('assignmentsBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-box"><div class="empty-ico">🔗</div><p>Нет назначений</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = items.map(a => `
        <tr>
            <td class="tbl-bold">${esc(a.equipment?.name || '—')}</td>
            <td>${esc(a.employees?.full_name || '—')}</td>
            <td>${esc(a.employees?.departments?.name || '—')}</td>
            <td>${formatDate(a.assigned_date)}</td>
            <td>${a.returned_date
                ? `<span class="badge badge-written_off">${formatDate(a.returned_date)}</span>`
                : '<span class="badge badge-active">Активно</span>'}</td>
            <td>${esc(a.notes || '—')}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-icon-sm" onclick="openAssignmentModal(${a.id})" title="Редактировать">✏️</button>
                    ${!a.returned_date ? `<button class="btn btn-icon-sm btn-icon-success" onclick="returnEquipment(${a.id})" title="Вернуть">↩️</button>` : ''}
                    <button class="btn btn-icon-sm btn-icon-del" onclick="deleteAssignment(${a.id})" title="Удалить">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function openAssignmentModal(id = null) {
    // Reload fresh data for selects
    const [equipRes, empRes] = await Promise.all([
        db.from('equipment').select('id, name, status').in('status', ['available', 'assigned']).order('name'),
        db.from('employees').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);

    const equipSel = document.getElementById('assignEquipment');
    const empSel = document.getElementById('assignEmployee');
    equipSel.innerHTML = '<option value="">Выберите технику</option>';
    empSel.innerHTML = '<option value="">Выберите сотрудника</option>';

    (equipRes.data || []).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `${e.name} [${statusLabel(e.status)}]`;
        equipSel.appendChild(opt);
    });

    (empRes.data || []).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.full_name;
        empSel.appendChild(opt);
    });

    document.getElementById('assignmentForm').reset();
    document.getElementById('assignmentId').value = '';
    document.getElementById('assignDate').value = new Date().toISOString().split('T')[0];

    if (id) {
        document.getElementById('assignmentModalTitle').textContent = 'Редактировать назначение';
        const item = state.assignments.find(a => a.id === id);
        if (item) {
            document.getElementById('assignmentId').value = item.id;
            document.getElementById('assignEquipment').value = item.equipment_id;
            document.getElementById('assignEmployee').value = item.employee_id;
            document.getElementById('assignDate').value = item.assigned_date || '';
            document.getElementById('returnDate').value = item.returned_date || '';
            document.getElementById('assignNotes').value = item.notes || '';
        }
    } else {
        document.getElementById('assignmentModalTitle').textContent = 'Назначить технику';
    }
    openModal('assignmentModal');
}

document.getElementById('saveAssignment').addEventListener('click', async () => {
    const equipId = document.getElementById('assignEquipment').value;
    const empId = document.getElementById('assignEmployee').value;
    const date = document.getElementById('assignDate').value;

    if (!equipId || !empId || !date) { showToast('Заполните обязательные поля', 'error'); return; }

    const returnDate = document.getElementById('returnDate').value || null;
    const payload = {
        equipment_id: parseInt(equipId),
        employee_id: parseInt(empId),
        assigned_date: date,
        returned_date: returnDate,
        notes: document.getElementById('assignNotes').value.trim() || null,
    };

    const id = document.getElementById('assignmentId').value;
    let error;
    if (id) {
        ({ error } = await db.from('assignments').update(payload).eq('id', id));
    } else {
        ({ error } = await db.from('assignments').insert(payload));
    }

    if (!error && !id) {
        // Update equipment status to assigned
        await db.from('equipment').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', equipId);
    }

    if (error) { showToast('Ошибка сохранения: ' + error.message, 'error'); return; }
    showToast(id ? 'Назначение обновлено' : 'Техника назначена', 'success');
    closeModal('assignmentModal');
    await loadAssignments();
    loadNotifications();
});

async function returnEquipment(id) {
    const item = state.assignments.find(a => a.id === id);
    if (!item) return;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await db.from('assignments').update({ returned_date: today }).eq('id', id);
    if (error) { showToast('Ошибка: ' + error.message, 'error'); return; }
    // Free the equipment
    await db.from('equipment').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', item.equipment_id);
    showToast('Техника возвращена', 'success');
    await loadAssignments();
    loadNotifications();
}

async function deleteAssignment(id) {
    confirmAction('Удалить это назначение?', async () => {
        const item = state.assignments.find(a => a.id === id);
        const { error } = await db.from('assignments').delete().eq('id', id);
        if (error) { showToast('Ошибка удаления: ' + error.message, 'error'); return; }
        // If was active, free the equipment
        if (item && !item.returned_date) {
            await db.from('equipment').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', item.equipment_id);
        }
        showToast('Назначение удалено', 'success');
        await loadAssignments();
    });
}

// ============ DEPARTMENTS ============
async function loadDepartmentsPage() {
    const grid = document.getElementById('departmentsGrid');
    grid.innerHTML = '<div class="loading"><div class="spin"></div> Загрузка...</div>';

    const search = document.getElementById('deptSearch').value.trim().toLowerCase();

    const { data, error } = await db.from('departments').select('*').order('name');
    if (error) { showToast('Ошибка загрузки отделов', 'error'); return; }

    // Get employee counts
    const { data: empData } = await db.from('employees').select('department_id, is_active').eq('is_active', true);
    const empCount = {};
    (empData || []).forEach(e => {
        if (e.department_id) empCount[e.department_id] = (empCount[e.department_id] || 0) + 1;
    });

    state.departments = data || [];
    let items = data || [];
    if (search) items = items.filter(d => d.name.toLowerCase().includes(search));

    if (items.length === 0) {
        grid.innerHTML = '<div class="empty-box"><div class="empty-ico">🏢</div><p>Отделы не найдены</p></div>';
        return;
    }

    grid.innerHTML = items.map(d => `
        <div class="dept-card">
            <div class="dept-card-top">
                <div class="dept-avi">🏢</div>
                <div class="dept-name">${esc(d.name)}</div>
                <div class="dept-actions">
                    <button class="btn btn-icon-sm" onclick="openDeptModal(${d.id})" title="Редактировать">✏️</button>
                    <button class="btn btn-icon-sm btn-icon-del" onclick="deleteDept(${d.id})" title="Удалить">🗑️</button>
                </div>
            </div>
            <div class="dept-meta">
                <span>👥 <strong>${empCount[d.id] || 0}</strong> сотрудников</span>
            </div>
        </div>
    `).join('');

    attachOnce('deptSearch', 'input', debounce(loadDepartmentsPage, 300));
}

function openDeptModal(id = null) {
    document.getElementById('deptForm').reset();
    document.getElementById('deptId').value = '';
    if (id) {
        document.getElementById('deptModalTitle').textContent = 'Редактировать отдел';
        const d = state.departments.find(d => d.id === id);
        if (d) {
            document.getElementById('deptId').value = d.id;
            document.getElementById('deptName').value = d.name;
        }
    } else {
        document.getElementById('deptModalTitle').textContent = 'Добавить отдел';
    }
    openModal('departmentModal');
}

document.getElementById('saveDept').addEventListener('click', async () => {
    const name = document.getElementById('deptName').value.trim();
    if (!name) { showToast('Введите название отдела', 'error'); return; }
    const id = document.getElementById('deptId').value;
    let error;
    if (id) {
        ({ error } = await db.from('departments').update({ name }).eq('id', id));
    } else {
        ({ error } = await db.from('departments').insert({ name }));
    }
    if (error) { showToast('Ошибка: ' + error.message, 'error'); return; }
    showToast(id ? 'Отдел обновлён' : 'Отдел добавлен', 'success');
    closeModal('departmentModal');
    await loadDepartmentsPage();
    await loadDepartments();
});

async function deleteDept(id) {
    confirmAction('Удалить этот отдел?', async () => {
        const { error } = await db.from('departments').delete().eq('id', id);
        if (error) { showToast('Ошибка удаления: ' + error.message, 'error'); return; }
        showToast('Отдел удалён', 'success');
        await loadDepartmentsPage();
        await loadDepartments();
    });
}

// ============ MODALS ============
function initModals() {
    document.querySelectorAll('.modal-close-btn, [data-modal]').forEach(el => {
        el.addEventListener('click', () => {
            const modalId = el.dataset.modal;
            if (modalId) closeModal(modalId);
        });
    });

    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
}

function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// ============ CONFIRM DIALOG ============
function confirmAction(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    state.deleteCallback = callback;
    openModal('confirmModal');
}

document.getElementById('confirmDelete').addEventListener('click', async () => {
    closeModal('confirmModal');
    if (state.deleteCallback) {
        await state.deleteCallback();
        state.deleteCallback = null;
    }
});

// ============ TOAST ============
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${esc(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============ NOTIFICATIONS ============
function initNotifications() {
    const btn = document.getElementById('notifBtn');
    const dropdown = document.getElementById('notifDropdown');
    const readAllBtn = document.getElementById('notifReadAll');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!document.getElementById('notifWrap').contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    readAllBtn.addEventListener('click', () => {
        state.notifications.forEach(n => n.read = true);
        saveNotifState();
        renderNotifications();
    });
}

async function loadNotifications() {
    // Load recent assignments and generate notifications
    const { data } = await db.from('assignments')
        .select('id, assigned_date, returned_date, equipment(name), employees(full_name)')
        .order('assigned_date', { ascending: false })
        .limit(10);

    const saved = JSON.parse(localStorage.getItem('notif_read') || '{}');
    const items = (data || []);

    state.notifications = [];

    items.forEach(a => {
        // Notification for assignment
        const assignKey = `assign_${a.id}`;
        state.notifications.push({
            id: assignKey,
            icon: '🔗',
            text: `${a.equipment?.name || 'Техника'} назначена сотруднику ${a.employees?.full_name || '—'}`,
            sub: `Дата выдачи: ${formatDate(a.assigned_date)}`,
            read: !!saved[assignKey],
        });

        // Notification for return
        if (a.returned_date) {
            const retKey = `return_${a.id}`;
            state.notifications.push({
                id: retKey,
                icon: '↩️',
                text: `${a.equipment?.name || 'Техника'} возвращена от ${a.employees?.full_name || '—'}`,
                sub: `Дата возврата: ${formatDate(a.returned_date)}`,
                read: !!saved[retKey],
            });
        }
    });

    // Sort unread first then keep order
    state.notifications.sort((a, b) => (a.read ? 1 : 0) - (b.read ? 1 : 0));
    // Keep max 12
    state.notifications = state.notifications.slice(0, 12);

    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    const unread = state.notifications.filter(n => !n.read).length;

    if (unread > 0) {
        badge.style.display = 'flex';
        badge.textContent = unread > 9 ? '9+' : String(unread);
    } else {
        badge.style.display = 'none';
    }

    if (state.notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">Нет уведомлений</div>';
        return;
    }

    list.innerHTML = state.notifications.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${esc(n.id)}">
            <div class="notif-item-icon">${n.icon}</div>
            <div class="notif-item-body">
                <div class="notif-item-text">${esc(n.text)}</div>
                <div class="notif-item-sub">${esc(n.sub)}</div>
            </div>
            ${n.read ? '' : '<div class="notif-unread-dot"></div>'}
        </div>
    `).join('');

    list.querySelectorAll('.notif-item').forEach(el => {
        el.addEventListener('click', () => {
            const nid = el.dataset.notifId;
            const n = state.notifications.find(x => x.id === nid);
            if (n && !n.read) {
                n.read = true;
                saveNotifState();
                renderNotifications();
            }
        });
    });
}

function saveNotifState() {
    const saved = {};
    state.notifications.forEach(n => { if (n.read) saved[n.id] = true; });
    localStorage.setItem('notif_read', JSON.stringify(saved));
}

// ============ HELPERS ============
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusBadge(status) {
    const labels = { available: 'Свободно', assigned: 'Назначено', repair: 'В ремонте', written_off: 'Списано' };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function statusLabel(status) {
    const labels = { available: 'Свободно', assigned: 'Назначено', repair: 'В ремонте', written_off: 'Списано' };
    return labels[status] || status;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

const _listeners = new Set();
function attachOnce(id, event, fn) {
    const key = `${id}:${event}`;
    if (_listeners.has(key)) return;
    _listeners.add(key);
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
}
