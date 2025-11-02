import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  className = '',
  showLabel = true,
  size = 'md',
}) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(100, Math.max(0, value));

  // Determine color based on value
  const getColorClass = (val: number): string => {
    if (val >= 61) return 'bg-green-500'; // Expert (61-100)
    if (val >= 31) return 'bg-yellow-500'; // Intermediate (31-60)
    return 'bg-orange-500'; // Beginner (0-30)
  };

  // Determine label
  const getLabel = (val: number): string => {
    if (val >= 61) return 'Expert';
    if (val >= 31) return 'Intermediate';
    return 'Beginner';
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">
          Experience: {Math.round(clampedValue)}%
        </span>
        {showLabel && (
          <span className={`text-xs font-medium ${
            clampedValue >= 61
              ? 'text-green-600'
              : clampedValue >= 31
              ? 'text-yellow-600'
              : 'text-orange-600'
          }`}>
            {getLabel(clampedValue)}
          </span>
        )}
      </div>
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]} overflow-hidden`}>
        <div
          className={`${getColorClass(clampedValue)} ${sizeClasses[size]} rounded-full transition-all duration-300 ease-in-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
