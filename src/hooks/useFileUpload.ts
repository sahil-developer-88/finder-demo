
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface UploadOptions {
  fileType: 'business_document' | 'profile_image' | 'listing_image' | 'chat_attachment';
  relatedId?: string;
  maxSize?: number; // in MB
  allowedTypes?: string[];
}

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();

  const uploadFile = async (file: File, options: UploadOptions): Promise<string | null> => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload files",
        variant: "destructive",
      });
      return null;
    }

    const { fileType, relatedId, maxSize = 10, allowedTypes } = options;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxSize}MB`,
        variant: "destructive",
      });
      return null;
    }

    // Validate file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Allowed types: ${allowedTypes.join(', ')}`,
        variant: "destructive",
      });
      return null;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      // TODO: file_uploads table doesn't exist - skipping database logging
      // File is uploaded to storage successfully

      setProgress(100);
      toast({
        title: "Upload successful",
        description: "File uploaded successfully",
      });

      return publicUrl;

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('uploads')
        .remove([filePath]);

      if (error) throw error;

      // TODO: file_uploads table doesn't exist - skipping database cleanup

      toast({
        title: "File deleted",
        description: "File deleted successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    uploadFile,
    deleteFile,
    uploading,
    progress,
  };
};
