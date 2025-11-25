import React from 'react';

interface NavigationProps {
  activeTab: string;
  onChange: (tab: string) => void;
  isInMatch: boolean;
  onForfeit: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChange, isInMatch, onForfeit }) => {
  const navItems = [
    { id: 'lobby', icon: 'home', label: 'LOBBY' },
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
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-lime-900 backdrop-blur-md z-40 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
              isInMatch
                ? 'text-gray-600 hover:text-gray-400'
                : activeTab === item.id
                  ? 'text-lime-500'
                  : 'text-gray-600 hover:text-gray-400'
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
  );
};