-- Add department_id to courses table
ALTER TABLE courses ADD COLUMN department_id INT NULL;
ALTER TABLE courses ADD CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id);

-- Update courses with department mappings
-- College of Arts and Sciences
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Arts and Sciences')
WHERE courseName IN (
    'Bachelor of Arts in Communication (BA Comm)',
    'Bachelor of Arts in English Language (ABEL)',
    'Bachelor of Arts in Political Science (AB PolSci)',
    'Bachelor of Science in Mathematics (BS Mathematics)',
    'Bachelor of Science in Psychology (BS Psych)'
);

-- College of Business Management
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Business Management')
WHERE courseName IN (
    'Bachelor of Science in Business Administration (BSBA)',
    'Bachelor of Science in Entrepreneurship (BS Entrep)',
    'Bachelor of Science in Public Administration (BS PubAd)',
    'Bachelor of Science in Real Estate Management (BSREM)',
    'Bachelor of Science in Hospitality Management (BSHM)'
);

-- College of Education
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Education')
WHERE courseName IN (
    'Bachelor of Elementary Education (BEED)',
    'Bachelor of Secondary Education (BSED)',
    'Bachelor of Technology and Livelihood Education (BTLEd)',
    'Bachelor of Physical Education (BPED)',
    'Bachelor of Special Needs Education (BSNEd)',
    'Certificate in Teaching Program (CTP)'
);

-- College of Nursing
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Nursing')
WHERE courseName IN (
    'Bachelor of Science in Nursing (BSN)'
);

-- College of Computer Studies
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Computer Studies')
WHERE courseName IN (
    'Bachelor of Science in Computer Science (BSCS)',
    'Bachelor of Science in Information Technology (BSIT)',
    'Associate in Computer Technology (ACT)'
);

-- College of Physical Therapy
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Physical Therapy')
WHERE courseName IN (
    'Bachelor of Science in Physical Therapy (BSPT)'
);

-- College of Radiologic Technology
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Radiologic Technology')
WHERE courseName IN (
    'Bachelor of Science in Radiologic Technology (BSRT)',
    'Associate in Radiologic Technology (AradTech)'
);

-- College of Accountancy
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Accountancy')
WHERE courseName IN (
    'Bachelor of Science in Accountancy (BSA)'
);

-- College of Law
UPDATE courses SET department_id = (SELECT id FROM departments WHERE name = 'College of Law')
WHERE courseName IN (
    'Juris Doctor'
);