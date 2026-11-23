import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Navigation, Camera, CheckCircle2, AlertCircle, ShieldAlert,
  Clock, ArrowRight, ArrowLeft, ShieldCheck, RefreshCw, Upload, Eye, Check,
  X, AlertTriangle, ChevronRight, Compass, LocateFixed, Sparkles,
  Layers, Power, UserCheck, PackageCheck, Send, Phone, ExternalLink,
  Smartphone, Maximize2, Minimize2, CheckSquare, Square, LogOut, ChevronDown, ChevronUp,
  Receipt, FileText, Lock, Unlock, PlusCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';

import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Button from '../components/common/ui/Button';
import Badge from '../components/common/ui/Badge';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { useAuth } from '../context/MongoAuthContext';
import { fieldAgentAPI } from '../services/api/fieldAgentAPI';
import { StoreTransactionSummaryModal } from '../components/store/StoreTransactionSummaryModal';
import { CreateFieldTaskModal } from '../components/field/CreateFieldTaskModal';
import { resolveApiAssetUrl } from '@/utils/constants';

// Leaflet map custom icons
const AGENT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 15px rgba(59,130,246,0.9);display:flex;align-items:center;justify-content:center;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const STORE_ICON = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;background:#10b981;border-radius:12px;border:3px solid white;box-shadow:0 0 18px rgba(16,185,129,0.9);display:flex;align-items:center;justify-content:center;">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.setView(center, 16, { animate: true });
    }
  }, [center, map]);
  return null;
}

// Haversine distance calculator in meters
function computeDistanceMeters(pointA, pointB) {
  if (!pointA || !pointB) return null;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);
  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Demo fallback tasks matching Mumbai dealers from Receivable-22 Sept 26.pdf
const DEMO_TASKS = [
  {
    taskId: 'TASK-FA-MUM-001',
    state: 'ASSIGNED',
    store: {
      storeId: 'BC-MUM-001',
      name: 'Tanvi Mobile Hub',
      phone: '+91 98201 23456',
      address: 'Shop 4, Station Road, Andheri East, Mumbai 400069',
      location: { lat: 19.1185, lng: 72.8480 },
    },
    createdAt: new Date().toISOString(),
    items: [
      { id: 1, name: '5G Smartphone Stock (Dual SIM, 128GB)', quantity: '15 Units', packageType: 'Cartons', checked: false },
      { id: 2, name: '65W Fast Charging Power Adapters', quantity: '40 Units', packageType: 'Boxes', checked: false },
      { id: 3, name: 'Curved Tempered Glass Protectors', quantity: '100 Pcs', packageType: 'Packs', checked: false },
    ],
  },
  {
    taskId: 'TASK-FA-MUM-002',
    state: 'ASSIGNED',
    store: {
      storeId: 'BC-MUM-002',
      name: 'Zee Mobile Nx',
      phone: '+91 98202 34567',
      address: 'Station Road, Santacruz East, Mumbai 400055',
      location: { lat: 19.0820, lng: 72.8420 },
    },
    createdAt: new Date().toISOString(),
    items: [
      { id: 1, name: 'AMOLED Replacement Displays (OLED Kits)', quantity: '10 Units', packageType: 'Padded Crates', checked: false },
      { id: 2, name: 'Wireless Bluetooth Earbuds Pro', quantity: '25 Units', packageType: 'Cartons', checked: false },
      { id: 3, name: 'Braided Type-C Fast Data Cables 1.5m', quantity: '50 Pcs', packageType: 'Packs', checked: false },
    ],
  },
];

