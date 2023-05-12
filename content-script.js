const HANDLE_DOM_MUTATIONS_THROTTLE_MS = 100
let domMutationsAreThrottled = false
let hasUnseenDomMutations = false

const API_RETRY_DELAY = 5000
const MAX_RETRIES_PER_THUMBNAIL = 10
let isPendingApiRetry = false
let thumbnailsToRetry = []

let curTheme = 0
const THEME_MODERN = 1
const THEME_CLASSIC = 2
const THEME_GAMING = 3
const THEME_MOBILE = 4
const NUM_THEMES = 4

const isDarkTheme = getComputedStyle(document.body).getPropertyValue('--yt-spec-general-background-a') === ' #181818'

const THUMBNAIL_SELECTORS = []
THUMBNAIL_SELECTORS[THEME_MODERN] = '' + 'a#thumbnail[href]'

THUMBNAIL_SELECTORS[THEME_CLASSIC] = '' +
    '.video-thumb' +
    ':not(.yt-thumb-20)' +
    ':not(.yt-thumb-27)' +
    ':not(.yt-thumb-32)' +
    ':not(.yt-thumb-36)' +
    ':not(.yt-thumb-48)' +
    ':not(.yt-thumb-64), ' +
    '.thumb-wrapper, ' +
    '.pl-header-thumb'

THUMBNAIL_SELECTORS[THEME_GAMING] = '' +
    'ytg-thumbnail' +
    ':not([avatar])' +
    ':not(.avatar)' +
    ':not(.ytg-user-avatar)' +
    ':not(.ytg-box-art)' +
    ':not(.ytg-compact-gaming-event-renderer)' +
    ':not(.ytg-playlist-header-renderer)'

THUMBNAIL_SELECTORS[THEME_MOBILE] = '' +
    'a.media-item-thumbnail-container, ' +
    'a.compact-media-item-image, ' +
    'a.video-card-image'

const THUMBNAIL_SELECTOR_VIDEOWALL = '' +
    'a.ytp-videowall-still'

const DEFAULT_USER_SETTINGS = {
  barPosition: 'top',
  barHeight: 4,
  barOpacity: 100,
  barTooltip: true,
  useOnVideoPage: false,
}
let userSettings = DEFAULT_USER_SETTINGS

function getNewThumbnails() {
  let thumbnails = []
  if (curTheme) {
    thumbnails = $(THUMBNAIL_SELECTORS[curTheme])
  } else {
    for (let i = 1; i <= NUM_THEMES; i++) {
      thumbnails = $(THUMBNAIL_SELECTORS[i])
      if (thumbnails.length) {
        curTheme = i
        break
      }
    }
  }
  thumbnails = $.merge(thumbnails, $(THUMBNAIL_SELECTOR_VIDEOWALL))
  return thumbnails
}

function getThumbnailsAndIds(thumbnails) {
  const thumbnailsAndVideoIds = []
  $(thumbnails).each(function(_, thumbnail) {
    let url
    if (curTheme === THEME_MODERN) {
      url = $(thumbnail).attr('href')

    } else if (curTheme === THEME_CLASSIC) {
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).children(':first').attr('href')
          || $(thumbnail).children(':first').next().attr('href')

    } else if (curTheme === THEME_GAMING) {
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).parent().parent().parent().attr('href')

      if (!$(thumbnail).is('a')) {
        thumbnail = $(thumbnail).parent()
      }

    } else if (curTheme === THEME_MOBILE) {
      url = $(thumbnail).attr('href')
      const firstChild = $(thumbnail).children(':first')[0]
      if ($(firstChild).is('.video-thumbnail-container-compact')) {
        thumbnail = firstChild
      }

    } else {
      url = $(thumbnail).attr('href')
    }

    if (!url) {
      return true
    }

    const previousUrl = $(thumbnail).attr('data-ytrb-processed')
    if (previousUrl) {
      if (previousUrl === url) {
        if (curTheme === THEME_MOBILE) {
          if ($(thumbnail).children().last().is('ytrb-bar')) {
            return true
          }
        } else {
          return true
        }
      } else {
        $(thumbnail).children('ytrb-bar').remove()
        $(thumbnail).removeAttr('data-ytrb-retries')
      }
    }
    $(thumbnail).attr('data-ytrb-processed', url)
    const match = url.match(/.*[?&]v=([^&]+).*/)
    if (match) {
      const id = match[1]
      thumbnailsAndVideoIds.push([thumbnail, id])
    }
  })
  return thumbnailsAndVideoIds
}

