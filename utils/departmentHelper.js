// Department name normalization and matching utility
// Handles case-insensitive matching and variations

const DEPARTMENT_MAPPING = {
    // Full names (canonical)
    'Computer Science & Engineering': 'Computer Science & Engineering',
    'Computer Science and Engineering': 'Computer Science & Engineering',
    'CSE': 'Computer Science & Engineering',
    'cse': 'Computer Science & Engineering',
    'COMPUTER SCIENCE': 'Computer Science & Engineering',
    'computer science': 'Computer Science & Engineering',
    'Computer Science': 'Computer Science & Engineering',
    
    'Mechanical Engineering': 'Mechanical Engineering',
    'Mechanical': 'Mechanical Engineering',
    'ME': 'Mechanical Engineering',
    'me': 'Mechanical Engineering',
    'MECHANICAL': 'Mechanical Engineering',
    'mechanical': 'Mechanical Engineering',
    
    'Civil Engineering': 'Civil Engineering',
    'Civil': 'Civil Engineering',
    'CE': 'Civil Engineering',
    'ce': 'Civil Engineering',
    'CIVIL': 'Civil Engineering',
    'civil': 'Civil Engineering',
    
    'Electrical Engineering': 'Electrical Engineering',
    'Electrical': 'Electrical Engineering',
    'EE': 'Electrical Engineering',
    'ee': 'Electrical Engineering',
    'ELECTRICAL': 'Electrical Engineering',
    'electrical': 'Electrical Engineering',
    
    'Electronics & Computer Engineering': 'Electronics & Computer Engineering',
    'Electronics and Computer Engineering': 'Electronics & Computer Engineering',
    'Electronics & Computer': 'Electronics & Computer Engineering',
    'Electronics and Computer': 'Electronics & Computer Engineering',
    'ECE': 'Electronics & Computer Engineering',
    'ece': 'Electronics & Computer Engineering',
    'ENC': 'Electronics & Computer Engineering',
    'enc': 'Electronics & Computer Engineering',
    'ELECTRONICS & COMPUTER': 'Electronics & Computer Engineering',
    'electronics & computer': 'Electronics & Computer Engineering',
    
    'Artificial Intelligence & Machine Learning': 'Artificial Intelligence & Machine Learning',
    'Artificial Intelligence and Machine Learning': 'Artificial Intelligence & Machine Learning',
    'AIML': 'Artificial Intelligence & Machine Learning',
    'aiml': 'Artificial Intelligence & Machine Learning',
    'AI & ML': 'Artificial Intelligence & Machine Learning',
    'ai & ml': 'Artificial Intelligence & Machine Learning',
    'AI ML': 'Artificial Intelligence & Machine Learning',
    'ai ml': 'Artificial Intelligence & Machine Learning',
};

// Normalize department name to canonical form
function normalizeDepartment(dept) {
    if (!dept) return null;
    
    // Trim and normalize
    const trimmed = dept.trim();
    
    // Check direct mapping
    if (DEPARTMENT_MAPPING[trimmed]) {
        return DEPARTMENT_MAPPING[trimmed];
    }
    
    // Case-insensitive lookup
    const lower = trimmed.toLowerCase();
    for (const [key, value] of Object.entries(DEPARTMENT_MAPPING)) {
        if (key.toLowerCase() === lower) {
            return value;
        }
    }
    
    // If not found, return trimmed original (might be a new department)
    return trimmed;
}

// Get all canonical department names
function getAllDepartments() {
    return [
        'Computer Science & Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Electrical Engineering',
        'Electronics & Computer Engineering',
        'Artificial Intelligence & Machine Learning'
    ];
}

// SQL condition for case-insensitive department matching
function getDepartmentMatchSQL(columnName, deptValue) {
    const normalized = normalizeDepartment(deptValue);
    if (!normalized) return null;
    
    // Get all variations that map to this department
    const variations = Object.entries(DEPARTMENT_MAPPING)
        .filter(([_, value]) => value === normalized)
        .map(([key]) => key);
    
    // Create SQL condition
    const conditions = variations.map(v => `LOWER(${columnName}) = LOWER(?)`).join(' OR ');
    return { sql: `(${conditions})`, values: variations };
}

module.exports = {
    normalizeDepartment,
    getAllDepartments,
    getDepartmentMatchSQL
};
