import { createContext, useContext } from 'react';

// { me, isAdmin, brand, setBrand, system, setSystem }  (system = name, logo, theme colours, menu style)
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
