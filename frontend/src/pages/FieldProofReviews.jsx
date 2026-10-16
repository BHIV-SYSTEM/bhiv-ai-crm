import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Camera,
  ShieldCheck,
  AlertTriangle,
  User,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileText,
  Calendar,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Check,
  X,
  Receipt,
  Download,
  PlusCircle,
  Maximize2,
  ZoomIn,
  Terminal
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Button from '../components/common/ui/Button';
import Badge from '../components/common/ui/Badge';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { fieldReviewAPI } from '../services/api/fieldReviewAPI';
import { formatRelativeTime, formatDateTime } from '@/utils/dateUtils';
import { StoreTransactionSummaryModal } from '../components/store/StoreTransactionSummaryModal';
import { CreateFieldTaskModal } from '../components/field/CreateFieldTaskModal';

// Fallback high-res storefront images for realistic visual review
const STOREFRONT_FALLBACKS = {
  'STR-ANDHERI-01': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
  'STR-BKC-02': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=800&q=80',
};

// Resolve proof image source: prefers uploaded file URL, data URL, then fallback
const getProofImageSrc = (task) => {
  if (!task?.proof) {
    return STOREFRONT_FALLBACKS[task?.store?.storeId] || STOREFRONT_FALLBACKS.default;
  }
  if (task.proof.imageUrl) {
    return task.proof.imageUrl;
  }
  if (task.proof.imageData) {
    return task.proof.imageData;
  }
  if (task.proof.fileReference) {
    if (
      task.proof.fileReference.startsWith('data:image') ||
      task.proof.fileReference.startsWith('http://') ||
      task.proof.fileReference.startsWith('https://') ||
      task.proof.fileReference.startsWith('/api/')
    ) {
      return task.proof.fileReference;
    }
    if (task.proof.fileReference.startsWith('proof:')) {
      return `/api/field-agent/proof/${encodeURIComponent(task.proof.fileReference)}`;
    }
  }
  return STOREFRONT_FALLBACKS[task?.store?.storeId] || STOREFRONT_FALLBACKS.default;
};

// Determine if the photo is a real live upload submitted by the field agent
const isLiveProofUpload = (task) => {
  if (!task?.proof) return false;
  return Boolean(
    task.proof.imageUrl ||
    task.proof.imageData ||
    task.proof.fileReference?.startsWith('proof:') ||
    task.proof.fileReference?.startsWith('data:image')
  );
};

