import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Brain, Zap, TrendingUp, Target, Play, Settings,
  Route, Package, BarChart3, Clock,
  CheckSquare, Wrench, Heart, Save, Rocket, RefreshCw, AlertCircle
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import MetricCard from '../components/common/charts/MetricCard';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Select from '../components/common/forms/Select';
import Badge from '../components/common/ui/Badge';
import { Alert } from '../components/common/ui/Alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/ui/Table';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { Modal, ModalFooter } from '../components/common/ui/Modal';
import { aiDecisionsAPI } from '../services/api/aiDecisionsAPI';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';

export const Decisions = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('make');
  const [decisionHistory, setDecisionHistory] = useState([]);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState('route_optimization');
  const [metrics, setMetrics] = useState({
    totalDecisions: 0,
    avgConfidence: 0,
    successRate: 0,
    avgExecutionTime: '0s',
  });
  
  // Workflow form state
  const [workflowForm, setWorkflowForm] = useState({
    workflowType: 'order_processing',
    orderId: 'ORD_001',
    customerEmail: 'customer@example.com',
    priority: 'high',
    orderValue: 500.00,
    inventoryJson: '{"item_A": 10, "item_B": 5, "item_C": 20}',
    salesJson:
      '[{"item_id": "item_A", "sales": [20, 25, 22]}, {"item_id": "item_B", "sales": [15, 18, 16]}]'
  });

  // Settings state
  const [capabilities, setCapabilities] = useState({
    routeOptimization: true,
    procurementDecisions: true,
    inventoryForecasting: true,
    delayRiskAssessment: true,
    supplierSelection: true,
  });
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [autoExecuteHighConfidence, setAutoExecuteHighConfidence] = useState(false);
  const [enableDecisionNotifications, setEnableDecisionNotifications] = useState(true);

  // Fetch decision data
  const fetchDecisionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch decision history
      try {
        const historyResponse = await aiDecisionsAPI.getDecisionHistory({ limit: 100 });
        const rawHistory = historyResponse.data?.data?.decisions || historyResponse.data?.decisions || (Array.isArray(historyResponse.data) ? historyResponse.data : []);
        const historyData = Array.isArray(rawHistory) ? rawHistory : [];
        setDecisionHistory(historyData.map(decision => ({
          id: decision.id || decision.decision_id,
          type: decision.decision_type || decision.type || 'Unknown',
          confidence: parseFloat(decision.confidence || decision.confidence_score || 0) * 100,
          status: decision.status || 'success',
          timestamp: decision.timestamp ? new Date(decision.timestamp) : new Date(),
        })));
      } catch (err) {
        console.warn('Failed to fetch decision history:', err);
      }

      // Fetch analytics for metrics
      try {
        const analyticsResponse = await aiDecisionsAPI.getDecisionAnalytics();
        const analytics = analyticsResponse.data?.data || analyticsResponse.data || {};
        setMetrics({
          // `??` so a real value of 0 stays 0 — never a fabricated fallback
          totalDecisions: analytics.totalDecisions ?? analytics.total_decisions ?? 0,
          avgConfidence: analytics.averageConfidence ?? analytics.avg_confidence ?? 0,
          successRate: analytics.successRate ?? analytics.success_rate ?? 0,
          avgExecutionTime: analytics.avgExecution ? `${analytics.avgExecution}s` : (analytics.avg_execution_time ?? '—'),
        });
      } catch (err) {
        console.warn('Failed to fetch analytics:', err);
        // Calculate from history
        if (decisionHistory.length > 0) {
          const avgConf = decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / decisionHistory.length;
          const successful = decisionHistory.filter(d => d.status === 'success').length;
          setMetrics({
            totalDecisions: decisionHistory.length,
            avgConfidence: Math.round(avgConf * 10) / 10,
            successRate: Math.round((successful / decisionHistory.length) * 100 * 10) / 10,
            avgExecutionTime: '—',
          });
        }
      }

    } catch (err) {
      console.error('Error fetching decision data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load decision data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecisionData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDecisionData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchDecisionData]);

  const orderValueControls = useMemo(() => {
    const dec = () => setWorkflowForm(p => ({ ...p, orderValue: Math.max(0, (p.orderValue || 0) - 1) }));
    const inc = () => setWorkflowForm(p => ({ ...p, orderValue: (p.orderValue || 0) + 1 }));
    return { dec, inc };
  }, []);

  const handleStartWorkflow = async () => {
    try {
      setLoading(true);
      await aiDecisionsAPI.executeWorkflow(workflowForm.workflowType, workflowForm);
      // Refresh data after workflow execution
      setTimeout(() => {
        fetchDecisionData();
      }, 2000);
    } catch (error) {
      console.error('Error starting workflow:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to start workflow');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading AI decision engine..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">AI Decision Engine</h1>
          <p className="text-muted-foreground mt-1">
            Intelligent decision-making for logistics operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDecisionData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowDecisionModal(true)}>
            <Play className="h-4 w-4 mr-2" />
            Make Decision
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Decisions"
          value={metrics.totalDecisions.toLocaleString()}
          icon={Brain}
          variant="primary"
        />
        <MetricCard
          title="Avg Confidence"
          value={`${metrics.avgConfidence}%`}
          icon={Target}
          variant="success"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          icon={TrendingUp}
          variant="accent"
        />
        <MetricCard
          title="Avg Execution"
          value={metrics.avgExecutionTime}
          icon={Clock}
          variant="secondary"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('make')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'make'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Make Decisions
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'workflows'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Decision Analytics
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

      {/* Make Decisions Tab */}
      {activeTab === 'make' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card hover onClick={() => { setDecisionType('route_optimization'); setShowDecisionModal(true); }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Route className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Route Optimization</h3>
                  <p className="text-sm text-muted-foreground">Optimize delivery routes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover onClick={() => { setDecisionType('procurement_decision'); setShowDecisionModal(true); }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-8 w-8 text-accent" />
                <div>
                  <h3 className="font-semibold">Procurement Decision</h3>
                  <p className="text-sm text-muted-foreground">Make procurement choices</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover onClick={() => { setDecisionType('inventory_forecast'); setShowDecisionModal(true); }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-8 w-8 text-secondary" />
                <div>
                  <h3 className="font-semibold">Inventory Forecast</h3>
                  <p className="text-sm text-muted-foreground">Forecast inventory needs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover onClick={() => { setDecisionType('delay_assessment'); setShowDecisionModal(true); }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-8 w-8 text-warning" />
                <div>
                  <h3 className="font-semibold">Delay Assessment</h3>
                  <p className="text-sm text-muted-foreground">Assess delivery delays</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover onClick={() => { setDecisionType('supplier_selection'); setShowDecisionModal(true); }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-8 w-8 text-success" />
                <div>
                  <h3 className="font-semibold">Supplier Selection</h3>
                  <p className="text-sm text-muted-foreground">Choose best supplier</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          {/* Workflow Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Workflow Type</label>
            <Select
              value={workflowForm.workflowType}
              onChange={(e) => setWorkflowForm({ ...workflowForm, workflowType: e.target.value })}
              options={[
                { value: 'order_processing', label: 'Order Processing' },
                { value: 'inventory_optimization', label: 'Inventory Optimization' },
              ]}
              className="border-primary focus-visible:ring-primary"
            />
          </div>

          {/* Workflow Form (conditional by type) */}
          <Card className="border border-border">
            <CardContent className="p-6">
              {workflowForm.workflowType === 'order_processing' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Order ID</label>
                        <Input
                          value={workflowForm.orderId}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, orderId: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Customer Email</label>
                        <Input
                          type="email"
                          value={workflowForm.customerEmail}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, customerEmail: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Priority</label>
                        <Select
                          value={workflowForm.priority}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, priority: e.target.value })}
                          options={[
                            { value: 'low', label: 'Low' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'high', label: 'High' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Order Value</label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={orderValueControls.dec}
                            className="h-10 w-10 p-0"
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            step="0.01"
                            value={workflowForm.orderValue}
                            onChange={(e) =>
                              setWorkflowForm({
                                ...workflowForm,
                                orderValue: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={orderValueControls.inc}
                            className="h-10 w-10 p-0"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-start">
                    <Button onClick={handleStartWorkflow} className="gap-2">
                      <Rocket className="h-4 w-4" />
                      Start Order Workflow
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="font-semibold">Current Inventory</h3>
                      <label className="text-sm font-medium text-muted-foreground">Inventory Data (JSON)</label>
                      <textarea
                        value={workflowForm.inventoryJson}
                        onChange={(e) => setWorkflowForm({ ...workflowForm, inventoryJson: e.target.value })}
                        className="w-full min-h-[110px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold">Historical Sales Data</h3>
                      <label className="text-sm font-medium text-muted-foreground">Sales Data (JSON)</label>
                      <textarea
                        value={workflowForm.salesJson}
                        onChange={(e) => setWorkflowForm({ ...workflowForm, salesJson: e.target.value })}
                        className="w-full min-h-[110px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-start">
                    <Button onClick={handleStartWorkflow} className="gap-2">
                      <Rocket className="h-4 w-4" />
                      Start Inventory Workflow
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <Card>
          <CardHeader>
            <CardTitle>Decision History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisionHistory.map((decision) => (
                  <TableRow key={decision.id}>
                    <TableCell className="font-medium">{decision.type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${decision.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{decision.confidence}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">{decision.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(decision.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
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
        <div className="space-y-8">
          {/* Heading */}
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6" />
            <h1 className="text-3xl font-heading font-bold tracking-tight">AI Decision Settings</h1>
          </div>

          {/* Engine Capabilities */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6" />
              <h2 className="text-2xl font-heading font-bold tracking-tight">Engine Capabilities</h2>
            </div>

            <div className="space-y-3">
              {[
                { key: 'routeOptimization', label: 'Route Optimization' },
                { key: 'procurementDecisions', label: 'Procurement Decisions' },
                { key: 'inventoryForecasting', label: 'Inventory Forecasting' },
                { key: 'delayRiskAssessment', label: 'Delay Risk Assessment' },
                { key: 'supplierSelection', label: 'Supplier Selection' },
              ].map((cap) => (
                <div
                  key={cap.key}
                  className="rounded-lg border border-success/30 bg-success/15 px-4 py-4"
                >
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!capabilities[cap.key]}
                      onChange={(e) =>
                        setCapabilities((p) => ({ ...p, [cap.key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="font-medium text-success">{cap.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6" />
              <h2 className="text-2xl font-heading font-bold tracking-tight">Configuration</h2>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sliders */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Confidence Threshold</label>
                        <span className="text-sm font-semibold text-destructive">
                          {confidenceThreshold.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                        className="w-full accent-destructive"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Risk Tolerance</label>
                        <span className="text-sm font-semibold text-destructive">
                          {riskTolerance.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={riskTolerance}
                        onChange={(e) => setRiskTolerance(Number(e.target.value))}
                        className="w-full accent-destructive"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={autoExecuteHighConfidence}
                        onChange={(e) => setAutoExecuteHighConfidence(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="font-medium">Auto-execute High Confidence Decisions</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={enableDecisionNotifications}
                        onChange={(e) => setEnableDecisionNotifications(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="font-medium">Enable Decision Notifications</span>
                    </label>
                  </div>
                </div>

                <div className="mt-6">
                  <Button className="gap-2" onClick={() => {}}>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-success" />
              <h2 className="text-2xl font-heading font-bold tracking-tight">System Status</h2>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-success" />
                      <span className="font-medium">Engine</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Online</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-success" />
                      <span className="font-medium">Models</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Loaded</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-success" />
                      <span className="font-medium">Notifications</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {enableDecisionNotifications ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      <Modal
        isOpen={showDecisionModal}
        title={`Make ${decisionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
        onClose={() => setShowDecisionModal(false)}
      >
          <div className="space-y-4">
            {decisionType === 'route_optimization' && (
              <>
                <Input label="Number of Orders" type="number" defaultValue="3" />
                <Input label="Vehicle Capacity" type="number" defaultValue="100" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="High Priority Orders" type="number" defaultValue="1" />
                  <Input label="Medium Priority Orders" type="number" defaultValue="2" />
                </div>
              </>
            )}
            {decisionType === 'procurement_decision' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Item A Stock" type="number" defaultValue="15" />
                  <Input label="Item B Stock" type="number" defaultValue="8" />
                  <Input label="Item C Stock" type="number" defaultValue="25" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Item A Demand" type="number" defaultValue="50" />
                  <Input label="Item B Demand" type="number" defaultValue="30" />
                  <Input label="Item C Demand" type="number" defaultValue="40" />
                </div>
              </>
            )}
            {decisionType === 'inventory_forecast' && (
              <>
                <Input label="Product ID" placeholder="PROD-001" />
                <Input label="Historical Period (days)" type="number" defaultValue="30" />
                <Input label="Forecast Period (days)" type="number" defaultValue="7" />
              </>
            )}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowDecisionModal(false)}>Cancel</Button>
            <Button onClick={() => setShowDecisionModal(false)}>
              <Zap className="h-4 w-4 mr-2" />
              Make Decision
            </Button>
          </ModalFooter>
      </Modal>
    </div>
  );
};

export default Decisions;
