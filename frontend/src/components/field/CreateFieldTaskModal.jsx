import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MapPin,
  Store,
  Phone,
  Package,
  Plus,
  Trash2,
  Navigation,
  UserCheck,
  Sparkles,
  Compass,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import { fieldReviewAPI } from '../../services/api/fieldReviewAPI';

// Dealers extracted from Receivable-22 Sept 26.pdf (Bright Connections Tally Master)
const MUMBAI_PRESETS = [
  {
    label: 'Tanvi Mobile Hub (Andheri E)',
    name: 'Tanvi Mobile Hub',
    storeCode: 'BC-MUM-001',
    lat: 19.1185,
    lng: 72.8480,
    address: 'Shop 4, Station Road, Andheri East, Mumbai 400069',
    phone: '+91 98201 23456',
    receivables: '₹13,204',
    items: [
      { id: 1, name: '5G Smartphone Stock (Dual SIM, 128GB)', quantity: '15 Units', packageType: 'Cartons' },
      { id: 2, name: '65W Fast Charging Adapters', quantity: '40 Units', packageType: 'Boxes' },
      { id: 3, name: 'Curved Tempered Glass Protectors', quantity: '100 Pcs', packageType: 'Packs' },
    ]
  },
  {
    label: 'Zee Mobile Nx (Santacruz E)',
    name: 'Zee Mobile Nx',
    storeCode: 'BC-MUM-002',
    lat: 19.0820,
    lng: 72.8420,
    address: 'Station Road, Santacruz East, Mumbai 400055',
    phone: '+91 98202 34567',
    receivables: '₹21,299',
    items: [
      { id: 1, name: 'AMOLED Replacement Displays (OLED Kits)', quantity: '10 Units', packageType: 'Padded Crates' },
      { id: 2, name: 'Wireless Bluetooth Earbuds Pro', quantity: '25 Units', packageType: 'Cartons' },
      { id: 3, name: 'Braided Type-C Fast Data Cables', quantity: '50 Pcs', packageType: 'Packs' },
    ]
  },
  {
    label: 'The Mobile Hub (Marol / Andheri)',
    name: 'The Mobile Hub',
    storeCode: 'BC-MUM-003',
    lat: 19.1130,
    lng: 72.8870,
    address: 'Marol Naka Metro Junction, Andheri East, Mumbai 400059',
    phone: '+91 98203 45678',
    receivables: '₹18,827',
    items: [
      { id: 1, name: 'Smart Power Banks 20000mAh (65W Output)', quantity: '20 Units', packageType: 'Boxes' },
      { id: 2, name: 'Shockproof Transparent TPU Cases', quantity: '80 Pcs', packageType: 'Packs' },
    ]
  },
  {
    label: 'Shree New Kheteshwar (Andheri)',
    name: 'Shree New Kheteshwar Mobile',
    storeCode: 'BC-MUM-004',
    lat: 19.1197,
    lng: 72.8464,
    address: 'SV Road Junction, Andheri East, Mumbai 400069',
    phone: '+91 98204 56789',
    receivables: '₹6,136',
    items: [
      { id: 1, name: 'Fast USB-C Charging Hubs 100W', quantity: '15 Units', packageType: 'Boxes' },
      { id: 2, name: 'Magnetic Phone Mounts & Stands', quantity: '35 Pcs', packageType: 'Packs' },
    ]
  },
  {
    label: 'Vinayak Mobile (Khar West)',
    name: 'Vinayak Mobile',
    storeCode: 'BC-MUM-005',
    lat: 19.0720,
    lng: 72.8360,
    address: 'SV Road, Khar West, Mumbai 400052',
    phone: '+91 98205 67890',
    receivables: '₹8,151',
    items: [
      { id: 1, name: 'Wireless Charging Pads 15W Qi-Certified', quantity: '20 Units', packageType: 'Boxes' },
      { id: 2, name: 'Hydrogel Screen Protectors Pack', quantity: '60 Pcs', packageType: 'Packs' },
    ]
  },
  {
    label: 'Tech Guide (Mahakali Caves)',
    name: 'Tech Guide',
    storeCode: 'BC-MUM-006',
    lat: 19.1250,
    lng: 72.8650,
    address: 'Mahakali Caves Road, Andheri East, Mumbai 400093',
    phone: '+91 98206 78901',
    receivables: '₹6,330',
    items: [
      { id: 1, name: 'Bluetooth Headsets & Mic Adapters', quantity: '30 Units', packageType: 'Cartons' },
      { id: 2, name: 'Universal Travel Adapters 45W', quantity: '25 Units', packageType: 'Boxes' },
    ]
  }
];

