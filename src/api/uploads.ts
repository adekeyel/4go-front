import { apiClient } from "@/lib/apiClient";

export interface UploadResult {
  url: string;
  publicId: string;
  /** Seconds, measured by Cloudinary. Only present for audio/video. */
  duration?: number;
}

export async function uploadFile(file: File | Blob, folder: string, filename?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("folder", folder);
  const { data } = await apiClient.post<UploadResult>("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
