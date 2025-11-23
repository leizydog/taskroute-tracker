import React from 'react';
import QRCode from "react-qr-code";
import { FiDownload, FiSmartphone } from 'react-icons/fi';

const AppDownload = () => {
  // ✅ OPTION 1: If you put the APK in the 'public' folder (Best for Vercel)
  // This automatically gets your website's current URL (e.g., https://taskroute-tracker.vercel.app)
  const apkUrl = `${window.location.origin}/taskroute.apk`;


  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md mx-auto shadow-lg">
      
      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Get the Mobile App
      </h3>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
        Scan to download directly to your Android device.
      </p>

      {/* QR Code Container */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
        <QRCode 
          value={apkUrl} 
          size={160} 
          viewBox={`0 0 160 160`}
          level="H" // High error correction
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        />
      </div>

      {/* Instruction */}
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-6 uppercase tracking-wide font-semibold">
        <FiSmartphone size={14} />
        <span>Scan with Camera</span>
      </div>

      {/* Direct Download Button */}
      <a 
        href={apkUrl}
        download="TaskRoute.apk" // Hints the browser to download file
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
      >
        <FiDownload size={20} />
        Download APK File
      </a>
      
      <p className="text-xs text-slate-400 mt-3">
        * Requires "Install from Unknown Sources" enabled.
      </p>
    </div>
  );
};

export default AppDownload;