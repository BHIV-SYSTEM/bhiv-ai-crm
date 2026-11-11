import React, { useState, useEffect, useCallback } from 'react';
import { 
  Workflow, Play, Pause, Plus, Settings, CheckCircle, 
  Clock, AlertCircle, Zap, TrendingUp, RefreshCw
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import MetricCard from '../components/common/charts/MetricCard';
import Button from '../components/common/ui/Button';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/ui/Table';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';
import { logisticsAPI } from '../services/api/logisticsAPI';

export const Workflows = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [metrics, setMetrics] = useState({
    totalWorkflows: 0,
    activeWorkflows: 0,
    executedToday: 0,
    successRate: 0,
  });

  // Fetch workflow data from agent logs
  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch agent logs to create workflow-like data
      const logsResponse = await logisticsAPI.getAgentLogs({ limit: 100 });
      const logs = logsResponse.data?.logs || logsResponse.data || [];

      // Group logs by action type to create workflows
      const workflowMap = {};
      logs.forEach(log => {
        const actionType = log.action || 'Unknown';
        if (!workflowMap[actionType]) {
          workflowMap[actionType] = {
            id: `WF-${Object.keys(workflowMap).length + 1}`,
            name: `${actionType} Workflow`,
            description: `Automated workflow for ${actionType.toLowerCase()}`,
            status: 'active',
            trigger: actionType,
            lastRun: log.timestamp ? new Date(log.timestamp) : new Date(),
            executions: 0,
            successRate: 0,
            logs: []
          };
        }
        workflowMap[actionType].executions++;
        workflowMap[actionType].logs.push(log);
        if (log.timestamp && new Date(log.timestamp) > new Date(workflowMap[actionType].lastRun)) {
          workflowMap[actionType].lastRun = new Date(log.timestamp);
        }
      });

      // Calculate success rates
      Object.values(workflowMap).forEach(workflow => {
        const successful = workflow.logs.filter(l => l.confidence > 0.7).length;
        workflow.successRate = workflow.executions > 0 
          ? Math.round((successful / workflow.executions) * 100 * 10) / 10 
          : 0;
      });

      const workflowsList = Object.values(workflowMap).slice(0, 10);
      setWorkflows(workflowsList);

      // Create execution history from recent logs
      const recentLogs = logs.slice(0, 20).map(log => ({
        workflow: `${log.action || 'Unknown'} Workflow`,
        trigger: log.action || 'Unknown',
        status: log.confidence > 0.7 ? 'success' : 'warning',
        // The logs don't record duration — show an honest dash, not a
        // fabricated "2.3s" for every row
        executionTime: log.duration ? `${log.duration}s` : '—',
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
      }));
      setExecutionHistory(recentLogs);

      // Calculate metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayExecutions = logs.filter(l => {
        const logDate = l.timestamp ? new Date(l.timestamp) : new Date();
        return logDate >= today;
      }).length;

      const totalSuccessful = logs.filter(l => l.confidence > 0.7).length;
      const successRate = logs.length > 0 ? Math.round((totalSuccessful / logs.length) * 100 * 10) / 10 : 0;

      setMetrics({
        totalWorkflows: workflowsList.length,
        activeWorkflows: workflowsList.filter(w => w.status === 'active').length,
        executedToday: todayExecutions,
        successRate,
      });

    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load workflows');
      // Fallback to empty workflows
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchWorkflows();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  const getStatusVariant = (status) => {
    const variants = {
      active: 'success',
      paused: 'warning',
      error: 'destructive',
    };
    return variants[status] || 'default';
  };

  if (loading) {
    return <LoadingSpinner text="Loading workflows..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Automated Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor automated workflow processes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchWorkflows}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
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
          title="Total Workflows"
          value={metrics.totalWorkflows.toLocaleString()}
          icon={Workflow}
          variant="primary"
        />
        <MetricCard
          title="Active Workflows"
          value={metrics.activeWorkflows.toLocaleString()}
          icon={Play}
          variant="success"
        />
        <MetricCard
          title="Executed Today"
          value={metrics.executedToday.toLocaleString()}
          icon={Zap}
          variant="accent"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Workflows List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="border-l-4 border-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{workflow.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{workflow.id}</p>
                </div>
                <Badge variant={getStatusVariant(workflow.status)}>
                  {workflow.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{workflow.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trigger:</span>
                  <span className="font-medium">{workflow.trigger}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Run:</span>
                  <span className="font-medium">{formatRelativeTime(workflow.lastRun)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Executions:</span>
                  <span className="font-medium">{workflow.executions}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="font-medium">{workflow.successRate}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {workflow.status === 'active' ? (
                  <>
                    <Button size="sm" className="flex-1">
                      <Play className="h-4 w-4 mr-1" />
                      Run Now
                    </Button>
                    <Button variant="outline" size="sm">
                      <Pause className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="flex-1">
                    <Play className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                )}
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Execution Time</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executionHistory.length > 0 ? (
                executionHistory.map((execution, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{execution.workflow}</TableCell>
                    <TableCell>{execution.trigger}</TableCell>
                    <TableCell>
                      <Badge variant={execution.status === 'success' ? 'success' : 'warning'}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {execution.status === 'success' ? 'Success' : 'Warning'}
                      </Badge>
                    </TableCell>
                    <TableCell>{execution.executionTime}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(execution.timestamp)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No execution history available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Workflows;
