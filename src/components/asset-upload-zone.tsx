import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, X, CheckCircle2, AlertCircle } from "lucide-react";

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface AssetUploadZoneProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  isLoading?: boolean;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
}

export function AssetUploadZone({
  onFilesSelected,
  isLoading,
  accept = "image/*,.pdf",
  multiple = true,
  maxSize = 50 * 1024 * 1024, // 50MB default
}: AssetUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadFile[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);

    // Validate files
    const validFiles = newFiles.filter((file) => {
      if (file.size > maxSize) {
        console.warn(`File ${file.name} exceeds max size`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Add to uploads list
    const newUploads = validFiles.map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Process uploads
    try {
      await onFilesSelected(validFiles);

      // Mark as done
      setUploads((prev) =>
        prev.map((u, idx) =>
          idx >= prev.length - validFiles.length
            ? { ...u, status: "done" as const, progress: 100 }
            : u
        )
      );
    } catch (error: any) {
      setUploads((prev) =>
        prev.map((u, idx) =>
          idx >= prev.length - validFiles.length
            ? {
                ...u,
                status: "error" as const,
                error: error.message || "Upload failed",
              }
            : u
        )
      );
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearUploads = () => setUploads([]);
  const removeUpload = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <Card
        className={`p-8 border-2 border-dashed transition-all cursor-pointer surface-elevated ${
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={isLoading}
        />

        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Cloud className="size-12 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">اسحب الملفات هنا</h3>
            <p className="text-xs text-muted-foreground mt-1">
              أو انقر لاختيار ملفات من جهازك
            </p>
          </div>
          <div className="flex gap-2 justify-center flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline">صور</Badge>
            <Badge variant="outline">PDF</Badge>
            <Badge variant="outline">
              حتى {formatFileSize(maxSize)}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Uploads List */}
      {uploads.length > 0 && (
        <Card className="p-4 space-y-3 surface-elevated border-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">الملفات المرفوعة</h3>
            {uploads.every((u) => u.status !== "pending" && u.status !== "uploading") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearUploads}
              >
                <X className="size-4 mr-1" />
                مسح الكل
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {uploads.map((upload, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {upload.status === "done" && (
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                  )}
                  {upload.status === "error" && (
                    <AlertCircle className="size-4 text-destructive shrink-0" />
                  )}
                  {(upload.status === "pending" ||
                    upload.status === "uploading") && (
                    <div className="size-4 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{upload.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(upload.file.size)}
                    </p>
                  </div>

                  {upload.error && (
                    <span className="text-xs text-destructive">{upload.error}</span>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => removeUpload(idx)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                {(upload.status === "uploading" || upload.status === "pending") && (
                  <Progress value={upload.progress} className="h-1" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
