import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface WalletButtonProps {
  className?: string;
}

export const WalletButton: React.FC<WalletButtonProps> = ({ className }) => {
  return (
    <div className={className}>
      <WalletMultiButton />
    </div>
  );
};