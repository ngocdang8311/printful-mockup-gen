import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, CheckCircle, XCircle, Loader2, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/api/client';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [printifyToken, setPrintifyToken] = useState('');
  const [printifyShopId, setPrintifyShopId] = useState('');
  const [publicUrl, setPublicUrl] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setPublicUrl(settings.publicUrl || '');
      setPrintifyShopId(settings.printifyShopId || '');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setToken('');
      setPrintifyToken('');
      toast.success(data.message || 'Settings saved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save');
    },
  });

  const testMutation = useMutation({
    mutationFn: api.testConnection,
  });

  const testPrintifyMutation = useMutation({
    mutationFn: api.testPrintifyConnection,
  });

  const handleSave = () => {
    const updates: any = {};
    if (token.trim()) updates.printfulToken = token.trim();
    if (printifyToken.trim()) updates.printifyToken = printifyToken.trim();
    if (printifyShopId !== (settings?.printifyShopId || '')) updates.printifyShopId = printifyShopId;
    if (publicUrl.trim()) updates.publicUrl = publicUrl.trim();
    if (Object.keys(updates).length === 0) {
      toast.info('Nothing to save');
      return;
    }
    saveMutation.mutate(updates);
  };

  const handleTest = () => {
    testMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.success) {
          toast.success(`Connected! Found ${data.productCount} products in catalog.`);
        } else {
          toast.error(`Connection failed: ${data.error}`);
        }
      },
    });
  };

  const handleTestPrintify = () => {
    testPrintifyMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.success) {
          toast.success(`Connected! Found ${data.shops.length} shop(s).`);
        } else {
          toast.error(`Connection failed: ${data.error}`);
        }
      },
    });
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6 max-w-2xl">
        {/* Printful Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Printful API Token
              {settings?.printfulTokenSet ? (
                <Badge className="bg-green-600">Connected</Badge>
              ) : (
                <Badge variant="destructive">Not set</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Get your API token from Printful Dashboard &rarr; Settings &rarr; API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings?.printfulTokenSet && (
              <div className="text-sm text-muted-foreground">
                Current token: <code className="bg-muted px-1 rounded">{settings.printfulToken}</code>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">
                {settings?.printfulTokenSet ? 'Update token' : 'Enter token'}
              </label>
              <Input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste your Printful API token here"
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testMutation.isPending || !settings?.printfulTokenSet}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            {testMutation.data && (
              <span className="flex items-center gap-1 text-sm">
                {testMutation.data.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">{testMutation.data.productCount} products</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Failed</span>
                  </>
                )}
              </span>
            )}
          </CardFooter>
        </Card>

        {/* Printify Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Printify API Token
              {settings?.printifyTokenSet ? (
                <Badge className="bg-green-600">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not set</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Get your API token from Printify &rarr; My Account &rarr; Connections &rarr; Personal Access Token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings?.printifyTokenSet && (
              <div className="text-sm text-muted-foreground">
                Current token: <code className="bg-muted px-1 rounded">{settings.printifyToken}</code>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">
                {settings?.printifyTokenSet ? 'Update token' : 'Enter token'}
              </label>
              <Input
                type="password"
                value={printifyToken}
                onChange={e => setPrintifyToken(e.target.value)}
                placeholder="Paste your Printify API token here"
              />
            </div>
            {settings?.printifyTokenSet && (
              <div>
                <label className="text-sm font-medium mb-1 block">Shop ID</label>
                <Input
                  value={printifyShopId}
                  onChange={e => setPrintifyShopId(e.target.value)}
                  placeholder="Enter your Printify shop ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Test Connection" to see your available shops and their IDs.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleTestPrintify}
              disabled={testPrintifyMutation.isPending || !settings?.printifyTokenSet}
            >
              {testPrintifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            {testPrintifyMutation.data && (
              <span className="flex items-center gap-1 text-sm">
                {testPrintifyMutation.data.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">
                      {testPrintifyMutation.data.shops.map((s: any) =>
                        `${s.title} (ID: ${s.id})`
                      ).join(', ')}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Failed</span>
                  </>
                )}
              </span>
            )}
          </CardFooter>
        </Card>

        {/* Public URL */}
        <Card>
          <CardHeader>
            <CardTitle>Public URL</CardTitle>
            <CardDescription>
              Printful needs a public URL to access your design images.
              Use ngrok or cloudflare tunnel, then paste the URL here.
              (Not needed for Printify — designs are uploaded directly.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={publicUrl}
              onChange={e => setPublicUrl(e.target.value)}
              placeholder="e.g., https://abc123.ngrok.io"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Run <code className="bg-muted px-1 rounded">ngrok http {settings?.port || '3003'}</code> to
              get a public URL, then paste it here.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
