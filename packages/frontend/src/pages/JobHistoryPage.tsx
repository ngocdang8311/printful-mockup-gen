import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
    case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

function JobOutputGallery({ jobId }: { jobId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['job-outputs', jobId],
    queryFn: () => api.getJobOutputs(jobId),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-2">Loading images...</div>;

  const files = data?.files || [];
  if (files.length === 0) return <div className="text-sm text-muted-foreground py-2">No output files found.</div>;

  // Group by product
  const grouped: Record<string, typeof files> = {};
  for (const f of files) {
    if (!grouped[f.product]) grouped[f.product] = [];
    grouped[f.product].push(f);
  }

  return (
    <div className="space-y-3 pt-3 border-t">
      {Object.entries(grouped).map(([product, images]) => (
        <div key={product}>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {product.replace(/-/g, ' ').replace(/\bor\b/g, '|').replace(/\b\w/g, c => c.toUpperCase())}
            <Badge variant="secondary" className="ml-2 text-xs">{images.length}</Badge>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {images.map((img: any) => (
              <a
                key={img.path}
                href={`${img.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <img
                  src={`${img.path}`}
                  alt={img.filename}
                  className="w-full aspect-square object-cover rounded border hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
                <p className="text-[10px] text-muted-foreground truncate mt-0.5 group-hover:text-foreground">
                  {img.filename}
                </p>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobHistoryPage() {
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
    refetchInterval: 5000,
  });

  const toggleExpand = (jobId: number) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Job History</h2>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No generation jobs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => {
            const isExpanded = expandedJobs.has(job.id);
            const hasOutput = job.status === 'completed' || job.completed_tasks > 0;

            return (
              <Card key={job.id}>
                <CardContent className="py-4">
                  <div
                    className={`flex items-center justify-between ${hasOutput ? 'cursor-pointer' : ''}`}
                    onClick={() => hasOutput && toggleExpand(job.id)}
                  >
                    <div className="flex items-center gap-3">
                      {hasOutput ? (
                        isExpanded ?
                          <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        statusIcon(job.status)
                      )}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          Job #{job.id}
                          {job.provider === 'printify' && (
                            <Badge variant="outline" className="text-[10px] py-0">Printify</Badge>
                          )}
                          {hasOutput && (
                            <ImageIcon className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(job.created_at).toLocaleString()} &middot;{' '}
                          {job.completed_tasks}/{job.total_tasks} tasks
                          {job.failed_tasks > 0 && (
                            <span className="text-destructive"> ({job.failed_tasks} failed)</span>
                          )}
                        </div>
                        {job.output_dir && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {job.output_dir}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={
                      job.status === 'completed' ? 'default' :
                      job.status === 'failed' ? 'destructive' : 'secondary'
                    }>
                      {job.status}
                    </Badge>
                  </div>

                  {isExpanded && <JobOutputGallery jobId={job.id} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
