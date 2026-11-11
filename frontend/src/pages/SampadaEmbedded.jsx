import React from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import Button from '../components/common/ui/Button';

const SAMPADA_DASHBOARD_URL = import.meta.env.VITE_SAMPADA_URL || 'http://localhost:5175/';

export const SampadaEmbedded = () => {
  const handleOpenInNewTab = () => {
    window.open(SAMPADA_DASHBOARD_URL, '_blank', 'noopener,noreferrer');
  };

  const handleReloadFrame = () => {
    const frame = document.getElementById('sampada-dashboard-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.location.reload();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Sampada Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Sampada dashboard embedded inside SETU
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReloadFrame}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open New Tab
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/30 p-2">
        <iframe
          id="sampada-dashboard-frame"
          title="Sampada Dashboard"
          src={SAMPADA_DASHBOARD_URL}
          className="w-full h-[calc(100vh-13rem)] min-h-[640px] rounded-lg bg-background"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
};

export default SampadaEmbedded;
