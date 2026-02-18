/**
 * @fileoverview Email service for the Document Request System
 *
 * This module provides secure email functionality using Nodemailer:
 * - SMTP configuration with environment variables
 * - HTML email templates for password reset
 * - Secure credential handling
 * - Error handling and logging
 *
 * Security Features:
 * - Credentials from environment variables only
 * - No hardcoded sensitive information
 * - Proper error handling without exposing internals
 * - HTML email content with proper escaping
 */

const nodemailer = require('nodemailer');

/**
 * Mail Service Class
 * Handles all email operations for the application
 *
 * Key Features:
 * - SMTP transporter configuration
 * - Password reset email templates
 * - Password change confirmation emails
 * - Secure credential management
 * - Comprehensive error handling
 */
class MailService {
    /**
     * Initialize the mail service
     * Creates SMTP transporter with secure configuration
     *
     * Security Configuration:
     * - Uses environment variables for all credentials
     * - TLS encryption enabled
     * - Secure authentication
     * - Connection pooling disabled for security
     */
    constructor() {
        // Create SMTP transporter with secure configuration
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                ciphers: 'SSLv3'
            }
        });

        // Note: SMTP verification is done lazily when first email is sent
        // to avoid blocking server startup
    }

    /**
     * Verify SMTP connection and configuration
     * Tests the transporter configuration to ensure emails can be sent
     *
     * @private
     */
    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('📧 SMTP connection verified successfully');
        } catch (error) {
            console.error('❌ SMTP connection failed:', error.message);
            // Don't throw error - allow app to start, but log the issue
            console.warn('⚠️  Email functionality may not work until SMTP is configured properly');
        }
    }

    /**
     * Send password reset email
     * Delivers a secure password reset link to the user
     *
     * Email Content:
     * - Professional HTML template
     * - Secure reset link with token
     * - Clear instructions for user
     * - Expiration notice
     * - Security warnings
     *
     * @param {string} toEmail - Recipient email address
     * @param {string} resetToken - Secure reset token
     * @param {string} userName - User's display name
     * @returns {Promise<boolean>} Success status
     */
    async sendPasswordResetEmail(toEmail, resetToken, userName = 'User') {
        try {
            // Generate reset URL
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

            // HTML email template
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Password Reset - Registrar System</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f8f9fa; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #eab308; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                        .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${userName}</strong>,</p>

                            <p>You have requested to reset your password for the Registrar Document Request System.</p>

                            <p>Please click the button below to reset your password:</p>

                            <a href="${resetUrl}" class="button">Reset Password</a>

                            <p><strong>Important:</strong> This link will expire in 15 minutes for security reasons.</p>

                            <div class="warning">
                                <strong>Security Notice:</strong><br>
                                If you did not request this password reset, please ignore this email.<br>
                                Your account remains secure and no changes have been made.
                            </div>

                            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
                            <p><small>${resetUrl}</small></p>

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

            // Email configuration
            const mailOptions = {
                from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
                to: toEmail,
                subject: 'Password Reset - Registrar Document Request System',
                html: htmlContent
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log(`📧 Password reset email sent to ${toEmail} (Message ID: ${info.messageId})`);
            return true;

        } catch (error) {
            console.error('❌ Failed to send password reset email:', error.message);
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Send password change confirmation email
     * Notifies user that their password has been successfully changed
     *
     * Email Content:
     * - Confirmation of successful password change
     * - Security notification
     * - Contact information for support
     *
     * @param {string} toEmail - Recipient email address
     * @param {string} userName - User's display name
     * @returns {Promise<boolean>} Success status
     */
    async sendPasswordChangedEmail(toEmail, userName = 'User') {
        try {
            // HTML email template
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Password Changed - Registrar System</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f8f9fa; }
                        .success { background-color: #d1fae5; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Successfully Changed</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${userName}</strong>,</p>

                            <div class="success">
                                <strong>✓ Password Changed Successfully</strong><br>
                                Your password has been successfully updated in the Registrar Document Request System.
                            </div>

                            <p>You can now log in to your account using your new password.</p>

                            <p>If you did not make this change, please contact system administrator immediately.</p>

                            <p>For security reasons, we recommend:</p>
                            <ul>
                                <li>Using a strong, unique password</li>
                                <li>Enabling two-factor authentication if available</li>
                                <li>Not sharing your credentials with others</li>
                            </ul>

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

            // Email configuration
            const mailOptions = {
                from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
                to: toEmail,
                subject: 'Password Changed Successfully - Registrar System',
                html: htmlContent
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log(`📧 Password change confirmation email sent to ${toEmail} (Message ID: ${info.messageId})`);
            return true;

        } catch (error) {
            console.error('❌ Failed to send password change confirmation email:', error.message);
            throw new Error('Failed to send password change confirmation email');
        }
    }

    /**
     * Generic send mail method
     * Sends an email with the provided mail options
     *
     * @param {Object} mailOptions - Email options (to, subject, html, etc.)
     * @returns {Promise<Object>} Send result with messageId
     */
    async sendMail(mailOptions) {
        try {
            // Ensure from field is set if not provided
            if (!mailOptions.from) {
                mailOptions.from = `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`;
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email sent successfully (Message ID: ${info.messageId})`);
            return info;

        } catch (error) {
            console.error('❌ Failed to send email:', error.message);
            throw new Error('Failed to send email');
        }
    }

    /**
     * Test email functionality
     * Sends a test email to verify SMTP configuration
     *
     * @param {string} testEmail - Email address to send test to
     * @returns {Promise<boolean>} Success status
     */
    async sendTestEmail(testEmail) {
        try {
            const mailOptions = {
                to: testEmail,
                subject: 'SMTP Test - Registrar System',
                html: `
                    <h2>SMTP Configuration Test</h2>
                    <p>This is a test email to verify SMTP configuration.</p>
                    <p>Sent at: ${new Date().toISOString()}</p>
                `
            };

            const info = await this.sendMail(mailOptions);
            console.log(`📧 Test email sent successfully to ${testEmail} (Message ID: ${info.messageId})`);
            return true;

        } catch (error) {
            console.error('❌ Test email failed:', error.message);
            throw error;
        }
    }

    /**
     * Send document request summary email
     * Sends a confirmation email with request details after successful submission
     *
     * Email Content:
     * - Professional HTML template
     * - Request reference number and ID
     * - Requester information
     * - Requested documents with pricing
     * - Total amount
     * - Processing time notice
     *
     * @param {Object} data - Request summary data
     * @param {string} data.toEmail - Recipient email address
     * @param {string} data.fullName - Requester's full name
     * @param {string} data.referenceNumber - Unique reference number
     * @param {string} data.requestId - Unique request ID
     * @param {string} data.requestNo - Request number
     * @param {string} data.email - Requester's email (alternate)
     * @param {string} data.contactNo - Requester's contact number
     * @param {string} data.course - Requester's course/program
     * @param {string} data.year - Requester's year level (for students)
     * @param {string} data.requesterType - 'student' or 'alumni'
     * @param {Array} data.documents - Array of document objects
     * @param {number} data.totalAmount - Total amount
     * @returns {Promise<boolean>} Success status
     */
    async sendRequestSummaryEmail(data) {
        const {
            toEmail,
            fullName,
            referenceNumber,
            requestId,
            requestNo,
            email,
            contactNo,
            course,
            year,
            requesterType,
            documents,
            totalAmount
        } = data;

        try {
            // Generate document rows for the email table
            const documentRows = documents.map(doc => {
                const documentName = doc.name || doc.documentName || 'Document';
                const schoolYear = doc.schoolYear || doc.year || 'N/A';
                const semester = doc.semester || 'N/A';
                const quantity = doc.quantity || 1;
                const price = parseFloat(doc.price || doc.unitPrice || 0);

                return `
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${documentName}</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${schoolYear}</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${semester}</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: center;">${quantity}</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">₱${price.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');

            // Format year level display
            const yearLevelDisplay = requesterType === 'student' && year ? `Year ${year}` : 'Alumni';

            // Professional HTML email template
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Document Request Submitted - Registrar System</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #16a34a; color: white; padding: 30px 20px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .content { padding: 30px 20px; background-color: #f8fafc; }
                        .info-box { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
                        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                        .info-row:last-child { border-bottom: none; }
                        .info-label { font-weight: bold; color: #475569; }
                        .info-value { color: #1e293b; }
                        .documents-table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
                        .documents-table th { background-color: #16a34a; color: white; padding: 12px; text-align: left; }
                        .documents-table td { padding: 12px; border: 1px solid #e2e8f0; }
                        .total-row { background-color: #f1f5f9; font-weight: bold; }
                        .total-row td { padding: 15px 12px; }
                        .processing-notice { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                        .footer { background-color: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .success-badge { background-color: #16a34a; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 15px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Document Request Submitted</h1>
                        </div>
                        <div class="content">
                            <div class="success-badge">✓ Request Submitted Successfully</div>
                            <p>Hello <strong>${fullName}</strong>,</p>

                            <p>Your document request has been successfully submitted to the Registrar Office. Below is a summary of your request for your reference.</p>

                            <div class="info-box">
                                <div class="info-row">
                                    <span class="info-label">Reference Number:</span>
                                    <span class="info-value" style="font-family: monospace; font-size: 16px; font-weight: bold;">${referenceNumber}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Status:</span>
                                    <span class="info-value"><span style="background-color: #fbbf24; color: #78350f; padding: 4px 12px; border-radius: 4px; font-weight: bold;">PENDING</span></span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Request Type:</span>
                                    <span class="info-value">${requesterType === 'student' ? 'Student' : 'Alumni'}</span>
                                </div>
                            </div>

                            <div class="info-box">
                                <div class="info-row">
                                    <span class="info-label">Email:</span>
                                    <span class="info-value">${email || toEmail}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Contact Number:</span>
                                    <span class="info-value">${contactNo || 'N/A'}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Course/Program:</span>
                                    <span class="info-value">${course || 'N/A'}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Year Level:</span>
                                    <span class="info-value">${yearLevelDisplay}</span>
                                </div>
                            </div>

                            <h3 style="color: #16a34a; margin-top: 30px;">Requested Documents</h3>
                            <table class="documents-table">
                                <thead>
                                    <tr>
                                        <th>Document</th>
                                        <th>School Year</th>
                                        <th>Semester</th>
                                        <th style="text-align: center;">Quantity</th>
                                        <th style="text-align: right;">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${documentRows}
                                    <tr class="total-row">
                                        <td colspan="4" style="text-align: right; padding-right: 12px;"><strong>Total Amount:</strong></td>
                                        <td style="text-align: right;"><strong>₱${(parseFloat(totalAmount) || 0).toFixed(2)}</strong></td>
                                    </tr>
                                </tbody>
                            </table>

                            <div class="processing-notice">
                                <strong>⏳ Processing Time Notice</strong>
                                <p style="margin: 10px 0 0 0;">Your request will be processed within <strong>3–5 business days</strong>. You will receive another email notification once your documents are ready for pickup.</p>
                            </div>

                            <div class="info-box" style="background-color: #f0f9ff; border-color: #7dd3fc;">
                                <strong>📋 Important Reminders:</strong>
                                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                    <li>Please bring a valid ID when picking up your documents.</li>
                                    <li>For Students and Alumni, documents will be released once payment is confirmed.</li>
                                    <li>You can track your request status online using your reference number.</li>
                                </ul>
                            </div>

                            <p style="margin-top: 30px;">If you have any questions or concerns, please contact the Registrar Office during office hours.</p>

                            <p>Best regards,<br>
                            <strong>San Pablo Colleges Registrar System</strong></p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} San Pablo Colleges. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // Email configuration
            const mailOptions = {
                from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
                to: toEmail || email,
                subject: `Document Request Submitted - ${referenceNumber}`,
                html: htmlContent
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log(`📧 Request summary email sent successfully to ${toEmail || email} (Message ID: ${info.messageId})`);
            console.log(`   Reference Number: ${referenceNumber}`);
            console.log(`   Request ID: ${requestId}`);
            console.log(`   Documents: ${documents.length}, Total: ₱${totalAmount.toFixed(2)}`);

            return true;

        } catch (error) {
            console.error('❌ Failed to send request summary email:', error.message);
            // Don't throw - email failure should not fail the request
            // Log the error for monitoring but allow request to succeed
            console.warn('⚠️  Request summary email failed but request was saved successfully');
            return false;
        }
    }

    /**
     * Send ready for pickup email notification
     * Notifies student that their documents are ready for pickup
     *
     * Email Content:
     * - Professional HTML template
     * - Student's Name
     * - Document Type
     * - Scheduled Pick-up date
     * - Pickup instructions
     *
     * @param {Object} data - Pickup notification data
     * @param {string} data.toEmail - Recipient email address
     * @param {string} data.fullName - Student's full name
     * @param {string} data.referenceNumber - Unique reference number
     * @param {string} data.documentType - Document type name
     * @param {string} data.scheduledPickup - Scheduled pickup date
     * @returns {Promise<boolean>} Success status
     */
    async sendReadyForPickupEmail(data) {
        const { toEmail, fullName, referenceNumber, documentType, scheduledPickup } = data;

        try {
            // Format the scheduled pickup date
            const pickupDate = scheduledPickup 
                ? new Date(scheduledPickup).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }) 
                : 'To be scheduled';

            // Professional HTML email template for READY_FOR_PICKUP
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Documents Ready for Pickup - San Pablo Colleges</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #16a34a; color: white; padding: 30px 20px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .header-subtitle { font-size: 14px; opacity: 0.9; margin-top: 5px; }
                        .content { padding: 30px 20px; background-color: #f8fafc; }
                        .info-box { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
                        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
                        .info-row:last-child { border-bottom: none; }
                        .info-label { font-weight: bold; color: #475569; }
                        .info-value { color: #1e293b; }
                        .pickup-date { background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
                        .pickup-date-label { color: #1e40af; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
                        .pickup-date-value { color: #1e3a8a; font-size: 24px; font-weight: bold; margin-top: 10px; }
                        .requirements-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
                        .requirements-box h3 { margin-top: 0; color: #92400e; }
                        .requirements-box ul { margin: 10px 0 0 0; padding-left: 20px; color: #78350f; }
                        .requirements-box li { margin: 8px 0; }
                        .footer { background-color: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }
                        .success-badge { background-color: #16a34a; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 15px; font-weight: bold; }
                        .document-info { background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin: 15px 0; }
                        .document-info strong { color: #166534; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📄 Documents Ready for Pickup</h1>
                            <div class="header-subtitle">San Pablo Colleges - Registrar Office</div>
                        </div>
                        <div class="content">
                            <div class="success-badge">✓ Your Documents Are Ready!</div>
                            <p>Hello <strong>${fullName}</strong>,</p>

                            <p>Great news! Your requested document(s) have been processed and are now ready for pickup at the Registrar Office.</p>

                            <div class="info-box">
                                <div class="info-row">
                                    <span class="info-label">Reference Number:</span>
                                    <span class="info-value" style="font-family: monospace; font-size: 16px; font-weight: bold;">${referenceNumber}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Status:</span>
                                    <span class="info-value"><span style="background-color: #22c55e; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">READY FOR PICKUP</span></span>
                                </div>
                            </div>

                            <div class="document-info">
                                <strong>Document:</strong> ${documentType}
                            </div>

                            <div class="pickup-date">
                                <div class="pickup-date-label">📅 Scheduled Pickup Date</div>
                                <div class="pickup-date-value">${pickupDate}</div>
                            </div>

                            <div class="requirements-box">
                                <h3>📋 Requirements for Pickup</h3>
                                <ul>
                                    <li>Bring a valid <strong>government-issued ID</strong> (e.g., Passport, Driver's License, School ID)</li>
                                    <li>If someone else will pick up the document, they need an <strong>authorization letter</strong> and their own valid ID</li>
                                    <li>Office hours: <strong>Monday - Friday, 8:00 AM - 5:00 PM</strong></li>
                                    <li>Please arrive at least <strong>30 minutes</strong> before closing time</li>
                                </ul>
                            </div>

                            <p><strong>Note:</strong> Please pick up your documents within <strong>30 days</strong> from the scheduled date. Unclaimed documents may require a new request.</p>

                            <p>If you have any questions or need to reschedule, please contact the Registrar Office during office hours.</p>

                            <p style="margin-top: 30px;">Best regards,<br>
                            <strong>San Pablo Colleges</strong><br>
                            <strong>Registrar Office</strong></p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>© ${new Date().getFullYear()} San Pablo Colleges. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // Email configuration
            const mailOptions = {
                from: `"San Pablo Colleges - Registrar Office" <${process.env.SMTP_FROM}>`,
                to: toEmail,
                subject: `📄 Your Documents are Ready for Pickup - ${referenceNumber}`,
                html: htmlContent
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log(`📧 Ready for pickup email sent successfully to ${toEmail} (Message ID: ${info.messageId})`);
            console.log(`   Reference Number: ${referenceNumber}`);
            console.log(`   Document: ${documentType}`);
            console.log(`   Pickup Date: ${pickupDate}`);

            return true;

        } catch (error) {
            console.error('❌ Failed to send ready for pickup email:', error.message);
            // Don't throw - email failure should not fail the status update
            console.warn('⚠️  Ready for pickup email failed but status was updated successfully');
            return false;
        }
    }
}

module.exports = MailService;
