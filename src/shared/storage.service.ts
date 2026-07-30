import { createClient } from "@supabase/supabase-js";

import { env } from "../config";

const getClient = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const getBucket = () => {
  if (!env.SUPABASE_BUCKET) throw new Error("SUPABASE_BUCKET is not configured");
  return env.SUPABASE_BUCKET;
};

export const storageService = {
  uploadAvatar: async (userId: string, buffer: Buffer, mimetype: string): Promise<string> => {
    const client = getClient();
    const bucket = getBucket();

    const ext = mimetype.split("/")[1] ?? "jpg";
    const filePath = `${userId}/${Date.now()}.${ext}`;

    const { error } = await client.storage.from(bucket).upload(filePath, buffer, {
      contentType: mimetype,
      upsert: true,
    });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = client.storage.from(bucket).getPublicUrl(filePath);

    return data.publicUrl;
  },

  deleteAvatar: async (url: string): Promise<void> => {
    const client = getClient();
    const bucket = getBucket();

    const prefix = `/storage/v1/object/public/${bucket}/`;

    const idx = url.indexOf(prefix);

    if (idx === -1) return;

    const filePath = url.slice(idx + prefix.length);

    await client.storage.from(bucket).remove([filePath]);
  },
};
