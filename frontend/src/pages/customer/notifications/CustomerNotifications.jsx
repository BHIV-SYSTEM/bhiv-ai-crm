import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import financialAPI from '@/services/api/financialAPI';
import notificationAPI from '@/services/api/notificationAPI';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/ui/Card';
import Badge from '@/components/common/ui/Badge';
import Button from '@/components/common/ui/Button';
import { formatRelativeTime } from '@/utils/dateUtils';
import {
  FinanceLoading,
  FinanceError,
  FinanceEmpty,
} from '@/components/finance/FinanceStates';

const toError = (err) =>
  err?.response?.data || { code: 'upstream', message: err?.message || 'Request failed' };

/** Normalise a SETU operational notification into the ARTHA inbox shape. */
const fromSetu = (row) => ({
  ...row,
  _id: `setu_${row._id}`,
  setuId: row._id,
  source: 'setu',
  isRead: Boolean(row.read),
  type: row.level || 'info',
  category: 'SETU',
});

const TYPE_ICONS = {
  error: XCircle,
  critical: XCircle,
  warning: AlertTriangle,
  alert: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const TYPE_VARIANTS = {
  error: 'destructive',
  critical: 'destructive',
  warning: 'warning',
  alert: 'warning',
  success: 'success',
  info: 'info',
};

export const CustomerNotifications = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (filter === 'unread') params.unreadOnly = 'true';
      // Two inboxes: ARTHA's financial notifications and SETU's own
      // order/shipping notifications. Either one failing must not blank the page.
      const [arthaRes, countRes, setuRes] = await Promise.allSettled([
        financialAPI.notifications(params),
        financialAPI.unreadCount(),
        notificationAPI.list(params),
      ]);
      if (arthaRes.status === 'rejected' && setuRes.status === 'rejected') {
        throw arthaRes.reason;
      }

      let rows = [];
      let nextPagination = null;
      if (arthaRes.status === 'fulfilled') {
        const body = arthaRes.value.data || {};
        rows = Array.isArray(body.data)
          ? body.data
          : body.notifications || body.data?.notifications || [];
        nextPagination = body.pagination || body.data?.pagination || null;
      }
      const setuRows =
        setuRes.status === 'fulfilled'
          ? (setuRes.value.data?.data || []).map(fromSetu)
          : [];

      rows = [...rows, ...setuRows].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setItems(rows);
      setPagination(nextPagination);
      const arthaUnread =
        arthaRes.status === 'fulfilled' ? (countRes.value?.data?.data?.count ?? 0) : 0;
      const setuUnread =
        setuRes.status === 'fulfilled' ? (setuRes.value.data?.unread_count ?? 0) : 0;
      setUnreadCount(Number(arthaUnread) + Number(setuUnread));
    } catch (err) {
      setItems([]);
      setError(toError(err));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const markRead = async (n) => {
    if (n.isRead) return;
    try {
      if (n.source === 'setu') {
        await notificationAPI.markRead(n.setuId);
      } else {
        await financialAPI.markNotificationRead(n._id);
      }
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      const body = toError(err);
      toast.error(body.message || 'Could not mark as read');
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await Promise.allSettled([
        financialAPI.markAllNotificationsRead(),
        notificationAPI.markAllRead(),
      ]);
      toast.success('All notifications marked as read');
      fetchAll();
    } catch (err) {
      const body = toError(err);
      toast.error(body.message || 'Could not mark all as read');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            ARTHA financial updates plus SETU order, shipping and invoice events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={unreadCount ? 'destructive' : 'muted'}>{unreadCount} unread</Badge>
          <Button size="sm" variant="outline" onClick={() => navigate('/customer-portal')}>
            Back to portal
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" /> Inbox
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>
              All
            </Button>
            <Button
              size="sm"
              variant={filter === 'unread' ? 'primary' : 'outline'}
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
            <Button size="sm" variant="secondary" onClick={fetchAll}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={markAllRead} disabled={busy || unreadCount === 0}>
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Mark all read
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <FinanceLoading label="Loading notifications…" />
          ) : error ? (
            <FinanceError error={error} />
          ) : items.length === 0 ? (
            <FinanceEmpty
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              body="Order, shipping and invoice events will appear here as they happen."
            />
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Info;
                const variant = TYPE_VARIANTS[n.type] || 'info';
                return (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => markRead(n)}
                    className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                      n.isRead ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      <Icon className={`h-5 w-5 ${variant === 'destructive' ? 'text-destructive' : variant === 'warning' ? 'text-warning' : variant === 'success' ? 'text-success' : 'text-info'}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatRelativeTime(new Date(n.createdAt))}
                        </span>
                      </span>
                      {n.body ? (
                        <span className="block text-xs text-muted-foreground mt-0.5">{n.body}</span>
                      ) : null}
                      <span className="flex gap-1.5 mt-1.5">
                        {n.category ? <Badge variant="muted">{n.category}</Badge> : null}
                        {!n.isRead ? <Badge variant="info">new</Badge> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {pagination && pagination.pages > 1 ? (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerNotifications;
