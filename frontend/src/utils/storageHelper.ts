// Add this to browser console if you encounter issues:
// localStorage.clear(); sessionStorage.clear(); location.reload();

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

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).clearStorage = clearBrowserStorage;
}
