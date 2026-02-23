import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';
import { ProductBrowser } from '@/components/catalog/ProductBrowser';
import { VariantPicker } from '@/components/catalog/VariantPicker';

export function PresetBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: preset } = useQuery({
    queryKey: ['preset', id],
    queryFn: () => api.getPreset(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setDescription(preset.description || '');
    }
  }, [preset]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return api.updatePreset(Number(id), { name, description });
      }
      return api.createPreset({ name, description });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      toast.success(isEdit ? 'Preset updated' : 'Preset created');
      if (!isEdit) navigate(`/presets/${data.id}`);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (item: any) => api.addPresetItem(Number(id), item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset', id] });
      setShowBrowser(false);
      setSelectedProduct(null);
      toast.success('Product added to preset');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => api.deletePresetItem(Number(id), itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset', id] });
      toast.success('Item removed');
    },
  });

  const handleAddProduct = (product: any, variantIds: number[], variantLabels: string[], placements: string[], mockupStyleOptions: any) => {
    addItemMutation.mutate({
      product_id: product.id,
      product_name: product.title || product.name || `Product ${product.id}`,
      variant_ids: variantIds,
      variant_labels: variantLabels,
      placements,
      mockup_style_options: mockupStyleOptions,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{isEdit ? 'Edit Preset' : 'New Preset'}</h2>
        <Button onClick={() => saveMutation.mutate()} disabled={!name.trim()}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>

      <div className="space-y-6">
        {/* Name & Description */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Black Shirts Collection"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </CardContent>
        </Card>

        {/* Items list */}
        {isEdit && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Products ({preset?.items?.length || 0})</CardTitle>
              <Button size="sm" onClick={() => setShowBrowser(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent>
              {(!preset?.items || preset.items.length === 0) ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No products added yet. Click "Add Product" to browse the Printful catalog.
                </p>
              ) : (
                <div className="space-y-3">
                  {preset.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-muted-foreground flex gap-2 mt-1">
                          <Badge variant="secondary">{item.variant_ids.length} variants</Badge>
                          <Badge variant="secondary">{item.placements.join(', ')}</Badge>
                        </div>
                        {item.variant_labels.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.variant_labels.slice(0, 5).join(', ')}
                            {item.variant_labels.length > 5 && ` +${item.variant_labels.length - 5} more`}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product Browser */}
        {showBrowser && !selectedProduct && (
          <ProductBrowser
            onSelect={(product) => setSelectedProduct(product)}
            onClose={() => setShowBrowser(false)}
          />
        )}

        {/* Variant Picker */}
        {selectedProduct && (
          <VariantPicker
            product={selectedProduct}
            onConfirm={handleAddProduct}
            onBack={() => setSelectedProduct(null)}
          />
        )}
      </div>
    </div>
  );
}