async function getAdSummary(videoId){
  const apiKey = ''; // input your api key
  const channels = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoId}&part=snippet`;
  const response = await fetch(channels);
  const data = await response.json();
  return data
}

function getRatingBarHtml(videoId) {
  var tmp = Math.floor(Math.random() * 2);
  var color = tmp==1? '#b2ffd9':'#FFA07A';
  return getAdSummary(videoId).then(description => {
    var ret =  '<ytrb-bar' +
      (userSettings.barOpacity !== 100
        ? ' style="opacity:' + (userSettings.barOpacity / 100) + '"'
        : ''
      ) +
      '>' +
    //   `<style>
    //   ytrb-default {
    //     display: flex;
    //     height: var(--ytrb-bar-height);
    //     background-color: ${color};
    //     border-radius: 12px 0px 0px 12px;
    //     position: relative;
    //     font-weight: bold;
    //     color: white;
    //     align-items: center;
    //     font-size: 16px;
    //   }
    
    //   ytrb-default::before {
    //     content: '';
    //     position: absolute;
    //     top: 0;
    //     right: -15px;
    //     border-top: 15px solid transparent;
    //     border-bottom: 15px solid transparent;
    //     border-left: 15px solid ${color};
    //     z-index: 1;
    //   }
    // </style>
    
    // <ytrb-default style="background-color: ${color}">&nbsp;&nbsp;AD</ytrb-default>` +
      `<ytrb-default>&nbsp&nbsp AD</ytrb-default>` +
      (userSettings.barTooltip
        ? '<ytrb-tooltip><div style="text-align: center; font-size: 10px; overflow-y: scroll; max-height: 100px;">' + description.items[0].snippet.description + '</div></ytrb-tooltip>'
        : ''
      ) +
      '</ytrb-bar>';
    return ret
  });
}

function addRatingBar(thumbnail, videoId) {

  var tmp = Math.floor(Math.random() * 2);
  if (tmp == 1){
    getRatingBarHtml(videoId).then(ret => {
      $(thumbnail).append(ret)
    })
  }
}

function processNewThumbnails() {
  const thumbnails = getNewThumbnails()
  const thumbnailsAndVideoIds = getThumbnailsAndIds(thumbnails)

  for (const [thumbnail, videoId] of thumbnailsAndVideoIds) {
    if (userSettings.barHeight !== 0) {
      addRatingBar(thumbnail, videoId)
    }
  }
}

function handleDomMutations() {
  if (domMutationsAreThrottled) {
    hasUnseenDomMutations = true
  } else {
    domMutationsAreThrottled = true
    if (userSettings.barHeight !== 0 || userSettings.showPercentage) {
      processNewThumbnails()
    }

    hasUnseenDomMutations = false

    setTimeout(function() {
      domMutationsAreThrottled = false
      if (hasUnseenDomMutations) {
        handleDomMutations()
      }

    }, HANDLE_DOM_MUTATIONS_THROTTLE_MS)
  }
}

const mutationObserver = new MutationObserver(handleDomMutations)
chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function(storedSettings) {
  if (storedSettings) {
    userSettings = storedSettings
  }
  const cssFiles = []
  cssFiles.push('css/bar.css')
  cssFiles.push('css/bar-top.css')

  if (userSettings.barTooltip) {
    cssFiles.push('css/bar-tooltip.css')
    cssFiles.push('css/bar-top-tooltip.css')
  }

  if (userSettings.useOnVideoPage) {
    cssFiles.push('css/bar-video-page.css')
  }

  if (cssFiles.length > 0) {
    chrome.runtime.sendMessage({
      query: 'insertCss',
      files: cssFiles,
    })
  }
  handleDomMutations()
  mutationObserver.observe(document.body, {childList: true, subtree: true})
})