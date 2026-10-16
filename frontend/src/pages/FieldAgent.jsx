import React, { useCallback, useEffect, useState } from 'react';
import { Activity, MapPin, RefreshCw, ClipboardList, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/ui/Button';
import fieldAgentAPI from '../services/api/fieldAgentAPI';

const STATUS_ACTIONS = {
  ASSIGNED: { label: 'Accept task', next: 'ACCEPTED' },
  ACCEPTED: { label: 'Start travel', next: 'EN_ROUTE' },
};

const STATUS_STYLES = {
  ASSIGNED: 'bg-slate-100 text-slate-700',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  EN_ROUTE: 'bg-amber-100 text-amber-800',
  ARRIVED: 'bg-indigo-100 text-indigo-800',
  PROOF_SUBMITTED: 'bg-purple-100 text-purple-800',
  REVIEW_REQUIRED: 'bg-orange-100 text-orange-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

const getTaskId = (task) => task.taskId || task._id || task.id;
const getTaskStatus = (task) => task.state || task.status || 'ASSIGNED';

export default function FieldAgent() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      const response = await fieldAgentAPI.getTasks();
      const items = Array.isArray(response)
        ? response
        : response.tasks || response.data?.tasks || response.data || [];

      if (!Array.isArray(items)) {
        throw new Error('The server returned an unexpected task response.');
      }

      setTasks(items);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Unable to load assigned tasks.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const updateTask = async (task, nextState) => {
    const taskId = getTaskId(task);

    if (!taskId) {
      toast.error('This task has no valid identifier.');
      return;
    }

    try {
      await fieldAgentAPI.updateTaskState(taskId, nextState);
      toast.success(`Task updated to ${nextState.replaceAll('_', ' ').toLowerCase()}.`);
      await loadTasks(true);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Could not update this task.'
      );
    }
  };

  const verifyArrival = async (task) => {
    const taskId = getTaskId(task);

    if (!taskId) {
      toast.error('This task has no valid identifier.');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('GPS location is not supported by this browser.');
      return;
    }

    toast.loading('Getting your current GPS location...', { id: `gps-${taskId}` });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fieldAgentAPI.recordArrival(
            taskId,
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            position.coords.accuracy
          );

          toast.success(
            `Arrival accepted${response.decision?.distanceMeters != null
              ? ` · ${Math.round(response.decision.distanceMeters)} m from shop`
              : ''}`,
            { id: `gps-${taskId}` }
          );

          await loadTasks(true);
        } catch (err) {
          const message =
            err.response?.data?.message ||
            err.response?.data?.decision?.reason ||
            'Arrival verification failed. Check your location and try again.';

          toast.error(message, { id: `gps-${taskId}` });
        }
      },
      (error) => {
        const messages = {
          1: 'Location permission was denied. Allow location access and try again.',
          2: 'Your location is unavailable. Move to an area with a GPS signal and retry.',
          3: 'Getting your location timed out. Please try again.',
        };

        toast.error(
          messages[error.code] || 'Unable to obtain your current location.',
          { id: `gps-${taskId}` }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };
  const submitShopProof = async (task, file) => {
    const taskId = getTaskId(task);

    if (!taskId || !file) {
      toast.error('Select a shop photo before submitting.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Choose a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('The photo must be 5 MB or smaller.');
      return;
    }

    const toastId = `proof-${taskId}`;
    toast.loading('Uploading shop-photo proof...', { id: toastId });

    try {
      const result = await fieldAgentAPI.submitProof(taskId, file);

      toast.success(
        result.message || 'Shop-photo proof submitted for manager review.',
        { id: toastId }
      );

      await loadTasks(true);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Photo upload failed. Please try again.',
        { id: toastId }
      );
    }
  };
  const counts = tasks.reduce((result, task) => {
    const status = getTaskStatus(task);
    result.total += 1;
    if (['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(status)) {
      result.active += 1;
    }
    if (status === 'REVIEW_REQUIRED' || status === 'PROOF_SUBMITTED') {
      result.review += 1;
    }
    if (status === 'COMPLETED' || status === 'VERIFIED') {
      result.completed += 1;
    }
    return result;
  }, { total: 0, active: 0, review: 0, completed: 0 });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            SETU · Field Operations
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Field Agent
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your assigned visits, verify arrival, and submit shop proof.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadTasks(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh tasks
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Assigned tasks', value: counts.total, icon: ClipboardList },
          { label: 'Active visits', value: counts.active, icon: Activity },
          { label: 'Awaiting review', value: counts.review, icon: AlertCircle },
          { label: 'Completed / verified', value: counts.completed, icon: MapPin },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">My assigned tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only tasks authorized by the backend should be shown here.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">{tasks.length} task(s)</span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Loading your tasks…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground">Unable to load tasks</h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{error}</p>
                  <Button className="mt-4" variant="outline" onClick={() => loadTasks(true)}>
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 font-semibold text-foreground">No assigned tasks</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                New assignments will appear here when the backend assigns them to you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task, index) => {
                const taskId = getTaskId(task);
                const status = getTaskStatus(task);
                const action = STATUS_ACTIONS[status];
                const shopName =
                  task.store?.name || task.shopName || task.storeName || task.customerName || task.title || 'Assigned visit';
                const location =
                  task.address || task.location?.address || task.storeAddress || '';

                return (
                  <article
                    key={taskId || `task-${index}`}
                    className="rounded-xl border border-border p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{shopName}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'}`}>
                            {status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Task ID: {taskId || 'Unavailable'}
                        </p>
                        {location && (
                          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{location}</span>
                          </p>
                        )}
                        {task.description && (
                          <p className="mt-3 text-sm text-foreground">{task.description}</p>
                        )}
                      </div>

                      {status === 'EN_ROUTE' && (
                        <Button
                          variant="secondary"
                          className="shrink-0"
                          onClick={() => verifyArrival(task)}
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          Verify Arrival
                        </Button>
                      )}
                      {action && (
                        <Button
                          className="shrink-0"
                          onClick={() => updateTask(task, action.next)}
                        >
                          {action.label}
                        </Button>
                      )}
                    </div>

                    {status === 'ARRIVED' && (
                      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                        <h4 className="font-semibold text-foreground">Shop visit proof</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Take a clear photo of the shop or choose an existing image. Maximum size: 5 MB.
                        </p>
                        <label className="mt-3 inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                          <ClipboardList className="mr-2 h-4 w-4" />
                          Choose Shop Photo
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="sr-only"
                            onChange={(event) => {
                              const selectedFile = event.target.files?.[0];
                              if (selectedFile) submitShopProof(task, selectedFile);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <p className="mt-2 text-xs text-muted-foreground">
                          OCR is not configured. Submitted photos will require manager review.
                        </p>
                      </div>
                    )}
                    {['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED', 'COMPLETED'].includes(status) && (
                      <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
                        {status === 'ARRIVED'
                          ? 'Arrival recorded. Shop-photo proof can be submitted in the next step.'
                          : status === 'PROOF_SUBMITTED' || status === 'REVIEW_REQUIRED'
                            ? 'Proof submitted or awaiting manager review.'
                            : status === 'REJECTED'
                              ? 'Proof was rejected. Check with your manager for next steps.'
                              : 'This visit has been verified or completed.'}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}





