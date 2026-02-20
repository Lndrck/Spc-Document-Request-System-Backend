const express = require('express');
const authRoutes = require('./authRoutes');
const requestRoutes = require('./requestRoutes');
const staffRoutes = require('./staffRoutes');
const adminRoutes = require('./adminRoutes');
const announcementRoutes = require('./announcementRoutes');
const transactionRoutes = require('./transactionRoutes');
const emailVerificationRoutes = require('./emailVerificationRoutes');
const reportRoutes = require('./reportRoutes');
const { asyncHandler } = require('../middleware/errorHandler');
const DepartmentController = require('../controllers/departmentController');
const AnnouncementController = require('../controllers/announcementController');
const TransactionController = require('../controllers/transactionController');
const multer = require('multer');

// File upload configuration for alumni verification
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const path = require('path');
        const uploadPath = path.join(__dirname, '../uploads');
        // Create uploads directory if it doesn't exist
        const fs = require('fs');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const path = require('path');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'alumni-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check file types
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
        }
    }
});

// Custom middleware to parse form fields for alumni requests
const parseFormFields = (req, res, next) => {
    // Ensure req.body exists
    if (!req.body) {
        req.body = {};
    }

    // Parse JSON strings back to objects for FormData fields
    if (req.body && typeof req.body === 'object') {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                try {
                    req.body[key] = JSON.parse(req.body[key]);
                } catch (e) {
                    // Not JSON, keep as string
                }
            }
        });
    }

    next();
};


const router = express.Router();

/**
 * Main routes index
 * Combines all route modules and exports them
 */

// Mount route modules
router.use('/auth', authRoutes);
router.use('/requests', requestRoutes);
router.use('/staff', staffRoutes);
router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);
router.use('/announcements', announcementRoutes);
router.use('/transactions', transactionRoutes);
router.use('/', emailVerificationRoutes); // Email verification routes are mounted at root level

// Public API endpoints for frontend
router.get('/public/announcements', asyncHandler(async (req, res, next) => {
    try {
        console.log('🔍 [ROUTE DEBUG] /public/announcements endpoint HIT');
        const announcementController = new AnnouncementController(req.dbManager);
        await announcementController.getAllAnnouncements(req, res, next);
    } catch (error) {
        console.error('Error fetching public announcements:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to fetch announcements'
        });
    }
}));

router.get('/public/transaction-days', asyncHandler(async (req, res, next) => {
    try {
        console.log('🔍 [ROUTE DEBUG] /public/transaction-days endpoint HIT');
        console.log('🔍 [ROUTE DEBUG] Query params:', req.query);
        const transactionController = new TransactionController(req.dbManager);
        await transactionController.getAllTransactionDays(req, res, next);
    } catch (error) {
        console.error('Error fetching public transaction days:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to fetch transaction days'
        });
    }
}));

// Direct routes for student and alumni requests
const { RequestController } = require('../controllers/requestController');
router.post('/students', asyncHandler(async (req, res, next) => {
    const controller = new RequestController(req.dbManager);
    await controller.createStudentRequest(req, res, next);
}));
// Alumni request with file upload
const alumniUpload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
        }
    }
}).single('alumniVerificationFile');

router.post('/alumni', (req, res, next) => {
    alumniUpload(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                error: 'File upload error',
                message: err.message
            });
        }

        // Parse JSON fields after multer processing
        if (req.body && typeof req.body === 'object') {
            Object.keys(req.body).forEach(key => {
                if (typeof req.body[key] === 'string') {
                    try {
                        req.body[key] = JSON.parse(req.body[key]);
                    } catch (e) {
                        // Not JSON, keep as string
                    }
                }
            });
        }

        next();
    });
}, asyncHandler(async (req, res, next) => {
    const controller = new RequestController(req.dbManager);
    await controller.createAlumniRequest(req, res, next);
}));



// Public API endpoints for frontend form
router.get('/documents', async (req, res) => {
  try {
    const dbManager = req.dbManager;

    // Verify database connection
    if (!dbManager || !dbManager.isConnected) {
      console.error('Database connection not available');
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Database connection not available'
      });
    }

    // Fetch documents with error handling
    const documents = await dbManager.executeQuery(`
      SELECT
        id,
        documentName as name,
        basePrice as price,
        isActive
      FROM document_types
      WHERE isActive = TRUE
      ORDER BY documentName
    `);

    res.json({
      success: true,
      data: documents,
      count: documents.length
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to fetch documents. Please try again later.',
      details: error.message
    });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const dbManager = req.dbManager;

    // Verify database connection
    if (!dbManager || !dbManager.isConnected) {
      console.error('Database connection not available');
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Database connection not available'
      });
    }

    const departmentController = new DepartmentController(dbManager);
    await departmentController.getAllDepartments(req, res);

  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to fetch departments. Please try again later.',
      details: error.message
    });
  }
});

router.get('/purposes', async (req, res) => {
  try {
    const dbManager = req.dbManager;
    const purposes = await dbManager.executeQuery(
      'SELECT id, purposeName as name FROM request_purposes WHERE isActive = TRUE ORDER BY purposeName'
    );

    res.json({
      success: true,
      data: purposes,
      count: purposes.length
    });
  } catch (error) {
    console.error('Error fetching purposes:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to fetch purposes. Please try again later.'
    });
  }
});

/**
 * @route GET /api/courses
 * @desc Get all courses with their department information
 * @access Public
 */
router.get('/courses', async (req, res) => {
  try {
    const dbManager = req.dbManager;

    // Verify database connection
    if (!dbManager || !dbManager.isConnected) {
      console.error('Database connection not available');
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Database connection not available'
      });
    }

    // Fetch all courses with department info
    const courses = await dbManager.executeQuery(`
      SELECT 
        c.id,
        c.courseName,
        c.educationalLevel,
        c.department_id,
        d.department_name as departmentName
      FROM courses c
      LEFT JOIN departments d ON c.department_id = d.department_id
      ORDER BY c.courseName ASC
    `);

    res.json({
      success: true,
      data: courses,
      count: courses.length
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to fetch courses. Please try again later.',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 * @route GET /api/health
 * @desc Check server health and status
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'Smart Registrar API',
        version: '1.0.0'
    });
});

/**
 * Test connection endpoint
 * @route GET /api/requests/track/test
 * @desc Test server connectivity (no database required)
 * @access Public
 */
router.get('/requests/track/test', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        message: 'Server is running and ready to accept requests',
        timestamp: new Date().toISOString(),
        database: 'Server operational (database may be offline)'
    });
});

module.exports = router;
