// Tiny hash router so browser Back/refresh keep you on the same screen.
//   #/            dashboard
//   #/users       users (admins)
//   #/edit/<id>   account editor (admins)
//   #/stats/<id>  read-only statistics (viewers)
import { useEffect, useState } from 'react';

const parse = () => {
  const [name = '', id = null] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name, id: id && decodeURIComponent(id) };
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = path => { location.hash = path; };