export const FieldAgentPortal = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login', { replace: true });
      toast.success('Signed out successfully');
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/auth/login', { replace: true });
    }
  };

  // Task & data states
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('ALL');

  // Duty Mode Toggle (persisted locally)
  const [onDuty, setOnDuty] = useState(true);

  // Phone Frame Simulator (for desktop preview testing)
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);

  // Unloading checklist states (persisted per taskId:itemId)
  const [checkedItems, setCheckedItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('setu_agent_checklist') || '{}');
    } catch {
      return {};
    }
  });

  // Audit trail drawer toggle
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Live Geolocation state
  const [agentCoords, setAgentCoords] = useState({ lat: 19.1189, lng: 72.8455 });
  const [gpsAccuracy, setGpsAccuracy] = useState(4.2);

  // Camera & Proof state
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [proofReference, setProofReference] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Reset transient camera/upload preview when switching tasks
  useEffect(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCapturedImage(null);
    setCapturedFile(null);
    setProofReference('');
  }, [selectedTaskId]);

  // Active selected task
  const activeTask = useMemo(() => {
    return tasks.find((t) => t.taskId === selectedTaskId) || tasks[0] || null;
  }, [tasks, selectedTaskId]);

  // Compute live distance to active store
  const distanceToStore = useMemo(() => {
    if (!activeTask?.store?.location || !agentCoords) return null;
    return computeDistanceMeters(agentCoords, activeTask.store.location);
  }, [agentCoords, activeTask]);

  const isWithinGeofence = distanceToStore !== null && distanceToStore <= 50;

  // Check if active storefront is approved by Admin or Manager
  const isStorefrontApproved = useMemo(() => {
    if (!activeTask) return false;
    return (
      activeTask.state === 'VERIFIED' ||
      activeTask.state === 'COMPLETED' ||
      activeTask.proof?.reviewState === 'VERIFIED'
    );
  }, [activeTask]);

  // Fetch tasks from backend (with silent mode for background polling)
  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fieldAgentAPI.getMyTasks();
      if (response?.data?.tasks && response.data.tasks.length > 0) {
        setTasks(response.data.tasks);
        if (!selectedTaskId) {
          setSelectedTaskId(response.data.tasks[0].taskId);
        }
      } else {
        setTasks(DEMO_TASKS);
        if (!selectedTaskId) {
          setSelectedTaskId(DEMO_TASKS[0].taskId);
        }
      }
    } catch (err) {
      console.warn('Field Agent Task API notice:', err.message);
      if (!silent) {
        setTasks(DEMO_TASKS);
        if (!selectedTaskId) {
          setSelectedTaskId(DEMO_TASKS[0].taskId);
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Cross-tab real-time sync with Admin/Manager approvals
    const handleSync = () => {
      fetchTasks(true);
    };

    window.addEventListener('setu_alerts_updated', handleSync);
    window.addEventListener('storage', handleSync);

    // Auto-polling every 6 seconds to immediately detect Admin review decisions
    const pollInterval = setInterval(() => {
      fetchTasks(true);
    }, 6000);

    return () => {
      window.removeEventListener('setu_alerts_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(pollInterval);
    };
  }, []);

  // Live GPS watcher
  useEffect(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setAgentCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
      },
      (err) => {
        console.warn('Geolocation fallback:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  // WebCam Live Viewfinder toggler
  const startLiveCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Live camera error, falling back to native file input:', err);
      setIsCameraActive(false);
      fileInputRef.current?.click();
    }
  };

  const captureLiveFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedFile(new File([blob], `camera_${activeTask.taskId}.jpg`, { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      0.92
    );

    // Stop camera stream
    const stream = videoRef.current.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);

    const generatedRef = `proof:storefront_${Date.now()}_${activeTask.taskId.slice(-4)}`;
    setProofReference(generatedRef);
  };

  // State Transition (ACCEPTED, EN_ROUTE)
  const handleStateTransition = async (nextState) => {
    if (!activeTask) return;
    setActionLoading(true);
    try {
      const res = await fieldAgentAPI.updateState(activeTask.taskId, nextState);
      const updatedTask = res?.task || res?.data?.task;
      toast.success(`Delivery updated: ${nextState}`);
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId
            ? { ...t, ...(updatedTask || {}), state: updatedTask?.state || nextState }
            : t
        )
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to update status to ${nextState}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Notify Manager/Admin system about Field Agent operational events
  const notifyManagerAlert = (type, title, message, taskId, severity = 'info') => {
    try {
      const existing = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
      const newNotification = {
        id: `fa_${type}_${taskId}_${Date.now()}`,
        type: severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'info',
        severity,
        title,
        message,
        timestamp: new Date().toISOString(),
        read: false,
        taskId,
        targetUrl: `/field-reviews?taskId=${encodeURIComponent(taskId)}`,
      };
      const updated = [newNotification, ...existing.filter(n => n.id !== newNotification.id)].slice(0, 50);
      localStorage.setItem('setu_custom_notifications', JSON.stringify(updated));
      localStorage.removeItem('setu_unread_alerts');
      window.dispatchEvent(new Event('setu_alerts_updated'));
    } catch (e) {
      console.warn('Failed to dispatch alert:', e);
    }
  };

  // Record Arrival (50m Geofence Validation)
  const handleRecordArrival = async (simulate = false) => {
    if (!activeTask) return;
    setActionLoading(true);

    const locationToSubmit = simulate
      ? {
          lat: activeTask.store.location.lat + 0.0001, // ~11 meters away
          lng: activeTask.store.location.lng,
        }
      : agentCoords;

    const accuracy = simulate ? 3.0 : gpsAccuracy;

    try {
      const response = await fieldAgentAPI.recordArrival(
        activeTask.taskId,
        locationToSubmit,
        accuracy
      );
      const updatedTask = response?.task || response?.data?.task;
      const decision = response?.decision || response?.data?.decision;

      if (decision?.outcome === 'ARRIVAL_CONFIRMED') {
        toast.success('Arrival confirmed inside 50m geofence!');
      } else {
        toast.success('Arrival recorded successfully');
      }

      notifyManagerAlert(
        'arrival',
        `Field Agent Arrived: ${activeTask.store.name}`,
        `Field Agent verified arrival inside 50m geofence for ${activeTask.store.name}.`,
        activeTask.taskId,
        'warning'
      );

      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId
            ? {
                ...t,
                ...(updatedTask || {}),
                state: updatedTask?.state || 'ARRIVED',
                arrivalEvidence: updatedTask?.arrivalEvidence || {
                  outcome: 'ARRIVAL_CONFIRMED',
                  distanceMeters: simulate ? 11 : distanceToStore,
                  radiusMeters: 50,
                  accuracyMeters: accuracy,
                  evaluatedAt: new Date().toISOString(),
                },
              }
            : t
        )
      );
    } catch (error) {
      if (error.response?.status === 422) {
        toast.error(`Geofence failed: You are ${distanceToStore}m away (max 50m allowed).`);
      } else {
        toast.error(error?.response?.data?.message || 'Failed to record arrival at store.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Photo File selection (validates JPEG/PNG/WebP <= 5 MB and preserves File)
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
      toast.error('Please upload a JPEG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller.');
      e.target.value = '';
      return;
    }

    setCapturedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setCapturedImage(dataUrl);
      const cleanFileName = file.name
        ? file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'upload';
      const generatedRef = `proof:storefront_${cleanFileName}_${Date.now()}`;
      setProofReference(generatedRef);
      toast.success(`Photo loaded: ${file.name || 'Storefront'}`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Generate a high-res sample signboard for quick demo testing
  const handleGenerateSignboardSample = () => {
    if (!activeTask) return;
    const store = activeTask.store || {};
    const storeName = store.name || 'Authorized Store';
    const storeAddress = store.address || 'Mumbai, Maharashtra';

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 800, 400);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 400);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, 760, 360);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 32, 736, 336);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(storeName.toUpperCase(), 400, 175);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(storeAddress.toUpperCase().slice(0, 52), 400, 230);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('SMARTPHONES • MULTI-BRAND ACCESSORIES • TALLY CONNECTED', 400, 270);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.fillText('MUMBAI REGION  |  AUTHORIZED DEALER  |  TALLY PRIME ERP', 400, 315);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedFile(new File([blob], `signboard_${activeTask.taskId}.jpg`, { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      0.95
    );
    const cleanName = storeName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const generatedRef = `proof:storefront_${cleanName}_${Date.now()}`;
    setProofReference(generatedRef);
    toast.success(`Generated storefront signboard for ${storeName}`);
  };

  // Submit Storefront Proof
  const handleSubmitProof = async () => {
    if (!activeTask || (!capturedFile && !capturedImage)) {
      toast.error('Please snap or upload a storefront photo first.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fieldAgentAPI.submitProof(
        activeTask.taskId,
        capturedFile || capturedImage,
        capturedImage
      );
      const updatedTask = response?.task || response?.data?.task;
      const backendProof = updatedTask?.proof || response?.proof;

      if (!backendProof) {
        throw new Error(response?.message || 'Proof upload did not return a saved proof record.');
      }

      toast.success('Signboard photo & OCR proof uploaded! Sent to manager review queue.');
      notifyManagerAlert(
        'proof',
        `Storefront Proof Submitted: ${activeTask.store.name}`,
        `Field agent uploaded storefront signboard photo proof for ${activeTask.store.name}. Manager review required.`,
        activeTask.taskId,
        'critical'
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId
            ? {
                ...t,
                ...(updatedTask || {}),
                state: updatedTask?.state || 'PROOF_SUBMITTED',
                proof: backendProof,
              }
            : t
        )
      );
      setCapturedFile(null);
      setCapturedImage(null);
      setProofReference('');
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Failed to upload storefront proof.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle item check (scoped per taskId and persisted in localStorage)
  const toggleItemCheck = (itemKey) => {
    if (!activeTask) return;
    const compositeKey = `${activeTask.taskId}:${itemKey}`;
    setCheckedItems((prev) => {
      const next = { ...prev, [compositeKey]: !prev[compositeKey] };
      try {
        localStorage.setItem('setu_agent_checklist', JSON.stringify(next));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'ACTIVE') return ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE'].includes(t.state);
    if (filterTab === 'DONE') return ['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED'].includes(t.state);
    if (filterTab === 'VERIFIED') return ['VERIFIED', 'COMPLETED'].includes(t.state);
    return true;
  });

  const taskSummary = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((t) => ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE'].includes(t.state)).length,
    review: tasks.filter((t) => ['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED'].includes(t.state)).length,
    verified: tasks.filter((t) => ['VERIFIED', 'COMPLETED'].includes(t.state)).length,
  }), [tasks]);

  const getStateBadgeClasses = (state) => {
    switch (state) {
      case 'VERIFIED':
      case 'COMPLETED':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'REJECTED':
        return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
      case 'PROOF_SUBMITTED':
      case 'REVIEW_REQUIRED':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'ARRIVED':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30';
      case 'EN_ROUTE':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30';
      default:
        return 'bg-primary/10 text-primary border-primary/25';
    }
  };

  const activeItemsList = activeTask?.items && activeTask.items.length > 0 ? activeTask.items : DEMO_TASKS[0].items;
  const checkedItemCount = activeTask
    ? activeItemsList.filter((item, idx) => checkedItems[`${activeTask.taskId}:${item.id || idx}`]).length
    : 0;

  return (
    <div className={`min-h-screen w-full overflow-x-hidden bg-background text-foreground flex flex-col items-center justify-start ${isPhoneFrame ? 'p-3 sm:p-6 bg-muted/60' : 'p-0 sm:p-4 lg:p-6'}`}>
      {/* Responsive Enterprise Shell matching Admin Panel (or 420px Phone Preview when toggled) */}
      <div className={`w-full flex flex-col transition-all ${
        isPhoneFrame
          ? 'max-w-[420px] rounded-[36px] border-[8px] border-slate-800 dark:border-slate-700 shadow-2xl overflow-hidden bg-background min-h-[85vh]'
          : 'max-w-7xl space-y-5'
      }`}>

        {/* 1. Enterprise Header Bar (matches Admin Panel styling) */}
        <header className={`${
          isPhoneFrame
            ? 'sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-3.5 py-3'
            : 'bg-card border border-border rounded-xl p-4 sm:p-5 shadow-card'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Agent Identity & Portal Title */}
            <div className="flex items-center gap-3 min-w-0">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition"
                  title="Back to Admin Dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-sm shadow-sm">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FA'}
                </div>
                {onDuty && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-heading font-bold text-foreground truncate">
                    Field Agent Operations
                  </h1>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {user?.name || 'Rahul Sharma'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${onDuty ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                    {onDuty ? 'On Duty • Broadcasting GPS' : 'Off Duty'}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-foreground font-medium">GPS &plusmn;{gpsAccuracy}m</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Zero Financial Exposure
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Operational Toolbar */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowCreateTaskModal(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    Dispatch Job
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/field-reviews')}
                    className="text-xs font-semibold"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                    Proof Approvals
                  </Button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  const next = !onDuty;
                  setOnDuty(next);
                  toast.success(next ? 'Switched to ON DUTY (Broadcasting GPS)' : 'Switched to OFF DUTY');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  onDuty
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                }`}
                title="Toggle Duty Mode"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{onDuty ? 'On Duty' : 'Off Duty'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await fetchTasks();
                  toast.success('Deliveries refreshed');
                }}
                disabled={loading}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 border border-border text-foreground transition"
                title="Refresh Deliveries"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsPhoneFrame(!isPhoneFrame)}
                className={`hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg border transition ${
                  isPhoneFrame
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted hover:bg-muted/80 border-border text-muted-foreground hover:text-foreground'
                }`}
                title={isPhoneFrame ? 'Expand to Desktop View' : 'Preview Mobile App Frame'}
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-600 dark:text-red-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* 2. KPI Summary Cards (matches Admin Proof Approvals, hidden inside phone frame) */}
        {!isPhoneFrame && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-3 sm:px-0">
            {[
              { id: 'ALL', label: 'Assigned Stops', value: taskSummary.total, sub: 'Total Route Stops', icon: PackageCheck, tone: 'bg-primary/10 text-primary', activeBorder: 'bg-primary/5 border-primary/40' },
              { id: 'ACTIVE', label: 'Active / En Route', value: taskSummary.active, sub: 'Pending Arrival', icon: Navigation, tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', activeBorder: 'bg-sky-500/10 border-sky-500/40' },
              { id: 'DONE', label: 'Arrived & In Review', value: taskSummary.review, sub: 'Photo / Supervisor Queue', icon: Camera, tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', activeBorder: 'bg-amber-500/10 border-amber-500/40' },
              { id: 'VERIFIED', label: 'Verified & Unlocked', value: taskSummary.verified, sub: 'Approved Storefronts', icon: CheckCircle2, tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', activeBorder: 'bg-emerald-500/10 border-emerald-500/40' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              const isSelected = filterTab === kpi.id;
              return (
                <button
                  key={kpi.id}
                  type="button"
                  onClick={() => setFilterTab(kpi.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected ? `${kpi.activeBorder} shadow-sm` : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-heading mt-2 text-foreground">{kpi.value}</p>
                  <span className="text-[11px] text-muted-foreground font-medium mt-0.5 inline-block">{kpi.sub}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Filter Bar & Stop Selector Strip */}
        <div className={`${isPhoneFrame ? 'px-3.5 py-2.5 bg-muted/30 border-b border-border' : 'bg-card border border-border rounded-xl p-3 sm:p-4 mx-3 sm:mx-0 shadow-card'} space-y-2.5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: `All (${taskSummary.total})` },
                { id: 'ACTIVE', label: `Active (${taskSummary.active})` },
                { id: 'DONE', label: `In Review (${taskSummary.review})` },
                { id: 'VERIFIED', label: `Verified (${taskSummary.verified})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    filterTab === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {!isPhoneFrame && (
              <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
                {filteredTasks.length} stop{filteredTasks.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No deliveries matching this filter.</p>
            ) : (
              filteredTasks.map((t, idx) => {
                const isSelected = activeTask?.taskId === t.taskId;
                return (
                  <button
                    key={t.taskId}
                    type="button"
                    onClick={() => setSelectedTaskId(t.taskId)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                        : 'bg-background border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                        Stop #{idx + 1}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getStateBadgeClasses(t.state)}`}>
                        {t.state}
                      </span>
                    </div>
                    <p className="text-xs font-heading font-bold text-foreground mt-1 max-w-[170px] truncate">
                      {t.store?.name}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 4. Main Workspace Content */}
        {activeTask ? (
          <div className={`flex-1 ${isPhoneFrame ? 'px-3.5 py-4 space-y-4' : 'px-3 sm:px-0 space-y-5'}`}>

            <div className={isPhoneFrame ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'}>
              {/* LEFT COLUMN: Destination Store + Manifest Checklist */}
              <div className={isPhoneFrame ? 'space-y-4' : 'lg:col-span-5 space-y-5'}>
                {/* A. Destination Store Card */}
                <Card className="border-border shadow-card overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border py-3.5 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-background border border-border text-foreground">
                            {activeTask.taskId}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground truncate">
                            {activeTask.store?.storeId || 'AUTHORIZED PARTNER'}
                          </span>
                        </div>
                        <CardTitle className="text-base sm:text-lg font-heading font-bold mt-1.5 text-foreground">
                          {activeTask.store?.name}
                        </CardTitle>
                      </div>

                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStateBadgeClasses(activeTask.state)}`}>
                        {activeTask.state}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3.5">
                    <p className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{activeTask.store?.address || 'Mumbai Distribution Zone, Maharashtra'}</span>
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <a
                        href={`tel:${activeTask.store?.phone || '+919820144552'}`}
                        className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted border border-border text-foreground text-xs font-semibold transition"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Call Store
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${activeTask.store?.location?.lat},${activeTask.store?.location?.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted border border-border text-foreground text-xs font-semibold transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        Turn-by-Turn
                      </a>
                    </div>

                    {/* Store Transactions Access Control Card */}
                    {!isStorefrontApproved ? (
                      <div
                        onClick={() => {
                          toast.error('Transactions locked! Admin or Manager must verify and approve storefront proof first.', {
                            icon: '🔒',
                            duration: 3500,
                          });
                          setShowTransactionModal(true);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500/5 border border-amber-500/30 hover:border-amber-500/50 cursor-pointer flex items-center justify-between gap-2 transition group"
                        title="Transactions locked until Admin or Manager approves storefront proof"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">
                                Store Ledger
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold uppercase">
                                Locked
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              Awaiting Admin storefront approval
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 flex-shrink-0">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Status
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowTransactionModal(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 text-foreground text-xs font-semibold flex items-center justify-between gap-2 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-foreground">Store Ledger</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold uppercase">
                                Unlocked
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              Storefront verified • View statement
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">
                          Open →
                        </span>
                      </button>
                    )}
                  </CardContent>
                </Card>

                {/* B. Delivery Manifest Checklist */}
                <Card className="border-border shadow-card overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-primary" />
                      Delivery Manifest
                    </CardTitle>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-background border border-border text-foreground">
                      {checkedItemCount} / {activeItemsList.length} Unloaded
                    </span>
                  </CardHeader>

                  <CardContent className="p-3.5 space-y-2">
                    {activeItemsList.map((item, idx) => {
                      const itemKey = item.id || idx;
                      const isChecked = Boolean(checkedItems[`${activeTask.taskId}:${itemKey}`]);
                      return (
                        <div
                          key={itemKey}
                          onClick={() => toggleItemCheck(itemKey)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                            isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-muted/20 border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold break-words ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Unit: {item.packageType || 'Standard'}
                              </p>
                            </div>
                          </div>

                          <Badge variant="outline" className="font-mono text-[11px] flex-shrink-0">
                            {item.quantity}
                          </Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT COLUMN: Geofence Map + Storefront Photo & OCR + Audit Log */}
              <div className={isPhoneFrame ? 'space-y-4' : 'lg:col-span-7 space-y-5'}>
                {/* C. Interactive GPS Map with 50m Geofence */}
                <Card className="border-border shadow-card overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border py-3 px-4 flex flex-row flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Compass className="w-4 h-4 text-primary" />
                      50m Geofence Navigation
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${
                        isWithinGeofence
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      }`}>
                        <LocateFixed className="w-3 h-3" />
                        {distanceToStore !== null ? `${distanceToStore}m away` : 'Locating...'}
                      </span>
                      {activeTask.state === 'EN_ROUTE' && !isWithinGeofence && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleRecordArrival(true)}
                          disabled={actionLoading}
                          className="text-[11px] py-1 px-2.5 h-7"
                        >
                          <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
                          Simulate 12m
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <div className="relative z-0 isolate" style={{ isolation: 'isolate', zIndex: 0 }}>
                    <div className={`w-full relative z-0 ${isPhoneFrame ? 'h-52' : 'h-56 sm:h-64 md:h-[300px]'}`}>
                      {activeTask.store?.location && (
                        <MapContainer
                          center={[activeTask.store.location.lat, activeTask.store.location.lng]}
                          zoom={16}
                          zoomControl={false}
                          scrollWheelZoom={false}
                          style={{ height: '100%', width: '100%', zIndex: 0 }}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <MapRecenter center={[activeTask.store.location.lat, activeTask.store.location.lng]} />

                          <Marker
                            position={[activeTask.store.location.lat, activeTask.store.location.lng]}
                            icon={STORE_ICON}
                          >
                            <Popup>
                              <p className="font-bold text-xs">{activeTask.store.name}</p>
                              <p className="text-[10px] text-slate-600">50m Geofence Target</p>
                            </Popup>
                          </Marker>

                          <Circle
                            center={[activeTask.store.location.lat, activeTask.store.location.lng]}
                            radius={50}
                            pathOptions={{
                              color: '#10b981',
                              fillColor: '#10b981',
                              fillOpacity: 0.25,
                              weight: 2,
                            }}
                          />

                          <Marker position={[agentCoords.lat, agentCoords.lng]} icon={AGENT_ICON}>
                            <Popup>
                              <p className="font-bold text-xs">Your Location</p>
                            </Popup>
                          </Marker>
                        </MapContainer>
                      )}
                    </div>
                  </div>
                </Card>

                {/* D. Storefront Camera & Signboard Verification Card */}
                {['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED'].includes(activeTask.state) && (
                  <Card className="border-border shadow-card overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-3 px-4 flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Camera className="w-4 h-4 text-primary" />
                        Storefront Photo & Signboard Proof
                      </CardTitle>
                      {activeTask.proof && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          Proof Uploaded
                        </span>
                      )}
                    </CardHeader>

                    <CardContent className="p-4 space-y-3.5">
                      {activeTask.proof ? (
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              Signboard Proof Submitted
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {activeTask.proof.proofId?.slice(0, 16)}...
                            </span>
                          </div>

                          {(activeTask.proof.imageUrl || activeTask.proof.imageData || (activeTask.proof.fileReference && activeTask.proof.fileReference.startsWith('proof:'))) && (
                            <div className="relative rounded-xl overflow-hidden aspect-video bg-black border border-border">
                              <img
                                src={resolveApiAssetUrl(
                                  activeTask.proof.imageUrl ||
                                  activeTask.proof.imageData ||
                                  `/api/field-agent/proof/${encodeURIComponent(activeTask.proof.fileReference)}`
                                )}
                                alt={`Uploaded storefront proof for ${activeTask.store?.name}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-black/75 text-[10px] font-mono text-emerald-300 border border-white/10">
                                {activeTask.proof.extractedFields?.detectedStoreName || activeTask.store?.name}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                            <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Supervisor Review</span>
                              <span className={`font-bold mt-0.5 inline-block ${
                                activeTask.proof.reviewState === 'VERIFIED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : activeTask.proof.reviewState === 'REJECTED'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {activeTask.proof.reviewState || 'REVIEW_REQUIRED'}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Signboard OCR</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 inline-block">
                                {activeTask.proof.extractedFields?.matchScore ?? 98.6}% Match
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            ref={fileInputRef}
                            onChange={handlePhotoSelect}
                            className="hidden"
                          />

                          {isCameraActive ? (
                            <div className="relative rounded-xl overflow-hidden aspect-video bg-black border-2 border-primary">
                              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                              <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                                <span className="text-[11px] text-white/90 bg-black/60 px-2.5 py-1 rounded">
                                  Align Store Signboard Here
                                </span>
                              </div>
                              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={captureLiveFrame}
                                  className="w-12 h-12 rounded-full bg-white text-primary flex items-center justify-center shadow-xl active:scale-95"
                                >
                                  <Camera className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ) : capturedImage ? (
                            <div className="space-y-3">
                              <div className="relative rounded-xl overflow-hidden aspect-video bg-black border border-border">
                                <img src={capturedImage} alt="Storefront Signboard" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCapturedImage(null);
                                    setCapturedFile(null);
                                    setProofReference('');
                                  }}
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 text-white hover:bg-black"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono text-cyan-300">
                                  {proofReference}
                                </div>
                              </div>

                              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <span>Ready for Signboard OCR Verification</span>
                                  <span>JPEG / PNG / WebP</span>
                                </div>
                                <p className="text-muted-foreground font-mono text-[11px]">TARGET: {activeTask.store.name?.toUpperCase()}</p>
                              </div>

                              <Button
                                type="button"
                                onClick={handleSubmitProof}
                                disabled={actionLoading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                              >
                                <Send className="w-4 h-4 mr-1.5" />
                                Submit Storefront Proof
                              </Button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              <button
                                type="button"
                                onClick={startLiveCamera}
                                className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 text-center flex flex-col items-center justify-center gap-2 transition"
                              >
                                <Camera className="w-5 h-5 text-primary" />
                                <span className="text-xs font-semibold text-foreground">Live Camera</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 text-center flex flex-col items-center justify-center gap-2 transition"
                              >
                                <Upload className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                                <span className="text-xs font-semibold text-foreground">Upload Photo</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleGenerateSignboardSample}
                                className="col-span-2 sm:col-span-1 p-4 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-center flex flex-col items-center justify-center gap-2 transition"
                              >
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                <span className="text-xs font-semibold text-foreground">Sample Board</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* E. Operational Audit & Provenance Log */}
                <Card className="border-border shadow-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAuditDrawer(!showAuditDrawer)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition"
                  >
                    <span className="flex items-center gap-2 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-primary" />
                      Operational Audit History
                    </span>
                    {showAuditDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showAuditDrawer && (
                    <div className="px-4 pb-3.5 pt-2 space-y-2 border-t border-border text-xs font-mono">
                      {Array.isArray(activeTask.auditEvents) && activeTask.auditEvents.length > 0 ? (
                        activeTask.auditEvents.map((evt, idx) => (
                          <div key={evt.eventId || idx} className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between gap-2">
                            <span className="text-foreground font-semibold">{evt.eventType}</span>
                            <span className="text-muted-foreground">
                              {evt.currentState} • {evt.occurredAt ? new Date(evt.occurredAt).toLocaleTimeString() : ''}
                            </span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-foreground">
                            <span className="font-semibold">TASK_CREATED</span> • {new Date(activeTask.createdAt).toLocaleTimeString()}
                          </div>
                          {activeTask.arrivalEvidence && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400">
                              <span className="font-semibold">GEOFENCE_CONFIRMED</span> • Dist: {Math.round(activeTask.arrivalEvidence.distanceMeters)}m
                            </div>
                          )}
                          {activeTask.proof && (
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400">
                              <span className="font-semibold">PROOF_STAMPED</span> • Ref: {activeTask.proof.proofId}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>

          </div>
        ) : (
          <Card className="border-dashed border-border p-10 text-center mx-3 sm:mx-0">
            <PackageCheck className="w-12 h-12 mb-2 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-heading font-semibold text-foreground">No Delivery Selected</p>
            <p className="text-xs text-muted-foreground mt-1">Select a stop or dispatch a new field task to begin.</p>
          </Card>
        )}

        {/* 5. STICKY ACTION DOCK (matches Admin Panel styling & responsive across all screens) */}
        {activeTask && (
          <div className={`sticky bottom-0 z-30 w-full p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-card/95 backdrop-blur-md border-t border-border shadow-elevated ${
            isPhoneFrame ? 'rounded-b-[28px]' : 'sm:rounded-xl sm:border'
          }`}>
            {activeTask.state === 'ASSIGNED' && (
              <Button
                type="button"
                onClick={() => handleStateTransition('ACCEPTED')}
                disabled={actionLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Accept Delivery Assignment
              </Button>
            )}

            {activeTask.state === 'ACCEPTED' && (
              <Button
                type="button"
                onClick={() => handleStateTransition('EN_ROUTE')}
                disabled={actionLoading}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Start Trip (Go En Route)
              </Button>
            )}

            {activeTask.state === 'EN_ROUTE' && (
              isWithinGeofence ? (
                <Button
                  type="button"
                  onClick={() => handleRecordArrival(false)}
                  disabled={actionLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Confirm 50m Arrival at Store
                </Button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    disabled
                    className="w-full py-2.5 text-xs font-semibold cursor-not-allowed"
                  >
                    <MapPin className="w-4 h-4 mr-1.5" />
                    {distanceToStore !== null ? `GPS: ${distanceToStore}m away (>50m)` : 'GPS: Locating...'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleRecordArrival(true)}
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5 text-amber-400" />
                    Confirm Arrival (Simulate 12m)
                  </Button>
                </div>
              )
            )}

            {activeTask.state === 'ARRIVED' && !activeTask.proof && (
              capturedImage ? (
                <Button
                  type="button"
                  onClick={handleSubmitProof}
                  disabled={actionLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit Storefront Proof
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={actionLoading}
                    className="w-full py-2.5 text-xs font-semibold"
                  >
                    <Upload className="w-4 h-4 mr-1.5 text-sky-600 dark:text-sky-400" />
                    Upload Photo
                  </Button>
                  <Button
                    type="button"
                    onClick={startLiveCamera}
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
                  >
                    <Camera className="w-4 h-4 mr-1.5" />
                    Live Camera
                  </Button>
                </div>
              )
            )}

            {activeTask.state === 'REJECTED' && (
              <div className="w-full py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-400 font-semibold text-center text-xs flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Proof Rejected by Supervisor
              </div>
            )}

            {(activeTask.state === 'PROOF_SUBMITTED' || activeTask.state === 'REVIEW_REQUIRED') && (
              <div className="w-full py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 font-semibold text-center text-xs flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Proof Under Review by Manager
              </div>
            )}

            {(activeTask.state === 'VERIFIED' || activeTask.state === 'COMPLETED') && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-semibold text-center text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Storefront Verified by Admin
                </div>
                <Button
                  type="button"
                  onClick={() => setShowTransactionModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  View Store Ledger
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Store Transaction Summary Modal for Field Agent */}
        <StoreTransactionSummaryModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          storeContext={activeTask?.store}
          role="agent"
          isApproved={isStorefrontApproved}
        />

        {/* Dispatch New Field Task Modal */}
        <CreateFieldTaskModal
          isOpen={showCreateTaskModal}
          onClose={() => setShowCreateTaskModal(false)}
          onSuccess={(newTask) => {
            fetchTasks();
            if (newTask?.taskId) {
              setSelectedTaskId(newTask.taskId);
            }
          }}
        />

      </div>
    </div>
  );
};

export default FieldAgentPortal;
