import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ManagerApp from './manager/ManagerApp';
import './manager/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/manager" replace />} />
        <Route path="/manager/*" element={<ManagerApp />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
