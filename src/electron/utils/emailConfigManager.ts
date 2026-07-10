import keytar from 'keytar';
import { EmailConfig, EmailService } from './emailService.js';

/**
 * EmailConfigManager handles secure storage and retrieval of email configuration
 * using the system keystore via keytar integration
 */
export class EmailConfigManager {
    private static readonly KEYTAR_SERVICE = 'warehouse-crm';
    private static readonly KEYTAR_ACCOUNT_GMAIL_ADDRESS = 'EMAIL_GMAIL_ADDRESS';
    private static readonly KEYTAR_ACCOUNT_APP_PASSWORD = 'EMAIL_APP_PASSWORD';
    private static readonly KEYTAR_ACCOUNT_EMAIL_ENABLED = 'EMAIL_ENABLED';

    /**
     * Checks if email configuration exists in the keystore
     * @returns Promise<boolean> - True if email configuration exists
     */
    static async hasConfig(): Promise<boolean> {
        try {
            const gmailAddress = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_GMAIL_ADDRESS);
            const appPassword = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_APP_PASSWORD);
            return Boolean(gmailAddress && appPassword);
        } catch (error) {
            throw new Error(`Failed to check email configuration existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieves the email configuration from the keystore
     * @returns Promise<EmailConfig | null> - The email configuration or null if not found
     */
    static async getConfig(): Promise<EmailConfig | null> {
        try {
            const gmailAddress = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_GMAIL_ADDRESS);
            const appPassword = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_APP_PASSWORD);
            const enabledStr = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_EMAIL_ENABLED);

            if (!gmailAddress || !appPassword) {
                return null;
            }

            return {
                gmailAddress,
                appPassword,
                enabled: enabledStr === 'true'
            };
        } catch (error) {
            throw new Error(`Failed to retrieve email configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Stores email configuration in the keystore
     * @param config - The email configuration to store
     * @returns Promise<void>
     */
    static async setConfig(config: EmailConfig): Promise<void> {
        try {
            // Validate configuration before storing
            if (!EmailService.validateConfig(config)) {
                throw new Error('Invalid email configuration provided');
            }

            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_GMAIL_ADDRESS, config.gmailAddress);
            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_APP_PASSWORD, config.appPassword);
            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_EMAIL_ENABLED, config.enabled.toString());
        } catch (error) {
            throw new Error(`Failed to store email configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Updates only the enabled status of email configuration
     * @param enabled - Whether email functionality should be enabled
     * @returns Promise<void>
     */
    static async setEnabled(enabled: boolean): Promise<void> {
        try {
            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_EMAIL_ENABLED, enabled.toString());
        } catch (error) {
            throw new Error(`Failed to update email enabled status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clears the email configuration from the keystore
     * @returns Promise<void>
     */
    static async clearConfig(): Promise<void> {
        try {
            await keytar.deletePassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_GMAIL_ADDRESS);
            await keytar.deletePassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_APP_PASSWORD);
            await keytar.deletePassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_EMAIL_ENABLED);
        } catch (error) {
            throw new Error(`Failed to clear email configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Tests the email configuration by attempting to connect
     * @param config - Optional configuration to test (uses stored config if not provided)
     * @returns Promise<boolean> - True if connection test is successful
     */
    static async testConfig(config?: EmailConfig): Promise<boolean> {
        try {
            const testConfig = config || await this.getConfig();

            if (!testConfig) {
                throw new Error('No email configuration available to test');
            }

            // Create a temporary email service instance for testing
            const emailService = new EmailService();
            await emailService.configure(testConfig);

            return await emailService.testConnection();
        } catch (error) {
            console.error('Email configuration test failed:', error);
            return false;
        }
    }

    /**
     * Validates email configuration format without testing connection
     * @param config - The configuration to validate
     * @returns boolean - True if configuration format is valid
     */
    static validateConfigFormat(config: EmailConfig): boolean {
        return EmailService.validateConfig(config);
    }

    /**
     * Gets only the Gmail address from stored configuration (for display purposes)
     * @returns Promise<string | null> - The Gmail address or null if not configured
     */
    static async getGmailAddress(): Promise<string | null> {
        try {
            return await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_GMAIL_ADDRESS);
        } catch (error) {
            throw new Error(`Failed to retrieve Gmail address: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets only the enabled status from stored configuration
     * @returns Promise<boolean> - The enabled status (defaults to false if not set)
     */
    static async getEnabled(): Promise<boolean> {
        try {
            const enabledStr = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_EMAIL_ENABLED);
            return enabledStr === 'true';
        } catch (error) {
            throw new Error(`Failed to retrieve email enabled status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

/**
 * Default export for the EmailConfigManager class
 */
export default EmailConfigManager;