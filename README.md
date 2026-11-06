![ntfy logo](./public/ntfy.svg)

# ntfy Viewer

A browser extension that receives [ntfy](https://github.com/binwiederhier/ntfy) messages in the background and shows them as desktop notifications and in a list you can open from the toolbar. You don't need an ntfy page open to get them.

Deleting a message removes it everywhere. Delete all in the popup deletes the messages from the ntfy server, so they also disappear from the ntfy apps and from this extension on your other computers.

> Unofficial, and not affiliated with ntfy. Supports Chrome and Firefox.

## Features

- Subscribe to any number of ntfy topics on ntfy.sh or your own server, with optional access tokens.
- Desktop notifications with ntfy titles, priorities, tags and emoji, and click-through links.
- A popup listing recent messages, with a badge count for unread ones.
- **Server-side deletes:** Delete all removes messages from the server. Deletes sent by any other client (the ntfy apps, `curl`, or another copy of this extension) are applied as they arrive.
- Reconnects after the browser sleeps or the connection drops, and fetches anything missed while offline.

## Credits

This project is based on [ntfy-browser](https://github.com/johman10/ntfy-browser) by **Johan van Eck**, an unofficial ntfy browser extension released under the MIT License. Thanks to Johan for the original work, which this project builds on.

The original project is licensed under the MIT License, and this fork keeps that license. See [LICENSE](./LICENSE).

## Contributing

Contributions are welcome. Fork this repository and follow the steps below.

### Prerequisites

- [Node](https://nodejs.org/) >= 20.9
- [NPM](https://npmjs.org/) >= 10

### Setup

Install dependencies and watch for file changes:

```
npm install
npm start
```

This builds and watches for changes in Chrome by default. To build for Firefox instead:

```
npm run start:firefox
```

Load the extension in your browser:

- [Chrome](https://support.google.com/chrome/a/answer/2714278?hl=en#:~:text=Step%202%3A%20Test%20the%20app%20or%20extension)
- [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_first_WebExtension#installing)

The built files live in `dist/[browser]`. Some changes need the extension to be reloaded before you can test them.

### Test

```
npm test
```

### Production build

```
npm run build
```

This builds the extension for all configured browsers and packages them as zip files in `dist/`.
