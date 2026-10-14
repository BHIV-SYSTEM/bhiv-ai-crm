import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react';
import Button from '../components/common/ui/Button';
import Badge from '../components/common/ui/Badge';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/MongoAuthContext';
import apiClient from '@/services/api/baseAPI';

const AI_ARTHA_DASHBOARD_URL = import.meta.env.VITE_ARTHA_URL || 'http://localhost:5173/';

/**
 * Embedded ARTHA with real single sign-on.
 *
 * Flow (see backend `routes/auth.js`):
 *   1. POST /api/auth/sso/artha/ticket  → one-time 60s ticket (never the JWT itself)
 *   2. Point the iframe at GET /api/auth/sso/artha?ticket=…
 *      → SETU swaps the ticket for an HttpOnly `blackhole_token` cookie
 *        (host-scoped, so localhost:3000 / 5173 / 8000 share it) and 302s
 *        to the ARTHA SPA, which loads already signed in.
 * No token ever appears in a URL, and the user never re-enters a password.
 */
export const AIArthaEmbedded = () => {
  const { user } = useAuth();
  const iframeRef = useRef(null);
  const [handingOff, setHandingOff] = useState(false);
  const [frameUrl, setFrameUrl] = useState(AI_ARTHA_DASHBOARD_URL);

  const startSso = useCallback(async () => {
    try {
      setHandingOff(true);
      const res = await apiClient.post('/api/auth/sso/artha/ticket');
      const ticket = res.data?.data?.ticket;
      if (!ticket) throw new Error('No SSO ticket returned');
      // Navigate the iframe through SETU's exchange endpoint. The ARTHA JWT
      // stays server-side; only the opaque ticket is ever in this URL.
      setFrameUrl(
        `http://localhost:8000/api/auth/sso/artha?ticket=${encodeURIComponent(ticket)}`
      );
    } catch (error) {
      console.error('Artha SSO failed:', error);
      const code = error.response?.data?.code;
      if (code === 'bridge_not_provisioned') {
        toast.error('No ARTHA account is linked to this SETU account yet.');
      } else {
        toast.error(
          error.response?.data?.message || 'Single sign-on into ARTHA failed.'
        );
      }
      // Fall back to loading ARTHA directly (it will show its own login).
      setFrameUrl(AI_ARTHA_DASHBOARD_URL);
    } finally {
      setHandingOff(false);
    }
  }, []);

  useEffect(() => {
    startSso();
  }, [startSso]);

  const handleOpenInNewTab = async () => {
    try {
      const res = await apiClient.post('/api/auth/sso/artha/ticket');
      const ticket = res.data?.data?.ticket;
      window.open(
        `http://localhost:8000/api/auth/sso/artha?ticket=${encodeURIComponent(ticket)}`,
        '_blank',
        'noopener,noreferrer'
      );
    } catch {
      window.open(AI_ARTHA_DASHBOARD_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-heading font-bold tracking-tight">AI Artha Dashboard</h1>
            <Badge variant="outline" className="flex items-center gap-1 border-primary/40 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Financial AI Engine
            </Badge>
            {user && (
              <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Signed in as {user.email}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Real-time dealer credit ledgers, financial summaries, and Tally insights
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={startSso} disabled={handingOff}>
            {handingOff ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Reload
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Direct Tab
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/30 p-2 shadow-lg">
        <iframe
          ref={iframeRef}
          id="ai-artha-dashboard-frame"
          title="AI Artha Financial Dashboard"
          src={frameUrl}
          className="w-full h-[calc(100vh-13rem)] min-h-[640px] rounded-lg bg-background border-0"
          loading="lazy"
          allow="fullscreen; clipboard-write; storage-access"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Lock className="h-3 w-3" />
        Single sign-on: your ARTHA session is handed off through a one-time ticket —
        the token never appears in the URL.
      </p>
    </div>
  );
};

export default AIArthaEmbedded;
