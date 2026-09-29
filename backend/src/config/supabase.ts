import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Supabase Config] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

/**
 * Server-side Admin Supabase Client (bypasses Row-Level Security)
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Storage Bucket Constants for X Chatter
 */
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  STREAK_SNAPS: 'streak-snaps',
  STORIES: 'stories-24h',
} as const;

/**
 * Helper: Generate Presigned Upload URL for clients (Avatars, Snaps, Stories)
 */
export async function createUploadSignedUrl(
  bucket: string,
  filePath: string,
  expiresInSeconds: number = 300 // 5 minutes
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/**
 * Helper: Generate Public or Signed Download URL
 */
export async function getDownloadUrl(bucket: string, filePath: string, expiresInSeconds: number = 3600): Promise<string> {
  if (bucket === STORAGE_BUCKETS.AVATARS) {
    // Avatars are public
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  // Snaps and Stories are private/time-limited
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data) {
    throw new Error(`Failed to create signed download URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Helper: Delete expired story files from Supabase Storage
 */
export async function deleteStorageFiles(bucket: string, filePaths: string[]): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove(filePaths);
  if (error) {
    console.error(`[Supabase Storage] Error deleting files from ${bucket}:`, error.message);
  }
}
