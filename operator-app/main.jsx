/*
 * Operator web app — a separate app for the fountain operator's phone.
 * It contains only the operator alert screen: no ceremony screen, no
 * INAUGURATE button and no organiser controls. It shares the alert screen and
 * its styles with the main app (../src) and talks to the same signal server.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OperatorScreen from '../src/components/OperatorScreen.jsx';
import { defaultEventConfig } from '../src/config/eventConfig.js';
import '../src/styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OperatorScreen eventTitle={defaultEventConfig.projectTitle} />
  </StrictMode>
);
