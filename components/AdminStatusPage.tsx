import React, { useState, useEffect } from 'react';

interface AdminStats {
  totalRegisteredUsers: number;
  onlineUsers: number;
  battlesToday: { created: number; completed: number };
  solMovedToday: string;
  platformFeesAccumulated: string;
  treasuryBalance: { sol: string; lamports: number };
  activeMatches: number;
  queueDepth: number;
}

interface ErrorLog {
  id: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  created_at: string;
  context: any;
}

interface SecurityAlerts {
  suspiciousWithdrawals: any[];
  bannedWalletAttempts: any[];
  rateLimitedAttempts: any[];
  totalAlerts: number;
}

interface AdminStatusPageProps {
  onClose: () => void;
}

export const AdminStatusPage: React.FC<AdminStatusPageProps> = ({ onClose }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlerts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const secretPath = import.meta.env.VITE_ADMIN_SECRET_PATH || '';
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

  // Fetch admin stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/stats`);

      if (!response.ok) {
        throw new Error('Failed to fetch admin stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setErrors(data.recentErrors);
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      setIsLoading(false);
    }
  };

  // Fetch security alerts
  const fetchSecurityAlerts = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/security-alerts`);

      if (response.ok) {
        const data = await response.json();
        setSecurityAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching security alerts:', error);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchStats();
    fetchSecurityAlerts();
    const interval = setInterval(() => {
      fetchStats();
      fetchSecurityAlerts();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Manual fee collection
  const handleFeeCollection = async () => {
    if (!confirm('Collect platform fees to platform wallet?')) return;

    setActionLoading('fees');
    try {
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/fees/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Fee collection successful!\n\nCollected: ${data.amount} SOL\nSignature: ${data.signature}\n\nExplorer: ${data.explorerUrl}`);
        fetchStats(); // Refresh stats
      } else {
        alert(`❌ Fee collection failed:\n${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Fee collection error:\n${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // View all error logs
  const handleViewErrors = async () => {
    setActionLoading('errors');
    try {
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/errors?limit=100`);
      const data = await response.json();

      if (data.success) {
        console.log('📋 All error logs:', data.errors);
        alert(`Found ${data.errors.length} error logs.\n\nCheck browser console (F12) for full details.`);
      }
    } catch (error: any) {
      alert(`Failed to fetch error logs: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Export errors to CSV
  const handleExportCSV = async () => {
    setActionLoading('export');
    try {
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/errors?limit=1000`);
      const data = await response.json();

      if (data.success) {
        // Convert errors to CSV format
        const csvHeaders = ['ID', 'Type', 'Severity', 'Message', 'Created At', 'Context'];
        const csvRows = data.errors.map((error: ErrorLog) => [
          error.id,
          error.error_type,
          'CRITICAL',
          `"${error.error_message.replace(/"/g, '""')}"`, // Escape quotes
          new Date(error.created_at).toISOString(),
          `"${JSON.stringify(error.context).replace(/"/g, '""')}"` // Escape quotes
        ]);

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map((row: string[]) => row.join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `warfog-errors-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert(`✅ Exported ${data.errors.length} errors to CSV`);
      }
    } catch (error: any) {
      alert(`❌ Failed to export errors: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Clear all error logs
  const handleClearErrors = async () => {
    if (!confirm('⚠️ Are you sure you want to clear ALL error logs?\n\nThis action cannot be undone!')) {
      return;
    }

    setActionLoading('clear');
    try {
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/errors/clear`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Cleared ${data.deletedCount} error logs`);
        setErrors([]); // Update UI
        fetchStats(); // Refresh stats
      } else {
        alert(`❌ Failed to clear errors: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Failed to clear errors: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Export security alerts to CSV
  const handleExportSecurityAlerts = async () => {
    if (!securityAlerts) return;

    setActionLoading('export-alerts');
    try {
      const csvRows: string[][] = [];

      // Add headers
      csvRows.push(['Alert Type', 'Timestamp', 'Wallet Address', 'Reason', 'Details']);

      // Add banned wallet attempts
      securityAlerts.bannedWalletAttempts.forEach((attempt: ErrorLog) => {
        csvRows.push([
          'Banned Wallet',
          new Date(attempt.created_at).toISOString(),
          attempt.context?.playerWallet || 'N/A',
          attempt.context?.reason || 'N/A',
          JSON.stringify(attempt.context)
        ]);
      });

      // Add suspicious withdrawals
      securityAlerts.suspiciousWithdrawals.forEach((alert: any) => {
        csvRows.push([
          'Suspicious Withdrawal',
          new Date().toISOString(),
          alert.wallet_address || 'N/A',
          alert.alert_reason || 'N/A',
          JSON.stringify(alert.details)
        ]);
      });

      // Add rate limited attempts
      securityAlerts.rateLimitedAttempts.forEach((attempt: ErrorLog) => {
        csvRows.push([
          'Rate Limited',
          new Date(attempt.created_at).toISOString(),
          attempt.context?.playerWallet || 'N/A',
          'Too many requests',
          JSON.stringify(attempt.context)
        ]);
      });

      const csvContent = csvRows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `warfog-security-alerts-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`✅ Exported ${csvRows.length - 1} security alerts to CSV`);
    } catch (error: any) {
      alert(`❌ Failed to export security alerts: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Clear security alerts (clears relevant error logs)
  const handleClearSecurityAlerts = async () => {
    if (!confirm('⚠️ Are you sure you want to clear security alerts?\n\nThis will clear banned wallet attempts and rate-limited errors.\n\nThis action cannot be undone!')) {
      return;
    }

    setActionLoading('clear-alerts');
    try {
      // Clear banned wallet attempts and rate limited errors from error_logs
      const response = await fetch(`${backendUrl}/api/admin/${secretPath}/security-alerts/clear`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Cleared ${data.deletedCount} security alerts`);
        setSecurityAlerts(null); // Update UI
        fetchSecurityAlerts(); // Refresh alerts
      } else {
        alert(`❌ Failed to clear security alerts: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Failed to clear security alerts: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-lime-500 font-mono p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold animate-pulse mb-4">⚙️</div>
          <div className="text-xl">LOADING DASHBOARD...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-lime-500 font-mono p-6 overflow-y-auto pb-24 lg:ml-64">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-3xl font-black mb-2 tracking-wider">
           ADMIN DASHBOARD
          </h1>
          <p className="text-xs text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()} • Auto-refresh: 10s
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={fetchStats}
            disabled={actionLoading !== null}
            className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 REFRESH
          </button>
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded transition-all"
          >
            ✕ CLOSE
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <button
          onClick={handleFeeCollection}
          disabled={actionLoading !== null}
          className="px-4 py-3 bg-lime-900/30 hover:bg-lime-900/50 border-2 border-lime-600 text-lime-400 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading === 'fees' ? '⏳ COLLECTING...' : '💰 COLLECT FEES'}
        </button>
        <button
          onClick={handleViewErrors}
          disabled={actionLoading !== null}
          className="px-4 py-3 bg-red-900/30 hover:bg-red-900/50 border-2 border-red-600 text-red-400 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading === 'errors' ? '⏳ LOADING...' : '📋 VIEW ALL ERRORS'}
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Registered Users"
            value={stats.totalRegisteredUsers}
            icon="👥"
          />
          <StatCard
            title="Online Users"
            value={stats.onlineUsers}
            icon="🟢"
            subtitle="Last 5 minutes"
          />
          <StatCard
            title="Battles Today"
            value={`${stats.battlesToday.completed}/${stats.battlesToday.created}`}
            icon="⚔️"
            subtitle="completed/created"
          />
          <StatCard
            title="SOL Moved Today"
            value={`${stats.solMovedToday} SOL`}
            icon="💸"
          />
          <StatCard
            title="Platform Fees"
            value={`${stats.platformFeesAccumulated} SOL`}
            icon="💰"
            highlight
          />
          <StatCard
            title="Treasury Balance"
            value={`${stats.treasuryBalance.sol} SOL`}
            icon="🏦"
            highlight
          />
          <StatCard
            title="Active Matches"
            value={stats.activeMatches}
            icon="🎮"
          />
          <StatCard
            title="Queue Depth"
            value={stats.queueDepth}
            icon="⏳"
          />
        </div>
      )}

      {/* Security Alerts Panel */}
      {securityAlerts && securityAlerts.totalAlerts > 0 && (
        <div className="bg-yellow-900/20 border-2 border-yellow-700 rounded-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              ⚠️ SECURITY ALERTS
              <span className="text-lg text-gray-500">({securityAlerts.totalAlerts})</span>
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleExportSecurityAlerts()}
                disabled={actionLoading !== null}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-900/30 hover:bg-blue-900/50 border-2 border-blue-600 text-blue-400 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {actionLoading === 'export-alerts' ? '⏳ EXPORTING...' : '📥 EXPORT CSV'}
              </button>
              <button
                onClick={() => handleClearSecurityAlerts()}
                disabled={actionLoading !== null}
                className="flex-1 sm:flex-none px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border-2 border-red-600 text-red-400 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {actionLoading === 'clear-alerts' ? '⏳ CLEARING...' : '🗑️ CLEAR ALERTS'}
              </button>
            </div>
          </div>

          {/* Suspicious Withdrawals */}
          {securityAlerts.suspiciousWithdrawals.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-yellow-400 mb-2 uppercase">
                🔍 Suspicious Withdrawal Patterns ({securityAlerts.suspiciousWithdrawals.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {securityAlerts.suspiciousWithdrawals.map((alert: any, idx: number) => (
                  <div key={idx} className="bg-gray-950 border border-yellow-700 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 text-xs font-bold rounded">
                        {alert.alert_reason}
                      </span>
                      <span className="text-gray-500 text-xs font-mono">
                        {alert.wallet_address?.slice(0, 8)}...{alert.wallet_address?.slice(-4)}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(alert.details, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banned Wallet Attempts */}
          {securityAlerts.bannedWalletAttempts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-red-400 mb-2 uppercase">
                🚫 Banned Wallet Attempts ({securityAlerts.bannedWalletAttempts.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {securityAlerts.bannedWalletAttempts.map((attempt: ErrorLog) => (
                  <div key={attempt.id} className="bg-gray-950 border border-red-700 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-gray-400 text-xs">
                        {new Date(attempt.created_at).toLocaleString()}
                      </span>
                      <span className="text-red-400 text-xs font-mono">
                        {attempt.context?.playerWallet?.slice(0, 8)}...
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">{attempt.context?.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rate Limited Attempts */}
          {securityAlerts.rateLimitedAttempts.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-orange-400 mb-2 uppercase">
                ⏱️ Rate Limited Attempts ({securityAlerts.rateLimitedAttempts.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {securityAlerts.rateLimitedAttempts.slice(0, 5).map((attempt: ErrorLog) => (
                  <div key={attempt.id} className="bg-gray-950 border border-orange-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <span className="text-gray-400 text-xs">
                        {new Date(attempt.created_at).toLocaleString()}
                      </span>
                      <span className="text-orange-400 text-xs font-mono">
                        {attempt.context?.playerWallet?.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Critical Errors */}
      <div className="bg-gray-900 border-2 border-red-900 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
             CRITICAL ERRORS
            <span className="text-lg text-gray-500">({errors.length})</span>
          </h2>
          {errors.length > 0 && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportCSV}
                disabled={actionLoading !== null}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-900/30 hover:bg-blue-900/50 border-2 border-blue-600 text-blue-400 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {actionLoading === 'export' ? '⏳ EXPORTING...' : '📥 EXPORT CSV'}
              </button>
              <button
                onClick={handleClearErrors}
                disabled={actionLoading !== null}
                className="flex-1 sm:flex-none px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border-2 border-red-600 text-red-400 font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {actionLoading === 'clear' ? '⏳ CLEARING...' : '🗑️ CLEAR ERRORS'}
              </button>
            </div>
          )}
        </div>

        {errors.length === 0 ? (
          <div className="text-left py-8">
            <p className="text-gray-500 text-md">No critical errors logged</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {errors.map(error => (
              <div
                key={error.id}
                className="bg-gray-950 border border-red-800 rounded-lg p-4 hover:border-red-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                  <span className="px-3 py-1 bg-red-900/50 text-red-400 font-bold uppercase text-sm rounded border border-red-700">
                    {error.error_type}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(error.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-300 mb-3 text-sm leading-relaxed">
                  {error.error_message}
                </p>
                {error.context && Object.keys(error.context).length > 0 && (
                  <details className="text-gray-500 text-xs">
                    <summary className="cursor-pointer hover:text-gray-400 select-none font-bold mb-2">
                      📊 Details
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 rounded overflow-x-auto border border-gray-800 text-xs">
                      {JSON.stringify(error.context, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string;
  subtitle?: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, subtitle, highlight }) => (
  <div
    className={`bg-gray-900 border-2 ${
      highlight ? 'border-lime-700 bg-lime-900/10' : 'border-gray-800'
    } rounded-lg p-4 hover:border-lime-600 transition-all`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm text-gray-500 font-bold uppercase">{title}</div>
      {icon && <div className="text-2xl">{icon}</div>}
    </div>
    <div
      className={`text-3xl font-black ${
        highlight ? 'text-lime-400' : 'text-lime-500'
      } mb-1`}
    >
      {value}
    </div>
    {subtitle && <div className="text-xs text-gray-600 uppercase">{subtitle}</div>}
  </div>
);
