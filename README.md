# mc-flare-copy-cshid
A javascript for MadCap Flare that allows you to copy a topic URL using the CSHID, if one exists

## Summary

When connected to a button in your MadCap Flare output, this script will output a clean URL that you can share with others. If the topic exists in your Alias file as the target of a CSH link, the copied link will be the CSHID link. If the topic is not in the Alias file, the copied link will be a clean URL with query parameters removed. If the browser doesn't allow the user to copy to the clipboard via script, a small modal window will appear with the URL to be copied manually.

## Features

- Detailed console logs and warnings with three levels of logging: 0: no logging; 1: debugging logs; 2: vberbose logs.
- Uses external javascript file so it works on sites that don't alow inline scripting (strict CSP)
- Uses built-in Flare feature to add buttons to the topic toolbar.
- Is agnostic of file extensions. Tested: .htm .html and .php files.
- Is deisgned to work at any server folder level.
- Handles default case of the browser being able to write to the clipboard, but if that doesn't work, it displays a pop-up modal with the target URL.
- Copy confirmation toast message that appears for 2 seconds (configurable).

## Installation and configuration

1. Copy this script to your Flare project.
1. Add a new button to the Topic Toolbar with the name CopyURL.
1. Set the icon for the button to an icon of your choosing.
1. You do not need to call this using the Event setting in Flare. It uses an 
   event handler to watch for clicks to the button.
1. Modify your masterpage to include a link to this script like this:
   <script src="../path/to/copy-csh.js"></script>
1. When you build your project, and click the button, the cliipboard will have a 
   URL with the CSHID, if available, and if not, a URL stripped of query parameters.

## Known issues
- copying doesn't work when files viewd from the filesystem (not served by a webserver) for security purposes.

## Feature requests

[New feature suggestions](https://github.com/docguytraining/mc-flare-copy-cshid/issues/new) are always welcomed and will be considered, though, please remember that this project is a non-revenue-generating side project. 

## Contributing guidelines

- Please work in feature branched and submit a pull request.
- Avoid introducing new dependencies.

## Thank you

I hope you like it! If you end up using it, I'd love to know!