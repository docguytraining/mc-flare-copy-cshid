# mc-flare-copy-cshid

A JavaScript utility for MadCap Flare that allows users to copy a topic URL using its **CSHID**, if one exists.

## Summary

When connected to a button in your MadCap Flare output, this script copies a clean, shareable URL.  
If the topic exists in your **Alias.xml** file as the target of a CSH link, the copied link will include the `CSHID`.  
If the topic is not listed in the Alias file, it will instead copy a clean URL with query parameters removed.  
If the browser prevents clipboard access, a small, accessible modal dialog will appear to allow manual copying.

## Features

- **Dynamic base discovery** – Works automatically across `/Docs/<version>/TopNav/...`, `/Content/...`, or root-level outputs.
- **Inline configuration block** for simple customization via `window.CopyCSH`.
- **Three log levels** for debugging: 0 = Off, 1 = Basic, 2 = Verbose.
- **Clipboard API support** with automatic fallback to a manual modal.
- **Configurable toast notifications** near the click or toolbar button.
- **Extension agnostic** – Works with `.htm`, `.html`, and `.php`.
- **Same-origin secure fetch** for Alias.xml lookups.
- **Accessible UI** for all notifications and dialogs.

## Installation and Configuration

1. Copy this script to your Flare project (e.g., `/Content/scripts/copy-csh.js`).
1. Add a new button to the **Topic Toolbar** with the name `CopyURL`.
1. Assign an icon of your choice to the button.
1. You do not need to configure an Event action in Flare — the script attaches automatically.
1. Add this line to your **Master Page** (before the closing `</body>` tag):

   ```html
   <script src="../path/to/copy-csh.js"></script>
   ```

1. (Optional) Configure inline settings at the top of the script:

   ```js
   window.CopyCSH = {
     useCustomSettings: true,
     basePath: "/Docs/current/TopNav",
     aliasPath: "/Docs/current/TopNav/Data/Alias.xml",
     defaultExt: "htm",
     logLevel: 1,
     buttonSelector: ".copy-url-button",
     toastDuration: 1500
   };
   ```

1. Build your project and click the **CopyURL** button — the clipboard will now contain the correct URL.

## Known Issues

- Copying **does not work** when files are opened directly from the filesystem (e.g., using `file://` URLs) due to browser security restrictions.
- Some browsers may block automatic clipboard access in insecure (HTTP) contexts.

## Contributing

1. Fork this repository and create a feature branch for your change.
1. Avoid adding new dependencies — this project should remain dependency-free.
1. Follow the existing code style and logging patterns.
1. Submit a pull request with a clear description of your changes.

Feature suggestions are always welcome: [New feature request →](https://github.com/docguytraining/mc-flare-copy-cshid/issues/new)

## Acknowledgments

This project was created and maintained by **Paul Pehrson** ([@docguytraining](https://github.com/docguytraining)) with AI-assisted optimization for performance, security, and maintainability.

If you find it useful, please ⭐ the repository or let the author know — feedback is always appreciated!
