import nodemailer, { Transporter } from 'nodemailer';

/**
 * Interface for email configuration
 */
export interface EmailConfig {
    gmailAddress: string;
    appPassword: string;
    enabled: boolean;
}

/**
 * Interface for email options
 */
export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
}

/**
 * Interface for email attachments
 */
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

/**
 * Interface for email sending result
 */
export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Interface for email content used in report generation
 */
export interface EmailContent {
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
}

/**
 * EmailService handles sending emails via Gmail SMTP
 */
export class EmailService {
    private transporter: Transporter | null = null;
    private config: EmailConfig | null = null;

    /**
     * Configures the email service with Gmail SMTP settings
     * @param config - Email configuration with Gmail credentials
     */
    async configure(config: EmailConfig): Promise<void> {
        try {
            this.config = config;

            if (!config.enabled) {
                this.transporter = null;
                return;
            }

            // Create Gmail SMTP transporter
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: config.gmailAddress,
                    pass: config.appPassword
                },
                secure: true, // Use SSL
                port: 465
            });

            console.log('Email service configured successfully');
        } catch (error) {
            throw new Error(`Failed to configure email service: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Tests the email configuration by attempting to verify the connection
     * @returns Promise<boolean> - True if connection is successful
     */
    async testConnection(): Promise<boolean> {
        try {
            if (!this.transporter) {
                throw new Error('Email service not configured');
            }

            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error('Email connection test failed:', error);
            return false;
        }
    }

    /**
     * Sends an email using the configured Gmail SMTP
     * @param options - Email options including recipient, subject, and content
     * @returns Promise<EmailResult> - Result of the email sending operation
     */
    async sendEmail(options: EmailOptions): Promise<EmailResult> {
        try {
            if (!this.transporter) {
                throw new Error('Email service not configured or disabled');
            }

            if (!this.config) {
                throw new Error('Email configuration not available');
            }

            // Validate email options
            this.validateEmailOptions(options);

            // Prepare email message
            const mailOptions = {
                from: `"${process.env.VITE_APP_NAME || 'Warehouse CRM'}" <${this.config.gmailAddress}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                attachments: options.attachments?.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    contentType: att.contentType
                }))
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to send email:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Validates email configuration
     * @param config - Email configuration to validate
     * @returns boolean - True if configuration is valid
     */
    static validateConfig(config: EmailConfig): boolean {
        try {
            // Validate Gmail address format
            const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
            if (!emailRegex.test(config.gmailAddress)) {
                return false;
            }

            // Validate app password format (16 characters, letters and numbers)
            const appPasswordRegex = /^[a-zA-Z0-9]{16}$/;
            if (!appPasswordRegex.test(config.appPassword)) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validates email options before sending
     * @param options - Email options to validate
     */
    private validateEmailOptions(options: EmailOptions): void {
        if (!options.to || !options.to.trim()) {
            throw new Error('Recipient email address is required');
        }

        if (!options.subject || !options.subject.trim()) {
            throw new Error('Email subject is required');
        }

        if (!options.html || !options.html.trim()) {
            throw new Error('Email content is required');
        }

        // Validate recipient email format
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(options.to)) {
            throw new Error('Invalid recipient email address format');
        }
    }

    /**
     * Gets the current configuration status
     * @returns boolean - True if service is configured and enabled
     */
    isConfigured(): boolean {
        return this.transporter !== null && this.config?.enabled === true;
    }

    /**
     * Gets the configured Gmail address
     * @returns string | null - The Gmail address or null if not configured
     */
    getGmailAddress(): string | null {
        return this.config?.gmailAddress || null;
    }
}

/**
 * Default export for the EmailService class
 */
export default EmailService;