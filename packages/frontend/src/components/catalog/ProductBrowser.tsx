import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import * as api from '@/api/client';

interface Props {
  onSelect: (product: any) => void;
  onClose: () => void;
}

export function ProductBrowser({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['catalog-products'],
    queryFn: api.getCatalogProducts,
  });

  const filtered = products.filter((p: any) =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.type?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by type
  const grouped = filtered.reduce((acc: Record<string, any[]>, p: any) => {
    const type = p.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Browse Printful Catalog</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products (e.g., t-shirt, hoodie...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Loading catalog...</div>
        ) : (
          <div className="max-h-96 overflow-auto space-y-4">
            {Object.entries(grouped).map(([type, prods]) => (
              <div key={type}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">{type}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(prods as any[]).map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => onSelect(product)}
                      className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent text-left transition-colors cursor-pointer"
                    >
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-12 h-12 object-contain rounded"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{product.title}</div>
                        <div className="text-xs text-muted-foreground">ID: {product.id}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="text-muted-foreground text-center py-4">No products found</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
