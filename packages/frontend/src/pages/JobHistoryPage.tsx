import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import * as api from '@/api/client';

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
    case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export function JobHistoryPage() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
    refetchInterval: 5000,
  });

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
          {jobs.map((job: any) => (
            <Card key={job.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(job.status)}
                  <div>
                    <div className="font-medium">Job #{job.id}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()} &middot;{' '}
                      {job.completed_tasks}/{job.total_tasks} tasks
                      {job.failed_tasks > 0 && (
                        <span className="text-destructive"> ({job.failed_tasks} failed)</span>
                      )}
                    </div>
                    {job.output_dir && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Output: {job.output_dir}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
