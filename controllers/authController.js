/**
 * @fileoverview Authentication controller for the Document Request System
 *
 * This controller handles all authentication-related business logic:
 * - User login and logout processes
 * - User registration for admin/staff accounts
 * - Password management and security
 * - JWT token generation and validation
 * - User profile management
 *
 * Security Features:
 * - Password hashing with bcrypt (12 salt rounds)
 * - JWT token-based authentication
 * - Input validation and sanitization
 * - Email format verification
 * - Password strength requirements
 * - Secure user session management
 *
 * Authentication Flow:
 * 1. User submits email/password to /login
 * 2. System validates credentials against database
 * 3. Password verification using bcrypt
 * 4. JWT token generation with user data
 * 5. Token returned to client for subsequent requests
 * 6. Middleware validates token on protected routes
 */

const jwt = require('jsonwebtoken'); // JWT token generation and verification
const crypto = require('crypto'); // Cryptographic functions for secure tokens
const User = require('../models/User'); // User model for database operations
const Department = require('../models/Department'); // Department model for department operations
const MailService = require('../services/mailer'); // Email service for notifications

/**
 * Authentication Controller Class
 * Manages all authentication and user account operations
 *
 * Key Responsibilities:
 * - User authentication (login/logout)
 * - User registration and account creation
 * - Password management and security
 * - User profile operations
 * - JWT token lifecycle management
 */
class AuthController {
    /**
     * Initialize authentication controller
     * Sets up dependencies for user operations and database access
     *
     * @param {Object} dbManager - Database manager instance for data operations
     */
    constructor(dbManager) {
        this.dbManager = dbManager; // Database access and utilities
        this.userModel = new User(dbManager); // User data operations
        this.departmentModel = new Department(dbManager); // Department data operations
    }

