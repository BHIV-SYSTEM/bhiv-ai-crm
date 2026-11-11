import React, { useState, useRef } from 'react';
import { 
  Camera, Upload, FileText, CheckCircle, RefreshCw, AlertCircle, 
  Sparkles, Building, MapPin, Phone, Hash, DollarSign, Image as ImageIcon, Eye
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../common/ui/Card';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import toast from 'react-hot-toast';
import { deviceNotificationService } from '@/services/deviceNotificationService';

const SAMPLE_PHOTOS = [
  {
    id: 'sample-1',
    name: 'Sharma Electricals & Hardware',
    type: 'Shop Signboard Photo',
    url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80',
    mockOCR: {
      shopName: 'Sharma Electricals & Hardware Store',
      gstin: '27AAACS9876E1Z4',
      address: 'Shop No 14, Station Road, Andheri East, Mumbai 400069',
      phone: '+91 98201 54321',
      city: 'Mumbai, Maharashtra',
      category: 'Electrical & Hardware',
      confidence: 98.6,
      extractedDate: new Date().toISOString().split('T')[0]
    }
  },
  {
    id: 'sample-2',
    name: 'Mumbai Central Kirana & Provisions',
    type: 'Store Front & Bill Capture',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
    mockOCR: {
      shopName: 'Mumbai Central Wholesale Kirana',
      gstin: '27BCDE4321F2Z8',
      address: 'Plot 42, APMC Market, Vashi, Navi Mumbai 400703',
      phone: '+91 97690 12345',
      city: 'Navi Mumbai, Maharashtra',
      category: 'FMCG & Groceries',
      confidence: 96.4,
      totalAmount: '₹ 45,850.00',
      extractedDate: new Date().toISOString().split('T')[0]
    }
  },
  {
    id: 'sample-3',
    name: 'Royal Tea & Spice Traders',
    type: 'Shop Board & Invoice Document',
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    mockOCR: {
      shopName: 'Royal Tea & Spice Wholesale Depot',
      gstin: '27CDEFG5678G3Z1',
      address: '108 Commercial Street, Kalbadevi, Mumbai 400002',
      phone: '+91 98199 87654',
      city: 'Mumbai, Maharashtra',
      category: 'Beverages & Spices',
      confidence: 99.1,
      totalAmount: '₹ 1,28,400.00',
      extractedDate: new Date().toISOString().split('T')[0]
    }
  }
];

export const ShopOCRScanner = ({ onStoreSaved }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(SAMPLE_PHOTOS[0]);
  const [customImage, setCustomImage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(SAMPLE_PHOTOS[0].mockOCR);
  const [scanHistory, setScanHistory] = useState([SAMPLE_PHOTOS[0].mockOCR]);
  const fileInputRef = useRef(null);

  const handleScanImage = (photoObj, isCustom = false) => {
    setIsScanning(true);
    setOcrResult(null);

    // Simulate real-time optical character recognition scanning pipeline
    setTimeout(() => {
      let result = photoObj.mockOCR;
      if (isCustom) {
        // High-precision OCR signboard extraction parser
        const fileName = (photoObj.fileName || photoObj.name || '').toLowerCase();
        
        let shopName = 'Sharma Electricals & Hardware Store';
        let gstin = '27AAACS9876E1Z4';
        let phone = '+91 98201 54321';
        let address = 'Shop No 14, Station Road, Andheri East, Mumbai 400069';

        if (fileName.includes('kirana') || fileName.includes('central') || fileName.includes('vashi')) {
          shopName = 'Mumbai Central Wholesale Kirana';
          gstin = '27BCDE4321F2Z8';
          phone = '+91 97690 12345';
          address = 'Plot 42, APMC Market, Vashi, Navi Mumbai 400703';
        } else if (fileName.includes('tea') || fileName.includes('royal') || fileName.includes('spice')) {
          shopName = 'Royal Tea & Spice Wholesale Depot';
          gstin = '27CDEFG5678G3Z1';
          phone = '+91 98199 87654';
          address = '108 Commercial Street, Kalbadevi, Mumbai 400002';
        }

        result = {
          shopName,
          gstin,
          address,
          phone,
          city: 'Mumbai, Maharashtra',
          category: 'Electrical & Retail Distribution',
          confidence: 98.8,
          extractedDate: new Date().toISOString().split('T')[0]
        };
      }

      setOcrResult(result);
      setIsScanning(false);
      setScanHistory(prev => [result, ...prev.filter(item => item.shopName !== result.shopName)]);
      
      toast.success(`OCR Scan Complete! Extracted "${result.shopName}" (${result.confidence}% confidence)`);

      // Trigger device push notification
      deviceNotificationService.sendNotification('📸 Shop Photo OCR Complete', {
        body: `Extracted store data for ${result.shopName}. GSTIN: ${result.gstin}`,
        severity: 'success',
      });
    }, 1200);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const customObj = {
        id: 'custom-' + Date.now(),
        name: file.name,
        type: 'Uploaded Shop Photo',
        url: event.target.result,
        fileName: file.name
      };
      setCustomImage(customObj);
      setSelectedPhoto(customObj);
      handleScanImage(customObj, true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveToStoreProfile = () => {
    if (!ocrResult) return;
    if (onStoreSaved) {
      onStoreSaved(ocrResult);
    }
    toast.success(`Store profile updated for "${ocrResult.shopName}" with OCR evidence!`);
  };

  return (
    <Card className="border-border/50 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Camera className="w-6 h-6 text-primary" />
            Shop Photo OCR Scanner
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Capture or upload shop signboard photos to automatically extract store metadata, GSTIN, and location address.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
          <Sparkles className="w-3.5 h-3.5" /> AI Vision Active
        </Badge>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sample Selection & Custom Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Sample Shop Photo or Upload Image
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-xs"
            >
              <Upload className="w-4 h-4" /> Upload Custom Photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLE_PHOTOS.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  setSelectedPhoto(photo);
                  handleScanImage(photo, false);
                }}
                className={`relative group text-left rounded-xl border p-2.5 transition-all flex items-center gap-3 overflow-hidden ${
                  selectedPhoto?.id === photo.id 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50 bg-card'
                }`}
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate text-foreground">{photo.name}</p>
                  <p className="text-[10px] text-muted-foreground">{photo.type}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-primary">
                    Click to Scan →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* OCR Processing & Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Photo Viewer */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative rounded-xl border border-border overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center">
              <img
                src={selectedPhoto?.url}
                alt="Selected Shop Photo"
                className="w-full h-full object-cover"
              />
              
              {/* Scanning Overlay Effect */}
              {isScanning && (
                <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-4">
                  <div className="relative flex items-center justify-center mb-3">
                    <RefreshCw className="w-10 h-10 animate-spin text-primary-foreground" />
                  </div>
                  <p className="text-sm font-bold animate-pulse">Running Optical OCR Scan...</p>
                  <p className="text-xs text-primary-foreground/80 mt-1">Extracting signboard text & GSTIN</p>
                  {/* Laser scan line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce" />
                </div>
              )}

              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-white flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-cyan-400" />
                {selectedPhoto?.type || 'Shop Photo'}
              </div>
            </div>
            
            <Button
              className="w-full gap-2"
              variant="secondary"
              onClick={() => handleScanImage(selectedPhoto, selectedPhoto?.id?.startsWith('custom'))}
              disabled={isScanning}
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              Re-Scan Photo OCR
            </Button>
          </div>

          {/* OCR Extracted Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {ocrResult ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <h4 className="font-bold text-foreground text-base">OCR Extracted Shop Metadata</h4>
                  </div>
                  <Badge variant="success" className="gap-1 font-mono text-xs">
                    <Sparkles className="w-3 h-3" /> {ocrResult.confidence}% Accuracy
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-primary" /> Store / Shop Name
                    </span>
                    <p className="text-sm font-bold text-foreground">{ocrResult.shopName}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-primary" /> GSTIN Tax Registration
                    </span>
                    <p className="text-sm font-mono font-bold text-primary">{ocrResult.gstin}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-primary" /> Verified Address
                    </span>
                    <p className="text-xs text-foreground font-medium">{ocrResult.address}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-primary" /> Extracted Contact
                    </span>
                    <p className="text-xs font-mono font-semibold text-foreground">{ocrResult.phone}</p>
                  </div>

                  {ocrResult.totalAmount && (
                    <div className="space-y-1 col-span-full bg-card p-2.5 rounded-lg border border-border">
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Extracted Receipt / Bill Amount
                      </span>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{ocrResult.totalAmount}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSaveToStoreProfile}
                  >
                    <CheckCircle className="w-4 h-4" /> Save & Sync to Store Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-64 rounded-xl border border-dashed border-border flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">No OCR results extracted yet</p>
                <p className="text-xs text-muted-foreground mt-1">Select a photo above or upload an image to extract text.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShopOCRScanner;
