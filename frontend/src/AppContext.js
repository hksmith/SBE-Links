import { createContext, useContext } from 'react';

// { me, isAdmin, brand, setBrand }
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
