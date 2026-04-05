import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ToastProvider } from './components/common/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';

// Performance optimizations for music player
// 1. Disable React DevTools in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  const win = window as Window & {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>;
  };

  if (typeof win.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object' && win.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    for (const prop in win.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      if (prop === 'renderers') {
        win.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] = new Map();
      } else {
        win.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] =
          typeof win.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] === 'function' ? () => { } : null;
      }
    }
  }
}

// 2. Request high performance mode for audio processing
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  // Hint to browser that we need high performance
  document.documentElement.classList.add('high-performance-mode');
}

// 3. Preconnect to external resources
const preconnectDomains = [
  'https://music.163.com',
  'https://api.github.com',
];

preconnectDomains.forEach(domain => {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = domain;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Use concurrent mode features for better performance
root.render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
