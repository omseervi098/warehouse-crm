import keytar from 'keytar';
import { CryptoService } from './crypto.js';

/**
 * Interface for key metadata tracking
 */
export interface KeyMetadata {
    createdAt: Date;
    lastRotated: Date;
    version: number;
}

/**
 * KeyManager handles secure storage and management of encryption keys
 * using the system keystore via keytar integration
 */
export class KeyManager {
    private static readonly KEYTAR_SERVICE = 'warehouse-crm';
    private static readonly KEYTAR_ACCOUNT_ENCRYPTION_KEY = 'ENCRYPTION_KEY';
    private static readonly KEYTAR_ACCOUNT_KEY_METADATA = 'ENCRYPTION_KEY_METADATA';


    /**
     * Checks if an encryption key exists in the keystore
     * @returns Promise<boolean> - True if encryption key exists
     */
    static async hasEncryptionKey(): Promise<boolean> {
        try {
            const key = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_ENCRYPTION_KEY);
            return Boolean(key);
        } catch (error) {
            throw new Error(`Failed to check encryption key existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieves the encryption key from the keystore
     * @returns Promise<Buffer | null> - The encryption key or null if not found
     */
    static async getEncryptionKey(): Promise<Buffer | null> {
        try {
            const keyBase64 = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_ENCRYPTION_KEY);
            if (!keyBase64) {
                return null;
            }
            return Buffer.from(keyBase64, 'base64');
        } catch (error) {
            throw new Error(`Failed to retrieve encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Stores an encryption key in the keystore
     * @param key - The encryption key to store
     * @returns Promise<void>
     */
    static async setEncryptionKey(key: Buffer): Promise<void> {
        try {
            if (!Buffer.isBuffer(key) || key.length !== 32) {
                throw new Error('Invalid key: must be a 32-byte Buffer');
            }

            const keyBase64 = key.toString('base64');
            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_ENCRYPTION_KEY, keyBase64);

            // Update metadata
            const now = new Date();
            const metadata: KeyMetadata = {
                createdAt: now,
                lastRotated: now,
                version: 1
            };
            await this.setKeyMetadata(metadata);
        } catch (error) {
            throw new Error(`Failed to store encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Stores an encryption key derived from a password
     * @param password - The password to derive the key from
     * @returns Promise<void>
     */
    static async setEncryptionKeyFromPassword(password: string): Promise<void> {
        try {
            if (!password || typeof password !== 'string' || password.length < 8) {
                throw new Error('Invalid password: must be at least 8 characters long');
            }

            // Derive key from password using fixed salt
            const key = CryptoService.deriveKey(password);
            await this.setEncryptionKey(key);
        } catch (error) {
            throw new Error(`Failed to set encryption key from password: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Rotates the encryption key with a new key
     * @param newKey - The new encryption key
     * @returns Promise<void>
     */
    static async rotateKey(newKey: Buffer): Promise<void> {
        try {
            if (!Buffer.isBuffer(newKey) || newKey.length !== 32) {
                throw new Error('Invalid new key: must be a 32-byte Buffer');
            }

            // Get current metadata to preserve creation date
            const currentMetadata = await this.getKeyMetadata();

            // Store new key
            const keyBase64 = newKey.toString('base64');
            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_ENCRYPTION_KEY, keyBase64);

            // Update metadata with rotation info
            const now = new Date();
            const metadata: KeyMetadata = {
                createdAt: currentMetadata?.createdAt || now,
                lastRotated: now,
                version: (currentMetadata?.version || 0) + 1
            };
            await this.setKeyMetadata(metadata);
        } catch (error) {
            throw new Error(`Failed to rotate encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clears the encryption key from the keystore
     * @returns Promise<void>
     */
    static async clearEncryptionKey(): Promise<void> {
        try {
            await keytar.deletePassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_ENCRYPTION_KEY);
            await keytar.deletePassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_KEY_METADATA);
        } catch (error) {
            throw new Error(`Failed to clear encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieves key metadata from the keystore
     * @returns Promise<KeyMetadata | null> - The key metadata or null if not found
     */
    static async getKeyMetadata(): Promise<KeyMetadata | null> {
        try {
            const metadataJson = await keytar.getPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_KEY_METADATA);
            if (!metadataJson) {
                return null;
            }

            const metadata = JSON.parse(metadataJson);
            return {
                createdAt: new Date(metadata.createdAt),
                lastRotated: new Date(metadata.lastRotated),
                version: metadata.version
            };
        } catch (error) {
            throw new Error(`Failed to retrieve key metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Stores key metadata in the keystore
     * @param metadata - The metadata to store
     * @returns Promise<void>
     */
    private static async setKeyMetadata(metadata: KeyMetadata): Promise<void> {
        try {
            const metadataJson = JSON.stringify({
                createdAt: metadata.createdAt.toISOString(),
                lastRotated: metadata.lastRotated.toISOString(),
                version: metadata.version
            });
            await keytar.setPassword(this.KEYTAR_SERVICE, this.KEYTAR_ACCOUNT_KEY_METADATA, metadataJson);
        } catch (error) {
            throw new Error(`Failed to store key metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }



    /**
     * Validates if the current key is strong enough
     * @returns Promise<boolean> - True if key meets strength requirements
     */
    static async validateKeyStrength(): Promise<boolean> {
        try {
            const key = await this.getEncryptionKey();
            if (!key) {
                return false;
            }

            // Check if key is 256 bits (32 bytes)
            if (key.length !== 32) {
                return false;
            }

            // Basic entropy check - ensure key is not all zeros or all same value
            const firstByte = key[0];
            const allSame = key.every(byte => byte === firstByte);
            if (allSame) {
                return false;
            }

            return true;
        } catch (error) {
            throw new Error(`Failed to validate key strength: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Checks if key rotation is recommended based on age
     * @param maxAgeMonths - Maximum age in months before rotation is recommended (default: 6)
     * @returns Promise<boolean> - True if rotation is recommended
     */
    static async isRotationRecommended(maxAgeMonths: number = 6): Promise<boolean> {
        try {
            const metadata = await this.getKeyMetadata();
            if (!metadata) {
                return false; // No key exists
            }

            const now = new Date();
            const lastRotated = metadata.lastRotated;
            const monthsDiff = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24 * 30);

            return monthsDiff >= maxAgeMonths;
        } catch (error) {
            throw new Error(`Failed to check rotation recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}