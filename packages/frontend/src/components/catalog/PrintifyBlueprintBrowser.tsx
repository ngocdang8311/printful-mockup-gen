import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import * as api from '@/api/client';

interface Props {
  onSelect: (blueprint: any) => void;
  onClose: () => void;
}

export function PrintifyBlueprintBrowser({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  const { data: blueprints = [], isLoading } = useQuery({
    queryKey: ['printify-blueprints'],
    queryFn: api.getPrintifyBlueprints,
  });

  const filtered = blueprints.filter((b: any) =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Show first 100 results to avoid overwhelming the UI
  const displayed = filtered.slice(0, 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Browse Printify Catalog</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search blueprints (e.g., t-shirt, hoodie, mug...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Loading catalog...</div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <p className="text-xs text-muted-foreground mb-2">
              {filtered.length} blueprints found{filtered.length > 100 ? ' (showing first 100)' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayed.map((bp: any) => (
                <button
                  key={bp.id}
                  onClick={() => onSelect(bp)}
                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent text-left transition-colors cursor-pointer"
                >
                  {bp.images?.length > 0 && (
                    <img
                      src={bp.images[0]}
                      alt={bp.title}
                      className="w-12 h-12 object-contain rounded"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{bp.title}</div>
                    <div className="text-xs text-muted-foreground">ID: {bp.id}</div>
                  </div>
                </button>
              ))}
            </div>
            {displayed.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No blueprints found</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
