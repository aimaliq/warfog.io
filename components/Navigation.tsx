import React from 'react';

interface NavigationProps {
  activeTab: string;
  onChange: (tab: string) => void;
  isInMatch: boolean;
  onForfeit: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChange, isInMatch, onForfeit }) => {
  const navItems = [
    { id: 'play', icon: 'play_circle', label: 'PLAY' },
    { id: 'leaderboard', icon: 'leaderboard', label: 'LEADERBOARD' },
    { id: 'sol', icon: 'attach_money', label: 'SOL' },
    { id: 'profile', icon: 'person', label: 'PROFILE' }
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 backdrop-blur-md z-40 pb-safe">
        <div className="flex justify-around items-center h-17 max-w-md mx-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isInMatch
                  ? 'text-gray-600 hover:text-gray-500'
                  : activeTab === item.id
                    ? 'text-lime-500'
                    : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <span className="material-icons-outlined text-2xl mt-2">{item.icon}</span>
              <span className="text-[10px] font-bold tracking-wider mb-3">{item.label}</span>
              {!isInMatch && activeTab === item.id && (
                <div className="absolute bottom-0 w-10 h-[3px] bg-lime-500 rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Left Sidebar Navigation */}
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-gray-950 border-r border-gray-800 backdrop-blur-md z-40 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-black tracking-[0.05em]" style={{ color: '#21bd5a', fontFamily: "'Orbitron', sans-serif" }}>
            WARFOG.IO
          </h1>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                isInMatch
                  ? 'text-gray-600 hover:text-gray-500'
                  : activeTab === item.id
                    ? 'bg-gray-800/60 text-lime-500'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
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