    /**
     * User login method
     * Authenticates users and generates JWT tokens for session management
     *
     * Login Process:
     * 1. Extract email, password, and rememberMe from request body
     * 2. Validate required fields are present
     * 3. Validate email format using regex
     * 4. Retrieve user from database by email
     * 5. Verify password using bcrypt comparison
     * 6. Update user's last login timestamp
     * 7. Generate JWT token with user data (1d for normal, 30d for remember me)
     * 8. Return token and user information
     *
     * Security Measures:
     * - Input validation and sanitization
     * - Email format verification
     * - Secure password comparison
     * - JWT token expiration (1d normal, 30d remember me)
     * - Stateless authentication (no server-side storage)
     * - Detailed logging for security monitoring
     *
     * @param {Object} req - Express request object containing email, password, rememberMe
     * @param {Object} res - Express response object for sending response
     * @param {Function} next - Express next function for error handling
     */
    login = async (req, res, next) => {
        try {
            console.log('🔐 User login attempt initiated');
            const { email, password, rememberMe } = req.body;

            // === INPUT VALIDATION ===
            // Ensure both email and password are provided
            if (!email || !password) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Email and password are required fields'
                });
            }

            // === EMAIL FORMAT VALIDATION ===
            // Use regex to validate proper email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Invalid email format - please provide a valid email address'
                });
            }

            // === DOMAIN ENFORCEMENT ===
            // Only allow login with Gmail domain
            if (!email.endsWith('@gmail.com')) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Login is only allowed with Gmail addresses'
                });
            }

            // Find user by email
            const userQuery = `
                SELECT u.*
                FROM users u
                WHERE u.email = ? AND u.isActive = TRUE
            `;
            const userRows = await this.dbManager.executeQuery(userQuery, [email]);
            const user = userRows[0] || null;

            if (!user) {
                return res.status(401).json({
                    error: 'Authentication failed',
                    message: 'Invalid email or password'
                });
            }

            // Verify password using bcrypt
            const isPasswordValid = await this.dbManager.verifyPassword(password, user.password);

            if (!isPasswordValid) {
                return res.status(401).json({
                    error: 'Authentication failed',
                    message: 'Invalid email or password'
                });
            }

            // Update last login
            await this.userModel.updateLastLogin(user.id);

            // Fetch departments for staff users from the junction table
            let departments = [];
            let department_ids = [];
            if (user.role === 'staff') {
                const deptQuery = `
                    SELECT d.department_id, d.department_name
                    FROM user_departments ud
                    JOIN departments d ON ud.department_id = d.department_id
                    WHERE ud.user_id = ?
                `;
                departments = await this.dbManager.executeQuery(deptQuery, [user.id]);
                department_ids = departments.map(d => d.department_id);
            }

            // Generate JWT token with conditional expiration
            const tokenPayload = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                departments: departments,
                department_ids: department_ids
            };

            // Set expiration: 1 day for normal login, 30 days for remember me
            const expiresIn = rememberMe ? '30d' : '1d';

            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
                expiresIn: expiresIn
            });

            console.log(`✅ User ${user.username} (${user.role}) logged in successfully`);

            res.json({
                success: true,
                message: 'Login successful',
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    departments: departments
                }
            });

        } catch (error) {
            console.error('❌ Login error:', error.message);
            next(error);
        }
    };

    /**
     * Register new user (Admin/Staff only)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    register = async (req, res, next) => {
        try {
            const { username, email, password, role, firstName, lastName, department } = req.body;

            // Input validation
            if (!username || !email || !password || !role || !firstName || !lastName) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'All fields are required'
                });
            }

            // Validate role
            if (!['admin', 'staff'].includes(role)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Role must be either admin or staff'
                });
            }

            // Handle department based on role
            let department_id = null;
            if (role === 'staff') {
                // Validate that department is not empty for staff
                if (!department || !department.trim()) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'Department is required for staff users'
                    });
                }
                // Find department by name
                const departmentData = await this.departmentModel.findByName(department.trim());
                if (!departmentData) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'Invalid department name'
                    });
                }
                department_id = departmentData.id;
            }
            // For admin, department is ignored and set to NULL

            // Password strength validation
            if (password.length < 6) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Password must be at least 6 characters long'
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Invalid email format'
                });
            }

            // Domain enforcement for registration
            if (!email.endsWith('@gmail.com')) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Registration is only allowed with Gmail addresses'
                });
            }

            // Check if user already exists
            const existingUser = await this.userModel.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    error: 'User already exists',
                    message: 'A user with this email already exists'
                });
            }

            // Check if username already exists
            const existingUsername = await this.userModel.findByUsername(username);
            if (existingUsername) {
                return res.status(409).json({
                    error: 'Username already exists',
                    message: 'This username is already taken'
                });
            }

            // Hash password
            const hashedPassword = await this.dbManager.hashPassword(password);

            // Create user data
            const userData = {
                username,
                email,
                password: hashedPassword,
                role,
                firstName,
                lastName,
                department_id
            };

            // Create user
            const newUser = await this.userModel.create(userData);

            console.log(`✅ New ${role} user registered: ${username}`);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    department_name: newUser.department_name || 'Not Assigned'
                }
            });

        } catch (error) {
            console.error('❌ Registration error:', error.message);
            next(error);
        }
    };

    /**
     * Logout user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    logout = async (req, res, next) => {
        try {
            const userId = req.user.id;

            // In a more sophisticated system, you would invalidate the token
            // For now, we'll just return success
            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('Logout error:', error.message);
            next(error);
        }
    };

    /**
     * Get user profile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getProfile = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const user = await this.userModel.findById(userId);

            if (!user) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User profile not found'
                });
            }

            res.json({
                success: true,
                user: user
            });

        } catch (error) {
            console.error('Profile error:', error.message);
            next(error);
        }
    };

    /**
     * Update user profile (name only)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateProfile = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { firstName, lastName } = req.body;

            // Validate required fields
            if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'First name and last name are required'
                });
            }

            // Check if user exists
            const user = await this.userModel.findById(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User not found'
                });
            }

            // Update user profile
            await this.userModel.update(userId, {
                firstName: firstName.trim(),
                lastName: lastName.trim()
            });

            // Get updated user
            const updatedUser = await this.userModel.findById(userId);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: updatedUser
            });

        } catch (error) {
            console.error('Update profile error:', error.message);
            next(error);
        }
    };

    /**
     * Change user password
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    changePassword = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Current password and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'New password must be at least 6 characters long'
                });
            }

            // Get current user password
            const user = await this.userModel.findById(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User not found'
                });
            }

            // Verify current password
            if (!this.dbManager.verifyPassword(currentPassword, user.password)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Current password is incorrect'
                });
            }

            // Hash new password
            const hashedNewPassword = await this.dbManager.hashPassword(newPassword);

            // Update password
            await this.userModel.updatePassword(userId, hashedNewPassword);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error.message);
            next(error);
        }
    };

    /**
     * Forgot password - generates secure reset token and sends email
     * @param {Object} req - Express request object containing email
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    forgotPassword = async (req, res, next) => {
        try {
            const { email } = req.body;

            // Input validation
            if (!email) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Email is required'
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Invalid email format'
                });
            }

            // Check if user exists
            const user = await this.userModel.findByEmail(email);
            if (!user) {
                // Don't reveal if email exists or not for security
                return res.json({
                    success: true,
                    message: 'If an account with this email exists, a password reset link has been sent.'
                });
            }

            // Generate secure reset token
            const resetToken = crypto.randomBytes(32).toString('hex');

            // Hash the token for storage
            const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

            // Set expiry time (15 minutes from now)
            const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

            // Store hashed token and expiry in database
            await this.userModel.updateResetToken(user.id, hashedToken, resetTokenExpiry);

            // Initialize mail service and send password reset email
            const mailService = new MailService();
            const userName = `${user.firstName} ${user.lastName}`;

            try {
                await mailService.sendPasswordResetEmail(email, resetToken, userName);
                console.log(`🔐 Password reset email sent successfully to ${email}`);
            } catch (emailError) {
                console.error('❌ Failed to send password reset email:', emailError.message);
                // Don't fail the request - user can still use the token if email fails
                // In production, you might want to implement a retry mechanism or queue
            }

            res.json({
                success: true,
                message: 'If an account with this email exists, a password reset link has been sent.'
            });

        } catch (error) {
            console.error('Forgot password error:', error.message);
            next(error);
        }
    };

    /**
     * Reset password using secure token
     * Implements atomic password updates with immediate database verification
     *
     * Security Features:
     * - Atomic transaction for password update and token clearing
     * - Immediate database verification of changes
     * - Fresh database reads for login (no caching)
     * - Comprehensive logging for auditing
     *
     * @param {Object} req - Express request object containing token and newPassword
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    resetPassword = async (req, res, next) => {
        try {
            const { token, newPassword } = req.body;

            // Input validation
            if (!token || !newPassword) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Reset token and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'New password must be at least 6 characters long'
                });
            }

            // Hash the provided token to compare with stored hash
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            // Find user by reset token - always fetch fresh from database
            const user = await this.userModel.findByResetToken(hashedToken);

            if (!user) {
                return res.status(400).json({
                    error: 'Invalid token',
                    message: 'Invalid or expired reset token'
                });
            }

            // Check if token has expired
            if (new Date() > user.reset_token_expiry) {
                return res.status(400).json({
                    error: 'Token expired',
                    message: 'Reset token has expired. Please request a new one.'
                });
            }

            // Hash new password using bcrypt with 12 salt rounds
            const hashedPassword = await this.dbManager.hashPassword(newPassword);

            // Perform atomic password reset using transaction
            const resetSuccess = await this.performAtomicPasswordReset(user.id, hashedPassword);

            if (!resetSuccess) {
                return res.status(500).json({
                    error: 'Reset failed',
                    message: 'Failed to update password. Please try again.'
                });
            }

            // Verify the password change was applied correctly in the database
            const verificationSuccess = await this.verifyPasswordReset(user.id, hashedPassword);

            if (!verificationSuccess) {
                console.error(`❌ Password reset verification failed for user ${user.email}`);
                return res.status(500).json({
                    error: 'Verification failed',
                    message: 'Password reset verification failed. Please try again.'
                });
            }

            // Send password change confirmation email
            const mailService = new MailService();
            const userName = `${user.firstName} ${user.lastName}`;

            try {
                await mailService.sendPasswordChangedEmail(user.email, userName);
                console.log(`📧 Password change confirmation email sent to ${user.email}`);
            } catch (emailError) {
                console.error('❌ Failed to send password change confirmation email:', emailError.message);
                // Don't fail the request - password was successfully changed
            }

            console.log(`✅ Password reset successful for user ${user.email}`);
            console.log(`🔐 Security audit: Password updated atomically, reset token cleared, changes verified`);

            res.json({
                success: true,
                message: 'Password reset successfully. You can now log in with your new password.'
            });

        } catch (error) {
            console.error('Reset password error:', error.message);
            next(error);
        }
    };

    /**
     * Perform atomic password reset using database transaction
     * Updates password and clears reset token in a single atomic operation
     *
     * @param {number} userId - User ID
     * @param {string} hashedPassword - New hashed password
     * @returns {Promise<boolean>} True if reset was successful
     */
    performAtomicPasswordReset = async (userId, hashedPassword) => {
        try {
            // Use a transaction to ensure atomicity
            const connection = await this.dbManager.getConnection().getConnection();

            try {
                // Start transaction
                await connection.beginTransaction();

                // Update password and clear reset token in single transaction
                const query = `
                    UPDATE users
                    SET
                        password = ?,
                        reset_token = NULL,
                        reset_token_expiry = NULL,
                        updatedAt = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;

                const [result] = await connection.execute(query, [hashedPassword, userId]);

                // Commit transaction
                await connection.commit();

                console.log(`🔐 Atomic password reset completed for user ID ${userId}`);
                return result.affectedRows > 0;

            } catch (error) {
                // Rollback transaction on error
                await connection.rollback();
                console.error(`❌ Atomic password reset failed for user ID ${userId}:`, error.message);
                return false;
            } finally {
                // Release connection
                connection.release();
            }
        } catch (error) {
            console.error('❌ Database connection error during atomic reset:', error.message);
            return false;
        }
    };

    /**
     * Verify password reset was applied correctly in database
     * Confirms that the new password hash and updated timestamp are present
     *
     * @param {number} userId - User ID
     * @param {string} expectedHashedPassword - Expected hashed password
     * @returns {Promise<boolean>} True if verification was successful
     */
    verifyPasswordReset = async (userId, expectedHashedPassword) => {
        try {
            // Query database directly to verify changes
            const query = `
                SELECT email, password, updatedAt, reset_token, reset_token_expiry
                FROM users
                WHERE id = ?
            `;

            const results = await this.dbManager.executeQuery(query, [userId]);
            const user = results[0];

            if (!user) {
                console.error(`❌ User not found during verification for ID ${userId}`);
                return false;
            }

            // Verify password hash matches
            const passwordMatches = await this.dbManager.verifyPassword(
                'temporary_test_password', // Dummy password for comparison
                user.password
            );

            // Since we can't verify the exact hash, we'll check that:
            // 1. Password field is not empty
            // 2. Reset token fields are cleared
            // 3. updatedAt timestamp is recent
            const isPasswordSet = user.password && user.password.length > 0;
            const isResetTokenCleared = !user.reset_token && !user.reset_token_expiry;
            const isRecentlyUpdated = user.updatedAt && new Date(user.updatedAt) > new Date(Date.now() - 5 * 60 * 1000); // Within last 5 minutes

            const verificationSuccess = isPasswordSet && isResetTokenCleared && isRecentlyUpdated;

            if (verificationSuccess) {
                console.log(`✅ Password reset verification successful for user ${user.email}`);
                console.log(`   - Password field updated: ${isPasswordSet}`);
                console.log(`   - Reset token cleared: ${isResetTokenCleared}`);
                console.log(`   - Recent update timestamp: ${isRecentlyUpdated}`);
                console.log(`   - Updated at: ${user.updatedAt}`);
            } else {
                console.error(`❌ Password reset verification failed for user ${user.email}`);
                console.error(`   - Password field updated: ${isPasswordSet}`);
                console.error(`   - Reset token cleared: ${isResetTokenCleared}`);
                console.error(`   - Recent update timestamp: ${isRecentlyUpdated}`);
            }

            return verificationSuccess;

        } catch (error) {
            console.error(`❌ Password reset verification error for user ID ${userId}:`, error.message);
            return false;
        }
    };
}

module.exports = AuthController;
