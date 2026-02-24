import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Zap, StopCircle, CheckCircle, XCircle, Loader2, Image, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

interface TaskEvent {
  type: string;
  taskId?: number;
  productName?: string;
  mockupUrls?: string[];
  error?: string;
  jobId?: number;
  status?: string;
  completedTasks?: number;
  failedTasks?: number;
  totalTasks?: number;
}

interface JobTracker {
  jobId: number;
  designName: string;
  status: string;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  events: TaskEvent[];
  mockupUrls: Array<{ url: string; productName?: string }>;
}

function formatPlacement(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function GeneratePage() {
  const [searchParams] = useSearchParams();
  const [selectedPresetId, setSelectedPresetId] = useState<number>(
    Number(searchParams.get('presetId')) || 0
  );
  const [selectedDesignIds, setSelectedDesignIds] = useState<Set<number>>(new Set());
  // Per-placement design overrides (only for single-design mode)
  const [placementDesignOverrides, setPlacementDesignOverrides] = useState<Record<string, number>>({});
  const [jobTrackers, setJobTrackers] = useState<JobTracker[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const unsubscribeRefs = useRef<Array<() => void>>([]);

  const { data: presets = [] } = useQuery({
    queryKey: ['presets'],
    queryFn: api.getPresets,
  });

  const { data: designs = [] } = useQuery({
    queryKey: ['designs'],
    queryFn: api.getDesigns,
  });

  const { data: presetDetail } = useQuery({
    queryKey: ['preset', selectedPresetId],
    queryFn: () => api.getPreset(selectedPresetId),
    enabled: selectedPresetId > 0,
  });

  const uniquePlacements = useMemo(() => {
    if (!presetDetail?.items) return [];
    const placementSet = new Set<string>();
    for (const item of presetDetail.items) {
      for (const p of item.placements || []) {
        placementSet.add(p);
      }
    }
    return Array.from(placementSet);
  }, [presetDetail]);

  // Reset when preset changes
  useEffect(() => {
    setPlacementDesignOverrides({});
  }, [selectedPresetId]);

  // Cleanup SSE subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const unsub of unsubscribeRefs.current) unsub();
    };
  }, []);

  const toggleDesign = (id: number) => {
    setSelectedDesignIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDesigns = () => {
    if (selectedDesignIds.size === designs.length) {
      setSelectedDesignIds(new Set());
    } else {
      setSelectedDesignIds(new Set(designs.map((d: any) => d.id)));
    }
  };

  const subscribeToJobUpdates = useCallback((jobId: number, trackerIndex: number) => {
    const unsub = api.subscribeToJob(jobId, (data: TaskEvent) => {
      setJobTrackers(prev => {
        const updated = [...prev];
        const tracker = { ...updated[trackerIndex] };

        tracker.events = [...tracker.events, data];

        if (data.type === 'job_state' && (data as any).job) {
          const job = (data as any).job;
          tracker.status = job.status;
          tracker.completedTasks = job.completed_tasks;
          tracker.failedTasks = job.failed_tasks;
          tracker.totalTasks = job.total_tasks;
        }
        if (data.type === 'task_completed') {
          tracker.completedTasks++;
          if (data.mockupUrls) {
            tracker.mockupUrls = [
              ...tracker.mockupUrls,
              ...data.mockupUrls.map(url => ({ url, productName: data.productName })),
            ];
          }
        }
        if (data.type === 'task_failed') {
          tracker.failedTasks++;
        }
        if (data.type === 'job_completed' || data.type === 'job_failed') {
          tracker.status = data.status || (data.type === 'job_completed' ? 'completed' : 'failed');
          if (data.completedTasks !== undefined) tracker.completedTasks = data.completedTasks;
          if (data.failedTasks !== undefined) tracker.failedTasks = data.failedTasks;
        }

        updated[trackerIndex] = tracker;
        return updated;
      });
    });
    unsubscribeRefs.current.push(unsub);
  }, []);

  const handleGenerate = async () => {
    if (!selectedPresetId || selectedDesignIds.size === 0) {
      toast.error('Select a preset and at least one design');
      return;
    }

    // Cleanup old subscriptions
    for (const unsub of unsubscribeRefs.current) unsub();
    unsubscribeRefs.current = [];

    setIsGenerating(true);
    setJobTrackers([]);

    const designIdsArray = Array.from(selectedDesignIds);
    const isSingleDesign = designIdsArray.length === 1;

    // Build designMap for single-design mode
    let designMap: Record<string, number> | undefined;
    if (isSingleDesign) {
      const map: Record<string, number> = {};
      for (const [placement, dId] of Object.entries(placementDesignOverrides)) {
        if (dId && dId !== designIdsArray[0]) {
          map[placement] = dId;
        }
      }
      if (Object.keys(map).length > 0) designMap = map;
    }

    const newTrackers: JobTracker[] = [];

    for (let i = 0; i < designIdsArray.length; i++) {
      const designId = designIdsArray[i];
      const design = designs.find((d: any) => d.id === designId);
      const designName = design?.name || `Design ${designId}`;

      try {
        const job = await api.startGeneration({
          presetId: selectedPresetId,
          designId,
          designMap: isSingleDesign ? designMap : undefined,
        });

        const tracker: JobTracker = {
          jobId: job.id,
          designName,
          status: job.status || 'processing',
          completedTasks: 0,
          failedTasks: 0,
          totalTasks: job.total_tasks || 0,
          events: [],
          mockupUrls: [],
        };
        newTrackers.push(tracker);
        setJobTrackers([...newTrackers]);

        // Subscribe to SSE
        subscribeToJobUpdates(job.id, i);
      } catch (err: any) {
        toast.error(`Failed to start ${designName}: ${err.response?.data?.error || err.message}`);
      }
    }

    if (newTrackers.length > 0) {
      toast.success(`Started ${newTrackers.length} generation job${newTrackers.length > 1 ? 's' : ''}`);
    }
    setIsGenerating(false);
  };

  const handleCancelAll = () => {
    for (const tracker of jobTrackers) {
      if (['pending', 'processing'].includes(tracker.status)) {
        api.cancelJob(tracker.jobId);
      }
    }
    toast.info('Jobs cancelled');
  };

  const isRunning = isGenerating || jobTrackers.some(t => ['pending', 'processing'].includes(t.status));

  // Aggregate progress
  const totalTasks = jobTrackers.reduce((s, t) => s + t.totalTasks, 0);
  const totalCompleted = jobTrackers.reduce((s, t) => s + t.completedTasks, 0);
  const totalFailed = jobTrackers.reduce((s, t) => s + t.failedTasks, 0);
  const overallProgress = totalTasks > 0 ? ((totalCompleted + totalFailed) / totalTasks) * 100 : 0;

  // All mockups from all jobs
  const allMockups = jobTrackers.flatMap(t =>
    t.mockupUrls.map(m => ({ ...m, designName: t.designName }))
  );

  const isSingleDesign = selectedDesignIds.size === 1;
  const hasMultiplePlacements = uniquePlacements.length > 1;
  const singleDesignId = isSingleDesign ? Array.from(selectedDesignIds)[0] : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Generate Mockups</h2>

      <div className="grid gap-6">
        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Preset</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={selectedPresetId}
                onChange={e => setSelectedPresetId(Number(e.target.value))}
                disabled={isRunning}
              >
                <option value={0}>Select a preset...</option>
                {presets.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Design multi-select */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">
                  Designs
                  {selectedDesignIds.size > 0 && (
                    <Badge variant="secondary" className="ml-2">{selectedDesignIds.size} selected</Badge>
                  )}
                </label>
                {designs.length > 1 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={selectAllDesigns}
                    disabled={isRunning}
                    type="button"
                  >
                    {selectedDesignIds.size === designs.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="border rounded-md max-h-48 overflow-auto">
                {designs.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No designs uploaded yet</div>
                ) : (
                  designs.map((d: any) => {
                    const isSelected = selectedDesignIds.has(d.id);
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                          isSelected ? 'bg-accent' : ''
                        } ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => toggleDesign(d.id)}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                        }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="text-sm truncate">{d.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{d.width}x{d.height}</span>
                      </div>
                    );
                  })
                )}
              </div>
              {selectedDesignIds.size > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Each design will generate a separate job ({selectedDesignIds.size} jobs total)
                </p>
              )}
            </div>

            {/* Per-placement design overrides (only in single-design mode with multiple placements) */}
            {isSingleDesign && hasMultiplePlacements && singleDesignId > 0 && (
              <div className="border rounded-md p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Image className="h-4 w-4" />
                  Design per Placement
                </div>
                {uniquePlacements.map(placement => (
                  <div key={placement} className="flex items-center gap-3">
                    <span className="text-sm min-w-[120px]">{formatPlacement(placement)}</span>
                    <select
                      className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={placementDesignOverrides[placement] || 0}
                      onChange={e => {
                        setPlacementDesignOverrides(prev => ({
                          ...prev,
                          [placement]: Number(e.target.value),
                        }));
                      }}
                      disabled={isRunning}
                    >
                      <option value={0}>Same as default</option>
                      {designs.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.filename})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={!selectedPresetId || selectedDesignIds.size === 0 || isRunning}
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate{selectedDesignIds.size > 1 ? ` (${selectedDesignIds.size} jobs)` : ''}
              </Button>
              {isRunning && (
                <Button variant="destructive" onClick={handleCancelAll}>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancel All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {jobTrackers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Progress
                {jobTrackers.length > 1 && (
                  <Badge variant="secondary">{jobTrackers.length} jobs</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall progress */}
              {jobTrackers.length > 1 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Overall: {totalCompleted} / {totalTasks} completed</span>
                    {totalFailed > 0 && (
                      <span className="text-destructive">{totalFailed} failed</span>
                    )}
                  </div>
                  <Progress value={overallProgress} />
                </div>
              )}

              {/* Per-job progress */}
              <div className="space-y-3">
                {jobTrackers.map(tracker => {
                  const jobProgress = tracker.totalTasks > 0
                    ? ((tracker.completedTasks + tracker.failedTasks) / tracker.totalTasks) * 100
                    : 0;

                  return (
                    <div key={tracker.jobId} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {tracker.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                          {tracker.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                          {['pending', 'processing'].includes(tracker.status) && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          <span className="text-sm font-medium">{tracker.designName}</span>
                          <span className="text-xs text-muted-foreground">Job #{tracker.jobId}</span>
                        </div>
                        <Badge variant={
                          tracker.status === 'completed' ? 'default' :
                          tracker.status === 'failed' ? 'destructive' : 'secondary'
                        } className="text-xs">
                          {tracker.completedTasks}/{tracker.totalTasks}
                        </Badge>
                      </div>
                      <Progress value={jobProgress} className="h-1.5" />

                      {/* Event log (collapsed by default for multi-job, shown for single) */}
                      {(jobTrackers.length === 1 || tracker.events.length <= 5) && tracker.events.length > 0 && (
                        <div className="max-h-32 overflow-auto space-y-0.5 text-xs">
                          {tracker.events.filter(e => e.type !== 'job_state').map((event, i) => (
                            <div key={i} className="flex items-center gap-1.5 py-0.5">
                              {event.type === 'task_completed' && <CheckCircle className="h-2.5 w-2.5 text-green-500 shrink-0" />}
                              {event.type === 'task_failed' && <XCircle className="h-2.5 w-2.5 text-destructive shrink-0" />}
                              {(event.type === 'task_submitting' || event.type === 'task_polling' || event.type === 'task_downloading') && (
                                <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />
                              )}
                              <span className="text-muted-foreground">
                                {event.type === 'task_submitting' && `Submitting ${event.productName}...`}
                                {event.type === 'task_polling' && `Waiting for ${event.productName || 'task'}...`}
                                {event.type === 'task_downloading' && `Downloading...`}
                                {event.type === 'task_completed' && `${event.productName} done`}
                                {event.type === 'task_failed' && `${event.productName}: ${event.error}`}
                                {event.type === 'job_completed' && `Done! ${event.completedTasks} completed, ${event.failedTasks} failed`}
                                {event.type === 'job_started' && `Started`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Gallery */}
        {allMockups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results ({allMockups.length} mockups)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allMockups.map(({ url, productName, designName }, i) => (
                  <div key={i} className="space-y-1">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={productName || 'Mockup'}
                        className="w-full rounded-lg border hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <p className="text-xs text-muted-foreground truncate">
                      {productName}
                      {jobTrackers.length > 1 && designName && (
                        <span className="text-[10px]"> - {designName}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
