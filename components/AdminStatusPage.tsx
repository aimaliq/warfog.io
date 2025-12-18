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

interface AdminStatusPageProps {
  onClose: () => void;
}

export const AdminStatusPage: React.FC<AdminStatusPageProps> = ({ onClose }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
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

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
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

      {/* Recent Critical Errors */}
      <div className="bg-gray-900 border-2 border-red-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-red-500 flex items-center gap-2">
           CRITICAL ERRORS
          <span className="text-lg text-gray-500">({errors.length})</span>
        </h2>

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
