CREATE TABLE IF NOT EXISTS grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    department TEXT NOT NULL,
    township TEXT NOT NULL,
    quarter_no TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO grievances (
    employee_name,
    employee_id,
    department,
    township,
    quarter_no,
    phone,
    email,
    category,
    subject,
    description,
    status
)
SELECT
    'Ravi Kumar',
    'BCCL1024',
    'Township Maintenance',
    'Koyla Nagar',
    'B-14',
    '9876543210',
    'ravi.kumar@example.com',
    'Water Supply',
    'Irregular water supply in residential quarter',
    'Water supply has been irregular for the last three days in Block B. Please arrange inspection.',
    'Pending'
WHERE NOT EXISTS (SELECT 1 FROM grievances);
