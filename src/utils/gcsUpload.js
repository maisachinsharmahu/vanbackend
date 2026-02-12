import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get absolute path to service account key
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyFilePath = path.resolve(__dirname, '..', 'vanmedia-8c17240cd7e0.json');

console.log('GCS Key File Path:', keyFilePath);
console.log('File exists:', fs.existsSync(keyFilePath));

// Load credentials directly from JSON file
let storage;
let credentials;

try {
    const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
    credentials = JSON.parse(keyFileContent);
    console.log('✓ Loaded credentials for:', credentials.client_email);

    storage = new Storage({
        projectId: credentials.project_id,
        credentials: credentials,
    });
    console.log('✓ GCS Storage initialized successfully');
} catch (err) {
    console.error('✗ GCS initialization failed:', err.message);
    // Fallback - will fail but won't crash the server
    storage = new Storage();
}

const bucketName = process.env.GCS_BUCKET_NAME || 'atlas-vanlife-uploads';
console.log('GCS Bucket:', bucketName);

/**
 * Upload a file buffer to Google Cloud Storage
 * @param {Buffer} fileBuffer - The file data
 * @param {string} originalName - Original filename  
 * @param {string} folder - Subfolder in bucket (e.g., 'avatars', 'photos')
 * @param {string} mimeType - File mime type
 * @returns {string} Public URL of the uploaded file
 */
export const uploadToGCS = async (fileBuffer, originalName, folder, mimeType) => {
    const bucket = storage.bucket(bucketName);

    // Create unique filename
    const ext = path.extname(originalName);
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
        metadata: {
            contentType: mimeType,
        },
        resumable: false,
    });

    // For uniform bucket-level access, don't call makePublic()
    // Bucket should be made public via IAM instead

    // Return public URL
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
};

/**
 * Delete a file from GCS by its URL
 * @param {string} fileUrl - The public URL of the file
 */
export const deleteFromGCS = async (fileUrl) => {
    try {
        const bucket = storage.bucket(bucketName);
        // Extract filename from URL
        const fileName = fileUrl.replace(`https://storage.googleapis.com/${bucketName}/`, '');
        await bucket.file(fileName).delete();
    } catch (error) {
        console.log('GCS delete error (non-fatal):', error.message);
    }
};
