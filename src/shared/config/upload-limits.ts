/**
 * Centralized file upload size limits configuration
 * All file size limits across the application should reference this file
 */

export const UPLOAD_LIMITS = {
  // Standard file size limits (in bytes)
  SMALL_FILE: 2 * 1024 * 1024,      // 2MB - for profile pictures, small attachments
  MEDIUM_FILE: 5 * 1024 * 1024,     // 5MB - for standard documents
  LARGE_FILE: 10 * 1024 * 1024,     // 10MB - for large documents

  // HTTP body parser limits
  JSON_BODY: 50 * 1024 * 1024,      // 50MB - for JSON payloads
  URLENCODED_BODY: 50 * 1024 * 1024, // 50MB - for form data
  PARAMETER_LIMIT: 50000,            // Maximum number of parameters in URL-encoded data

  // Multiple file upload limits
  MAX_FILES_PER_UPLOAD: 10,         // Maximum number of files in a single upload

  // Specific use case limits
  TRANSACTION_DOCUMENT: 5 * 1024 * 1024,    // 5MB per transaction document
  SUPPORT_TICKET_ATTACHMENT: 5 * 1024 * 1024, // 5MB for support tickets
  AGENT_PROFILE_PICTURE: 2 * 1024 * 1024,   // 2MB for agent profile pictures
  PASSPORT_IMAGE: 5 * 1024 * 1024,          // 5MB for passport images
  PROOF_OF_PAYMENT: 5 * 1024 * 1024,        // 5MB for payment proofs
} as const;

/**
 * Helper function to format file size for error messages
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
};

/**
 * Helper function to get file size limit in MB
 */
export const getFileSizeInMB = (bytes: number): number => {
  return bytes / (1024 * 1024);
};
