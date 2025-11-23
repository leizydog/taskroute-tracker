// src/components/organisms/AdvancedMarker.js
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkerF } from '@react-google-maps/api';
import PropTypes from 'prop-types';

/**
 * AdvancedMarker:
 * - Uses google.maps.marker.AdvancedMarkerElement when available
 * - Falls back to MarkerF otherwise
 *
 * Props:
 * - map: optional google.maps.Map instance (preferred). If omitted, will use window.__google_map__ if set.
 * - position: {lat, lng}
 * - draggable: boolean
 * - onDragEnd: function({lat, lng}, event)
 * - options: object
 * - label, title
 * - type: 'destination' | 'employee' | 'waypoint' (controls color/shape)
 * - zIndex
 * - content: DOM element or React element for custom marker content
 * - children: React children for custom marker content (Used for Profile Picture)
 */
const AdvancedMarker = ({ 
  map: mapProp, 
  position, 
  draggable = false, 
  onDragEnd, 
  options = {}, 
  label, 
  title, 
  type = 'employee', 
  zIndex,
  content,
  children 
}) => {
  const markerRef = useRef(null);
  const contentRef = useRef(null);
  const rootRef = useRef(null);

  // Build DOM content depending on type or custom content
  const makeContent = () => {
    const wrapper = document.createElement('div');
    wrapper.style.cursor = draggable ? 'grab' : 'auto';
    // wrapper.setAttribute('aria-hidden', 'true'); // Optional: Removed to prevent interference

    // 1. Handle React children (Custom Marker: Profile Picture)
    if (children) {
      // For custom avatars, we center the div on the coordinate
      try {
        rootRef.current = createRoot(wrapper);
        rootRef.current.render(
          <div style={{ 
            transform: 'translate(-50%, -50%)' // Center the avatar exactly on the lat/lng
          }}>
            {children}
          </div>
        );
      } catch (error) {
        console.error('❌ Error rendering children:', error);
      }
      return wrapper;
    } 
    
    // 2. Handle simple DOM content
    if (content) {
      wrapper.appendChild(content instanceof Node ? content : document.createTextNode(content));
      return wrapper;
    }

    // 3. Use Native PinElement for standard markers (Fixes Offset Issues)
    if (window.google && window.google.maps && window.google.maps.marker && window.google.maps.marker.PinElement) {
        const PinElement = window.google.maps.marker.PinElement;
        
        if (type === 'destination') {
            // Blue Pin
            const pin = new PinElement({
                background: '#1e40af',
                borderColor: '#172554',
                glyphColor: 'white',
                scale: 1.1
            });
            return pin.element;
        } else if (type === 'waypoint') {
            // Purple Pin with Label
            const pin = new PinElement({
                background: '#4f46e5',
                borderColor: '#312e81',
                glyphColor: 'white',
                glyph: typeof label === 'string' ? label : String(label || ''),
                scale: 1.1
            });
            return pin.element;
        }
    }

    // 4. Fallback SVG for Employee Dot (or if PinElement fails)
    // This is a simple circle, centered on the coordinate.
    wrapper.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: block;">
        <circle cx="12" cy="12" r="9" fill="#e53935" stroke="white" stroke-width="2"/>
      </svg>
    `;
    // Move circle center to coordinate
    wrapper.style.transform = 'translate(-50%, -50%)'; 

    return wrapper;
  };

  useEffect(() => {
    const hasAdvanced = typeof window !== 'undefined'
      && window.google && window.google.maps
      && window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;

    // Clean up any previous marker
    const cleanup = () => {
      if (rootRef.current) {
        try { rootRef.current.unmount(); } catch (e) {}
        rootRef.current = null;
      }
      if (markerRef.current) {
        try { markerRef.current.setMap(null); } catch (e) {}
        markerRef.current = null;
      }
      contentRef.current = null;
    };

    cleanup();

    if (!position || Number.isNaN(position.lat) || Number.isNaN(position.lng)) {
      return cleanup;
    }

    if (!hasAdvanced) {
      return cleanup;
    }

    // build advanced marker
    const contentElement = makeContent();
    contentRef.current = contentElement;

    const AdvancedMarkerElement = window.google.maps.marker.AdvancedMarkerElement;
    const mapInstance = mapProp || window.__google_map__ || null;

    const advOptions = {
      position,
      title: title || undefined,
      content: contentElement,
      zIndex: zIndex || undefined,
      gmpClickable: true,
      ...options,
      map: mapInstance || undefined,
    };

    let m;
    try {
      m = new AdvancedMarkerElement(advOptions);
      if (draggable) {
        try {
          if (typeof m.setDraggable === 'function') m.setDraggable(true);
          else if ('gmpDraggable' in advOptions) m.gmpDraggable = true;
        } catch (_) {}
      }
    } catch (err) {
      console.warn('AdvancedMarkerElement creation failed', err);
      cleanup();
      return cleanup;
    }

    // attach dragend listener
    let dragListener = null;
    try {
      if (draggable && typeof m.addListener === 'function') {
        dragListener = m.addListener('dragend', (ev) => {
          const latLng = ev?.latLng || (m.getPosition && m.getPosition && m.getPosition());
          if (latLng) {
            const out = { lat: latLng.lat(), lng: latLng.lng() };
            if (typeof onDragEnd === 'function') onDragEnd(out, ev);
          }
        });
      }
    } catch (e) {}

    markerRef.current = m;

    return () => {
      if (dragListener && typeof dragListener.remove === 'function') dragListener.remove();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, type, draggable, title, zIndex, children, content, label]);

  // Fallback for MarkerF (Legacy)
  const hasAdvancedNow = typeof window !== 'undefined'
    && window.google && window.google.maps
    && window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;

  if (!hasAdvancedNow) {
    const getSvgDataUrl = () => {
      // Using standard Google-like paths for fallback to ensure alignment
      if (type === 'destination') {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 24 34"><path d="M12 0C7.03 0 3.2 3.84 3.2 8.81 3.2 15.6 12 24 12 24s8.8-8.4 8.8-15.19C20.8 3.84 16.97 0 12 0z" fill="#1e40af"/><circle cx="12" cy="9" r="3.6" fill="white"/></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      } else if (type === 'waypoint') {
         const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 24 34"><path d="M12 0C7.03 0 3.2 3.84 3.2 8.81 3.2 15.6 12 24 12 24s8.8-8.4 8.8-15.19C20.8 3.84 16.97 0 12 0z" fill="#4f46e5"/><text x="12" y="12" font-family="sans-serif" font-size="10" fill="white" text-anchor="middle" dominant-baseline="middle">${label || ''}</text></svg>`;
         return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      } else {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e53935" stroke="white" stroke-width="2"/></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      }
    };

    const iconOpt = (typeof window !== 'undefined' && window.google && {
      url: getSvgDataUrl(),
      scaledSize: new window.google.maps.Size(type === 'destination' || type === 'waypoint' ? 30 : 24, type === 'destination' || type === 'waypoint' ? 42 : 24),
      // Anchor X=15 (half width), Y=42 (full height) ensures tip touches location
      anchor: new window.google.maps.Point(type === 'destination' || type === 'waypoint' ? 15 : 12, type === 'destination' || type === 'waypoint' ? 42 : 12),
    }) || undefined;

    return (
      <MarkerF
        position={position}
        draggable={draggable}
        onDragEnd={(e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (typeof onDragEnd === 'function') onDragEnd({ lat, lng }, e);
        }}
        icon={iconOpt}
        label={label}
        title={title}
        zIndex={zIndex}
        options={options}
      />
    );
  }

  return null;
};

AdvancedMarker.propTypes = {
  map: PropTypes.any,
  position: PropTypes.shape({ lat: PropTypes.number.isRequired, lng: PropTypes.number.isRequired }).isRequired,
  draggable: PropTypes.bool,
  onDragEnd: PropTypes.func,
  options: PropTypes.object,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  title: PropTypes.string,
  type: PropTypes.oneOf(['destination', 'employee', 'waypoint']),
  zIndex: PropTypes.number,
  content: PropTypes.any,
  children: PropTypes.node,
};

export default AdvancedMarker;