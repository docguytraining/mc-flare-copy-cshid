
//
// copy-csh - Version 1.0
// MadCap Flare Copy CSHID
//
// Copyright 2025
// All Rights Reserved.
//
// Dual-licensed under the MIT and GNU GPL licenses
//
// Author: Paul Pehrson (paul@docguytraining.com)
// Created with AI assistance (ChatGPT) for optimization, security, and best practices.
// Final version reviewed and refined by the author.
//
// Created: March 14, 2025
// Last Updated: March 14, 2025
//
// Public Repo: htps://github.com/docguytraining/mc-flare-copy-cshid
//
// Description:
// This script, when linked to a Topic Toolbar button in MadCap Flare output, 
// uses the current URL and the Alias.xml file to see if there is an existing CSHID
// for the current topic. If there is, it will attempt to copy the link, using the CSHID,
// to the clipboard. If there isn't, it will attempt to copy a clean link (with no 
// URL parameters) to the clipboard. If copying to the clipboard fails, it will show a
// small modal window with the URL so it can be easily copied.
//
// Version History:
// 1.0 (2025-03-14) - Initial release.
//
// Dependencies:
// - None (Vanilla JavaScript, no jQuery required)
// - Works with MadCap Flare v20+
//
// Usage:
// 1. Copy this script to your Flare project.
// 2  Add a new button to the Topic Toolbar with the name CopyURL.
// 3. Set the icon for the button to an icon of your choosing.
// 4. You do not need to call this using the Event setting in Flare. It uses an event handler
//    to watch for clicks to the button.
// 5. Modify your masterpage to include a link to this script like this:
//    <script src="../path/to/copy-csh.js"></script>
// 6. When you build your project, and click the button, the cliipboard will have a URL
//    with the CSHID, if available, and if not, a URL stripped of query parameters.


// Enable debug mode for detailed console logs (set to false in production)

document.addEventListener("DOMContentLoaded", function () {
    const logLevel = 1; // 0 = Off, 1 = Basic logs, 2 = Full debug logs

    function log(level, ...args) {
        if (logLevel >= level) console.log(...args);
    }

    function warn(...args) {
        console.warn(...args);
    }

    function error(...args) {
        console.error(...args);
    }

    log(1, "Script loaded and DOM fully ready.");

    function handleCopyUrlClick() {
        log(1, "Copy URL button clicked. Fetching CSH link...");
        
        const { basePath, aliasPath, targetFile } = getDynamicPathData();
        log(1, "Extracted data from URL:", { basePath, aliasPath, targetFile });
        
        getCshId(aliasPath, targetFile).then((result) => {
            let finalUrl;
            if (result) {
                const { cshId, correctExtension } = result;
                finalUrl = `${window.location.origin}${basePath}/Default.${correctExtension}#cshid=${cshId}`;
                log(1, "Found CSH ID:", cshId);
            } else {
                finalUrl = stripUrlVariables(window.location.href);
                warn("No CSH ID found! Using fallback URL.");
            }
            
            copyToClipboard(finalUrl);
        });
    }

    function attachButtonListener() {
        const button = document.querySelector(".copy-url-button");
        if (button) {
            button.removeEventListener("click", handleCopyUrlClick);
            button.addEventListener("click", handleCopyUrlClick);
            log(1, "Event listener attached to .copy-url-button");
        } else {
            const observer = new MutationObserver(() => {
                const newButton = document.querySelector(".copy-url-button");
                if (newButton) {
                    observer.disconnect();
                    attachButtonListener();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            log(1, "Watching for dynamically inserted .copy-url-button");
        }
    }

    attachButtonListener();

    function getDynamicPathData() {
        log(1, "Running getDynamicPathData()");
        const url = new URL(window.location.href);
        const pathParts = url.pathname.split("/").filter(Boolean); // Remove empty segments

        let basePath = "/" + pathParts.slice(0, -1).join("/"); // Assume everything before Default.* is base
        let targetFile = pathParts[pathParts.length - 1]; // Assume last part is the target file
        let aliasPath = `${basePath}/Data/Alias.xml`; // Default assumption

        log(1, "Determined basePath:", basePath);
        log(1, "Determined aliasPath:", aliasPath);
        log(1, "Determined targetFile:", targetFile);

        return { basePath, aliasPath, targetFile };
    }

    async function getCshId(aliasPath, targetFile) {
        const xmlUrl = window.location.origin + aliasPath;
        log(1, "Fetching Alias.xml from:", xmlUrl);
    
        try {
            const response = await fetch(xmlUrl);
            if (!response.ok) throw new Error(`Failed to fetch XML: ${response.statusText}`);
    
            const xmlText = await response.text();
            log(1, "Alias.xml loaded successfully");
    
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            
            const maps = xmlDoc.getElementsByTagName("Map");
            for (let map of maps) {
                let aliasFile = map.getAttribute("Link") || "";
                aliasFile = aliasFile.trim().toLowerCase();
                let normalizedTargetFile = targetFile.trim().toLowerCase();
    
                if (aliasFile === normalizedTargetFile) {
                    log(1, "Match found! CSH ID:", map.getAttribute("ResolvedId"));
                    return {
                        cshId: map.getAttribute("ResolvedId"),
                        correctExtension: aliasFile.split('.').pop()
                    };
                }
            }
    
            warn("No match found in Alias.xml for:", targetFile);
            return null;
        } catch (err) {
            error("Error fetching or parsing XML:", err);
            return null;
        }
    }

    function stripUrlVariables(url) {
        log(1, "Running stripUrlVariables()");
        return url.split("?")[0].split("#")[0];
    }

    function copyToClipboard(text) {
        log(1, "Attempting to copy URL to clipboard:", text);
        navigator.clipboard.writeText(text)
            .then(() => showToast("Copied to clipboard!"))
            .catch(() => {
                warn("Clipboard write failed! Showing manual copy dialog.");
                showManualCopyDialog(text);
            });
    }

    function showToast(message) {
        log(1, "Showing toast notification:", message);
        const toast = document.createElement("div");
        toast.innerText = message;
        toast.style.position = "fixed";
        toast.style.bottom = "60px";
        toast.style.right = "20px";
        toast.style.background = "black";
        toast.style.color = "white";
        toast.style.padding = "10px";
        toast.style.borderRadius = "5px";
        toast.style.opacity = "0.9";
        toast.style.transition = "opacity 0.5s ease-in-out";
        toast.style.zIndex = "1001";

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 2000);
    }

    function showManualCopyDialog(text) {
        log(1, "Showing manual copy dialog for:", text);

        const modal = document.createElement("div");
        modal.style.position = "fixed";
        modal.style.top = "50%";
        modal.style.left = "50%";
        modal.style.transform = "translate(-50%, -50%)";
        modal.style.background = "white";
        modal.style.padding = "20px";
        modal.style.border = "1px solid #ccc";
        modal.style.zIndex = "1002";

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.width = "100%";
        textArea.style.height = "60px";
        textArea.readOnly = true;

        const closeButton = document.createElement("button");
        closeButton.innerText = "Close";
        closeButton.addEventListener("click", () => document.body.removeChild(modal));

        modal.appendChild(textArea);
        modal.appendChild(closeButton);
        document.body.appendChild(modal);
    }
});