export const CreateFieldTaskModal = ({ isOpen, onClose, onSuccess }) => {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [phone, setPhone] = useState('+91 98201 23456');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('19.1185');
  const [lng, setLng] = useState('72.8480');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { id: 1, name: '5G Smartphone Stock (Dual SIM, 128GB)', quantity: '15 Units', packageType: 'Cartons' },
    { id: 2, name: '65W Fast Charging Adapters', quantity: '40 Units', packageType: 'Boxes' }
  ]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch agents on mount or when opened
  useEffect(() => {
    if (!isOpen) return;

    const fetchAgents = async () => {
      try {
        setLoadingAgents(true);
        const res = await fieldReviewAPI.getFieldAgents();
        if (res?.data?.success && res.data.agents?.length > 0) {
          setAgents(res.data.agents);
          setSelectedAgentId(res.data.agents[0]._id);
        }
      } catch (err) {
        console.warn('Notice loading agents:', err);
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchAgents();
  }, [isOpen]);

  // Apply a quick Mumbai location preset
  const applyPreset = (preset) => {
    setStoreName(preset.name);
    setStoreId(preset.storeCode || `BC-MUM-${Date.now().toString().slice(-4)}`);
    setAddress(preset.address);
    setPhone(preset.phone);
    setLat(preset.lat.toString());
    setLng(preset.lng.toString());
    if (preset.items && preset.items.length > 0) {
      setItems(preset.items);
    }
    toast.success(`Applied ${preset.name} from Tally PDF (${preset.receivables} receivables)`);
  };

  // Add delivery item row
  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now(), name: 'Whole Cloves (Laung)', quantity: '25 kg', packageType: 'Sacks' }
    ]);
  };

  // Remove delivery item row
  const removeItem = (idToRemove) => {
    if (items.length <= 1) {
      toast.error('Task must include at least one delivery item');
      return;
    }
    setItems(items.filter((item) => item.id !== idToRemove));
  };

  // Update item field
  const updateItem = (id, field, value) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  // Submit dispatch handler
  const handleDispatch = async (e) => {
    e.preventDefault();

    if (!storeName.trim()) {
      toast.error('Store name is required');
      return;
    }

    if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
      toast.error('Valid numeric GPS coordinates (Latitude & Longitude) are required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        storeName: storeName.trim(),
        storeId: storeId.trim() || `STR-MUM-${Date.now().toString().slice(-4)}`,
        address: address.trim() || 'Mumbai Central Distribution Hub, Maharashtra',
        phone: phone.trim() || '+91 98201 44552',
        location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        },
        assignedAgentId: selectedAgentId || undefined,
        items,
        notes: notes.trim()
      };

      const res = await fieldReviewAPI.createTask(payload);
      if (res?.data?.success) {
        toast.success(res.data.message || 'Task dispatched to agent successfully!');
        
        // Notify other tabs and components in real time
        window.dispatchEvent(new Event('setu_alerts_updated'));
        
        if (onSuccess) {
          onSuccess(res.data.task);
        }
        onClose();
      }
    } catch (err) {
      console.error('Task dispatch error:', err);
      toast.error(err.response?.data?.message || 'Failed to dispatch task');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-foreground">
                Dispatch New Field Task
              </h2>
              <p className="text-xs text-muted-foreground">
                Assign store verification & package delivery stops to field agents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDispatch} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Quick Presets Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                1-Click Mumbai Dealers (Receivable-22 Sept 26.pdf):
              </label>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                Tally Prime Master
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {MUMBAI_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40 text-foreground transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                  <span>{preset.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
                    {preset.receivables}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Selection */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              Assign Field Agent *
            </label>
            {loadingAgents ? (
              <p className="text-xs text-muted-foreground">Loading active field agents...</p>
            ) : agents.length > 0 ? (
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              >
                {agents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name} ({agent.email}) - {agent.role}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-500">
                Default Field Agent (Rahul Sharma - agent@company.com) will be assigned.
              </p>
            )}
          </div>

          {/* Store Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <Store className="w-3.5 h-3.5 text-primary" />
                Store Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Andheri Supermart & Kirana"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Store ID / Code (Auto-generated if empty)
              </label>
              <input
                type="text"
                placeholder="e.g. STR-ANDHERI-01"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          {/* Address & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Full Store Address
              </label>
              <input
                type="text"
                placeholder="Shop 12, Station Road, Mumbai 400058"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Store Contact
              </label>
              <input
                type="text"
                placeholder="+91 98201 44552"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* GPS Coordinates (Geofence target) */}
          <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-primary" />
                50m Geofence GPS Target (Lat / Lng)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Target radius: 50 meters
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  Latitude (DD)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="19.1197"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  Longitude (DD)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="72.8464"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {/* Package Delivery Checklist Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-500" />
                Delivery Cargo Checklist ({items.length} items)
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Item name (e.g. Cardamom Grade-A)"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <input
                    type="text"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    className="w-24 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <input
                    type="text"
                    placeholder="Package"
                    value={item.packageType}
                    onChange={(e) => updateItem(item.id, 'packageType', e.target.value)}
                    className="w-24 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Manager Notes */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Dispatch Instructions / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Verify signboard lettering and collect store manager signature upon unloading."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="text-xs font-bold flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            >
              <Send className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
              {submitting ? 'Dispatching Task...' : 'Dispatch Task to Agent'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateFieldTaskModal;
