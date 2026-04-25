'use client';

interface LoadingSpinnerProps {
  size?: 'page' | 'inline';
}

export default function LoadingSpinner({ size = 'page' }: LoadingSpinnerProps) {
  if (size === 'inline') {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <svg
          className="animate-spin"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#4fc3a1" strokeWidth="3" />
          <path
            className="opacity-75"
            fill="#4fc3a1"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span style={{ fontSize: 13, color: '#6b7280' }}>데이터를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center flex-col gap-3">
      <svg
        className="animate-spin"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#4fc3a1" strokeWidth="3" />
        <path
          className="opacity-75"
          fill="#4fc3a1"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span style={{ fontSize: 13, color: '#6b7280' }}>데이터를 불러오는 중...</span>
    </div>
  );
}
