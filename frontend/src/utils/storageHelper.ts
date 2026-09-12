// Escape hatch for a corrupted persisted store. From the browser console:
//   clearStorage()

export const clearBrowserStorage = () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Storage cleared successfully');
    window.location.reload();
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
  }
};

declare global {
  interface Window {
    clearStorage: typeof clearBrowserStorage;
  }
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  window.clearStorage = clearBrowserStorage;
}
