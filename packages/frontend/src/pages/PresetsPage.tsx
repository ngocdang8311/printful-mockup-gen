import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

export function PresetsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['presets'],
    queryFn: api.getPresets,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deletePreset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      toast.success('Preset deleted');
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Presets</h2>
          <p className="text-muted-foreground">Manage your product mockup presets</p>
        </div>
        <Button asChild>
          <Link to="/presets/new">
            <Plus className="h-4 w-4 mr-2" />
            New Preset
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : presets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No presets yet. Create your first one!</p>
            <Button asChild>
              <Link to="/presets/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Preset
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset: any) => (
            <Card key={preset.id}>
              <CardHeader>
                <CardTitle>{preset.name}</CardTitle>
                {preset.description && (
                  <CardDescription>{preset.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">
                  {new Date(preset.updated_at).toLocaleDateString()}
                </Badge>
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/presets/${preset.id}`)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(`/generate?presetId=${preset.id}`)}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Generate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  onClick={() => {
                    if (confirm('Delete this preset?')) {
                      deleteMutation.mutate(preset.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
