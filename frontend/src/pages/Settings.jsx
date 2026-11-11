import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings as SettingsIcon, Save, RefreshCw, Bell, Shield, 
  Database, Mail, Globe, Lock, AlertTriangle, CheckCircle, 
  Moon, Sun, Monitor, Palette
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { Modal, ModalFooter } from '../components/common/ui/Modal';
import { userAPI } from '../services/api/userAPI';
import { deviceNotificationService } from '@/services/deviceNotificationService';

export const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [currentUser, setCurrentUser] = useState(null);

  // Settings state
  const [generalSettings, setGeneralSettings] = useState({
    appName: 'SETU',
    timezone: 'UTC',
    language: 'en',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    orderAlerts: true,
    inventoryAlerts: true,
    deliveryAlerts: true,
    systemAlerts: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    requireStrongPassword: true,
    loginAttempts: 5,
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'SETU',
  });

  const [databaseSettings, setDatabaseSettings] = useState({
    backupFrequency: 'daily',
    backupRetention: 30,
    autoBackup: true,
  });

  // Fetch current user
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await userAPI.getCurrentUser();
      setCurrentUser(response.data);
    } catch (err) {
      console.warn('Failed to fetch current user:', err);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const handleSaveSettings = async (settingsType) => {
    try {
      setLoading(true);
      setError(null);
      
      // In a real app, this would call a settings API
      // For now, we'll save to localStorage
      const settingsKey = `settings_${settingsType}`;
      let settingsToSave = {};
      
      switch (settingsType) {
        case 'general':
          settingsToSave = generalSettings;
          break;
        case 'notifications':
          settingsToSave = notificationSettings;
          break;
        case 'security':
          settingsToSave = securitySettings;
          break;
        case 'email':
          settingsToSave = emailSettings;
          break;
        case 'database':
          settingsToSave = databaseSettings;
          break;
      }
      
      localStorage.setItem(settingsKey, JSON.stringify(settingsToSave));
      setSuccess(`${settingsType.charAt(0).toUpperCase() + settingsType.slice(1)} settings saved successfully`);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'database', label: 'Database', icon: Database },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure system preferences and settings
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCurrentUser}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          <CheckCircle className="h-4 w-4 mr-2" />
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Application Name"
              value={generalSettings.appName}
              onChange={(e) => setGeneralSettings({ ...generalSettings, appName: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Timezone</label>
                <select
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Language</label>
                <select
                  value={generalSettings.language}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Date Format</label>
                <select
                  value={generalSettings.dateFormat}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, dateFormat: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time Format</label>
                <select
                  value={generalSettings.timeFormat}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timeFormat: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="24h">24 Hour</option>
                  <option value="12h">12 Hour</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleSaveSettings('general')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save General Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Email Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium block">Device Push Notifications</span>
                  <span className="text-[11px] text-muted-foreground">Hardware & browser system popups</span>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.pushNotifications}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      const granted = await deviceNotificationService.requestPermission();
                      setNotificationSettings({ ...notificationSettings, pushNotifications: granted });
                    } else {
                      setNotificationSettings({ ...notificationSettings, pushNotifications: false });
                    }
                  }}
                  className="w-4 h-4 rounded border-border"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Order Alerts</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.orderAlerts}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, orderAlerts: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Inventory Alerts</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.inventoryAlerts}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, inventoryAlerts: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Delivery Alerts</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.deliveryAlerts}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, deliveryAlerts: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">System Alerts</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.systemAlerts}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, systemAlerts: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
              </label>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-medium">Browser Permission:</span>
                <Badge variant={deviceNotificationService.getPermissionState() === 'granted' ? 'success' : 'warning'}>
                  {deviceNotificationService.getPermissionState().toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => deviceNotificationService.sendTestNotification()}>
                  <Bell className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Test Device Push
                </Button>
                <Button onClick={() => handleSaveSettings('notifications')} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Two-Factor Authentication</span>
              <input
                type="checkbox"
                checked={securitySettings.twoFactorAuth}
                onChange={(e) => setSecuritySettings({ ...securitySettings, twoFactorAuth: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Session Timeout (minutes)"
                type="number"
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
              />
              <Input
                label="Password Expiry (days)"
                type="number"
                value={securitySettings.passwordExpiry}
                onChange={(e) => setSecuritySettings({ ...securitySettings, passwordExpiry: parseInt(e.target.value) })}
              />
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Require Strong Password</span>
              <input
                type="checkbox"
                checked={securitySettings.requireStrongPassword}
                onChange={(e) => setSecuritySettings({ ...securitySettings, requireStrongPassword: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
            </label>
            <Input
              label="Max Login Attempts"
              type="number"
              value={securitySettings.loginAttempts}
              onChange={(e) => setSecuritySettings({ ...securitySettings, loginAttempts: parseInt(e.target.value) })}
            />
            <div className="flex justify-end">
              <Button onClick={() => handleSaveSettings('security')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Security Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Settings */}
      {activeTab === 'email' && (
        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SMTP Host"
                value={emailSettings.smtpHost}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
              />
              <Input
                label="SMTP Port"
                type="number"
                value={emailSettings.smtpPort}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: parseInt(e.target.value) })}
              />
            </div>
            <Input
              label="SMTP Username"
              value={emailSettings.smtpUser}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
            />
            <Input
              label="SMTP Password"
              type="password"
              value={emailSettings.smtpPassword}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="From Email"
                type="email"
                value={emailSettings.fromEmail}
                onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
              />
              <Input
                label="From Name"
                value={emailSettings.fromName}
                onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleSaveSettings('email')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Email Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Settings */}
      {activeTab === 'database' && (
        <Card>
          <CardHeader>
            <CardTitle>Database Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Backup Frequency</label>
              <select
                value={databaseSettings.backupFrequency}
                onChange={(e) => setDatabaseSettings({ ...databaseSettings, backupFrequency: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Input
              label="Backup Retention (days)"
              type="number"
              value={databaseSettings.backupRetention}
              onChange={(e) => setDatabaseSettings({ ...databaseSettings, backupRetention: parseInt(e.target.value) })}
            />
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Auto Backup</span>
              <input
                type="checkbox"
                checked={databaseSettings.autoBackup}
                onChange={(e) => setDatabaseSettings({ ...databaseSettings, autoBackup: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
            </label>
            <div className="flex justify-end">
              <Button onClick={() => handleSaveSettings('database')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Database Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
