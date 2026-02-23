import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

interface Props {
  product: any;
  onConfirm: (
    product: any,
    variantIds: number[],
    variantLabels: string[],
    placements: string[],
    mockupStyleOptions: any
  ) => void;
  onBack: () => void;
}

export function VariantPicker({ product, onConfirm, onBack }: Props) {
  const [selectedVariants, setSelectedVariants] = useState<Map<number, string>>(new Map());
  const [selectedPlacements, setSelectedPlacements] = useState<Set<string>>(new Set(['front']));
  const [selectedOptionGroups, setSelectedOptionGroups] = useState<Set<string>>(new Set());

  const { data: productDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['catalog-product', product.id],
    queryFn: () => api.getCatalogProduct(product.id),
  });

  const { data: templates } = useQuery({
    queryKey: ['product-templates', product.id],
    queryFn: () => api.getProductTemplates(product.id),
  });

  const variants = productDetail?.variants || [];

  // Group variants by color
  const colorGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const v of variants) {
      const color = v.color || 'Default';
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color)!.push(v);
    }
    return groups;
  }, [variants]);

  // Available placements from templates
  const availablePlacements = useMemo(() => {
    if (!templates?.available_placements) return ['front', 'back'];
    return Object.keys(templates.available_placements);
  }, [templates]);

  // Option groups from templates
  const optionGroups = useMemo(() => {
    return templates?.option_groups || [];
  }, [templates]);

  const toggleVariant = (variantId: number, label: string) => {
    setSelectedVariants(prev => {
      const next = new Map(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.set(variantId, label);
      return next;
    });
  };

  const selectAllOfColor = (color: string) => {
    const colorVars = colorGroups.get(color) || [];
    setSelectedVariants(prev => {
      const next = new Map(prev);
      const allSelected = colorVars.every(v => next.has(v.id));
      for (const v of colorVars) {
        if (allSelected) next.delete(v.id);
        else next.set(v.id, `${v.color} / ${v.size}`);
      }
      return next;
    });
  };

  const togglePlacement = (placement: string) => {
    setSelectedPlacements(prev => {
      const next = new Set(prev);
      if (next.has(placement)) next.delete(placement);
      else next.add(placement);
      return next;
    });
  };

  const toggleOptionGroup = (group: string) => {
    setSelectedOptionGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleConfirm = () => {
    const variantIds = Array.from(selectedVariants.keys());
    const variantLabels = Array.from(selectedVariants.values());
    const placements = Array.from(selectedPlacements);
    const mockupStyleOptions: any = {};
    if (selectedOptionGroups.size > 0) {
      mockupStyleOptions.option_groups = Array.from(selectedOptionGroups);
    }
    onConfirm(product, variantIds, variantLabels, placements, mockupStyleOptions);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="flex items-center gap-2">
              {product.image && (
                <img src={product.image} alt="" className="w-8 h-8 object-contain rounded" />
              )}
              {product.title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingDetail ? (
          <div className="text-muted-foreground">Loading variants...</div>
        ) : (
          <>
            {/* Placements */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Placements</h4>
              <div className="flex flex-wrap gap-2">
                {availablePlacements.map((p: string) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={selectedPlacements.has(p) ? 'default' : 'outline'}
                    onClick={() => togglePlacement(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Option Groups (Flat/Lifestyle) */}
            {optionGroups.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Mockup Style</h4>
                <div className="flex flex-wrap gap-2">
                  {optionGroups.map((g: any) => (
                    <Button
                      key={g.id || g.name}
                      size="sm"
                      variant={selectedOptionGroups.has(g.id || g.name) ? 'default' : 'outline'}
                      onClick={() => toggleOptionGroup(g.id || g.name)}
                    >
                      {g.name || g.id}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Groups */}
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Variants ({selectedVariants.size} selected)
              </h4>
              <div className="space-y-3 max-h-96 overflow-auto">
                {Array.from(colorGroups.entries()).map(([color, vars]) => {
                  const allSelected = vars.every((v: any) => selectedVariants.has(v.id));
                  return (
                    <div key={color} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {vars[0]?.color_code && (
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: vars[0].color_code }}
                            />
                          )}
                          <span className="text-sm font-medium">{color}</span>
                          <Badge variant="secondary" className="text-xs">{vars.length} sizes</Badge>
                        </div>
                        <Button
                          size="sm"
                          variant={allSelected ? 'default' : 'outline'}
                          onClick={() => selectAllOfColor(color)}
                        >
                          {allSelected ? <Check className="h-3 w-3 mr-1" /> : null}
                          Select All
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {vars.map((v: any) => (
                          <Button
                            key={v.id}
                            size="sm"
                            variant={selectedVariants.has(v.id) ? 'default' : 'outline'}
                            className="text-xs h-7"
                            onClick={() => toggleVariant(v.id, `${v.color} / ${v.size}`)}
                          >
                            {v.size}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleConfirm}
          disabled={selectedVariants.size === 0 || selectedPlacements.size === 0}
        >
          Add {selectedVariants.size} variants with {selectedPlacements.size} placement(s)
        </Button>
      </CardFooter>
    </Card>
  );
}
