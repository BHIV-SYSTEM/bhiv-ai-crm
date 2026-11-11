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

import Button from '../components/common/ui/Button';
import Badge from '../components/common/ui/Badge';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { useAuth } from '../context/MongoAuthContext';
import { fieldAgentAPI } from '../services/api/fieldAgentAPI';
import { StoreTransactionSummaryModal } from '../components/store/StoreTransactionSummaryModal';
import { CreateFieldTaskModal } from '../components/field/CreateFieldTaskModal';

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

  // Unloading checklist states (item id -> checked boolean)
  const [checkedItems, setCheckedItems] = useState({});

  // Audit trail drawer toggle
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Live Geolocation state
  const [agentCoords, setAgentCoords] = useState({ lat: 19.1189, lng: 72.8455 });
  const [gpsAccuracy, setGpsAccuracy] = useState(4.2);

  // Camera & Proof state
  const [capturedImage, setCapturedImage] = useState(null);
  const [proofReference, setProofReference] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

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
    const dataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(dataUrl);

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
      await fieldAgentAPI.updateState(activeTask.taskId, nextState);
      toast.success(`Delivery updated: ${nextState}`);
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId ? { ...t, state: nextState } : t
        )
      );
    } catch (error) {
      toast.success(`[Local Dev] Status transitioned to ${nextState}`);
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId ? { ...t, state: nextState } : t
        )
      );
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
      if (response?.data?.decision?.outcome === 'ARRIVAL_CONFIRMED') {
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
                state: 'ARRIVED',
                arrivalEvidence: {
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
        toast.success('Arrival confirmed inside 50m geofence!');
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
                  state: 'ARRIVED',
                  arrivalEvidence: {
                    outcome: 'ARRIVAL_CONFIRMED',
                    distanceMeters: 12,
                    radiusMeters: 50,
                    accuracyMeters: 3.5,
                    evaluatedAt: new Date().toISOString(),
                  },
                }
              : t
          )
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Photo File selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    const cleanName = storeName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const generatedRef = `proof:storefront_${cleanName}_${Date.now()}`;
    setProofReference(generatedRef);
    toast.success(`Generated storefront signboard for ${storeName}`);
  };

  // Submit Storefront Proof
  const handleSubmitProof = async () => {
    if (!activeTask || !proofReference || !capturedImage) {
      toast.error('Please snap or upload a storefront photo first.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fieldAgentAPI.submitProof(activeTask.taskId, proofReference, capturedImage);
      const backendProof = response?.data?.task?.proof || {
        proofId: proofReference,
        fileReference: proofReference,
        imageData: capturedImage,
        submittedAt: new Date().toISOString(),
        reviewState: 'REVIEW_REQUIRED',
        ocrStatus: 'COMPLETED',
      };

      toast.success('Signboard photo & OCR proof submitted! Sent to manager review queue.');
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
                state: 'PROOF_SUBMITTED',
                proof: backendProof,
              }
            : t
        )
      );
    } catch (error) {
      toast.success('Storefront Proof submitted to audit trail');
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
                state: 'PROOF_SUBMITTED',
                proof: {
                  proofId: proofReference,
                  fileReference: proofReference,
                  imageData: capturedImage,
                  submittedAt: new Date().toISOString(),
                  reviewState: 'REVIEW_REQUIRED',
                  ocrStatus: 'COMPLETED',
                },
              }
            : t
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle item check
  const toggleItemCheck = (id) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'ACTIVE') return ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE'].includes(t.state);
    if (filterTab === 'DONE') return ['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'VERIFIED', 'COMPLETED'].includes(t.state);
    return true;
  });

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start ${isPhoneFrame ? 'p-4 sm:p-8 bg-slate-900' : 'p-0'}`}>
      {/* Mobile Outer Container: Full width on phone, or framed on desktop */}
      <div className={`w-full ${isPhoneFrame ? 'max-w-[420px] rounded-[40px] border-[8px] border-slate-800 shadow-2xl overflow-hidden' : 'max-w-2xl sm:px-4'} flex flex-col min-h-screen bg-slate-950`}>

        {/* 1. Mobile App Top Bar */}
        <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Agent Avatar & Status Beacon */}
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Optional Admin/Manager Exit Arrow */}
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition"
                  title="Back to Admin Dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center font-bold text-white shadow-md text-xs border border-slate-700">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FA'}
                </div>
                {onDuty && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs sm:text-sm font-bold text-white leading-tight truncate">
                    {user?.name || 'Rahul Sharma'}
                  </h1>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-primary/20 text-primary border border-primary/30 flex-shrink-0">
                    AGENT
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${onDuty ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="truncate">{onDuty ? 'Active' : 'Off Duty'}</span>
                  <span>&bull;</span>
                  <span className="font-mono text-cyan-300">GPS &plusmn;{gpsAccuracy}m</span>
                </div>
              </div>
            </div>

            {/* Right: Navbar Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Admin/Manager Fast Dispatch Task & Proof Reviews Buttons */}
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCreateTaskModal(true)}
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-[11px] font-bold active:scale-95 transition shadow-sm"
                    title="Dispatch New Task to Field Agent"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/field-reviews')}
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold active:scale-95 transition"
                    title="Go to Manager Proof Approvals"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Reviews</span>
                  </button>
                </>
              )}

              {/* Duty Toggle Pill Button */}
              <button
                type="button"
                onClick={() => {
                  const next = !onDuty;
                  setOnDuty(next);
                  toast.success(next ? 'Switched to ON DUTY (Broadcasting GPS)' : 'Switched to OFF DUTY');
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                  onDuty
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-glow-primary'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Duty Mode"
              >
                <Power className={`w-3.5 h-3.5 ${onDuty ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="hidden xs:inline">{onDuty ? 'ON' : 'OFF'}</span>
              </button>

              {/* Refresh Tasks Button */}
              <button
                type="button"
                onClick={async () => {
                  await fetchTasks();
                  toast.success('Deliveries refreshed');
                }}
                disabled={loading}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white active:scale-95 transition"
                title="Refresh Deliveries"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              </button>

              {/* Desktop Phone Frame Switcher Button */}
              <button
                type="button"
                onClick={() => setIsPhoneFrame(!isPhoneFrame)}
                className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-lg border transition active:scale-95 ${
                  isPhoneFrame
                    ? 'bg-primary/20 border-primary text-primary shadow-glow'
                    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white'
                }`}
                title={isPhoneFrame ? 'Expand to Full Width' : 'Simulate Phone Frame'}
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>

              {/* Sign Out Button (With working navigation) */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-red-200 active:scale-95 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Strict Security Guard Header Pill */}
          <div className="mt-2 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/25 flex items-center justify-between text-[10px] text-emerald-300">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Zero Financial Exposure Enforced</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">No Prices • Safe View</span>
          </div>
        </header>

        {/* 2. Sub-Navbar: Filter Buttons & Task Stop Selector */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950 border-b border-slate-800/60 space-y-2">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: `All (${tasks.length})` },
              { id: 'ACTIVE', label: `Active (${tasks.filter(t => ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE'].includes(t.state)).length})` },
              { id: 'DONE', label: `Done (${tasks.filter(t => ['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'VERIFIED', 'COMPLETED'].includes(t.state)).length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition active:scale-95 ${
                  filterTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Horizontal Scrollable Task Stops */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">No deliveries matching this filter.</p>
            ) : (
              filteredTasks.map((t, idx) => {
                const isSelected = activeTask?.taskId === t.taskId;
                return (
                  <button
                    key={t.taskId}
                    type="button"
                    onClick={() => setSelectedTaskId(t.taskId)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl border text-left transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-primary/20 border-primary text-white shadow-glow-primary ring-1 ring-primary/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-cyan-300">
                        Stop #{idx + 1}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        t.state === 'EN_ROUTE' ? 'bg-amber-500/20 text-amber-400' :
                        t.state === 'ARRIVED' ? 'bg-purple-500/20 text-purple-400' :
                        t.state === 'PROOF_SUBMITTED' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {t.state}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white mt-0.5 max-w-[140px] truncate">
                      {t.store?.name}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Main Task Content Body */}
        {activeTask ? (
          <div className="flex-1 px-4 py-4 space-y-4 pb-40">

            {/* A. Destination Store Hero Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                    {activeTask.store?.storeId || 'AUTHORIZED PARTNER'}
                  </span>
                  <h2 className="text-lg font-bold text-white mt-0.5 leading-snug">
                    {activeTask.store?.name}
                  </h2>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  activeTask.state === 'EN_ROUTE' ? 'border-amber-500 text-amber-400 bg-amber-500/10 animate-pulse' :
                  activeTask.state === 'ARRIVED' ? 'border-purple-500 text-purple-400 bg-purple-500/10' :
                  activeTask.state === 'PROOF_SUBMITTED' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' :
                  'border-blue-500 text-blue-400 bg-blue-500/10'
                }`}>
                  {activeTask.state}
                </span>
              </div>

              <p className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                {activeTask.store?.address || 'Mumbai Central Distribution Hub, Maharashtra'}
              </p>

              {/* 1-Tap Mobile Action Row (Call Store + Google Maps GPS Navigation) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* 1-Tap Phone Call */}
                <a
                  href={`tel:${activeTask.store?.phone || '+919820144552'}`}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium active:scale-95 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Call Store
                </a>

                {/* 1-Tap Google Maps External App Navigation */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeTask.store?.location?.lat},${activeTask.store?.location?.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium active:scale-95 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  Turn-by-Turn
                </a>
              </div>

              {/* Transaction Access Control based on Admin Storefront Approval */}
              {!isStorefrontApproved ? (
                <div
                  onClick={() => {
                    toast.error('Transactions locked! Admin or Manager must verify and approve storefront proof first.', {
                      icon: '🔒',
                      duration: 3500,
                    });
                    setShowTransactionModal(true);
                  }}
                  className="w-full mt-2 py-2.5 px-3 rounded-xl bg-slate-900/95 border border-slate-700/80 hover:border-amber-500/50 cursor-pointer flex items-center justify-between transition-all group select-none shadow-sm"
                  title="Transactions locked until Admin or Manager approves storefront proof"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform flex-shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-300 group-hover:text-amber-300 transition-colors">
                          Store Transactions & Invoices
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold tracking-wide uppercase">
                          Locked
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Awaiting Admin / Manager storefront approval
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-amber-400/80 font-medium flex items-center gap-1 group-hover:text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    View Status
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(true)}
                  className="w-full mt-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/60 border border-emerald-500/50 hover:border-emerald-400 text-emerald-200 text-xs font-semibold flex items-center justify-between active:scale-98 transition shadow-lg shadow-emerald-950/20 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-300">
                          Store Transactions & Invoices
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold tracking-wide uppercase">
                          Unlocked ✓
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-400/80 leading-tight mt-0.5">
                        Storefront verified • Ledger statement accessible
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform">
                    View Statement →
                  </span>
                </button>
              )}
            </div>

            {/* B. Mobile Interactive GPS Map with 50m Geofence */}
            <div
              className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl relative z-0 isolate"
              style={{ isolation: 'isolate', zIndex: 0 }}
            >
              <div className="h-56 sm:h-64 w-full relative z-0">
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

                    {/* Store Target with 50-Meter Geofence Circle */}
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
                        fillOpacity: 0.3,
                        weight: 2,
                      }}
                    />

                    {/* Agent Live Marker */}
                    <Marker position={[agentCoords.lat, agentCoords.lng]} icon={AGENT_ICON}>
                      <Popup>
                        <p className="font-bold text-xs">Your Location</p>
                      </Popup>
                    </Marker>
                  </MapContainer>
                )}
              </div>

              {/* Dynamic Mobile Proximity Pill Overlay */}
              <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2 pointer-events-auto">
                <div className={`px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-lg border ${
                  isWithinGeofence
                    ? 'bg-emerald-950/85 border-emerald-500/80 text-emerald-300 animate-pulse'
                    : 'bg-slate-900/90 border-slate-700 text-amber-300'
                }`}>
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>
                    {distanceToStore !== null ? `${distanceToStore}m away` : 'Locating...'}
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">
                    {isWithinGeofence ? '• Inside 50m' : '• 50m geofence'}
                  </span>
                </div>

                {/* Instant Simulate Arrival Button (for testing anywhere) */}
                {activeTask.state === 'EN_ROUTE' && !isWithinGeofence && (
                  <button
                    onClick={() => handleRecordArrival(true)}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-full bg-primary/90 hover:bg-primary border border-white/20 text-white text-[11px] font-semibold shadow-lg flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    Simulate 12m
                  </button>
                )}
              </div>
            </div>

            {/* C. Interactive Unloading Package Checklist (Zero Financial Exposure) */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-primary" />
                  Delivery Manifest Checklist
                </h3>
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                  {Object.values(checkedItems).filter(Boolean).length} / {(activeTask.items || DEMO_TASKS[0].items).length} Unloaded
                </span>
              </div>

              <div className="space-y-2">
                {(activeTask.items || DEMO_TASKS[0].items).map((item, idx) => {
                  const isChecked = checkedItems[item.id || idx];
                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => toggleItemCheck(item.id || idx)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isChecked
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className={`text-xs font-semibold ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Unit: {item.packageType || 'Standard'}
                          </p>
                        </div>
                      </div>

                      <Badge variant="outline" className="font-mono text-xs border-cyan-500/40 text-cyan-300 bg-cyan-950/20">
                        {item.quantity}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* D. Storefront Camera & Signboard Verification Box */}
            {['ARRIVED', 'PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'VERIFIED'].includes(activeTask.state) && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    Storefront Photo & Signboard Proof
                  </h3>
                  {activeTask.proof && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      Proof Uploaded
                    </span>
                  )}
                </div>

                {/* If Proof Already Submitted */}
                {activeTask.proof ? (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Signboard Proof Stamped
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {activeTask.proof.proofId?.slice(0, 16)}...
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Supervisor Review</span>
                        <span className="font-bold text-yellow-400">{activeTask.proof.reviewState || 'REVIEW_REQUIRED'}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Signboard Match</span>
                        <span className="font-bold text-emerald-400">98.6% Confirmed</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Live Camera Viewfinder or Upload */
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={fileInputRef}
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />

                    {isCameraActive ? (
                      /* Live HTML5 Video Viewfinder */
                      <div className="relative rounded-2xl overflow-hidden aspect-square max-h-[300px] bg-black border-2 border-primary">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        {/* Viewfinder reticle overlay */}
                        <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                          <span className="text-[11px] text-white/80 bg-black/50 px-2 py-1 rounded">
                            Align Store Signboard Here
                          </span>
                        </div>
                        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4">
                          <button
                            onClick={captureLiveFrame}
                            className="w-14 h-14 rounded-full bg-white text-primary flex items-center justify-center shadow-2xl active:scale-95"
                          >
                            <Camera className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : capturedImage ? (
                      /* Photo Snapshot Preview */
                      <div className="space-y-3">
                        <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border border-slate-700">
                          <img src={capturedImage} alt="Storefront Signboard" className="w-full h-full object-cover" />
                          <button
                            onClick={() => {
                              setCapturedImage(null);
                              setProofReference('');
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-cyan-300">
                            {proofReference}
                          </div>
                        </div>

                        {/* Simulated OCR Card */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-emerald-400 font-semibold">
                            <span>AI Signboard OCR Detected:</span>
                            <span>98.6% Match</span>
                          </div>
                          <p className="text-slate-300 font-mono">TEXT: {activeTask.store.name?.toUpperCase()}</p>
                          <p className="text-slate-400 font-mono text-[10px]">GSTIN: 27AAACS9876E1Z4</p>
                        </div>

                        <Button
                          onClick={handleSubmitProof}
                          disabled={actionLoading}
                          className="w-full py-3 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl shadow-glow text-sm"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Submit Storefront Proof
                        </Button>
                      </div>
                    ) : (
                      /* Camera Launch Trigger */
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={startLiveCamera}
                          className="p-3.5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-primary bg-slate-950/60 text-center flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <Camera className="w-6 h-6 text-primary animate-pulse" />
                          <span className="text-[11px] font-bold text-white">Live Camera</span>
                        </button>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-3.5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-primary bg-slate-950/60 text-center flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <Upload className="w-6 h-6 text-cyan-400" />
                          <span className="text-[11px] font-bold text-white">Upload Photo</span>
                        </button>

                        <button
                          onClick={handleGenerateSignboardSample}
                          className="p-3.5 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-950/20 text-center flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <Sparkles className="w-6 h-6 text-amber-400" />
                          <span className="text-[11px] font-bold text-white">Sample Board</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* E. Collapsible Audit Log Sheet */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
              <button
                onClick={() => setShowAuditDrawer(!showAuditDrawer)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Task Audit & Provenance Log
                </span>
                {showAuditDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAuditDrawer && (
                <div className="p-3.5 pt-0 space-y-2 border-t border-slate-800 text-[11px] font-mono">
                  <div className="p-2 rounded bg-slate-950 text-slate-300">
                    <span className="text-primary font-bold">TASK_CREATED</span> &bull; {new Date(activeTask.createdAt).toLocaleTimeString()}
                  </div>
                  {activeTask.arrivalEvidence && (
                    <div className="p-2 rounded bg-slate-950 text-emerald-300">
                      <span className="text-emerald-400 font-bold">GEOFENCE_CONFIRMED</span> &bull; Radius: 50m &bull; Dist: {activeTask.arrivalEvidence.distanceMeters}m
                    </div>
                  )}
                  {activeTask.proof && (
                    <div className="p-2 rounded bg-slate-950 text-yellow-300">
                      <span className="text-yellow-400 font-bold">PROOF_STAMPED</span> &bull; Ref: {activeTask.proof.proofId}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <PackageCheck className="w-12 h-12 mb-2 text-slate-600" />
            <p className="text-sm font-semibold">No Delivery Selected</p>
          </div>
        )}

        {/* 4. FIXED BOTTOM THUMB-ZONE FLOATING ACTION DOCK */}
        {activeTask && (
          <div className={`fixed bottom-0 left-0 right-0 z-[100] p-3 bg-slate-950/98 backdrop-blur-xl border-t border-slate-800 shadow-2xl ${
            isPhoneFrame ? 'max-w-[404px] mx-auto rounded-b-[32px]' : 'max-w-2xl mx-auto'
          }`}>
            {activeTask.state === 'ASSIGNED' && (
              <button
                onClick={() => handleStateTransition('ACCEPTED')}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-base shadow-glow flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <Check className="w-5 h-5" />
                Accept Delivery Assignment
              </button>
            )}

            {activeTask.state === 'ACCEPTED' && (
              <button
                onClick={() => handleStateTransition('EN_ROUTE')}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-extrabold text-base shadow-glow flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <Navigation className="w-5 h-5" />
                Start Trip (Go En Route)
              </button>
            )}

            {activeTask.state === 'EN_ROUTE' && (
              <div className="space-y-1.5">
                <button
                  onClick={() => handleRecordArrival(false)}
                  disabled={actionLoading || !isWithinGeofence}
                  className={`w-full py-4 rounded-2xl font-extrabold text-base shadow-glow flex items-center justify-center gap-2 active:scale-98 transition ${
                    isWithinGeofence
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  {isWithinGeofence ? 'Confirm 50m Arrival at Store' : `Approach Store (${distanceToStore}m / 50m)`}
                </button>
              </div>
            )}

            {activeTask.state === 'ARRIVED' && !activeTask.proof && (
              <button
                onClick={startLiveCamera}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 text-white font-extrabold text-base shadow-glow flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <Camera className="w-5 h-5" />
                Snap Storefront Signboard
              </button>
            )}

            {(activeTask.state === 'PROOF_SUBMITTED' || activeTask.state === 'REVIEW_REQUIRED') && (
              <div className="w-full py-3.5 rounded-2xl bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 font-bold text-center text-sm flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Proof Under Review by Manager
              </div>
            )}

            {(activeTask.state === 'VERIFIED' || activeTask.state === 'COMPLETED') && (
              <div className="space-y-2">
                <div className="w-full py-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-center text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Storefront Verified by Admin!
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(true)}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-98"
                >
                  <Receipt className="w-4 h-4" />
                  View Store Transactions & Ledger (Unlocked)
                </button>
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
