import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { getVerifiedDeveloperMetadata } from './kioskTypes.ts';
import './index.css';

const win = window as unknown as {
  __REACT_APP_MOUNTED__?: boolean;
  __ABOUT_THE_CREATOR__?: ReturnType<typeof getVerifiedDeveloperMetadata>;
  __CREATED_BY__?: string;
};

const devMeta = getVerifiedDeveloperMetadata();
win.__ABOUT_THE_CREATOR__ = devMeta;
win.__CREATED_BY__ = devMeta.createdByLabel;

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.setAttribute('data-system-architect', devMeta.fullName);
  document.documentElement.setAttribute('data-created-by', devMeta.createdByLabel);
  document.documentElement.setAttribute('data-developer-signature', devMeta.signatureHash);
}

if (!win.__REACT_APP_MOUNTED__) {
  win.__REACT_APP_MOUNTED__ = true;
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.setAttribute('data-created-by', devMeta.fullName);
    rootEl.setAttribute('data-developer-signature', devMeta.signatureHash);
    createRoot(rootEl).render(<App />);
  }
}

