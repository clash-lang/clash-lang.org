---
identifier: install-clash
title: Install Clash
disable_comments: true
---

<script>
// From: https://stackoverflow.com/a/38241481
var userAgent = window.navigator.userAgent,
    platform = window.navigator.platform,
    macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
    windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];

if (macosPlatforms.indexOf(platform) !== -1) {
  window.location.href = "./macos";
} else if (windowsPlatforms.indexOf(platform) !== -1) {
  window.location.href = "./windows";
} else if (/Linux/.test(platform)) {
  window.location.href = "./linux";
} else {
  // Make a choice
}
</script>

<link rel="stylesheet" href="/css/install.css">

# 1. Choose your platform
<div id="platform-select" class="button-group">
    <a href="/install/windows"><button class="button">{{% fontawesome windows-brands %}}<br>Windows</button>
    </a><a href="/install/macos"><button class="button">{{% fontawesome apple-brands %}}<br>macOS</button>
    </a><a href="/install/linux"><button class="button">{{% fontawesome linux-brands %}}<br>Linux</button>
    </a>
</div>
