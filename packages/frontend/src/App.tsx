import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { PresetsPage } from './pages/PresetsPage';
import { PresetBuilderPage } from './pages/PresetBuilderPage';
import { GeneratePage } from './pages/GeneratePage';
import { DesignsPage } from './pages/DesignsPage';
import { JobHistoryPage } from './pages/JobHistoryPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<PresetsPage />} />
            <Route path="/presets/new" element={<PresetBuilderPage />} />
            <Route path="/presets/:id" element={<PresetBuilderPage />} />
            <Route path="/generate" element={<GeneratePage />} />
            <Route path="/designs" element={<DesignsPage />} />
            <Route path="/history" element={<JobHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

export default App;
