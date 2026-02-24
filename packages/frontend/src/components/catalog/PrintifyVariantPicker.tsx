import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

interface Props {
  blueprint: any;
  onConfirm: (
    blueprint: any,
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
  representativeId: number;
}

export function PrintifyVariantPicker({ blueprint, onConfirm, onBack }: Props) {
  const [selectedProviderId, setSelectedProviderId] = useState<number>(0);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedPlacements, setSelectedPlacements] = useState<Set<string>>(new Set());

  // Fetch providers for this blueprint
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['printify-providers', blueprint.id],
    queryFn: () => api.getPrintifyBlueprintProviders(blueprint.id),
  });

  // Fetch variants when a provider is selected
  const { data: variantData, isLoading: loadingVariants } = useQuery({
    queryKey: ['printify-variants', blueprint.id, selectedProviderId],
    queryFn: () => api.getPrintifyBlueprintVariants(blueprint.id, selectedProviderId),
    enabled: selectedProviderId > 0,
  });

  const variants = variantData?.variants || variantData || [];

  // Extract available placements from first variant's placeholders
  const availablePlacements: Array<{ key: string; label: string; width: number; height: number }> = useMemo(() => {
    if (!Array.isArray(variants) || variants.length === 0) return [];
    const first = variants[0];
    if (!first.placeholders) return [];
    return first.placeholders.map((ph: any) => ({
      key: ph.position,
      label: ph.position.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      width: ph.width,
      height: ph.height,
    }));
  }, [variants]);

  // Auto-select "front" when placements load
  useEffect(() => {
    if (availablePlacements.length > 0 && selectedPlacements.size === 0) {
      const front = availablePlacements.find(p => p.key === 'front');
      setSelectedPlacements(new Set([front ? front.key : availablePlacements[0].key]));
    }
  }, [availablePlacements]);

  // Group variants by color
  const colorGroups: ColorGroup[] = useMemo(() => {
    if (!Array.isArray(variants)) return [];
    const groups = new Map<string, any[]>();
    for (const v of variants) {
      const color = v.options?.color || v.title?.split(' / ')?.[0] || v.title || 'Default';
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color)!.push(v);
    }
    return Array.from(groups.entries()).map(([color, vars]) => {
      const sizes = vars.map((v: any) => v.options?.size || '').filter(Boolean);
      return {
        color,
        colorCode: null,
        variants: vars,
        sizeRange: sizes.length > 1 ? `${sizes[0]}-${sizes[sizes.length - 1]}` : sizes[0] || '',
        representativeId: vars[0].id,
      };
    });
  }, [variants]);

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

  const togglePlacement = (key: string) => {
    setSelectedPlacements(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = colorGroups.filter(g => selectedColors.has(g.color));
    const variantIds = selected.map(g => g.representativeId);
    const variantLabels = selected.map(g => g.color);
    const placements = Array.from(selectedPlacements);
    const mockupStyleOptions = { print_provider_id: selectedProviderId };
    onConfirm(blueprint, variantIds, variantLabels, placements, mockupStyleOptions);
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
              {blueprint.images?.[0] && (
                <img src={blueprint.images[0]} alt="" className="w-8 h-8 object-contain rounded" />
              )}
              {blueprint.title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Print Provider</h4>
          {loadingProviders ? (
            <div className="text-muted-foreground text-sm">Loading providers...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto">
              {providers.map((prov: any) => (
                <button
                  key={prov.id}
                  onClick={() => {
                    setSelectedProviderId(prov.id);
                    setSelectedColors(new Set());
                    setSelectedPlacements(new Set());
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selectedProviderId === prov.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="text-sm font-medium">{prov.title}</div>
                  <div className="text-xs text-muted-foreground">ID: {prov.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Placements */}
        {selectedProviderId > 0 && availablePlacements.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Placements (where design is printed)</h4>
            <div className="flex flex-wrap gap-2">
              {availablePlacements.map(p => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={selectedPlacements.has(p.key) ? 'default' : 'outline'}
                  onClick={() => togglePlacement(p.key)}
                >
                  {p.label}
                  <span className="ml-1 text-xs opacity-60">{p.width}x{p.height}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select which positions to apply the design. Mockup images for all angles are always generated.
            </p>
          </div>
        )}

        {/* Variant Selection */}
        {selectedProviderId > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">
                Colors ({selectedColors.size} / {colorGroups.length} selected)
              </h4>
              {colorGroups.length > 0 && (
                <Button size="sm" variant={allColorsSelected ? 'default' : 'outline'} onClick={selectAllColors}>
                  {allColorsSelected ? <Check className="h-3 w-3 mr-1" /> : null}
                  {allColorsSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
            {loadingVariants ? (
              <div className="text-muted-foreground text-sm">Loading variants...</div>
            ) : (
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
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleConfirm}
          disabled={selectedColors.size === 0 || selectedProviderId === 0 || selectedPlacements.size === 0}
        >
          Add {selectedColors.size} color(s) with {selectedPlacements.size} placement(s)
        </Button>
      </CardFooter>
    </Card>
  );
}
