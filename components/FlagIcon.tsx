import React from 'react';

interface FlagIconProps {
  countryCode: string;
  width?: string;
  height?: string;
  className?: string;
}

export const FlagIcon: React.FC<FlagIconProps> = ({
  countryCode,
  width,
  height,
  className = ''
}) => {
  return (
    <span
      className={`fi fi-${countryCode.toLowerCase()} inline-block ${className}`}
      style={{
        width: width || 'auto',
        height: height || 'auto',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center'
      }}
    />
  );
};
