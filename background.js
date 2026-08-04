chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "save") {
    const dataUrl = "data:text/markdown;charset=utf-8," + encodeURIComponent(msg.content);
    chrome.downloads.download({
      url: dataUrl,
      filename: msg.filename || "gig.md",
      saveAs: true
    });
  }
});