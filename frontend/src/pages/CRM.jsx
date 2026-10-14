import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, TrendingUp, DollarSign, Target, Plus, Search, Filter, 
  Building2, Phone, Mail, Calendar, Award, 
  BarChart3, PieChart, Clock, CheckCircle2, AlertCircle,
  UserCheck, FileText, TrendingDown, Briefcase, MapPin,
  RefreshCw, Brain, MessageSquare, Sparkles, Loader2, CheckCircle, Lightbulb
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import MetricCard from '../components/common/charts/MetricCard';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/ui/Table';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { Modal, ModalFooter } from '../components/common/ui/Modal';
import Select from '../components/common/forms/Select';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { crmAPI } from '../services/api/crmAPI';
import { dashboardAPI } from '../services/api/dashboardAPI';
import { llmQueryAPI } from '../services/api/llmQueryAPI';

export const CRM = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // AI Query state
  const [aiQuery, setAiQuery] = useState('');
  const [aiQueryLoading, setAiQueryLoading] = useState(false);
  const [aiQueryError, setAiQueryError] = useState(null);
  const [aiQueryHistory, setAiQueryHistory] = useState([]);
  const [aiQueryResult, setAiQueryResult] = useState(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    account_type: 'customer',
    industry: '',
    website: '',
    phone: '',
    email: '',
    password: '',
    billing_address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    annual_revenue: '',
    employee_count: '',
    territory: '',
    status: 'active',
    lifecycle_stage: 'prospect',
  });
  const [metrics, setMetrics] = useState({
    totalAccounts: 0,
    opportunities: 0,
    conversionRate: 0,
    pipelineValue: 0,
    avgDealSize: 0,
    closedWon: 0,
    closedLost: 0,
  });

  // Single source of truth for lead metrics: the Overview "Active Leads" card
  // and every Leads-tab card read these exact numbers, so the two tabs cannot
  // drift apart (previously each computed its own counts and the Leads
  // "Inactive" card was a residual that always rendered 0).
  const leadStats = useMemo(() => {
    const active = leads.filter((l) => !!l.isActive).length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: leads.length,
      active,
      inactive: leads.length - active,
      newThisWeek: leads.filter((l) => new Date(l.created).getTime() >= weekAgo).length,
    };
  }, [leads]);

  // Fetch all CRM data
  const fetchCRMData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard stats (MongoDB backend) for accurate overview metrics
      let dashboardStats = null;
      try {
        const statsResponse = await dashboardAPI.getDashboardStats();
        dashboardStats = statsResponse.data?.data || null;
      } catch (err) {
        console.warn('Failed to fetch dashboard stats:', err);
      }

      // Fetch accounts
      let accountsTotal = 0;
      let usersList = [];
      try {
        const accountsResponse = await crmAPI.getAccounts({ limit: 100 });
        usersList = accountsResponse.data?.data?.users || [];
        accountsTotal = accountsResponse.data?.data?.pagination?.total ?? usersList.length;

        setAccounts(usersList.map(user => ({
          id: user._id,
          name: user.shopDetails?.shopName || user.name,
          industry: '',
          value: 0,
          revenue: 0,
          stage: user.isActive ? 'active' : 'inactive',
          contact: user.name,
          email: user.email,
          phone: user.shopDetails?.phone || '',
          territory: '',
          accountType: user.role || 'customer',
          manager: user.createdBy?.name || '',
          lastActivity: user.updatedAt ? new Date(user.updatedAt) : new Date(user.createdAt || Date.now())
        })));
      } catch (err) {
        console.warn('Failed to fetch accounts:', err);
        usersList = [];
        accountsTotal = 0;
      }

      // Fetch leads
      // Leads are not a separate collection in the MongoDB-only backend;
      // we treat customer accounts as leads for display purposes. (Accounts
      // now include every role, so leads stay scoped to customers.)
      const customerUsers = usersList.filter(user => (user.role || 'customer') === 'customer');
      setLeads(customerUsers.map(user => ({
        id: user._id,
        name: user.name,
        company: user.shopDetails?.shopName || user.name,
        email: user.email,
        phone: user.shopDetails?.phone || '',
        status: user.isActive ? 'qualified' : 'inactive',
        isActive: !!user.isActive,
        source: 'crm',
        budget: 0,
        territory: '',
        assignedTo: user.createdBy?.name || '',
        created: user.createdAt ? new Date(user.createdAt) : new Date()
      })));

      // Fetch opportunities
      let ordersList = [];
      try {
        const oppsResponse = await crmAPI.getOpportunities({ limit: 100 });
        ordersList = oppsResponse.data?.data?.orders || [];

        setOpportunities(ordersList.map(order => {
          const status = String(order.status || 'PLACED').toUpperCase();
          const probability = status === 'DELIVERED' ? 100 : status === 'DISPATCHED' ? 75 : 25;
          const customer = order.customerId || {};
          const customerName = customer.shopDetails?.shopName || customer.name || '';

          return {
            id: order._id,
            name: order.orderNumber || `Order #${String(order._id || '').slice(-8)}`,
            accountId: customer._id,
            accountName: customerName,
            stage: status,
            probability,
            amount: Number(order.totalAmount ?? 0),
            closeDate: order.tracking?.deliveredAt ? new Date(order.tracking.deliveredAt) : new Date(order.createdAt || Date.now()),
            owner: order.tracking?.dispatchedBy?.name || '',
            products: Array.isArray(order.items) ? order.items.map(i => i.productName).filter(Boolean).join(', ') : ''
          };
        }));
      } catch (err) {
        console.warn('Failed to fetch opportunities:', err);
        ordersList = [];
      }

      // Update overview metrics from real backend counts only — no
      // hard-coded fallbacks (a fresh workspace honestly shows 0).
      if (activeTab === 'overview') {
        const totalAccounts = dashboardStats?.users?.total ?? accountsTotal ?? usersList.length;
        const totalOpps = dashboardStats?.orders?.total ?? ordersList.length;
        const closedWon = dashboardStats?.orders?.delivered ?? ordersList.filter(o => String(o.status || '').toUpperCase() === 'DELIVERED').length;
        const closedLost = ordersList.filter(o => String(o.status || '').toUpperCase() === 'CANCELLED').length;

        const pipelineOrders = ordersList.filter(o => {
          const s = String(o.status || '').toUpperCase();
          return s === 'PLACED' || s === 'DISPATCHED';
        });
        const pipelineValue = pipelineOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
        const avgDealSize = pipelineOrders.length > 0 ? pipelineValue / pipelineOrders.length : 0;
        const conversionRate = totalOpps > 0 ? (closedWon / totalOpps) * 100 : 0;

        setMetrics({
          totalAccounts,
          opportunities: totalOpps,
          conversionRate: Math.round(conversionRate * 10) / 10,
          pipelineValue,
          avgDealSize,
          closedWon,
          closedLost,
        });
      }


    } catch (err) {
      console.error('Error fetching CRM data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCRMData();
  }, [fetchCRMData]);

  const getStageVariant = (stage) => {
    const variants = {
      discovery: 'info',
      qualification: 'info',
      proposal: 'warning',
      negotiation: 'warning',
      prospecting: 'info',
      PLACED: 'warning',
      DISPATCHED: 'info',
      DELIVERED: 'success',
      closed_won: 'success',
      closed_lost: 'destructive',
    };
    return variants[stage] || 'default';
  };

  const getLeadStatusVariant = (status) => {
    const variants = {
      new: 'info',
      contacted: 'warning',
      qualified: 'success',
      converted: 'success',
      inactive: 'destructive',
    };
    return variants[status] || 'default';
  };



  // Chart data — always computed from real data. When a series is empty the
  // chart card renders an honest "no data" note instead of fabricated numbers.
  const opportunityStageData = (() => {
    const stageCounts = {};
    opportunities.forEach(opp => {
      const stage = opp.stage || 'unknown';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    return Object.entries(stageCounts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  })();

  const leadSourceData = (() => {
    const sourceCounts = {};
    leads.forEach(lead => {
      const source = lead.source || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    return Object.entries(sourceCounts).map(([name, count]) => ({ name: name.replace('_', ' '), count })).filter(item => item.count > 0);
  })();

  // Accounts per role — real data replacing the old fake "revenue by
  // territory" chart (the User model has no territory/revenue fields).
  const accountsByRole = (() => {
    const roleCounts = {};
    accounts.forEach(acc => {
      const role = acc.accountType || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    return Object.entries(roleCounts).map(([role, count]) => ({ role, count })).filter(item => item.count > 0);
  })();

  const EmptyChartNote = () => (
    <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
      No data yet
    </div>
  );

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  if (loading) {
    return <LoadingSpinner text="Loading CRM data..." />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'accounts':
        return renderAccountsTab();
      case 'leads':
        return renderLeadsTab();
      case 'opportunities':
        return renderOpportunitiesTab();
      case 'ai-query':
        return renderAIQueryTab();
      default:
        return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Accounts"
          value={metrics.totalAccounts.toLocaleString()}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Active Leads"
          value={leadStats.active.toLocaleString()}
          icon={TrendingUp}
          variant="secondary"
        />
        <MetricCard
          title="Pipeline Value"
          value={`₹${(metrics.pipelineValue / 1000000).toFixed(2)}M`}
          icon={DollarSign}
          variant="accent"
        />
        <MetricCard
          title="Avg Deal Size"
          value={`₹${(metrics.avgDealSize / 1000).toFixed(0)}K`}
          icon={Award}
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities by Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Opportunities by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {opportunityStageData.length === 0 ? <EmptyChartNote /> : (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={opportunityStageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {opportunityStageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-secondary" />
              Lead Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadSourceData.length === 0 ? <EmptyChartNote /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={leadSourceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accounts by Role - real counts from the user directory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-accent" />
                Accounts by Role
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accountsByRole.length === 0 ? <EmptyChartNote /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={accountsByRole}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Pipeline Summary Stats — real numbers only */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">₹{(metrics.pipelineValue / 1000000).toFixed(2)}M</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closed Won</p>
                <p className="text-lg font-semibold">{metrics.closedWon.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-lg font-semibold text-success">{metrics.conversionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  );

  const renderAccountsTab = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Account Management
          </CardTitle>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search accounts..."
              icon={Search}
              className="w-64"
            />
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button onClick={() => setShowAddAccountModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account ID</TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead>Annual Revenue</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.id}</TableCell>
                <TableCell className="font-semibold">{account.name}</TableCell>
                <TableCell>{account.industry}</TableCell>
                <TableCell>
                  <Badge variant="outline">{account.accountType}</Badge>
                </TableCell>
                <TableCell>{account.territory}</TableCell>
                <TableCell>{(account.revenue / 1000000).toFixed(1)}M</TableCell>
                <TableCell>{account.manager}</TableCell>
                <TableCell>{formatRelativeTime(account.lastActivity)}</TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedAccount(account)}
                  >
                    View 360°
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderLeadsTab = () => {
    // Lead metrics come from `leadStats` — the exact same source as the
    // Overview "Active Leads" card, so both tabs always agree.
    return (
    <div className="space-y-6">
      {/* Lead Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Leads"
          value={leadStats.total.toLocaleString()}
          icon={UserCheck}
          variant="info"
        />
        <MetricCard
          title="New (7 Days)"
          value={leadStats.newThisWeek.toLocaleString()}
          icon={Phone}
          variant="warning"
        />
        <MetricCard
          title="Active Leads"
          value={leadStats.active.toLocaleString()}
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="Inactive"
          value={leadStats.inactive.toLocaleString()}
          icon={TrendingDown}
          variant="destructive"
        />
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-secondary" />
            Lead Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.id}</TableCell>
                  <TableCell className="font-semibold">{lead.name}</TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    <Badge variant={getLeadStatusVariant(lead.status)}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.source.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>{(lead.budget / 1000).toFixed(0)}K</TableCell>
                  <TableCell>{lead.territory}</TableCell>
                  <TableCell>{lead.assignedTo}</TableCell>
                  <TableCell>{formatRelativeTime(lead.created)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Convert
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    );
  };

  const renderOpportunitiesTab = () => (
    <div className="space-y-6">
      {/* Opportunity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Opportunities"
          value={metrics.opportunities.toLocaleString()}
          icon={Briefcase}
          variant="primary"
        />
        <MetricCard
          title="Pipeline Value"
          value={`₹${(metrics.pipelineValue / 1000000).toFixed(2)}M`}
          icon={DollarSign}
          variant="accent"
        />
        <MetricCard
          title="Closed Won"
          value={metrics.closedWon.toLocaleString()}
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="Closed Lost"
          value={metrics.closedLost.toLocaleString()}
          icon={TrendingDown}
          variant="destructive"
        />
      </div>

      {/* Opportunities Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Sales Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => (
                <TableRow key={opp.id}>
                  <TableCell className="font-medium">{opp.id}</TableCell>
                  <TableCell className="font-semibold">{opp.name}</TableCell>
                  <TableCell>{opp.accountName}</TableCell>
                  <TableCell>
                    <Badge variant={getStageVariant(opp.stage)}>
                      {opp.stage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${opp.probability}%` }}
                        />
                      </div>
                      <span className="text-sm">{opp.probability}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{(opp.amount / 1000).toFixed(0)}K</TableCell>
                  <TableCell>{formatDate(opp.closeDate)}</TableCell>
                  <TableCell>{opp.owner}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Update
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderAIQueryTab = () => {
    const exampleQueries = [
      'Show me all opportunities closing this month',
      'What are the pending tasks for TechCorp?',
      'Show me leads from website that are not converted',
      'Give me account summary for Acme Corp',
      'What is the pipeline analysis?',
      'Show recent activities',
    ];

    const handleAIQuery = async () => {
      if (!aiQuery.trim()) return;

      try {
        setAiQueryLoading(true);
        setAiQueryError(null);
        setAiQueryResult(null);

        const response = await llmQueryAPI.processQuery(aiQuery);
        const result = response.data;

        setAiQueryResult(result);
        
        // Add to history
        setAiQueryHistory(prev => [{
          id: Date.now(),
          query: aiQuery,
          timestamp: new Date(),
          result: result
        }, ...prev].slice(0, 10)); // Keep last 10 queries

        setAiQuery('');
      } catch (err) {
        console.error('Error processing query:', err);
        setAiQueryError(err.response?.data?.detail || err.message || 'Failed to process query');
      } finally {
        setAiQueryLoading(false);
      }
    };

    const handleExampleClick = (exampleQuery) => {
      setAiQuery(exampleQuery);
    };

    const renderQueryResult = () => {
      if (!aiQueryResult) return null;

      const payload = aiQueryResult.data || aiQueryResult.result || aiQueryResult;
      const naturalResponse = aiQueryResult.natural_response || aiQueryResult.answer || payload.answer || payload.natural_response || payload.message || (typeof payload === 'string' ? payload : '');
      const queryType = payload.query_type || payload.type || aiQueryResult.type || 'AI Reasoning Query';
      const data = payload.data || (Array.isArray(payload) ? payload : null);

      return (
        <div className="space-y-4">
          {/* Natural Language Response */}
          {naturalResponse && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{naturalResponse}</p>
              </CardContent>
            </Card>
          )}

          {/* Query Result Data */}
          {Array.isArray(data) && data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Results ({data.length} {data.length === 1 ? 'item' : 'items'})
                  <Badge variant="outline" className="ml-2">
                    {queryType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    {Object.keys(data[0] || {}).length > 0 && (
                      <TableRow>
                        {Object.keys(data[0]).map((key) => (
                          <TableHead key={key}>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableHead>
                        ))}
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {data.map((item, index) => (
                      <TableRow key={index}>
                        {Object.entries(item).map(([key, value]) => (
                          <TableCell key={key}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Object Result */}
          {!Array.isArray(data) && typeof data === 'object' && Object.keys(data).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Query Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* No Results */}
          {(!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No data found for your query.</p>
              </CardContent>
            </Card>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {/* Error Alert */}
        {aiQueryError && (
          <Alert variant="destructive" onClose={() => setAiQueryError(null)}>
            <AlertCircle className="h-4 w-4 mr-2" />
            {aiQueryError}
          </Alert>
        )}

        {/* Query Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Natural Language Query
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about your CRM data... (e.g., Show me all opportunities closing this month)"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !aiQueryLoading && handleAIQuery()}
                icon={Search}
                className="flex-1"
              />
              <Button onClick={handleAIQuery} disabled={aiQueryLoading || !aiQuery.trim()}>
                {aiQueryLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Query
                  </>
                )}
              </Button>
            </div>

            {/* Example Queries */}
            <div>
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Example queries:
              </p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleExampleClick(example)}
                    className="text-xs"
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {aiQueryLoading && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Processing your query...</p>
            </CardContent>
          </Card>
        )}

        {/* Query Results */}
        {!aiQueryLoading && aiQueryResult && renderQueryResult()}

        {/* Query History */}
        {aiQueryHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Recent Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {aiQueryHistory.map((historyItem) => (
                  <div
                    key={historyItem.id}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setAiQuery(historyItem.query);
                      setAiQueryResult(historyItem.result);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{historyItem.query}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {historyItem.timestamp.toLocaleString()}
                        </p>
                      </div>
                      {historyItem.result?.result?.success && (
                        <CheckCircle className="h-4 w-4 text-success" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive customer relationship management system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCRMData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddAccountModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Account
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

      {/* Success Alert */}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {success}
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'accounts'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4 inline mr-2" />
          Accounts
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'leads'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Leads
        </button>
        <button
          onClick={() => setActiveTab('opportunities')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'opportunities'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="h-4 w-4 inline mr-2" />
          Opportunities
        </button>
        <button
          onClick={() => setActiveTab('ai-query')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'ai-query'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Brain className="h-4 w-4 inline mr-2" />
          AI Query
        </button>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Add Account Modal */}
      <Modal
        isOpen={showAddAccountModal}
        title="Create New Account"
        onClose={() => {
          setShowAddAccountModal(false);
          setAccountForm({
            name: '',
            account_type: 'customer',
            industry: '',
            website: '',
            phone: '',
            email: '',
            password: '',
            billing_address: '',
            city: '',
            state: '',
            country: '',
            postal_code: '',
            annual_revenue: '',
            employee_count: '',
            territory: '',
            status: 'active',
            lifecycle_stage: 'prospect',
          });
        }}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Essential Fields Section */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-foreground mb-2">Essential Information</div>
            
            <Input
              label="Account Name *"
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              placeholder="Enter company name"
              required
            />
            
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Role"
                value={accountForm.account_type}
                onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'customer', label: 'Customer' },
                  { value: 'manager', label: 'Manager' },
                ]}
              />
              <Select
                label="Status"
                value={accountForm.status}
                onChange={(e) => setAccountForm({ ...accountForm, status: e.target.value })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Email*"
                type="email"
                value={accountForm.email}
                onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                placeholder="contact@company.com"
                required
              />
              <Input
                label="Password*"
                type="password"
                value={accountForm.password}
                onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                placeholder="Min 6 characters"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone"
                value={accountForm.phone}
                onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                placeholder="+1-555-0123"
              />
            </div>

            <Input
              label="Industry"
              value={accountForm.industry}
              onChange={(e) => setAccountForm({ ...accountForm, industry: e.target.value })}
              placeholder="e.g., Technology, Healthcare, Finance"
            />
          </div>

          {/* Additional Details Section - Compact */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="text-sm font-medium text-foreground mb-2">Additional Details (Optional)</div>
            
            <Input
              label="Website"
              value={accountForm.website}
              onChange={(e) => setAccountForm({ ...accountForm, website: e.target.value })}
              placeholder="https://www.company.com"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Annual Revenue"
                type="number"
                value={accountForm.annual_revenue}
                onChange={(e) => setAccountForm({ ...accountForm, annual_revenue: e.target.value })}
                placeholder="5000000"
              />
              <Input
                label="Employee Count"
                type="number"
                value={accountForm.employee_count}
                onChange={(e) => setAccountForm({ ...accountForm, employee_count: e.target.value })}
                placeholder="150"
              />
            </div>

            <Input
              label="Territory"
              value={accountForm.territory}
              onChange={(e) => setAccountForm({ ...accountForm, territory: e.target.value })}
              placeholder="Sales territory"
            />
          </div>

          {/* Address Section - Compact */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="text-sm font-medium text-foreground mb-2">Address (Optional)</div>
            
            <Input
              label="Street Address"
              value={accountForm.billing_address}
              onChange={(e) => setAccountForm({ ...accountForm, billing_address: e.target.value })}
              placeholder="123 Business Street"
            />
            
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="City"
                value={accountForm.city}
                onChange={(e) => setAccountForm({ ...accountForm, city: e.target.value })}
                placeholder="City"
              />
              <Input
                label="State"
                value={accountForm.state}
                onChange={(e) => setAccountForm({ ...accountForm, state: e.target.value })}
                placeholder="State"
              />
              <Input
                label="Postal Code"
                value={accountForm.postal_code}
                onChange={(e) => setAccountForm({ ...accountForm, postal_code: e.target.value })}
                placeholder="12345"
              />
            </div>

            <Input
              label="Country"
              value={accountForm.country}
              onChange={(e) => setAccountForm({ ...accountForm, country: e.target.value })}
              placeholder="Country"
            />
          </div>
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowAddAccountModal(false);
              setAccountForm({
                name: '',
                account_type: 'customer',
                industry: '',
                website: '',
                phone: '',
                email: '',
                password: '',
                billing_address: '',
                city: '',
                state: '',
                country: '',
                postal_code: '',
                annual_revenue: '',
                employee_count: '',
                territory: '',
                status: 'active',
                lifecycle_stage: 'prospect',
              });
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              try {
                setLoading(true);
                setError(null);
                setSuccess(null);
                
                if (!accountForm.name || !accountForm.name.trim()) {
                  setError('Account name is required');
                  setLoading(false);
                  return;
                }

                const accountData = {
                  name: accountForm.name.trim(),
                  account_type: accountForm.account_type || 'customer',
                  industry: accountForm.industry?.trim() || null,
                  website: accountForm.website?.trim() || null,
                  phone: accountForm.phone?.trim() || null,
                  email: accountForm.email?.trim() || null,
                  password: accountForm.password?.trim() || null,
                  billing_address: accountForm.billing_address?.trim() || null,
                  city: accountForm.city?.trim() || null,
                  state: accountForm.state?.trim() || null,
                  country: accountForm.country?.trim() || null,
                  postal_code: accountForm.postal_code?.trim() || null,
                  annual_revenue: accountForm.annual_revenue ? parseFloat(accountForm.annual_revenue) : null,
                  employee_count: accountForm.employee_count ? parseInt(accountForm.employee_count) : null,
                  territory: accountForm.territory?.trim() || null,
                  status: accountForm.status || 'active',
                  lifecycle_stage: accountForm.lifecycle_stage || 'prospect',
                };

                const response = await crmAPI.createAccount(accountData);
                
                if (response && response.data) {
                  setSuccess('Account created successfully!');
                  setShowAddAccountModal(false);
                  
                  // Reset form
                  setAccountForm({
                    name: '',
                    account_type: 'customer',
                    industry: '',
                    website: '',
                    phone: '',
                    email: '',
                    password: '',
                    billing_address: '',
                    city: '',
                    state: '',
                    country: '',
                    postal_code: '',
                    annual_revenue: '',
                    employee_count: '',
                    territory: '',
                    status: 'active',
                    lifecycle_stage: 'prospect',
                  });
                  
                  // Refresh data
                  await fetchCRMData();
                  
                  // Clear success message after 3 seconds
                  setTimeout(() => {
                    setSuccess(null);
                  }, 3000);
                } else {
                  throw new Error('Unexpected response from server');
                }
              } catch (err) {
                console.error('Error creating account:', err);
                const backendErrors = err.response?.data?.errors;
                const firstFieldError = Array.isArray(backendErrors) && backendErrors.length > 0
                  ? backendErrors.map(e => e.message).join(', ')
                  : null;
                const errorMessage = firstFieldError || err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to create account. Please try again.';
                setError(errorMessage);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || !accountForm.name?.trim() || !accountForm.email?.trim() || !accountForm.password?.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default CRM;
