
import React, { useRef } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/useFileUpload';

interface FileUploadProps {
  fileType: 'business_document' | 'profile_image' | 'listing_image' | 'chat_attachment';
  relatedId?: string;
  maxSize?: number;
  allowedTypes?: string[];
  onUploadComplete?: (url: string) => void;
  accept?: string;
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  fileType,
  relatedId,
  maxSize = 10,
  allowedTypes,
  onUploadComplete,
  accept,
  multiple = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading, progress } = useFileUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // Handle single file for now
    const url = await uploadFile(file, {
      fileType,
      relatedId,
      maxSize,
      allowedTypes,
    });

    if (url && onUploadComplete) {
      onUploadComplete(url);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Uploading file...</p>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-gray-500">{progress}% complete</p>
            </div>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={triggerFileSelect}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Click to upload file
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or drag and drop your file here
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>Maximum file size: {maxSize}MB</p>
              {allowedTypes && (
                <p>Allowed types: {allowedTypes.join(', ')}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <Button
            onClick={triggerFileSelect}
            disabled={uploading}
            className="w-full sm:w-auto"
          >
            <File className="h-4 w-4 mr-2" />
            Select File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