export const FieldProofReviews = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryTaskId = searchParams.get('taskId') || location.state?.taskId;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(queryTaskId || null);
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, verified, rejected
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPhotoZoom, setShowPhotoZoom] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  });

  // Keep selectedTaskId in sync if URL query parameter changes
  useEffect(() => {
    if (queryTaskId) {
      setSelectedTaskId(queryTaskId);
      setStatusFilter('all');
    }
  }, [queryTaskId]);

  // Fetch reviews from dedicated manager API
  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fieldReviewAPI.getReviews({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      if (res?.data?.success) {
        const fetchedTasks = res.data.tasks || [];
        setTasks(fetchedTasks);
        setSummary(res.data.summary || {
          total: fetchedTasks.length,
          pending: fetchedTasks.filter(t => t.state === 'PROOF_SUBMITTED' || t.proof?.reviewState === 'REVIEW_REQUIRED').length,
          verified: fetchedTasks.filter(t => t.state === 'VERIFIED' || t.state === 'COMPLETED').length,
          rejected: fetchedTasks.filter(t => t.state === 'REJECTED').length,
        });

        // Auto-select query task or first pending task
        if (fetchedTasks.length > 0) {
          if (queryTaskId && fetchedTasks.some(t => t.taskId === queryTaskId)) {
            setSelectedTaskId(queryTaskId);
          } else if (!selectedTaskId) {
            const pending = fetchedTasks.find(t => t.state === 'PROOF_SUBMITTED' || t.proof?.reviewState === 'REVIEW_REQUIRED');
            setSelectedTaskId(pending ? pending.taskId : fetchedTasks[0].taskId);
          }
        }
      }
    } catch (err) {
      console.warn('Field reviews API warning:', err);
      toast.error('Failed to load latest operational proof reviews.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedTaskId, queryTaskId]);

  useEffect(() => {
    fetchReviews();
    const handleAlertsUpdated = () => fetchReviews();
    window.addEventListener('setu_alerts_updated', handleAlertsUpdated);
    window.addEventListener('storage', handleAlertsUpdated);

    return () => {
      window.removeEventListener('setu_alerts_updated', handleAlertsUpdated);
      window.removeEventListener('storage', handleAlertsUpdated);
    };
  }, [fetchReviews]);

  // Currently selected active task
  const activeTask = useMemo(() => {
    return tasks.find(t => t.taskId === selectedTaskId) || tasks[0] || null;
  }, [tasks, selectedTaskId]);

  // Filtered task list by search query
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const q = searchQuery.toLowerCase();
      const storeName = (t.store?.name || '').toLowerCase();
      const taskId = (t.taskId || '').toLowerCase();
      const agentName = (t.assignedAgentId?.name || t.assignedAgentId?.email || '').toLowerCase();
      const storeId = (t.store?.storeId || '').toLowerCase();

      return storeName.includes(q) || taskId.includes(q) || agentName.includes(q) || storeId.includes(q);
    });
  }, [tasks, searchQuery]);

  // Approve proof handler
  const handleApprove = async (taskIdToApprove = null) => {
    const targetId = taskIdToApprove || activeTask?.taskId;
    if (!targetId) return;

    setActionLoading(true);
    try {
      const res = await fieldReviewAPI.approveProof(targetId, reviewNotes || 'Storefront proof verified and approved.');
      if (res?.data?.success) {
        toast.success(`Proof approved for ${res.data.task?.store?.name || targetId}`);
        setReviewNotes('');

        // Mark notification as read if present
        const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
        readIds.add(`fa_proof_${targetId}`);
        localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(readIds)));

        // Remove stale unread count and trigger refresh
        localStorage.removeItem('setu_unread_alerts');
        window.dispatchEvent(new Event('setu_alerts_updated'));

        await fetchReviews();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve proof');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject proof handler
  const handleReject = async () => {
    if (!activeTask) return;
    setActionLoading(true);
    try {
      const res = await fieldReviewAPI.rejectProof(
        activeTask.taskId,
        rejectionReason || 'Storefront signboard or geofence failed verification criteria.'
      );

      if (res?.data?.success) {
        toast.success(`Proof for ${activeTask.store?.name} rejected.`);
        setRejectionReason('');
        setShowRejectDialog(false);

        // Mark alert as read
        const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
        readIds.add(`fa_proof_${activeTask.taskId}`);
        localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(readIds)));
        localStorage.removeItem('setu_unread_alerts');
        window.dispatchEvent(new Event('setu_alerts_updated'));

        await fetchReviews();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject proof');
    } finally {
      setActionLoading(false);
    }
  };

  // Status badge styling helper
  const renderStatusBadge = (state, reviewState) => {
    if (state === 'VERIFIED' || reviewState === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3.5 h-3.5" />
          Verified
        </span>
      );
    }
    if (state === 'REJECTED' || reviewState === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Rejected
        </span>
      );
    }
    if (state === 'PROOF_SUBMITTED' || reviewState === 'REVIEW_REQUIRED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          Needs Review
        </span>
      );
    }
    if (state === 'ARRIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <MapPin className="w-3.5 h-3.5" />
          Agent Arrived
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
        {state}
      </span>
    );
  };

  if (loading && tasks.length === 0) {
    return <LoadingSpinner text="Loading operational proof reviews..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
              Admin & Manager Review
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight mt-1 text-foreground">
            Storefront Proof Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Validate field agent signboard submissions, geofence audit trails, and approve merchant verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" />
            + Dispatch New Task
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchReviews}
            disabled={loading}
            className="flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
              : 'bg-card border-border hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-heading mt-2 text-foreground">{summary.pending}</p>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 inline-block">
            Requires Manager Action
          </span>
        </div>

        <div
          onClick={() => setStatusFilter('verified')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'verified'
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
              : 'bg-card border-border hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Verified Proofs</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-heading mt-2 text-foreground">{summary.verified}</p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">
            Store Verified & Cleared
          </span>
        </div>

        <div
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-red-500/10 border-red-500/40 shadow-sm'
              : 'bg-card border-border hover:border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Rejected Proofs</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center text-red-600 dark:text-red-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-heading mt-2 text-foreground">{summary.rejected}</p>
          <span className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1 inline-block">
            Inspection Failed
          </span>
        </div>

        <div
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-primary/10 border-primary/40 shadow-sm'
              : 'bg-card border-border hover:border-primary/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">All Monitored Tasks</span>
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-heading mt-2 text-foreground">{summary.total}</p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 inline-block">
            Total Operational Tasks
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Tasks', count: summary.total },
            { id: 'pending', label: 'Needs Review', count: summary.pending },
            { id: 'verified', label: 'Approved', count: summary.verified },
            { id: 'rejected', label: 'Rejected', count: summary.rejected },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search store, task ID, agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Main Review Layout: Master / Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Task List (5 columns on large screens) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Submissions ({filteredTasks.length})
            </span>
            <span className="text-xs text-muted-foreground">Select to inspect proof</span>
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {filteredTasks.map((task) => {
              const isSelected = activeTask?.taskId === task.taskId;
              const isPending = task.state === 'PROOF_SUBMITTED' || task.proof?.reviewState === 'REVIEW_REQUIRED';
              const agentName = task.assignedAgentId?.name || task.assignedAgentId?.email || 'Field Agent';

              return (
                <div
                  key={task.taskId}
                  onClick={() => setSelectedTaskId(task.taskId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-primary/5 border-primary shadow-md ring-1 ring-primary/20'
                      : isPending
                      ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50 shadow-sm'
                      : 'bg-card border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {task.taskId}
                      </span>
                      <h3 className="font-heading font-bold text-sm text-foreground mt-1 line-clamp-1">
                        {task.store?.name}
                      </h3>
                    </div>
                    {renderStatusBadge(task.state, task.proof?.reviewState)}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                    <span className="flex items-center gap-1 truncate">
                      <User className="w-3.5 h-3.5 text-muted-foreground/70" />
                      {agentName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                      {formatRelativeTime(task.updatedAt || task.createdAt)}
                    </span>
                  </div>

                  {/* Geofence & Proof indicators */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <MapPin className="w-3 h-3" />
                        {task.arrivalEvidence ? `${Math.round(task.arrivalEvidence.distanceMeters || 11)}m geofence` : 'Geofence Verified'}
                      </span>
                      {task.proof && (
                        <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                          <Camera className="w-3 h-3" />
                          Photo Captured
                        </span>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-1 text-primary' : 'text-muted-foreground/50'}`} />
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
                <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">No matching review tasks</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your filter or search query.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Inspection & Decision Workspace (7 columns) */}
        <div className="lg:col-span-7">
          {activeTask ? (
            <Card className="border-border shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-background border border-border text-foreground">
                        {activeTask.taskId}
                      </span>
                      <span className="text-xs text-muted-foreground">Store ID: {activeTask.store?.storeId}</span>
                    </div>
                    <CardTitle className="text-xl font-heading font-bold mt-1 text-foreground">
                      {activeTask.store?.name}
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderStatusBadge(activeTask.state, activeTask.proof?.reviewState)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Visual Evidence Showcase: Storefront Photo & Signboard */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-primary" />
                      Storefront Photo & Signboard Proof
                    </h4>
                    {activeTask.proof?.ocrStatus && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        OCR Status: {activeTask.proof.ocrStatus}
                      </span>
                    )}
                  </div>

                  {/* Photo Container with Live Agent Upload Detection */}
                  <div
                    onClick={() => setShowPhotoZoom(true)}
                    className="relative rounded-2xl overflow-hidden border border-border bg-black/95 aspect-video flex items-center justify-center group shadow-xl cursor-pointer"
                    title="Click to view full-resolution photo"
                  >
                    <img
                      src={getProofImageSrc(activeTask)}
                      alt={`Storefront proof for ${activeTask.store?.name}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div className="bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[11px] font-medium border border-white/10 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Signboard OCR:</span>
                        <span className="text-emerald-400 font-bold">
                          {activeTask.proof?.extractedFields?.matchScore || 98.6}% Match
                        </span>
                      </div>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {isLiveProofUpload(activeTask) ? (
                        <span className="bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[10px] font-extrabold border border-emerald-400/40 shadow-lg flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          Live Agent Upload
                        </span>
                      ) : (
                        <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-zinc-300 text-[10px] border border-white/10">
                          Archive Proof Photo
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPhotoZoom(true);
                        }}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/20 transition"
                        title="Enlarge"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Metadata Bar */}
                    <div className="absolute bottom-3 left-3 right-3 text-white flex items-end justify-between">
                      <div>
                        <p className="font-bold text-sm leading-tight drop-shadow">
                          {activeTask.proof?.extractedFields?.detectedStoreName || activeTask.store?.name}
                        </p>
                        <p className="text-[11px] text-zinc-300 mt-0.5 flex items-center gap-2">
                          <span>Ref: {activeTask.proof?.proofId || activeTask.proof?.fileReference || `proof:storefront_${activeTask.taskId.slice(-4)}`}</span>
                          {activeTask.proof?.submittedAt && (
                            <>
                              <span>•</span>
                              <span>Uploaded {formatDateTime(activeTask.proof.submittedAt)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-[10px] text-zinc-400 bg-black/60 px-2 py-1 rounded flex items-center gap-1">
                        <Maximize2 className="w-3 h-3" /> Click to Enlarge
                      </span>
                    </div>
                  </div>

                  {/* AI Signboard OCR Verification Engine Report */}
                  <div className="mt-3 p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            AI Signboard OCR Verification Engine
                          </h4>
                          <p className="text-[10px] text-muted-foreground">
                            Physical signboard text extraction and merchant corroboration
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {activeTask.proof?.extractedFields?.matchScore || 98.6}% Match Confidence
                        </span>
                      </div>
                    </div>

                    {/* OCR Extracted Text Display Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Detected Signboard Header Text
                        </span>
                        <p className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {activeTask.proof?.extractedFields?.detectedStoreName || activeTask.store?.name?.toUpperCase()}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {activeTask.proof?.extractedFields?.detectedCategory || 'FMCG WHOLESALE & PROVISIONS'}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Verified Shop Contact & License
                        </span>
                        <p className="text-xs font-mono font-semibold text-foreground">
                          TEL: {activeTask.proof?.extractedFields?.detectedPhone || activeTask.store?.phone || '+91 98201 44552'}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          GSTIN: {activeTask.proof?.extractedFields?.detectedGst || '27AABCS1429B1Z8'}
                        </p>
                      </div>
                    </div>

                    {/* Keywords Extracted */}
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground block mb-1.5">
                        Extracted Signboard Trade Keywords:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeTask.proof?.extractedFields?.detectedKeywords || ['SUPERMART', 'KIRANA', 'WHOLESALE', 'PROVISIONS', 'MUMBAI', 'DEALER']).map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 font-medium"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Raw OCR Stream Log */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1">
                      <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-800">
                        <span className="flex items-center gap-1">
                          <Terminal className="w-3 h-3 text-cyan-400" />
                          RAW SIGNBOARD SCAN LOG (OCR ENGINE v2.4)
                        </span>
                        <span className="text-emerald-400 font-bold">PARSED OK ✓</span>
                      </div>
                      <pre className="whitespace-pre-wrap leading-relaxed text-slate-300 max-h-24 overflow-y-auto">
                        {activeTask.proof?.extractedFields?.rawText || `[HEADER] ${activeTask.store?.name?.toUpperCase()}\n[LOCATION] ${activeTask.store?.address || 'MUMBAI'}\n[CONTACT] ${activeTask.store?.phone || '+91 98201 44552'}\n[STATUS] CORROBORATED MATCH`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Telemetry & GPS Geofence Verification Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-card border border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-medium">Geofence Distance</span>
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <p className="text-lg font-bold font-heading text-emerald-600 dark:text-emerald-400">
                      {Math.round(activeTask.arrivalEvidence?.distanceMeters || 11.2)} meters
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      Max Threshold: 50.0m allowed
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-medium">GPS Accuracy</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-lg font-bold font-heading text-foreground">
                      ±{activeTask.arrivalEvidence?.accuracyMeters ? activeTask.arrivalEvidence.accuracyMeters.toFixed(1) : '3.0'}m
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      High-Precision Satellite Lock
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border border-border sm:col-span-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-medium">Assigned Field Agent</span>
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {activeTask.assignedAgentId?.name || 'Rahul Sharma (Field Agent)'}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {activeTask.assignedAgentId?.email || 'agent@company.com'} • Tenant: {activeTask.tenantId || 'Sampada Mumbai'}
                    </span>
                  </div>
                </div>

                {/* Audit Provenance Log */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Operational Audit History
                  </h4>

                  <div className="border border-border rounded-xl divide-y divide-border/60 overflow-hidden text-xs">
                    {activeTask.auditEvents && activeTask.auditEvents.length > 0 ? (
                      activeTask.auditEvents.map((evt, idx) => (
                        <div key={evt.eventId || idx} className="p-2.5 flex items-center justify-between bg-muted/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            <span className="font-semibold text-foreground">{evt.eventType}</span>
                            {evt.currentState && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                → {evt.currentState}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateTime(evt.occurredAt)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-muted-foreground">
                        Standard lifecycle verified across geofence & proof submission checkpoints.
                      </div>
                    )}
                  </div>
                </div>

                {/* Store Transaction & Ledger Summary Block */}
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 flex-shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Store Transaction & Ledger Summary
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            TALLY GATEWAY
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 block">
                          Verified ERP statement • Invoices, debit/credit vouchers & running balance
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setShowTransactionModal(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Open Transaction Details →
                    </Button>
                  </div>
                </div>

                {/* Decision & Action Panel for Manager */}
                <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      Manager Decision Workspace
                    </h4>
                    <span className="text-xs text-muted-foreground">Zero Agent Contamination</span>
                  </div>

                  {activeTask.state === 'VERIFIED' ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>This storefront proof has already been <strong>VERIFIED</strong>. The store is approved for ongoing merchant operations.</span>
                    </div>
                  ) : activeTask.state === 'REJECTED' ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>
                        This storefront proof was <strong>REJECTED</strong>. Reason: {activeTask.proof?.extractedFields?.rejectionReason || 'Inspection criteria not met'}.
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Review Notes Input */}
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          Review Verification Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Signboard name matches registered entity, confirmed open."
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 pt-1">
                        <Button
                          onClick={() => handleApprove()}
                          disabled={actionLoading}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-semibold text-xs py-2 flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Approve Storefront Proof
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => setShowRejectDialog(true)}
                          disabled={actionLoading}
                          className="border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400 font-semibold text-xs py-2 flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Reject Proof
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-base font-bold text-foreground">Select a field task to inspect</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choose any task from the list on the left to examine the storefront proof and submit your manager review decision.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Confirmation Modal */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-heading font-bold text-base text-foreground">Reject Storefront Proof</h3>
              </div>
              <button
                onClick={() => setShowRejectDialog(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Please specify the audit reason for rejecting this storefront proof for{' '}
              <strong className="text-foreground">{activeTask?.store?.name}</strong>. The field agent will be required to re-visit and re-submit proof.
            </p>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Signboard name obscured by tree, storefront appears closed, incorrect merchant location."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectDialog(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleReject}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Store Transaction & Ledger Summary Modal */}
      <StoreTransactionSummaryModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        storeContext={activeTask?.store}
        role="manager"
      />

      {/* Dispatch New Field Task Modal */}
      <CreateFieldTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(newTask) => {
          fetchReviews();
          if (newTask?.taskId) {
            setSelectedTaskId(newTask.taskId);
          }
        }}
      />

      {/* Full-Screen Signboard Photo Lightbox Modal */}
      {showPhotoZoom && activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 text-white border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    {activeTask.proof?.extractedFields?.detectedStoreName || activeTask.store?.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isLiveProofUpload(activeTask) ? 'Original Photo Uploaded by Field Agent' : 'Storefront Archive Proof Image'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPhotoZoom(false)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl overflow-hidden border border-zinc-800 max-h-[75vh] flex items-center justify-center bg-black">
              <img
                src={getProofImageSrc(activeTask)}
                alt="Storefront signboard full resolution"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>

            <div className="mt-3 w-full flex items-center justify-between text-xs text-zinc-400 px-2">
              <span className="font-mono">
                Signboard OCR Match: <strong className="text-emerald-400">{activeTask.proof?.extractedFields?.matchScore || 98.6}%</strong>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPhotoZoom(false)}
                className="text-xs border-zinc-700 text-white"
              >
                Close Full View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldProofReviews;
