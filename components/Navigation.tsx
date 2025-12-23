import React from 'react';

interface NavigationProps {
  activeTab: string;
  onChange: (tab: string) => void;
  isInMatch: boolean;
  onForfeit: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChange, isInMatch, onForfeit }) => {
  const navItems = [
    { id: 'play', icon: 'sports_esports', label: 'PLAY' },
    { id: 'sol', icon: 'paid', label: 'SOL' },
    { id: 'leaderboard', icon: 'emoji_events', label: 'LEADERBOARD' },
    { id: 'profile', icon: 'badge', label: 'PROFILE' }
  ];

  const handleNavClick = (tabId: string) => {
    if (isInMatch) {
      // Player clicked navigation during match - forfeit the game
      onForfeit();
    } else {
      onChange(tabId);
    }
  };

  return (
    <>
      {/* Mobile/Tablet: Bottom Navigation (hidden on desktop) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-lime-900 backdrop-blur-md z-40 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isInMatch
                  ? 'text-gray-500 hover:text-gray-400'
                  : activeTab === item.id
                    ? 'text-lime-500'
                    : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="material-icons-outlined text-2xl mb-1">{item.icon}</span>
              <span className="text-[10px] font-bold tracking-widest">{item.label}</span>
              {!isInMatch && activeTab === item.id && (
                <div className="absolute bottom-0 w-12 h-1 bg-lime-500 shadow-[0_0_10px_rgba(163,230,53,0.5)]"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Left Sidebar Navigation */}
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-lime-900 backdrop-blur-md z-40 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-lime-900">
          <h1 className="text-3xl font-black text-lime-500 tracking-wider font-mono">
            WARFOG.IO
          </h1>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                isInMatch
                  ? 'text-gray-500 hover:text-gray-400'
                  : activeTab === item.id
                    ? 'bg-gray-800 text-lime-500'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="material-icons-outlined text-2xl">{item.icon}</span>
              <span className="text-sm font-bold tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
};