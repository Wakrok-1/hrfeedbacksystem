import { useRef, useState } from "react";
import { Upload, X, FileVideo, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "video/mp4", "video/quicktime"];
const MAX_FILE_MB = 20;
const MAX_TOTAL_MB = 60;
const MAX_FILES = 5;

export interface LocalFile {
  file: File;
  preview: string | null; // object URL for images
  id: string;
}

interface FileUploadProps {
  files: LocalFile[];
  onChange: (files: LocalFile[]) => void;
  error?: string;
}

export function FileUpload({ files, onChange, error }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = (incoming: File[], existing: LocalFile[]): string | null => {
    if (existing.length + incoming.length > MAX_FILES)
      return `Maximum ${MAX_FILES} files allowed`;

    const totalMB =
      existing.reduce((s, f) => s + f.file.size / 1024 / 1024, 0) +
      incoming.reduce((s, f) => s + f.size / 1024 / 1024, 0);

    if (totalMB > MAX_TOTAL_MB) return `Total size exceeds ${MAX_TOTAL_MB}MB`;

    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type))
        return `${f.name}: only JPG, PNG, MP4, MOV allowed`;
      if (f.size / 1024 / 1024 > MAX_FILE_MB)
        return `${f.name} exceeds ${MAX_FILE_MB}MB`;
    }
    return null;
  };

  const addFiles = (raw: FileList | null) => {
    if (!raw) return;
    const incoming = Array.from(raw);
    const err = validate(incoming, files);
    if (err) { setValidationError(err); return; }
    setValidationError(null);

    const newFiles: LocalFile[] = incoming.map((f) => ({
      file: f,
      id: crypto.randomUUID(),
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    onChange([...files, ...newFiles]);
  };

  const removeFile = (id: string) => {
    const removed = files.find((f) => f.id === id);
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    onChange(files.filter((f) => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = ""; // allow re-selecting same file
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
          files.length >= MAX_FILES && "pointer-events-none opacity-50"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          <span className="font-medium text-primary">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, MP4, MOV · Max {MAX_FILE_MB}MB per file · {MAX_TOTAL_MB}MB total · Up to {MAX_FILES} files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.mp4,.mov"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Validation error */}
      {(validationError || error) && (
        <p className="text-sm text-destructive">{validationError ?? error}</p>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f) => (
            <div key={f.id} className="relative rounded-lg border bg-muted/30 p-2">
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="absolute -right-2 -top-2 z-10 rounded-full bg-destructive p-0.5 text-white hover:bg-destructive/90"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {f.preview ? (
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="h-20 w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-20 w-full items-center justify-center rounded bg-muted">
                  <FileVideo className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <p className="mt-1 truncate text-xs text-muted-foreground">{f.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(f.file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {files.length}/{MAX_FILES} files · Min 1 file required
      </p>
    </div>
  );
}
