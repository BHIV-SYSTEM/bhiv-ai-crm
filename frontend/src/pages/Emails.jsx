import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Mail, Send, Clock, CheckCircle, XCircle, AlertTriangle,
  Plus, RefreshCw, Settings, FileText, Calendar, ChevronRight,
  AtSign, Save
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import MetricCard from '../components/common/charts/MetricCard';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import { Alert } from '../components/common/ui/Alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/ui/Table';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { Modal, ModalFooter } from '../components/common/ui/Modal';
import { emsAPI } from '../services/api/emsAPI';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';
import toast from 'react-hot-toast';

export const Emails = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('send');
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [emailActivity, setEmailActivity] = useState([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailType, setEmailType] = useState('restock');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [formData, setFormData] = useState({
    recipientEmail: '',
    productId: '',
    productName: '',
    currentStock: '5',
    quantity: '20',
    supplierEmail: '',
    poNumber: '',
    unitCost: '',
    trackingNumber: '',
    courierName: '',
    originalDelivery: '',
    newDelivery: '',
    delayReason: '',
    message: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSendEmail = async () => {
    try {
      setSending(true);
      setError(null);
      setSuccessMsg(null);

      const targetEmail = formData.recipientEmail || formData.supplierEmail;
      if (!targetEmail) {
        const msg = 'Please enter a recipient email address';
        setError(msg);
        toast.error(msg);
        setSending(false);
        return;
      }

      let res;
      if (emailType === 'restock') {
        res = await emsAPI.sendRestockAlert({
          supplierEmail: targetEmail,
          productId: formData.productId,
          productName: formData.productName || 'Requested Product',
          currentStock: parseInt(formData.currentStock) || 5,
          quantity: parseInt(formData.quantity) || 20,
          message: formData.message || 'Urgent restock alert from SETU Logistics'
        });
      } else if (emailType === 'purchase') {
        res = await emsAPI.sendPurchaseOrder({
          supplierEmail: targetEmail,
          supplierName: 'Valued Supplier',
          items: [{
            productName: formData.productName || 'Item',
            quantity: parseInt(formData.quantity) || 1,
            price: parseFloat(formData.unitCost) || 0
          }],
          orderNumber: formData.poNumber || `PO-${Date.now()}`
        });
      } else if (emailType === 'shipment') {
        res = await emsAPI.sendShipmentNotification({
          recipientEmail: targetEmail,
          trackingNumber: formData.trackingNumber || `TRK-${Date.now()}`
        });
      } else {
        res = await emsAPI.sendRestockAlert({
          supplierEmail: targetEmail,
          message: formData.message || 'Alert'
        });
      }

      if (res.data?.success || res.status === 200) {
        const msg = `Email sent successfully to ${targetEmail}!`;
        setSuccessMsg(msg);
        toast.success(msg);
        setShowEmailModal(false);
        fetchEmailData();
      } else {
        const errMsg = res.data?.message || 'Failed to send email';
        setError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      console.error('Error sending email from modal:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to send email';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  const [metrics, setMetrics] = useState({
    emailsSentToday: 0,
    successRate: 0,
    scheduled: 0,
    templates: 0,
  });
  
  // Settings state
  const [smtpSettings, setSmtpSettings] = useState({
    host: 'smtp.gmail.com',
    user: 'your-email@gmail.com',
    port: 587,
    sslTls: true
  });
  const [expandedTriggers, setExpandedTriggers] = useState({});

  // Fetch email data
  const fetchEmailData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch scheduled emails
      try {
        const scheduledResponse = await emsAPI.getScheduledEmails();
        const rawScheduled = scheduledResponse.data?.data?.scheduled || scheduledResponse.data?.scheduled || (Array.isArray(scheduledResponse.data) ? scheduledResponse.data : []);
        const scheduledData = Array.isArray(rawScheduled) ? rawScheduled : [];
        setScheduledEmails(scheduledData.map(email => ({
          id: email.id,
          subject: email.subject || email.title || 'Scheduled Email',
          recipients: Array.isArray(email.recipients) ? email.recipients : [email.recipient || ''],
          scheduledTime: email.scheduled_time ? new Date(email.scheduled_time) : new Date(),
          status: email.status || 'pending',
          priority: email.priority || 'medium',
        })));
      } catch (err) {
        console.warn('Failed to fetch scheduled emails:', err);
      }

      // Fetch email activity
      try {
        const activityResponse = await emsAPI.getEmailActivity({ limit: 100 });
        const rawActivity = activityResponse.data?.data?.activity || activityResponse.data?.activity || (Array.isArray(activityResponse.data) ? activityResponse.data : []);
        const activityData = Array.isArray(rawActivity) ? rawActivity : [];
        setEmailActivity(activityData.map(activity => ({
          id: activity.id,
          type: activity.type || activity.email_type || 'Email',
          recipient: activity.recipient || activity.to || '',
          status: activity.status || 'sent',
          timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date(),
        })));
      } catch (err) {
        console.warn('Failed to fetch email activity:', err);
      }

      // Fetch email stats
      try {
        const statsResponse = await emsAPI.getEmailStats();
        const stats = statsResponse.data?.data || statsResponse.data || {};
        setMetrics({
          // `??` so real zeros (e.g. 0 emails today, 0 templates) are shown
          // as 0 instead of the old fabricated 95.5% / 5 fallbacks
          emailsSentToday: stats.emails_sent_today ?? stats.today ?? 0,
          successRate: stats.success_rate ?? 0,
          scheduled: stats.scheduled ?? 0,
          templates: stats.templates ?? 0,
        });
      } catch (err) {
        console.warn('Failed to fetch email stats:', err);
        // Calculate from activity data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEmails = emailActivity.filter(e => e.timestamp >= today);
        const successful = emailActivity.filter(e => e.status === 'sent').length;
        const successRate = emailActivity.length > 0 ? Math.round((successful / emailActivity.length) * 100 * 10) / 10 : 0;
        setMetrics({
          emailsSentToday: todayEmails.length,
          successRate,
          scheduled: scheduledEmails.length,
          templates: 0,
        });
      }

    } catch (err) {
      console.error('Error fetching email data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load email data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchEmailData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchEmailData]);

  const getStatusVariant = (status) => {
    const variants = {
      sent: 'success',
      pending: 'warning',
      failed: 'destructive',
    };
    return variants[status] || 'default';
  };

  const toggleTrigger = (triggerId) => {
    setExpandedTriggers(prev => ({
      ...prev,
      [triggerId]: !prev[triggerId]
    }));
  };

  const portControls = useMemo(() => {
    const dec = () => setSmtpSettings(p => ({ ...p, port: Math.max(1, (p.port || 587) - 1) }));
    const inc = () => setSmtpSettings(p => ({ ...p, port: Math.min(65535, (p.port || 587) + 1) }));
    return { dec, inc };
  }, []);

  const handleSaveSettings = async () => {
    try {
      await emsAPI.updateSettings(smtpSettings);
      // Show success message
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const triggers = [
    { id: 'restock', name: 'Restock Request' },
    { id: 'purchase', name: 'Purchase Order Created' },
    { id: 'shipment', name: 'Shipment Created' },
    { id: 'delay', name: 'Delivery Delay' },
  ];

  if (loading) {
    return <LoadingSpinner text="Loading email automation..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Email Automation</h1>
          <p className="text-muted-foreground mt-1">
            Manage email triggers and automated notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEmailData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowEmailModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Success Alert */}
      {successMsg && (
        <Alert variant="default" className="border-emerald-500 bg-emerald-500/10 text-emerald-400" onClose={() => setSuccessMsg(null)}>
          <CheckCircle className="h-4 w-4 mr-2 text-emerald-400" />
          {successMsg}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Emails Sent Today"
          value={metrics.emailsSentToday.toLocaleString()}
          icon={Mail}
          variant="primary"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Scheduled"
          value={metrics.scheduled.toLocaleString()}
          icon={Clock}
          variant="accent"
        />
        <MetricCard
          title="Templates"
          value={metrics.templates.toLocaleString()}
          icon={FileText}
          variant="secondary"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'send'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Send Emails
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'scheduled'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Scheduled
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'activity'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity Log
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Send Emails Tab */}
      {activeTab === 'send' && (
        <Card>
          <CardHeader>
            <CardTitle>Email Triggers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card hover onClick={() => { setEmailType('restock'); setShowEmailModal(true); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-8 w-8 text-warning" />
                    <div>
                      <h3 className="font-semibold">Restock Alert</h3>
                      <p className="text-sm text-muted-foreground">Notify when stock is low</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card hover onClick={() => { setEmailType('purchase'); setShowEmailModal(true); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Purchase Order</h3>
                      <p className="text-sm text-muted-foreground">Send PO to suppliers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card hover onClick={() => { setEmailType('shipment'); setShowEmailModal(true); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="h-8 w-8 text-accent" />
                    <div>
                      <h3 className="font-semibold">Shipment Notification</h3>
                      <p className="text-sm text-muted-foreground">Notify customers of shipments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card hover onClick={() => { setEmailType('delay'); setShowEmailModal(true); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-8 w-8 text-destructive" />
                    <div>
                      <h3 className="font-semibold">Delivery Delay</h3>
                      <p className="text-sm text-muted-foreground">Notify of delivery delays</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Emails Tab */}
      {activeTab === 'scheduled' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Scheduled Emails</CardTitle>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Process Scheduled
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Scheduled Time</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledEmails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="font-medium">{email.subject}</TableCell>
                    <TableCell>{email.recipients.join(', ')}</TableCell>
                    <TableCell>{formatDate(email.scheduledTime, 'PPpp')}</TableCell>
                    <TableCell>
                      <Badge variant={email.priority === 'high' ? 'destructive' : 'default'}>
                        {email.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(email.status)}>
                        {email.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Cancel</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Email Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailActivity.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.type}</TableCell>
                    <TableCell>{activity.recipient}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(activity.status)}>
                        {activity.status === 'sent' ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* EMS Settings Heading */}
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6" />
            <h1 className="text-3xl font-heading font-bold tracking-tight">EMS Settings</h1>
          </div>

          {/* Email Configuration Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AtSign className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Email Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">SMTP Host</label>
                  <Input 
                    value={smtpSettings.host}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">SMTP User</label>
                  <Input 
                    value={smtpSettings.user}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">SMTP Port</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={portControls.dec}
                      className="h-10 w-10 p-0"
                    >
                      -
                    </Button>
                    <Input 
                      type="number"
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) || 587 })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={portControls.inc}
                      className="h-10 w-10 p-0"
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ssl_tls"
                    checked={smtpSettings.sslTls}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, sslTls: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="ssl_tls" className="text-sm font-medium">
                    Enable SSL/TLS
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trigger Settings Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Trigger Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {triggers.map((trigger) => {
                  const isExpanded = expandedTriggers[trigger.id];
                  return (
                    <div key={trigger.id} className="border border-border rounded-lg">
                      <button
                        type="button"
                        onClick={() => toggleTrigger(trigger.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronRight 
                            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          />
                          <span className="font-medium">{trigger.name}</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-6 pb-4 pt-2 border-t border-border">
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`trigger_${trigger.id}_enabled`}
                                defaultChecked
                                className="h-4 w-4 rounded border-border"
                              />
                              <label htmlFor={`trigger_${trigger.id}_enabled`} className="text-sm">
                                Enable this trigger
                              </label>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Recipient Email</label>
                              <Input placeholder="email@example.com" className="text-sm" />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Template</label>
                              <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                                <option>Default Template</option>
                                <option>Custom Template 1</option>
                                <option>Custom Template 2</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Save Settings Button */}
          <div className="flex justify-start">
            <Button onClick={handleSaveSettings} className="gap-2">
              <Save className="h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </div>
      )}

      {/* Email Modal */}
      <Modal
        isOpen={showEmailModal}
        title={`Send ${emailType === 'restock' ? 'Restock Alert' : emailType === 'purchase' ? 'Purchase Order' : emailType === 'shipment' ? 'Shipment Notification' : 'Delivery Delay'}`}
        onClose={() => setShowEmailModal(false)}
      >
          <div className="space-y-4">
            <Input 
              label="Recipient Email" 
              placeholder="supplier@example.com" 
              value={formData.recipientEmail} 
              onChange={(e) => handleInputChange('recipientEmail', e.target.value)} 
            />
            {emailType === 'restock' && (
              <>
                <Input 
                  label="Product ID (Optional)" 
                  placeholder="PROD-001" 
                  value={formData.productId} 
                  onChange={(e) => handleInputChange('productId', e.target.value)} 
                />
                <Input 
                  label="Product Name" 
                  placeholder="Wireless Mouse" 
                  value={formData.productName} 
                  onChange={(e) => handleInputChange('productName', e.target.value)} 
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Current Stock" 
                    type="number" 
                    placeholder="5" 
                    value={formData.currentStock} 
                    onChange={(e) => handleInputChange('currentStock', e.target.value)} 
                  />
                  <Input 
                    label="Restock Quantity" 
                    type="number" 
                    placeholder="20" 
                    value={formData.quantity} 
                    onChange={(e) => handleInputChange('quantity', e.target.value)} 
                  />
                </div>
              </>
            )}
            {emailType === 'purchase' && (
              <>
                <Input 
                  label="PO Number" 
                  placeholder="PO-2025-001" 
                  value={formData.poNumber} 
                  onChange={(e) => handleInputChange('poNumber', e.target.value)} 
                />
                <Input 
                  label="Product Name" 
                  placeholder="Wireless Mouse" 
                  value={formData.productName} 
                  onChange={(e) => handleInputChange('productName', e.target.value)} 
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Quantity" 
                    type="number" 
                    placeholder="20" 
                    value={formData.quantity} 
                    onChange={(e) => handleInputChange('quantity', e.target.value)} 
                  />
                  <Input 
                    label="Unit Cost" 
                    type="number" 
                    placeholder="15.50" 
                    value={formData.unitCost} 
                    onChange={(e) => handleInputChange('unitCost', e.target.value)} 
                  />
                </div>
              </>
            )}
            {emailType === 'shipment' && (
              <>
                <Input 
                  label="Tracking Number" 
                  placeholder="FS123456789" 
                  value={formData.trackingNumber} 
                  onChange={(e) => handleInputChange('trackingNumber', e.target.value)} 
                />
                <Input 
                  label="Courier Name" 
                  placeholder="FastShip Express" 
                  value={formData.courierName} 
                  onChange={(e) => handleInputChange('courierName', e.target.value)} 
                />
              </>
            )}
            {emailType === 'delay' && (
              <>
                <Input 
                  label="Tracking Number" 
                  placeholder="FS123456789" 
                  value={formData.trackingNumber} 
                  onChange={(e) => handleInputChange('trackingNumber', e.target.value)} 
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Original Delivery" 
                    type="date" 
                    value={formData.originalDelivery} 
                    onChange={(e) => handleInputChange('originalDelivery', e.target.value)} 
                  />
                  <Input 
                    label="New Delivery" 
                    type="date" 
                    value={formData.newDelivery} 
                    onChange={(e) => handleInputChange('newDelivery', e.target.value)} 
                  />
                </div>
                <Input 
                  label="Delay Reason" 
                  placeholder="Weather conditions" 
                  value={formData.delayReason} 
                  onChange={(e) => handleInputChange('delayReason', e.target.value)} 
                />
              </>
            )}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </ModalFooter>
      </Modal>
    </div>
  );
};

export default Emails;
