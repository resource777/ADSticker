const videoTitles = document.querySelectorAll('a.yt-simple-endpoint.style-scope.ytd-rich-grid-media');
videoTitles.forEach(title => {
  const hiElement = document.createElement('span');
  hiElement.style.fontWeight = 'bold';
  hiElement.innerText = '🚨';
  title.parentNode.insertBefore(hiElement, title.nextSibling);
});
