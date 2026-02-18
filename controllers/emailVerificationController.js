/**
 * Email Verification Controller
 * Handles email verification for document requests using OTP-based verification
 */

const crypto = require('crypto');
const TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes

class EmailVerificationController {
    /**
     * @param {Object} dbManager - Database manager instance
     * @param {Object} mailService - Mail service instance
     */
    constructor(dbManager, mailService) {
        if (!dbManager) throw new Error('dbManager is required');

        this.dbManager = dbManager;
        this.mailService = mailService; // Can be null for read-only operations
    }

    /**
     * Send verification email with OTP code
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async sendVerificationEmail(req, res) {
        try {
            // Debug logging
            console.log('🔍 sendVerificationEmail called');
            console.log('dbManager:', !!this.dbManager);
            console.log('mailService:', !!this.mailService);
            console.log('mailService.sendMail:', typeof this.mailService?.sendMail);

            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    error: 'Email required',
                    message: 'Email address is required'
                });
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Invalid email',
                    message: 'Please provide a valid email address'
                });
            }

            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log('🔑 Generated OTP for email:', email);

            // Store OTP in database with expiry
            console.log('💾 Storing OTP in database...');
            await this.dbManager.executeQuery(
                `INSERT INTO email_verifications (email, code, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
                 ON DUPLICATE KEY UPDATE
                 code = VALUES(code),
                 expires_at = VALUES(expires_at),
                 created_at = NOW(),
                 verified = 0`,
                [email.toLowerCase(), otp]
            );
            console.log('✅ OTP stored in database');

            // Send verification email with OTP using MailService.sendMail
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Email Verification - Registrar System</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f8f9fa; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #16a34a; text-align: center; margin: 20px 0; letter-spacing: 5px; }
                        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                        .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Email Verification</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>

                            <p>You have requested to verify your email address for the Registrar Document Request System.</p>

                            <p>Please enter the following verification code in the form:</p>

                            <div class="otp-code">${otp}</div>

                            <p><strong>Important:</strong> This code will expire in 15 minutes for security reasons.</p>

                            <div class="warning">
                                <strong>Security Notice:</strong><br>
                                If you did not request this verification, please ignore this email.<br>
                                Do not share this code with anyone.
                            </div>

                            <p>Best regards,<br>
                            Registrar System Team</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} Registrar Document Request System</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const mailOptions = {
                from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
                to: email,
                subject: 'Email Verification Code - Registrar Document Request System',
                html: htmlContent
            };

            console.log('📧 Sending email via MailService...');
            // Use the injected MailService instance
            await this.mailService.sendMail(mailOptions);
            console.log(`📧 Verification email sent successfully to ${email}`);

            res.json({
                success: true,
                message: 'Verification code sent to your email'
            });

        } catch (error) {
            console.error('❌ sendVerificationEmail error:', error.message);
            console.error('❌ Error stack:', error.stack);
            res.status(500).json({
                error: 'Failed to send email',
                message: error.message || 'Unable to send verification email. Please try again.'
            });
        }
    };

    /**
     * Verify email code entered by user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async verifyEmailCode(req, res) {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return res.status(400).json({
                    error: 'Email and code required',
                    message: 'Email address and verification code are required'
                });
            }

            // Check if code exists and is not expired
            const result = await this.dbManager.executeQuery(
                `SELECT email FROM email_verifications
                 WHERE email = ? AND code = ? AND expires_at > NOW()`,
                [email.toLowerCase(), code]
            );

            if (result.length === 0) {
                return res.status(400).json({
                    error: 'Invalid or expired code',
                    message: 'The verification code is invalid or has expired. Please request a new code.'
                });
            }

            // Mark email as verified (permanent verification)
            await this.dbManager.executeQuery(
                'UPDATE email_verifications SET verified = 1 WHERE email = ?',
                [email.toLowerCase()]
            );

            console.log(`✅ Email verified successfully: ${email}`);

            res.json({
                success: true,
                message: 'Your email has been verified successfully!',
                email: email
            });

        } catch (error) {
            console.error('Verify OTP error:', error);
            res.status(500).json({
                error: 'Verification failed',
                message: 'Unable to verify email. Please try again.'
            });
        }
    }

    /**
     * Verify email token (legacy method for link-based verification)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async verifyEmailToken(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({ error: 'Token required' });
            }

            // Check if token exists and is not expired
            const result = await this.dbManager.executeQuery(
                `SELECT email FROM email_verifications
                 WHERE token = ? AND expires_at > NOW()`,
                [token]
            );

            if (result.length === 0) {
                return res.status(400).json({
                    error: 'Invalid or expired token',
                    message: 'The verification link is invalid or has expired. Please request a new verification email.'
                });
            }

            const email = result[0].email;

            // Mark email as verified (permanent verification)
            await this.dbManager.executeQuery(
                'UPDATE email_verifications SET verified = 1 WHERE email = ?',
                [email]
            );

            console.log(`✅ Email verified successfully: ${email}`);

            res.json({
                success: true,
                message: 'Your email has been verified successfully!',
                email: email
            });

        } catch (error) {
            console.error('Verify email token error:', error);
            res.status(500).json({
                error: 'Verification failed',
                message: 'Unable to verify email. Please try again.'
            });
        }
    }

    /**
     * Check if email is verified (for frontend polling)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async checkEmailVerification(req, res) {
        try {
            const { email } = req.query;

            if (!email) {
                return res.status(400).json({
                    error: 'Email required',
                    message: 'Email address is required'
                });
            }

            // Check if email is marked as verified in database
            const result = await this.dbManager.executeQuery(
                `SELECT verified FROM email_verifications
                 WHERE email = ?`,
                [email.toLowerCase()]
            );

            // Email is verified if record exists and verified = 1
            const isVerified = result.length > 0 && result[0].verified === 1;

            res.json({
                verified: isVerified,
                message: isVerified ? 'Email is verified' : 'Email verification pending'
            });

        } catch (error) {
            console.error('Check email verification error:', error);
            res.status(500).json({
                error: 'Check failed',
                message: 'Unable to check verification status.'
            });
        }
    }
}

module.exports = EmailVerificationController;
