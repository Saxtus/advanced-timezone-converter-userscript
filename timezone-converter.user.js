// ==UserScript==
// @name         Advanced Timezone Converter
// @namespace    https://github.com/Saxtus/advanced-timezone-converter-userscript/
// @version      2025-04-28.001
// @updateURL    https://github.com/Saxtus/advanced-timezone-converter-userscript/releases/latest/download/timezone-converter.user.js
// @downloadURL  https://github.com/Saxtus/advanced-timezone-converter-userscript/releases/latest/download/timezone-converter.user.js
// @description  Show browser's timezone equivalent with improved configuration and date format parsing
// @author       Saxtus
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/luxon@2.4.0/build/global/luxon.min.js
// ==/UserScript==

(function () {
  "use strict";
  const DateTime = luxon.DateTime;

  let config = GM_getValue("tzConfig", {});

  function normalizeDomain(domain) {
    return domain.replace(/^www\./i, "").toLowerCase();
  }

  function showConfigModal() {
    const timezones = Intl.supportedValuesOf("timeZone").sort();
    const currentConfig = Object.entries(config).map(([domain, tz]) => ({
      domain: normalizeDomain(domain),
      timezone: tz,
    }));

    GM_addStyle(`
        .tz-config-modal { position: fixed; top: 50px; left: 50%; transform: translateX(-50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.2); z-index: 999999; width: 80%; max-width: 600px; }
        .tz-config-row { display: flex; gap: 10px; margin-bottom: 10px; }
        .tz-config-input { flex: 1; padding: 8px; }
        .tz-list { max-height: 300px; overflow-y: auto; margin: 20px 0; }
        .tz-entry { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; }
        .tz-entry:hover { background: #f5f5f5; }
        .tz-datalist { display: none; }
        .current-domain-note { font-size: 0.9em; color: #666; margin-bottom: 10px; }
      `);

    const modal = document.createElement("div");
    modal.className = "tz-config-modal";
    modal.innerHTML = `
        <h3>Timezone Configuration</h3>
        <div class="current-domain-note">Current domain: ${normalizeDomain(
          window.location.hostname
        )}</div>
        <div class="tz-config-row">
          <input class="tz-config-input" id="tz-domain" placeholder="Domain (example.com)" type="text" value="${normalizeDomain(
            window.location.hostname
          )}">
          <input class="tz-config-input" id="tz-timezone" list="tz-options" placeholder="Timezone">
          <datalist id="tz-options">
              ${timezones.map((tz) => `<option value="${tz}">`).join("")}
          </datalist>
          <button id="tz-add">Add/Update</button>
        </div>
        <div class="tz-list" id="tz-entries"></div>
        <button id="tz-save" style="width: 100%; padding: 10px;">Save Configuration</button>
      `;

    document.body.appendChild(modal);
    const entriesContainer = modal.querySelector("#tz-entries");
    const domainInput = modal.querySelector("#tz-domain");
    const tzInput = modal.querySelector("#tz-timezone");
    let editingIndex = -1;

    function updateEntries() {
      entriesContainer.innerHTML = currentConfig
        .map(
          (entry, index) => `
                <div class="tz-entry" data-index="${index}">
                  <span>${entry.domain} → ${entry.timezone}</span>
                  <button class="tz-remove">Remove</button>
                </div>
              `
        )
        .join("");
    }

    function addOrUpdateEntry() {
      const domain = normalizeDomain(domainInput.value);
      const timezone = tzInput.value;
      if (!domain || !timezones.includes(timezone)) return;
      if (editingIndex > -1) {
        currentConfig[editingIndex] = { domain, timezone };
        editingIndex = -1;
      } else {
        const existingIndex = currentConfig.findIndex(
          (e) => e.domain === domain
        );
        if (existingIndex > -1) {
          currentConfig[existingIndex].timezone = timezone;
        } else {
          currentConfig.push({ domain, timezone });
        }
      }
      domainInput.value = normalizeDomain(window.location.hostname);
      tzInput.value = "";
      updateEntries();
    }
    modal.querySelector("#tz-add").addEventListener("click", addOrUpdateEntry);

    entriesContainer.addEventListener("click", (e) => {
      const entry = e.target.closest(".tz-entry");
      if (!entry) return;
      if (e.target.classList.contains("tz-remove")) {
        e.stopPropagation();
        const index = parseInt(entry.dataset.index);
        currentConfig.splice(index, 1);
        updateEntries();
      } else {
        editingIndex = parseInt(entry.dataset.index);
        const { domain, timezone } = currentConfig[editingIndex];
        domainInput.value = domain;
        tzInput.value = timezone;
      }
    });

    modal.querySelector("#tz-save").addEventListener("click", () => {
      const newConfig = {};
      currentConfig.forEach((entry) => {
        newConfig[entry.domain] = entry.timezone;
      });
      GM_setValue("tzConfig", newConfig);
      config = newConfig;
      modal.remove();
      alert("Configuration saved!");
    });
    document.addEventListener("click", function onClickOutside(e) {
      if (!modal.contains(e.target)) {
        modal.remove();
        document.removeEventListener("click", onClickOutside);
      }
    });
    updateEntries();
  }

  GM_registerMenuCommand("Configure Timezones", showConfigModal);

  function processDates() {
    const hostname = normalizeDomain(window.location.hostname);
    const sourceTZ = config[hostname];
    if (!sourceTZ) return;

    const patterns = [
      // ISO: 2025-04-25 09:33:34  or 2025-04-25 09:33
      {
        re: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\b/g,
        parse: function (match) {
          let format;
          if (/^\d{4}-\d{2}-\d{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(match))
            format = "yyyy-MM-dd HH:mm:ss";
          else if (/^\d{4}-\d{2}-\d{2} [0-9]{2}:[0-9]{2}$/.test(match))
            format = "yyyy-MM-dd HH:mm";
          else if (/^\d{4}-\d{2}-\d{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(match))
            format = "yyyy-MM-dd'T'HH:mm:ss";
          else if (/^\d{4}-\d{2}-\d{2}T[0-9]{2}:[0-9]{2}$/.test(match))
            format = "yyyy-MM-dd'T'HH:mm";
          else format = null;
          return { toParse: match.trim(), format, orig: match };
        },
      },
      // Parentheses: 2025-04-25 (16:17)
      {
        re: /(\d{4}-\d{2}-\d{2})\s*\(\s*(\d{2}:\d{2})\s*\)/g,
        parse: function (match, g1, g2) {
          let datepart = g1.trim();
          let timepart = g2.trim();
          let dtstring = datepart + "T" + timepart;
          let format = "yyyy-MM-dd'T'HH:mm";
          return { toParse: dtstring, format, orig: match };
        },
      },
      // US: 04/25/2025 09:33 or 04/25/2025 09:33:34 or 04/25/2025 09:33 AM
      {
        re: /\b\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}(?::\d{2})?(?: [AP]M)?\b/gi,
        parse: function (match) {
          if (/[AP]M$/i.test(match.trim())) {
            if (/\d{1,2}:\d{2}:\d{2} [AP]M$/i.test(match.trim()))
              return {
                toParse: match.trim(),
                format: "MM/dd/yyyy hh:mm:ss a",
                orig: match,
              };
            else
              return {
                toParse: match.trim(),
                format: "MM/dd/yyyy hh:mm a",
                orig: match,
              };
          } else {
            if (/\d{1,2}:\d{2}:\d{2}$/.test(match.trim()))
              return {
                toParse: match.trim(),
                format: "MM/dd/yyyy HH:mm:ss",
                orig: match,
              };
            else
              return {
                toParse: match.trim(),
                format: "MM/dd/yyyy HH:mm",
                orig: match,
              };
          }
        },
      },
      // EU: 25.04.2025 09:33 or 25.04.2025 09:33:34
      {
        re: /\b\d{1,2}\.\d{1,2}\.\d{4} \d{2}:\d{2}(?::\d{2})?\b/g,
        parse: function (match) {
          if (/\d{2}:\d{2}:\d{2}$/.test(match.trim()))
            return {
              toParse: match.trim(),
              format: "dd.MM.yyyy HH:mm:ss",
              orig: match,
            };
          else
            return {
              toParse: match.trim(),
              format: "dd.MM.yyyy HH:mm",
              orig: match,
            };
        },
      },
    ];

    function handleTextNode(node) {
      // Skip already injected/replaced content
      if (
        node.parentNode &&
        node.parentNode.classList &&
        node.parentNode.classList.contains("tz-annotated")
      ) {
        return;
      }
      let text = node.nodeValue;
      let originalText = text;
      let modified = false;
      let newText = text;

      patterns.forEach(({ re, parse }) => {
        re.lastIndex = 0;
        newText = newText.replace(re, function (match, g1, g2) {
          let { toParse, format, orig } = parse(match, g1, g2);
          if (!format) return match;
          let parsedDate = DateTime.fromFormat(toParse, format, {
            zone: sourceTZ,
          });
          if (!parsedDate.isValid) return match;
          const localDate = parsedDate.setZone(DateTime.local().zoneName);
          const formattedDate = localDate.toFormat("MMM dd, yyyy HH:mm:ss");
          modified = true;
          return `${
            orig || toParse
          } <span style="font-size:1em;vertical-align:middle;">🕒</span> <span style="background:#eef;padding:1px 4px;border-radius:2px;">${formattedDate}</span>`;
        });
      });

      if (modified && newText !== originalText) {
        const span = document.createElement("span");
        span.className = "tz-annotated";
        span.innerHTML = newText;
        node.parentNode.replaceChild(span, node);
      }
    }

    document.querySelectorAll(".date").forEach((el) => {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) handleTextNode(child);
      });
    });

    Array.from(document.body.getElementsByTagName("*")).forEach((el) => {
      Array.from(el.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) handleTextNode(child);
      });
    });

    // Watch for dynamic content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) handleTextNode(node);
          else if (node.nodeType === Node.ELEMENT_NODE) {
            node.querySelectorAll("*").forEach((el) => {
              Array.from(el.childNodes).forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE) handleTextNode(child);
              });
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  window.addEventListener("load", processDates);
})();
