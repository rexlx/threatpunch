


window.electronAPI.onReceiveDetails((data) => {
    const pre = document.getElementById('details-content');
    if (pre) {
        
        pre.textContent = JSON.stringify(data, null, 2);
    }
});
