# volastor

Firefox add-on that allows you to clear Local Storage, manually or when Firefox starts up and exits.

Available from Mozilla Add-Ons: https://addons.mozilla.org/en-US/firefox/addon/volatile-storage/

Click on the icon to clear now or go to *Tools → Add-ons → Extensions → Volatile Storage → Options* to customize automatic cleanup.

Local Storage (aka HTML5 DOM Storage) is used by some resources (YouTube, Google, Amazon and others) in addition to cookies to track you among your visits. Therefore even if you clear cookies or have them expired when you close Firefox Local Storage still persists. This add-on lets you clear Local Storage as well.

Please report issues to the tracker: https://github.com/detell/volastor/issues

## How to build

1. Install Mozilla Add-On SDK as described [here](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation). On Windows, [download/install Python 2.7](https://www.python.org/download), then extract the SDK anywhere.
2. Clone git repository and open command prompt there.
3. Run `cfx run` or `cfx xpi`. The main code is in `lib/main.js`.
