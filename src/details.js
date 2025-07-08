// This script runs in the details.html window

// Listen for the details data from the main process via the preload bridge
window.electronAPI.onReceiveDetails((data) => {
    const pre = document.getElementById('details-content');
    if (pre) {
        // Safely display the JSON data
        pre.textContent = JSON.stringify(data, null, 2);
    }
});
