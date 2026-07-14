"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  currentImage?: string;
  fallback: string;
  onImageUploaded: (url: string) => void | Promise<void>;
  folder?: string;
  size?: "sm" | "md" | "lg";
  showUploadToast?: boolean;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export default function ImageUpload({
  currentImage,
  fallback,
  onImageUploaded,
  folder = "pets",
  size = "md",
  showUploadToast = true,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      setPreview(json.url);
      await onImageUploaded(json.url);
      if (showUploadToast) toast.success("Image uploaded!");
    } catch (err: unknown) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
      setPreview(currentImage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setPreview(undefined);
    try {
      await onImageUploaded("");
    } catch {
      setPreview(currentImage);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative group">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={preview} alt="Profile" />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {fallback}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <Camera className="h-4 w-4 text-white" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} className="text-xs h-6 px-2">
            <X className="h-3 w-3 mr-1" /> Remove
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
