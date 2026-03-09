-- ================================================
-- Схема базы данных для учёта компьютерной техники
-- ================================================

-- Таблица отделов
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица сотрудников
CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    position VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица типов техники
CREATE TABLE IF NOT EXISTS equipment_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Таблица техники
CREATE TABLE IF NOT EXISTS equipment (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type_id BIGINT REFERENCES equipment_types(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    inventory_number VARCHAR(100) UNIQUE,
    purchase_date DATE,
    warranty_until DATE,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'repair', 'written_off')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица назначений техники сотрудникам
CREATE TABLE IF NOT EXISTS assignments (
    id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    returned_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Начальные данные
-- ================================================

INSERT INTO departments (name) VALUES
    ('ИТ-отдел'),
    ('Бухгалтерия'),
    ('Отдел кадров'),
    ('Администрация'),
    ('Отдел продаж'),
    ('Юридический отдел')
ON CONFLICT (name) DO NOTHING;

INSERT INTO equipment_types (name) VALUES
    ('Системный блок'),
    ('Ноутбук'),
    ('Монитор'),
    ('Принтер'),
    ('МФУ'),
    ('Клавиатура'),
    ('Мышь'),
    ('ИБП'),
    ('Сетевое оборудование'),
    ('Прочее')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- Включение Row Level Security (опционально)
-- ================================================
-- ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Разрешить анонимный доступ (для разработки)
-- CREATE POLICY "Allow all" ON departments FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON employees FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON equipment FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON equipment_types FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON assignments FOR ALL USING (true);
