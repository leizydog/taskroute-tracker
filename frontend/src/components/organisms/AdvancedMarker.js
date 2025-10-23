// src/components/organisms/AdvancedMarker.js
import React, { useEffect, useRef } from 'react';
import { MarkerF } from '@react-google-maps/api';
import PropTypes from 'prop-types';

/**
 * AdvancedMarker:
 * - Uses google.maps.marker.AdvancedMarkerElement when available
 * - Falls back to MarkerF otherwise
 *
 * Props:
 *  - map: optional google.maps.Map instance (preferred). If omitted, will use window.__google_map__ if set.
 *  - position: {lat, lng}
 *  - draggable: boolean
 *  - onDragEnd: function({lat, lng}, event)
 *  - options: object
 *  - label, title
 *  - type: 'destination' | 'employee' (controls color/shape)
 *  - zIndex
 */
const AdvancedMarker = ({ map: mapProp, position, draggable = false, onDragEnd, options = {}, label, title, type = 'employee', zIndex }) => {
  const markerRef = useRef(null);
  const contentRef = useRef(null);

  // Build DOM content depending on type
  const makeContent = () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.transform = 'translate(-50%, -100%)'; // anchor bottom center
    wrapper.style.cursor = draggable ? 'grab' : 'auto';
    wrapper.setAttribute('aria-hidden', 'true');

    if (type === 'destination') {
      // Blue pin
      wrapper.innerHTML = `
        <svg width="30" height="42" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C7.03 0 3.2 3.84 3.2 8.81 3.2 15.6 12 24 12 24s8.8-8.4 8.8-15.19C20.8 3.84 16.97 0 12 0z" fill="#1e40af"/>
          <circle cx="12" cy="9" r="3.6" fill="white"/>
        </svg>
      `;
    } else {
      // Employee red circle
      wrapper.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="#e53935" stroke="white" stroke-width="2"/>
        </svg>
      `;
    }

    return wrapper;
  };

  useEffect(() => {
    const hasAdvanced = typeof window !== 'undefined'
      && window.google && window.google.maps
      && window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;

    // Clean up any previous marker
    const cleanup = () => {
      if (markerRef.current) {
        try {
          markerRef.current.setMap(null);
        } catch (e) {}
        markerRef.current = null;
      }
      if (contentRef.current && contentRef.current.parentNode) {
        contentRef.current.parentNode.removeChild(contentRef.current);
      }
      contentRef.current = null;
    };

    cleanup();

    if (!position || Number.isNaN(position.lat) || Number.isNaN(position.lng)) {
      return cleanup; // nothing to do
    }

    if (!hasAdvanced) {
      // fallback path handled by render branch (MarkerF)
      return cleanup;
    }

    // build advanced marker
    const content = makeContent();
    contentRef.current = content;

    const AdvancedMarkerElement = window.google.maps.marker.AdvancedMarkerElement;

    // Determine map instance:
    const mapInstance = mapProp || window.__google_map__ || null;

    const advOptions = {
      position,
      title: title || undefined,
      content,
      zIndex: zIndex || undefined,
      // Note: AdvancedMarkerElement does not accept a `draggable` boolean directly in older versions.
      // some versions uses gmpDraggable; we'll attempt both via options and later via setDraggable if available.
      ...options,
      map: mapInstance || undefined,
    };

    let m;
    try {
      m = new AdvancedMarkerElement(advOptions);
      // If draggable is required and the API supports 'draggable' or 'gmpDraggable', try setting
      if (draggable) {
        try {
          // best-effort attempt
          if (typeof m.setDraggable === 'function') m.setDraggable(true);
          else if ('gmpDraggable' in advOptions) m.gmpDraggable = true;
        } catch (_) {}
      }
    } catch (err) {
      console.warn('AdvancedMarkerElement creation failed, will fallback to MarkerF.', err);
      cleanup();
      return cleanup;
    }

    // attach dragend listener if possible
    let dragListener = null;
    try {
      if (draggable && typeof m.addListener === 'function') {
        dragListener = m.addListener('dragend', (ev) => {
          // event may provide latLng or marker.getPosition()
          const latLng = ev?.latLng || (m.getPosition && m.getPosition && m.getPosition());
          if (latLng) {
            const out = { lat: latLng.lat(), lng: latLng.lng() };
            if (typeof onDragEnd === 'function') onDragEnd(out, ev);
          }
        });
      }
    } catch (e) {
      // ignore
    }

    markerRef.current = m;

    return () => {
      if (dragListener && typeof dragListener.remove === 'function') dragListener.remove();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, type, draggable, title, zIndex]);

  // If AdvancedMarkerElement isn't available OR advanced marker creation failed, render fallback MarkerF
  const hasAdvancedNow = typeof window !== 'undefined'
    && window.google && window.google.maps
    && window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;

  if (!hasAdvancedNow) {
    // prepare SVG data-url icon for fallback
    const getSvgDataUrl = () => {
      if (type === 'destination') {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 24 34"><path d="M12 0C7.03 0 3.2 3.84 3.2 8.81 3.2 15.6 12 24 12 24s8.8-8.4 8.8-15.19C20.8 3.84 16.97 0 12 0z" fill="#1e40af"/><circle cx="12" cy="9" r="3.6" fill="white"/></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      } else {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="9" fill="#e53935" stroke="white" stroke-width="2"/></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      }
    };

    // guard window.google may not exist at SSR, but MarkerF will only be used clientside
    const iconOpt = (typeof window !== 'undefined' && window.google && {
      url: getSvgDataUrl(),
      scaledSize: new window.google.maps.Size(type === 'destination' ? 30 : 24, type === 'destination' ? 42 : 24),
      anchor: new window.google.maps.Point(type === 'destination' ? 15 : 12, type === 'destination' ? 38 : 12),
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

  // Advanced path uses no React DOM output
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
  type: PropTypes.oneOf(['destination', 'employee']),
  zIndex: PropTypes.number,
};

export default AdvancedMarker;
