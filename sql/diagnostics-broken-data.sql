-- Diagnostics for broken data causing N/A in admin dashboard

-- Find requests with NULL courseId or purposeId
SELECT id, requesterType, courseId, purposeId
FROM document_requests
WHERE courseId IS NULL OR purposeId IS NULL;

-- Find requests with no associated documents
SELECT dr.id, dr.requesterType, dr.referenceNumber
FROM document_requests dr
LEFT JOIN request_documents rd ON dr.id = rd.requestId
WHERE rd.id IS NULL;

-- Find students with missing email or contactNo
SELECT id, studentNumber, email, contactNo
FROM students
WHERE email IS NULL OR contactNo IS NULL;

-- Find alumni with missing contactNo or graduationYear
SELECT id, email, contactNo, graduationYear
FROM alumni
WHERE contactNo IS NULL OR graduationYear IS NULL;

-- Count of requests by status showing N/A potential
SELECT
    COUNT(*) as total_requests,
    SUM(CASE WHEN courseId IS NULL THEN 1 ELSE 0 END) as null_course,
    SUM(CASE WHEN purposeId IS NULL THEN 1 ELSE 0 END) as null_purpose,
    SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM request_documents rd WHERE rd.requestId = dr.id) THEN 1 ELSE 0 END) as no_documents
FROM document_requests dr;