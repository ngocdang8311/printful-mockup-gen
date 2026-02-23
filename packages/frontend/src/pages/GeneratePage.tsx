import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Zap, StopCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
}

export function GeneratePage() {
  const [searchParams] = useSearchParams();
  const [selectedPresetId, setSelectedPresetId] = useState<number>(
    Number(searchParams.get('presetId')) || 0
  );
  const [selectedDesignId, setSelectedDesignId] = useState<number>(0);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [jobData, setJobData] = useState<any>(null);

  const { data: presets = [] } = useQuery({
    queryKey: ['presets'],
    queryFn: api.getPresets,
  });

  const { data: designs = [] } = useQuery({
    queryKey: ['designs'],
    queryFn: api.getDesigns,
  });

  const generateMutation = useMutation({
    mutationFn: api.startGeneration,
    onSuccess: (job) => {
      setActiveJobId(job.id);
      setJobData(job);
      setEvents([]);
      toast.success('Generation started');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Generation failed');
    },
  });

  // SSE subscription
  useEffect(() => {
    if (!activeJobId) return;

    const unsubscribe = api.subscribeToJob(activeJobId, (data: TaskEvent) => {
      setEvents(prev => [...prev, data]);

      if (data.type === 'job_state') {
        setJobData(data);
      }
      if (data.type === 'job_completed' || data.type === 'job_failed') {
        // Refresh job data
        api.getJob(activeJobId).then(setJobData);
      }
    });

    return unsubscribe;
  }, [activeJobId]);

  const handleGenerate = () => {
    if (!selectedPresetId || !selectedDesignId) {
      toast.error('Select a preset and design');
      return;
    }
    generateMutation.mutate({ presetId: selectedPresetId, designId: selectedDesignId });
  };

  const handleCancel = () => {
    if (activeJobId) {
      api.cancelJob(activeJobId);
      toast.info('Job cancelled');
    }
  };

  const isRunning = jobData && ['pending', 'processing'].includes(jobData.status);
  const progress = jobData
    ? ((jobData.completed_tasks + jobData.failed_tasks) / Math.max(jobData.total_tasks, 1)) * 100
    : 0;

  // Collect completed mockup URLs from events
  const completedMockups = events
    .filter(e => e.type === 'task_completed' && e.mockupUrls)
    .flatMap(e => (e.mockupUrls || []).map(url => ({ url, productName: e.productName })));

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
            <div>
              <label className="text-sm font-medium mb-1 block">Design</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={selectedDesignId}
                onChange={e => setSelectedDesignId(Number(e.target.value))}
                disabled={isRunning}
              >
                <option value={0}>Select a design...</option>
                {designs.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.filename})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={!selectedPresetId || !selectedDesignId || isRunning}
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate
              </Button>
              {isRunning && (
                <Button variant="destructive" onClick={handleCancel}>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {jobData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Progress
                <Badge variant={
                  jobData.status === 'completed' ? 'default' :
                  jobData.status === 'failed' ? 'destructive' : 'secondary'
                }>
                  {jobData.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>{jobData.completed_tasks} / {jobData.total_tasks} completed</span>
                  {jobData.failed_tasks > 0 && (
                    <span className="text-destructive">{jobData.failed_tasks} failed</span>
                  )}
                </div>
                <Progress value={progress} />
              </div>

              {/* Event log */}
              <div className="max-h-48 overflow-auto space-y-1 text-sm">
                {events.map((event, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    {event.type === 'task_completed' && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                    {event.type === 'task_failed' && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                    {(event.type === 'task_submitting' || event.type === 'task_polling' || event.type === 'task_downloading') && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                    )}
                    <span className="text-muted-foreground">
                      {event.type === 'task_submitting' && `Submitting ${event.productName}...`}
                      {event.type === 'task_polling' && `Waiting for ${event.productName || 'task'}...`}
                      {event.type === 'task_downloading' && `Downloading mockups...`}
                      {event.type === 'task_completed' && `${event.productName} done`}
                      {event.type === 'task_failed' && `${event.productName}: ${event.error}`}
                      {event.type === 'job_completed' && `Job completed! ${event.completedTasks} done, ${event.failedTasks} failed`}
                      {event.type === 'job_started' && `Job started`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Gallery */}
        {completedMockups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results ({completedMockups.length} mockups)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {completedMockups.map(({ url, productName }, i) => (
                  <div key={i} className="space-y-1">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={productName || 'Mockup'}
                        className="w-full rounded-lg border hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <p className="text-xs text-muted-foreground truncate">{productName}</p>
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
