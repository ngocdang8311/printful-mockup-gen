import { useState, useMemo, useEffect } from 'react';
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

interface ColorGroup {
  color: string;
  colorCode: string | null;
  variants: any[];
  sizeRange: string;
  representativeId: number; // first variant id (used for mockup)
}

export function VariantPicker({ product, onConfirm, onBack }: Props) {
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedPlacements, setSelectedPlacements] = useState<Set<string>>(new Set());
  const [selectedOptionGroups, setSelectedOptionGroups] = useState<Set<string>>(new Set());
  const [downloadExtras, setDownloadExtras] = useState(false);

  const { data: productDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['catalog-product', product.id],
    queryFn: () => api.getCatalogProduct(product.id),
  });

  const { data: placementData } = useQuery({
    queryKey: ['product-placements', product.id],
    queryFn: () => api.getProductPlacements(product.id),
  });

  const variants = productDetail?.variants || [];

  // Group variants by color → one representative variant per color
  const colorGroups: ColorGroup[] = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const v of variants) {
      const color = v.color || 'Default';
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color)!.push(v);
    }
    return Array.from(groups.entries()).map(([color, vars]) => {
      const sizes = vars.map((v: any) => v.size).filter(Boolean);
      return {
        color,
        colorCode: vars[0]?.color_code || null,
        variants: vars,
        sizeRange: sizes.length > 1 ? `${sizes[0]}–${sizes[sizes.length - 1]}` : sizes[0] || '',
        representativeId: vars[0].id,
      };
    });
  }, [variants]);

  // Available placements from printfiles API (with human-readable labels)
  const availablePlacements: Array<{ key: string; label: string }> = useMemo(() => {
    const map = placementData?.placements || {};
    const entries = Object.entries(map);
    if (entries.length === 0) return [{ key: 'front', label: 'Front' }];
    return entries.map(([key, label]) => ({ key, label: label as string }));
  }, [placementData]);

  // Auto-select first placement when data loads
  useEffect(() => {
    if (availablePlacements.length > 0 && selectedPlacements.size === 0) {
      setSelectedPlacements(new Set([availablePlacements[0].key]));
    }
  }, [availablePlacements]);

  // Known mockup style option_groups
  const KNOWN_OPTION_GROUPS = [
    { id: 'Flat', name: 'Flat (garment only)' },
    { id: 'Lifestyle', name: 'Lifestyle' },
    { id: 'Lifestyle 2', name: 'Lifestyle 2' },
    { id: 'On model', name: 'On model' },
  ];

  const toggleColor = (color: string) => {
    setSelectedColors(prev => {
      const next = new Set(prev);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      return next;
    });
  };

  const selectAllColors = () => {
    const allColors = colorGroups.map(g => g.color);
    const allSelected = allColors.every(c => selectedColors.has(c));
    if (allSelected) {
      setSelectedColors(new Set());
    } else {
      setSelectedColors(new Set(allColors));
    }
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
    // One representative variant per selected color
    const selected = colorGroups.filter(g => selectedColors.has(g.color));
    const variantIds = selected.map(g => g.representativeId);
    const variantLabels = selected.map(g => g.color);
    const placements = Array.from(selectedPlacements);
    const mockupStyleOptions: any = {};
    if (selectedOptionGroups.size > 0) {
      mockupStyleOptions.option_groups = Array.from(selectedOptionGroups);
    }
    if (downloadExtras) {
      mockupStyleOptions.download_extras = true;
    }
    onConfirm(product, variantIds, variantLabels, placements, mockupStyleOptions);
  };

  const allColorsSelected = colorGroups.length > 0 && colorGroups.every(g => selectedColors.has(g.color));

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
                {availablePlacements.map(p => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={selectedPlacements.has(p.key) ? 'default' : 'outline'}
                    onClick={() => togglePlacement(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mockup Style */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Mockup Style</h4>
              <div className="flex flex-wrap gap-2">
                {KNOWN_OPTION_GROUPS.map(g => (
                  <Button
                    key={g.id}
                    size="sm"
                    variant={selectedOptionGroups.has(g.id) ? 'default' : 'outline'}
                    onClick={() => toggleOptionGroup(g.id)}
                  >
                    {g.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Not all styles are available for every product. Unavailable styles will be ignored.
              </p>
            </div>

            {/* Extra Views */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Extra Views</h4>
              <Button
                size="sm"
                variant={downloadExtras ? 'default' : 'outline'}
                onClick={() => setDownloadExtras(!downloadExtras)}
              >
                {downloadExtras ? <Check className="h-3 w-3 mr-1" /> : null}
                Download all extra angles
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Main mockup is always saved. Enable to also download extra angles (back, sides, etc.)
              </p>
            </div>

            {/* Color Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">
                  Colors ({selectedColors.size} / {colorGroups.length} selected)
                </h4>
                <Button size="sm" variant={allColorsSelected ? 'default' : 'outline'} onClick={selectAllColors}>
                  {allColorsSelected ? <Check className="h-3 w-3 mr-1" /> : null}
                  {allColorsSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-auto">
                {colorGroups.map(group => {
                  const isSelected = selectedColors.has(group.color);
                  return (
                    <button
                      key={group.color}
                      onClick={() => toggleColor(group.color)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:bg-accent'
                      }`}
                    >
                      {group.colorCode && (
                        <div
                          className="w-6 h-6 rounded-full border shrink-0"
                          style={{ backgroundColor: group.colorCode }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{group.color}</div>
                        {group.sizeRange && (
                          <div className="text-xs text-muted-foreground">{group.sizeRange}</div>
                        )}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />}
                    </button>
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
          disabled={selectedColors.size === 0 || selectedPlacements.size === 0}
        >
          Add {selectedColors.size} color(s) with {selectedPlacements.size} placement(s)
        </Button>
      </CardFooter>
    </Card>
  );
}
