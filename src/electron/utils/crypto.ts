import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from 'crypto';

/**
 * Interface for structured encrypted data storage
 */
export interface EncryptedData {
    data: string;        // Base64 encoded encrypted data
    iv: string;          // Base64 encoded initialization vector
    tag: string;         // Base64 encoded authentication tag
    version: number;     // Encryption version for future compatibility
}

/**
 * CryptoService provides AES-256-GCM encryption and decryption operations
 * with secure key generation and derivation using PBKDF2
 */
export class CryptoService {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly KEY_LENGTH = 32; // 256 bits
    private static readonly IV_LENGTH = 16;  // 128 bits
    private static readonly TAG_LENGTH = 16; // 128 bits
    private static readonly PBKDF2_ITERATIONS = 100000;
    private static readonly SALT_LENGTH = 32; // 256 bits
    private static readonly CURRENT_VERSION = 1;

    /**
     * Encrypts plaintext using AES-256-GCM with the provided key
     * @param plaintext - The text to encrypt
     * @param key - The encryption key (32 bytes)
     * @returns EncryptedData object containing encrypted data, IV, and auth tag
     */
    static encrypt(plaintext: string, key: Buffer): EncryptedData {
        try {
            if (!plaintext || typeof plaintext !== 'string') {
                throw new Error('Invalid plaintext: must be a non-empty string');
            }

            if (!Buffer.isBuffer(key) || key.length !== this.KEY_LENGTH) {
                throw new Error(`Invalid key: must be a Buffer of ${this.KEY_LENGTH} bytes`);
            }

            // Generate random IV for each encryption operation
            const iv = randomBytes(this.IV_LENGTH);

            // Create cipher
            const cipher = createCipheriv(this.ALGORITHM, key, iv);

            // Encrypt the data
            let encrypted = cipher.update(plaintext, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            // Get authentication tag
            const tag = cipher.getAuthTag();

            return {
                data: encrypted,
                iv: iv.toString('base64'),
                tag: tag.toString('base64'),
                version: this.CURRENT_VERSION
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Decrypts encrypted data using AES-256-GCM with the provided key
     * @param encryptedData - The EncryptedData object to decrypt
     * @param key - The decryption key (32 bytes)
     * @returns The decrypted plaintext
     */
    static decrypt(encryptedData: EncryptedData, key: Buffer): string {
        try {
            if (!encryptedData || typeof encryptedData !== 'object') {
                throw new Error('Invalid encrypted data: must be an EncryptedData object');
            }

            const { data, iv, tag, version } = encryptedData;

            if (!data || !iv || !tag || typeof version !== 'number') {
                throw new Error('Invalid encrypted data: missing required fields');
            }

            if (!Buffer.isBuffer(key) || key.length !== this.KEY_LENGTH) {
                throw new Error(`Invalid key: must be a Buffer of ${this.KEY_LENGTH} bytes`);
            }

            // Convert base64 strings back to buffers
            const ivBuffer = Buffer.from(iv, 'base64');
            const tagBuffer = Buffer.from(tag, 'base64');

            if (ivBuffer.length !== this.IV_LENGTH) {
                throw new Error(`Invalid IV length: expected ${this.IV_LENGTH} bytes`);
            }

            if (tagBuffer.length !== this.TAG_LENGTH) {
                throw new Error(`Invalid tag length: expected ${this.TAG_LENGTH} bytes`);
            }

            // Create decipher
            const decipher = createDecipheriv(this.ALGORITHM, key, ivBuffer);
            decipher.setAuthTag(tagBuffer);

            // Decrypt the data
            let decrypted = decipher.update(data, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generates a cryptographically secure random key
     * @returns A 256-bit random key as Buffer
     */
    static generateKey(): Buffer {
        try {
            return randomBytes(this.KEY_LENGTH);
        } catch (error) {
            throw new Error(`Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Derives a key from a password using PBKDF2 with a fixed salt for multi-device compatibility
     * @param password - The password to derive key from
     * @returns The derived key as Buffer
     */
    static deriveKey(password: string): Buffer {
        try {
            if (!password || typeof password !== 'string') {
                throw new Error('Invalid password: must be a non-empty string');
            }

            // Use fixed salt for multi-device compatibility
            // Same password will always produce the same key across all devices
            const salt = this.getFixedSalt();
            return pbkdf2Sync(password, salt, this.PBKDF2_ITERATIONS, this.KEY_LENGTH, 'sha256');
        } catch (error) {
            throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets the fixed salt used for key derivation across all devices
     * @returns A fixed 256-bit salt as Buffer
     */
    static getFixedSalt(): Buffer {
        try {
            // Fixed salt ensures same password = same key across all devices
            const saltSource = 'warehouse-crm-encryption-salt-v1-fixed';
            const hash = createHash('sha256').update(saltSource, 'utf8').digest();

            // Ensure we get exactly 32 bytes
            return hash.subarray(0, this.SALT_LENGTH);
        } catch (error) {
            throw new Error(`Fixed salt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generates a cryptographically secure random salt for key derivation
     * @returns A 256-bit random salt as Buffer
     */
    static generateSalt(): Buffer {
        try {
            return randomBytes(this.SALT_LENGTH);
        } catch (error) {
            throw new Error(`Salt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validates if a string represents valid encrypted data
     * @param data - The data to validate
     * @returns True if data appears to be valid encrypted data
     */
    static isEncryptedData(data: any): data is EncryptedData {
        return (
            data &&
            typeof data === 'object' &&
            typeof data.data === 'string' &&
            typeof data.iv === 'string' &&
            typeof data.tag === 'string' &&
            typeof data.version === 'number' &&
            data.version > 0
        );
    }
}