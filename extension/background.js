/* رنگارنگ — کلیک روی آیکون، اپ را در یک تب کروم باز میکند */
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
