import React from 'react';
import ReactDOM from 'react-dom/client';
import './font.config.css';
import App from './App.jsx';
import AdminDashboard from './AdminDashboard.jsx';

const isAdminRoute =
  window.location.hash === '#admin' ||
  window.location.search.includes('admin=1') ||
  window.location.pathname.endsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminDashboard /> : <App />}
  </React.StrictMode>
);
