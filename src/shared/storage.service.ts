import { env } from "../config";

const getConfig = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  }
  if (!env.SUPABASE_BUCKET) {
    throw new Error("SUPABASE_BUCKET is not configured");
  }
  return { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY, bucket: env.SUPABASE_BUCKET };
};

const uploadFile = async (filePath: string, buffer: Buffer, mimetype: string): Promise<string> => {
  const { url, key, bucket } = getConfig();

  const res = await fetch(`${url}/storage/v1/object/${bucket}/${filePath}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mimetype,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }

  return `${url}/storage/v1/object/public/${bucket}/${filePath}`;
};

export const storageService = {
  uploadAvatar: (userId: string, buffer: Buffer, mimetype: string): Promise<string> => {
    const ext = mimetype.split("/")[1] ?? "jpg";
    return uploadFile(`${userId}/${Date.now()}.${ext}`, buffer, mimetype);
  },

  uploadTaskPhoto: (
    taskId: string,
    type: "before" | "after",
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> => {
    const ext = mimetype.split("/")[1] ?? "jpg";
    return uploadFile(`tasks/${taskId}/${type}-${Date.now()}.${ext}`, buffer, mimetype);
  },

  deleteAvatar: async (avatarUrl: string): Promise<void> => {
    const { url, key, bucket } = getConfig();
    const prefix = `/storage/v1/object/public/${bucket}/`;
    const idx = avatarUrl.indexOf(prefix);
    if (idx === -1) return;
    const filePath = avatarUrl.slice(idx + prefix.length);

    await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [filePath] }),
    });
  },
};
