import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

export function DesignsPage() {
  const queryClient = useQueryClient();

  const { data: designs = [], isLoading } = useQuery({
    queryKey: ['designs'],
    queryFn: api.getDesigns,
  });

  const uploadMutation = useMutation({
    mutationFn: api.uploadDesign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designs'] });
      toast.success('Design uploaded');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDesign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designs'] });
      toast.success('Design deleted');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Designs</h2>

      {/* Upload zone */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm">Drop files here...</p>
            ) : (
              <div>
                <p className="text-sm font-medium">Drop design files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG up to 50MB</p>
              </div>
            )}
            {uploadMutation.isPending && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Designs list */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : designs.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No designs uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {designs.map((design: any) => (
            <Card key={design.id}>
              <CardContent className="pt-6">
                <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  <img
                    src={design.url}
                    alt={design.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{design.name}</p>
                    <div className="flex gap-2 mt-1">
                      {design.width > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {design.width}x{design.height}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {formatSize(design.file_size)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    onClick={() => {
                      if (confirm('Delete this design?')) {
                        deleteMutation.mutate(design.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
