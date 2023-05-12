let cache = {} // API 사용시 응답을 캐싱하는 객체
let cacheTimes = [] // 캐시된 데이터가 언제 요청되었는지를 저장하는 배열
let cacheDuration = 600000 // 캐시 유효기간 : 10분을 기준으로 한다.

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({cacheDuration: 600000}, function(settings) {
    if (settings && settings.cacheDuration !== undefined) {
      cacheDuration = settings.cacheDuration
    }
  })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.query) {
    case 'insertCss':
      chrome.scripting.insertCSS({
        target: {
          tabId: sender.tab.id,
        },
        files: message.files,
      })
      break

  }
})
