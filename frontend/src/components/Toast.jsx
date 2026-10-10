import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((text, { error = false, ms = 2600 } = {}) => {
    const id = Math.random();
    setItems(l => [...l, { id, text, error }]);
    setTimeout(() => setItems(l => l.filter(t => t.id !== id)), ms);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => <div key={t.id} className={'toast' + (t.error ? ' err' : '')}>{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
