// ==UserScript==
// @name         TDScript
// @namespace    https://drexel.edu/
// @version      2026-10-08
// @description  TDX helpers: Notify automation, hide Take Incident, add Unclaimed Status, remove Due, and track ticket communication activity
// @author       Luke Fabry / updated
// @match        https://servicedesk.drexel.edu/TDWorkManagement
// @match        https://servicedesk.drexel.edu/TDNext/Apps/*/Tickets/Update*
// @match        https://servicedesk.drexel.edu/TDNext/Apps/*/Tickets/TicketDet.aspx*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=drexel.edu
// @grant        GM_xmlhttpRequest
// @connect      servicedesk.drexel.edu
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // =========================================================
  // GLOBAL
  // =========================================================

  const PATH = window.location.pathname;
  const HERE = window.location.href;

  const isMainPage =
    /^\/TDWorkManagement\/?$/.test(PATH);

  const isUpdate =
    PATH.includes('/TDNext/Apps/') &&
    PATH.includes('/Tickets/Update');

  const isDetails =
    PATH.includes('/TDNext/Apps/') &&
    PATH.includes('/Tickets/TicketDet.aspx');

  const q = (sel, root = document) =>
    root.querySelector(sel);

  const qa = (sel, root = document) =>
    Array.from(root.querySelectorAll(sel));

  const clean = value =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  const log = (...args) =>
    console.log('[SD Script]', ...args);

  const warn = (...args) =>
    console.warn('[SD Script]', ...args);

  // =========================================================
  // MODE BADGE
  // =========================================================

  function addModeBadge() {
    if (!document.body || q('#sd-mode-badge')) {
      return;
    }

    const badge = document.createElement('div');

    badge.id = 'sd-mode-badge';

    badge.style.cssText =
      'position:fixed;' +
      'z-index:2147483647;' +
      'bottom:6px;' +
      'right:6px;' +
      'font:12px/1.2 system-ui;' +
      'background:#111;' +
      'color:#0ff;' +
      'padding:3px 6px;' +
      'border-radius:4px;' +
      'opacity:.55;' +
      'pointer-events:none';

    badge.textContent =
      isMainPage
        ? 'MODE: MAIN'
        : isUpdate
          ? 'MODE: UPDATE'
          : isDetails
            ? 'MODE: DETAILS'
            : 'MODE: OTHER';

    document.body.appendChild(badge);
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      addModeBadge,
      { once: true }
    );
  } else {
    addModeBadge();
  }

  // =========================================================
  // A) DETAILS - HIDE TAKE INCIDENT
  // =========================================================

  if (isDetails) {

    function hideTakeIncident() {

      let hidden = false;

      qa('a').forEach(link => {

        if (
          !clean(link.textContent).includes(
            'Take Incident'
          )
        ) {
          return;
        }

        let element = link;
        let parent = link.parentElement;

        while (
          parent &&
          parent.tagName !== 'LI' &&
          parent.tagName !== 'BODY'
        ) {
          parent = parent.parentElement;
        }

        if (
          parent &&
          parent.tagName === 'LI'
        ) {
          element = parent;
        }

        element.style.display = 'none';
        hidden = true;
      });

      if (!hidden) {

        const fallback =
          q('a[onclick*="TakeIncident"]') ||
          q('#divTakeTicket a') ||
          q('a[href*="TakeIncident"]');

        if (fallback) {

          let element = fallback;
          let parent = fallback.parentElement;

          while (
            parent &&
            parent.tagName !== 'LI' &&
            parent.tagName !== 'BODY'
          ) {
            parent = parent.parentElement;
          }

          if (
            parent &&
            parent.tagName === 'LI'
          ) {
            element = parent;
          }

          element.style.display = 'none';
        }
      }
    }

    function initDetails() {

      hideTakeIncident();

      const observer =
        new MutationObserver(
          hideTakeIncident
        );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );
    }

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        initDetails,
        { once: true }
      );
    } else {
      initDetails();
    }
  }

  // =========================================================
  // B) UPDATE - NOTIFY / PRIVATE COMMENTS
  // =========================================================

  if (isUpdate) {

    function fire(
      element,
      type,
      options = {}
    ) {

      const EventCtor =
        window[type] || MouseEvent;

      let event;

      try {
        event =
          new EventCtor(
            type,
            {
              bubbles: true,
              cancelable: true,
              view: window,
              ...options
            }
          );
      } catch {
        event =
          new MouseEvent(
            type,
            {
              bubbles: true,
              cancelable: true,
              view: window,
              ...options
            }
          );
      }

      element.dispatchEvent(event);
    }

    const getNotifySelect = () =>
      q(
        'select[name="NotificationEmails"]'
      );

    const countSelected = select =>
      select
        ? qa(
            'option',
            select
          ).filter(
            option =>
              option.selected
          ).length
        : 0;

    function findNotifyAllButton() {

      const group =
        q(
          '.tdx-lookup-button-group'
        );

      let button =
        group
          ? q(
              'button.js-select-all',
              group
            )
          : null;

      if (!button) {
        button =
          q(
            'button.js-select-all[title="Notify All Users"]'
          );
      }

      if (!button) {
        button =
          q(
            'button.js-select-all[title*="Notify All Users" i]'
          );
      }

      if (!button) {
        button =
          q(
            'button.js-select-all[data-original-title="Notify All Users"]'
          );
      }

      if (!button) {
        button =
          q(
            'button.js-select-all[data-original-title*="Notify All Users" i]'
          );
      }

      if (!button) {

        const icon =
          q('span.fa-users');

        if (icon) {
          button =
            icon.closest('button');
        }
      }

      return button || null;
    }

    function getRemoveAllButton() {

      return (
        q(
          'button.btn.btn-default.js-remove-all[title="Remove All"]'
        ) ||
        q(
          'button.js-remove-all[title="Remove All"]'
        ) ||
        q(
          'button.js-remove-all'
        )
      );
    }

    function clickNotifyOnce(
      label = '[Notify]'
    ) {

      if (isPrivateChecked()) {
        return false;
      }

      const button =
        findNotifyAllButton();

      if (!button) {
        return false;
      }

      if (
        button.disabled ||
        button.getAttribute(
          'aria-disabled'
        ) === 'true'
      ) {
        return false;
      }

      try {

        fire(
          button,
          'pointerdown'
        );

        fire(
          button,
          'mousedown'
        );

        button.click();

        fire(
          button,
          'mouseup'
        );

        fire(
          button,
          'pointerup'
        );

        log(
          `${label} Clicked "Notify All Users".`
        );

        return true;

      } catch (error) {

        warn(
          `${label} Error clicking:`,
          error
        );

        return false;
      }
    }

    function fallbackSelectAll() {

      if (isPrivateChecked()) {
        return false;
      }

      const select =
        getNotifySelect();

      if (!select) {
        return false;
      }

      const options =
        qa(
          'option',
          select
        );

      if (!options.length) {
        return false;
      }

      options.forEach(
        option => {
          option.selected = true;
        }
      );

      select.dispatchEvent(
        new Event(
          'change',
          {
            bubbles: true
          }
        )
      );

      return true;
    }

    function verifyNotify() {

      return (
        countSelected(
          getNotifySelect()
        ) > 0
      );
    }

    let notifyDone = false;
    let suppressPrivateHandler = false;

    /*
      Becomes true the moment the person physically clicks the
      "Make comments private" checkbox. From then on the script
      never forces its state or re-runs Notify automation, so the
      checkbox is always under the user's control.
    */
    let privateUserTouched = false;

    function getPrivateCheckbox() {

      let checkbox =
        q(
          'input[name="CommentsIsPrivate"][type="checkbox"]'
        );

      if (checkbox) {
        return checkbox;
      }

      for (
        const label of
          qa('label')
      ) {

        if (
          !clean(
            label.textContent
          ).includes(
            'Make comments private'
          )
        ) {
          continue;
        }

        checkbox =
          q(
            'input[type="checkbox"]',
            label
          );

        if (checkbox) {
          return checkbox;
        }
      }

      return null;
    }

    function isPrivateChecked() {

      const checkbox =
        getPrivateCheckbox();

      return !!(
        checkbox &&
        checkbox.checked
      );
    }

    function trackPrivateInteraction() {

      const handler =
        event => {

          // Ignore events fired by this script.
          if (
            !event.isTrusted ||
            privateUserTouched
          ) {
            return;
          }

          const checkbox =
            getPrivateCheckbox();

          const target =
            event.target;

          if (
            !checkbox ||
            !target
          ) {
            return;
          }

          const label =
            target.closest
              ? target.closest('label')
              : null;

          if (
            target === checkbox ||
            (
              label &&
              (
                label.contains(
                  checkbox
                ) ||
                (
                  label.htmlFor &&
                  label.htmlFor ===
                    checkbox.id
                )
              )
            )
          ) {
            privateUserTouched =
              true;
          }
        };

      // Capture phase: runs before TDX or our own handlers.
      document.addEventListener(
        'click',
        handler,
        true
      );

      document.addEventListener(
        'change',
        handler,
        true
      );
    }

    function runNotifyWithRetries(
      maxMs = 15000,
      stepMs = 400
    ) {

      const start =
        Date.now();

      function step() {

        if (
          notifyDone ||
          privateUserTouched
        ) {
          return;
        }

        const button =
          findNotifyAllButton();

        if (
          button &&
          clickNotifyOnce(
            '[Notify][Init]'
          )
        ) {

          setTimeout(
            () => {

              if (
                privateUserTouched
              ) {
                return;
              }

              if (
                verifyNotify()
              ) {

                notifyDone =
                  true;

              } else if (
                fallbackSelectAll() &&
                verifyNotify()
              ) {

                notifyDone =
                  true;
              }

            },
            150
          );
        }

        if (notifyDone) {
          return;
        }

        if (
          Date.now() - start >=
          maxMs
        ) {

          if (
            fallbackSelectAll() &&
            verifyNotify()
          ) {
            notifyDone =
              true;
          }

          return;
        }

        setTimeout(
          step,
          stepMs
        );
      }

      step();
    }

    function clickRemoveAll(
      label = '[Notify]'
    ) {

      const button =
        getRemoveAllButton();

      if (!button) {
        warn(
          `${label} Remove All button not found.`
        );
        return false;
      }

      try {
        button.click();
        return true;
      } catch (error) {
        warn(
          `${label} Failed to click Remove All:`,
          error
        );
        return false;
      }
    }

    function attachPrivateChangeListener(
      checkbox
    ) {

      if (
        !checkbox ||
        checkbox._sdPrivateListenerAttached
      ) {
        return;
      }

      checkbox.addEventListener(
        'change',
        event => {

          if (
            suppressPrivateHandler
          ) {
            return;
          }

          if (
            event.target.checked
          ) {

            clickRemoveAll(
              '[Notify][Private=ON]'
            );

          } else if (
            !clickNotifyOnce(
              '[Notify][Private=OFF]'
            )
          ) {

            fallbackSelectAll();
          }
        }
      );

      checkbox._sdPrivateListenerAttached =
        true;
    }

    function findPrivateCheckboxAndPrepare() {

      const checkbox =
        getPrivateCheckbox();

      if (!checkbox) {
        return false;
      }

      attachPrivateChangeListener(
        checkbox
      );

      /*
        Normalise the initial state ONCE per checkbox element.
        The old code did this on every DOM mutation for 30 seconds,
        which un-checked the box each time the user ticked it
        (Remove All mutates the DOM), making it look frozen.
      */

      if (
        !checkbox._sdPrepared
      ) {

        checkbox._sdPrepared =
          true;

        if (
          checkbox.checked &&
          !privateUserTouched
        ) {

          suppressPrivateHandler =
            true;

          checkbox.checked =
            false;

          checkbox.dispatchEvent(
            new Event(
              'change',
              {
                bubbles: true
              }
            )
          );

          suppressPrivateHandler =
            false;
        }
      }

      return true;
    }

    function initUpdateHandlers() {

      trackPrivateInteraction();

      findPrivateCheckboxAndPrepare();

      runNotifyWithRetries();

      const observer =
        new MutationObserver(
          findPrivateCheckboxAndPrepare
        );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

      setTimeout(
        () =>
          observer.disconnect(),
        30000
      );
    }

    if (
      document.readyState ===
      'loading'
    ) {

      document.addEventListener(
        'DOMContentLoaded',
        initUpdateHandlers,
        { once: true }
      );

    } else {

      initUpdateHandlers();
    }

    window.SD =
      Object.assign(
        window.SD || {},
        {

          clickNotifyAll:
            () =>
              runNotifyWithRetries(
                2000,
                250
              ),

          removeAllNotify:
            () =>
              clickRemoveAll(
                '[Notify][Manual]'
              ),

          where:
            () => ({
              isMainPage,
              isUpdate,
              isDetails,
              PATH,
              HERE
            })
        }
      );
  }

  // =========================================================
  // C) MAIN PAGE
  // =========================================================

  if (isMainPage) {

    // =======================================================
    // CONFIGURATION
    // =======================================================

    const CONFIG = {

      // Status requests.
      statusConcurrency: 8,

      // Activity/feed requests.
      activityConcurrency: 6,

      // Successful status cache.
      statusCacheMs:
        5 * 60 * 1000,

      // Short feed cache to handle DOM redraws.
      activityCacheMs:
        30 * 1000,

      // User requested five-minute feed refresh.
      activityRefreshMs:
        5 * 60 * 1000,

      // Network timeouts.
      statusTimeoutMs:
        15000,

      activityTimeoutMs:
        8000,

      // Saved activity baseline.
      seenStorageKey:
        'sdScript.activitySeen.v1',

      // Saved status cache.
      statusStorageKey:
        'sdScript.statusCache.v1'
    };

    // =======================================================
    // STATE
    // =======================================================

    const statusCache =
      new Map();

    const activityCache =
      Object.create(null);

    const statusQueue = [];
    const activityQueue = [];

    const queuedStatus =
      new Set();

    const queuedActivity =
      new Set();

    const visibleTickets =
      new Set();

    let activeStatus =
      0;

    let activeActivity =
      0;

    let lastTable =
      null;

    let tableObserver =
      null;

    let tableMonitorTimer =
      null;

    let pageSignature =
      '';

    let pageGeneration =
      0;

    let scanTimer =
      0;

    let internalMutation =
      false;

    let lastRepairAt =
      0;

    /*
      Native (pre-script) column index of "Due". Remembered so rows
      that TDX re-renders after the Due header is already gone
      (every page switch) can still have their Due cell removed.
    */
    let dueNativeIndex =
      -1;

    let seen = {};

    // =======================================================
    // LOAD PERSISTED STATUS CACHE
    // =======================================================

    try {

      const stored =
        JSON.parse(
          sessionStorage.getItem(
            CONFIG.statusStorageKey
          ) || '{}'
        ) || {};

      const now =
        Date.now();

      Object.entries(
        stored
      ).forEach(
        ([id, value]) => {

          if (
            value &&
            value.status &&
            Number(
              value.timestamp
            ) &&
            now -
              Number(
                value.timestamp
              ) <
              CONFIG.statusCacheMs
          ) {

            statusCache.set(
              id,
              value
            );
          }
        }
      );

    } catch {}

    function saveStatusCache() {

      try {

        const stored = {};
        const now =
          Date.now();

        for (
          const [id, value]
            of statusCache
        ) {

          if (
            value &&
            now -
              Number(
                value.timestamp ||
                0
              ) <
              CONFIG.statusCacheMs
          ) {

            stored[id] =
              value;
          }
        }

        sessionStorage.setItem(
          CONFIG.statusStorageKey,
          JSON.stringify(
            stored
          )
        );

      } catch {}
    }

    // =======================================================
    // LOAD ACTIVITY BASELINES
    // =======================================================

    try {

      seen =
        JSON.parse(
          localStorage.getItem(
            CONFIG.seenStorageKey
          ) || '{}'
        ) || {};

    } catch {

      seen = {};
    }

    function saveSeen() {

      try {

        const keys =
          Object.keys(
            seen
          );

        /*
          Prevent endless growth.
        */

        if (
          keys.length > 3000
        ) {

          keys.sort(
            (a, b) =>
              (
                seen[a].savedAt ||
                0
              ) -
              (
                seen[b].savedAt ||
                0
              )
          );

          keys
            .slice(
              0,
              keys.length - 3000
            )
            .forEach(
              id =>
                delete seen[id]
            );
        }

        localStorage.setItem(
          CONFIG.seenStorageKey,
          JSON.stringify(
            seen
          )
        );

      } catch {}
    }

    // =======================================================
    // STYLES
    // =======================================================

    function addMainStyles() {

      if (
        q(
          '#tdx-main-enhancement-styles'
        )
      ) {
        return;
      }

      const style =
        document.createElement(
          'style'
        );

      style.id =
        'tdx-main-enhancement-styles';

      style.textContent = `
        .tdx-status-header {
          font-weight: 600;
          white-space: nowrap;
        }

        .tdx-status-cell {
          white-space: nowrap;
          min-width: 105px;
          font-weight: 500;
        }

        .tdx-status-badge {
          display: inline-block;
          padding: 4px 9px;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.2;
          white-space: nowrap;
        }

        .tdx-status-new {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .tdx-status-inprocess {
          background: #e3f2fd;
          color: #1565c0;
        }

        .tdx-status-other {
          background: #f3f3f3;
          color: #444;
        }

        .tdx-status-loading {
          opacity: 0.55;
          font-size: 12px;
        }

        .tdx-status-error {
          opacity: 0.55;
          color: #777;
          font-size: 12px;
        }

        .sd-feed-cell {
          white-space: nowrap;
          vertical-align: middle;
          font: inherit;
        }

        .sd-feed-click {
          cursor: pointer;
        }

        .sd-feed-loading {
          opacity: 0.7;
        }

        .sd-feed-new {
          font-weight: 600;
        }
      `;

      document.head.appendChild(
        style
      );
    }

    // =======================================================
    // TICKET ID / LINK
    // =======================================================

    function getTicketId(
      row
    ) {

      for (
        const link of
          qa(
            'a[href]',
            row
          )
      ) {

        try {

          const url =
            new URL(
              link.href,
              location.origin
            );

          const id =
            url.searchParams.get(
              'TicketID'
            ) ||
            url.searchParams.get(
              'ticketId'
            ) ||
            url.searchParams.get(
              'id'
            );

          if (
            /^\d{5,10}$/.test(
              id || ''
            )
          ) {

            return id;
          }

        } catch {}
      }

      return (
        clean(
          q(
            'td',
            row
          )?.textContent
        ).match(
          /\b\d{5,10}\b/
        )?.[0] ||
        ''
      );
    }

    function getTicketLink(
      row
    ) {

      return qa(
        'a[href]',
        row
      ).find(
        link =>
          /^\d{5,10}$/.test(
            clean(
              link.textContent
            )
          )
      ) || null;
    }

    // =======================================================
    // UNCLAIMED TABLE DETECTION
    // =======================================================

    function tableHasTickets(
      table
    ) {

      return (
        !!q(
          'tbody',
          table
        ) &&
        qa(
          'tbody tr',
          table
        ).some(
          row =>
            !!getTicketId(row)
        )
      );
    }

    function tableLooksUnclaimed(
      table
    ) {

      let node =
        table.parentElement;

      for (
        let depth = 0;
        node && depth < 8;
        depth++,
        node =
          node.parentElement
      ) {

        const previous =
          table.previousElementSibling;

        if (
          previous &&
          /\bunclaimed\b/i.test(
            clean(
              previous.textContent
            )
          )
        ) {

          return true;
        }

        for (
          const child of
            Array.from(
              node.children || []
            )
        ) {

          if (
            child === table ||
            child.contains(table)
          ) {
            continue;
          }

          const value =
            clean(
              child.textContent
            );

          if (
            /^unclaimed$/i.test(
              value
            ) ||
            /\bunclaimed tickets\b/i.test(
              value
            )
          ) {

            return true;
          }
        }
      }

      return false;
    }

    function findUnclaimedTable() {

      const tables =
        qa('table')
          .filter(
            tableHasTickets
          );

      const match =
        tables.find(
          tableLooksUnclaimed
        );

      if (match) {
        return match;
      }

      const headings =
        qa(
          'h1,h2,h3,h4,h5,h6,' +
          '.panel-title,' +
          '.card-title,' +
          '[role="heading"]'
        )
          .filter(
            heading =>
              /\bunclaimed\b/i.test(
                clean(
                  heading.textContent
                )
              )
          );

      for (
        const heading of
          headings
      ) {

        let node =
          heading;

        for (
          let depth = 0;
          node &&
          depth < 6;
          depth++,
          node =
            node.parentElement
        ) {

          const candidate =
            qa(
              'table',
              node
            ).find(
              tableHasTickets
            );

          if (candidate) {
            return candidate;
          }
        }
      }

      return null;
    }

    // =======================================================
    // REMOVE DUE
    // =======================================================

    const isCustomColumn =
      element =>
        !!element.dataset.sdFeed ||
        element.classList.contains(
          'tdx-status-header'
        ) ||
        element.classList.contains(
          'tdx-status-cell'
        );

    // Cells/headers that belong to TDX (not added by this script).
    const nativeColumns =
      row =>
        Array.from(
          row.children
        ).filter(
          element =>
            (
              element.tagName ===
                'TH' ||
              element.tagName ===
                'TD'
            ) &&
            !isCustomColumn(
              element
            )
        );

    function removeDueColumn(
      table
    ) {

      const headerRow =
        q(
          'thead tr',
          table
        );

      if (!headerRow) {
        return;
      }

      let headers =
        nativeColumns(
          headerRow
        );

      const dueHeader =
        headers.find(
          header =>
            header.getAttribute(
              'data-field'
            ) ===
              'DueDate' ||
            clean(
              header.getAttribute(
                'data-title'
              )
            ).toLowerCase() ===
              'due'
        );

      if (dueHeader) {

        dueNativeIndex =
          headers.indexOf(
            dueHeader
          );

        dueHeader.remove();

        headers =
          nativeColumns(
            headerRow
          );
      }

      if (
        dueNativeIndex < 0
      ) {
        return;
      }

      /*
        Header and body are reconciled independently.
        TDX re-renders the body on every page change (Due cell
        comes back) while the header we already trimmed stays.
        Any row with more native cells than the header still has
        its Due cell, so remove it by the remembered index.
        Rows that already match are never touched, which also
        protects against removing a wrong column if TDX rebuilds
        only the header.
      */

      const expected =
        headers.length;

      qa(
        'tbody tr',
        table
      ).forEach(
        row => {

          if (
            !getTicketId(row)
          ) {
            return;
          }

          const cells =
            nativeColumns(
              row
            );

          if (
            cells.length >
              expected &&
            cells[
              dueNativeIndex
            ]
          ) {

            cells[
              dueNativeIndex
            ].remove();
          }
        }
      );
    }

    // Keep STATUS right after the first column and ACTIVITY last,
    // identically for the header row and every body row.
    function placeCustomColumns(
      row,
      statusSelector
    ) {

      const status =
        q(
          statusSelector,
          row
        );

      const feed =
        q(
          '[data-sd-feed="1"]',
          row
        );

      if (
        status &&
        row.children[1] !==
          status
      ) {

        row.insertBefore(
          status,
          row.children[1] ||
            null
        );
      }

      if (
        feed &&
        row.lastElementChild !==
          feed
      ) {

        row.appendChild(
          feed
        );
      }
    }

    // True when header/body structure has drifted from what
    // processTable guarantees (used by the monitor to self-heal).
    function columnsMisaligned(
      table
    ) {

      const headerRow =
        q(
          'thead tr',
          table
        );

      if (!headerRow) {
        return false;
      }

      const statusHeader =
        q(
          '.tdx-status-header',
          headerRow
        );

      const feedHeader =
        q(
          '[data-sd-feed="1"]',
          headerRow
        );

      if (
        !statusHeader ||
        !feedHeader ||
        headerRow.children[1] !==
          statusHeader ||
        headerRow.lastElementChild !==
          feedHeader
      ) {
        return true;
      }

      const expected =
        nativeColumns(
          headerRow
        ).length;

      return qa(
        'tbody tr',
        table
      ).some(
        row => {

          if (
            !getTicketId(row)
          ) {
            return false;
          }

          const status =
            q(
              '.tdx-status-cell',
              row
            );

          const feed =
            q(
              '[data-sd-feed="1"]',
              row
            );

          return (
            !status ||
            !feed ||
            row.children[1] !==
              status ||
            row.lastElementChild !==
              feed ||
            nativeColumns(
              row
            ).length !==
              expected
          );
        }
      );
    }

    // =======================================================
    // STATUS
    // Working status extraction preserved,
    // with faster/cached queue management.
    // =======================================================

    function cleanStatus(
      value
    ) {

      if (!value) {
        return null;
      }

      return String(value)
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .replace(
          /^[:\-|]\s*/,
          ''
        ) || null;
    }

    function extractStatus(
      doc
    ) {

      const possibleLabels =
        Array.from(
          doc.querySelectorAll(
            'label, th, dt, div, span, td'
          )
        );

      for (
        const element of
          possibleLabels
      ) {

        const text =
          element.textContent.trim();

        if (
          text !==
          'Status'
        ) {
          continue;
        }

        const sibling =
          element.nextElementSibling;

        if (sibling) {

          const value =
            sibling.textContent.trim();

          if (
            value &&
            value !==
              'Status'
          ) {

            return cleanStatus(
              value
            );
          }
        }

        const parent =
          element.parentElement;

        if (parent) {

          const children =
            Array.from(
              parent.children
            );

          const index =
            children.indexOf(
              element
            );

          if (
            index >= 0 &&
            children[
              index + 1
            ]
          ) {

            const value =
              children[
                index + 1
              ].textContent.trim();

            if (
              value &&
              value !==
                'Status'
            ) {

              return cleanStatus(
                value
              );
            }
          }
        }
      }

      const knownStatuses = [
        'New',
        'In Process',
        'In Progress',
        'Open',
        'Assigned',
        'On Hold',
        'Resolved',
        'Closed',
        'Cancelled',
        'Canceled',
        'Pending',
        'Waiting on User Response'
      ];

      const candidates =
        doc.querySelectorAll(
          '[class*="status"],' +
          '[class*="Status"],' +
          '[class*="badge"],' +
          '[class*="Badge"]'
        );

      for (
        const element of
          candidates
      ) {

        const value =
          cleanStatus(
            element.textContent
          );

        if (
          knownStatuses.includes(
            value
          )
        ) {

          return value;
        }
      }

      const bodyText =
        doc.body
          ? doc.body.innerText
          : '';

      const regexes = [
        /Status\s*[\r\n:]+\s*(New|In Process|In Progress|Open|Assigned|On Hold|Resolved|Closed|Cancelled|Canceled|Pending)/i,
        /Status\s+(New|In Process|In Progress|Open|Assigned|On Hold|Resolved|Closed|Cancelled|Canceled|Pending)/i
      ];

      for (
        const regex of
          regexes
      ) {

        const match =
          bodyText.match(
            regex
          );

        if (match) {
          return cleanStatus(
            match[1]
          );
        }
      }

      return null;
    }

    function fetchTicketPage(
      url
    ) {

      return new Promise(
        (resolve, reject) => {

          let settled =
            false;

          const finish =
            (
              callback,
              value
            ) => {

              if (settled) {
                return;
              }

              settled =
                true;

              callback(
                value
              );
            };

          GM_xmlhttpRequest({
            method:
              'GET',

            url,

            headers: {
              Accept:
                'text/html'
            },

            timeout:
              CONFIG.statusTimeoutMs,

            onload:
              response => {

                if (
                  response.status <
                    200 ||
                  response.status >=
                    400
                ) {

                  finish(
                    reject,
                    new Error(
                      `HTTP ${response.status}`
                    )
                  );

                  return;
                }

                finish(
                  resolve,
                  response.responseText
                );
              },

            onerror:
              () =>
                finish(
                  reject,
                  new Error(
                    'Status request failed'
                  )
                ),

            ontimeout:
              () =>
                finish(
                  reject,
                  new Error(
                    'Status request timed out'
                  )
                )
          });
        }
      );
    }

    async function getTicketStatus(
      id,
      url
    ) {

      const cached =
        statusCache.get(
          id
        );

      if (
        cached &&
        Date.now() -
          cached.timestamp <
          CONFIG.statusCacheMs
      ) {

        return cached.status;
      }

      try {

        const html =
          await fetchTicketPage(
            url
          );

        const parser =
          new DOMParser();

        const doc =
          parser.parseFromString(
            html,
            'text/html'
          );

        const status =
          extractStatus(
            doc
          ) ||
          'Unknown';

        statusCache.set(
          id,
          {
            status,
            timestamp:
              Date.now()
          }
        );

        saveStatusCache();

        return status;

      } catch (error) {

        warn(
          `[Status ${id}]`,
          error
        );

        /*
          Error values are intentionally cached
          briefly enough that a temporary request
          failure can recover without waiting 5 minutes.
        */

        statusCache.set(
          id,
          {
            status:
              'Unknown',

            timestamp:
              Date.now(),

            error:
              true
          }
        );

        saveStatusCache();

        return 'Unknown';
      }
    }

    function getStatusClass(
      status
    ) {

      const normalized =
        clean(
          status
        )
          .toLowerCase()
          .replace(
            /\s+/g,
            ' '
          );

      if (
        normalized ===
        'new'
      ) {

        return 'tdx-status-new';
      }

      if (
        normalized ===
          'in process' ||
        normalized ===
          'in progress'
      ) {

        return 'tdx-status-inprocess';
      }

      return 'tdx-status-other';
    }

    function ensureStatusHeader(
      table
    ) {

      const headerRow =
        q(
          'thead tr',
          table
        );

      if (!headerRow) {
        return null;
      }

      let header =
        q(
          '.tdx-status-header',
          headerRow
        );

      if (header) {
        return header;
      }

      header =
        document.createElement(
          'th'
        );

      header.className =
        'tdx-status-header';

      header.textContent =
        'STATUS';

      header.title =
        'Current ticket status';

      if (
        headerRow.children[1]
      ) {

        headerRow.insertBefore(
          header,
          headerRow.children[1]
        );

      } else {

        headerRow.appendChild(
          header
        );
      }

      return header;
    }

    function ensureStatusCell(
      row
    ) {

      let cell =
        q(
          '.tdx-status-cell',
          row
        );

      if (cell) {
        return cell;
      }

      cell =
        document.createElement(
          'td'
        );

      cell.className =
        'tdx-status-cell';

      cell.innerHTML =
        '<span class="tdx-status-loading">Loading...</span>';

      if (
        row.children[1]
      ) {

        row.insertBefore(
          cell,
          row.children[1]
        );

      } else {

        row.appendChild(
          cell
        );
      }

      return cell;
    }

    function renderStatus(
      ticket,
      status
    ) {

      const table =
        lastTable;

      if (!table) {
        return;
      }

      const row =
        qa(
          'tbody tr',
          table
        )
          .find(
            candidate =>
              getTicketId(
                candidate
              ) ===
                String(ticket)
          );

      if (!row) {
        return;
      }

      const cell =
        ensureStatusCell(
          row
        );

      cell.innerHTML =
        '';

      const badge =
        document.createElement(
          'span'
        );

      badge.className =
        `tdx-status-badge ${
          getStatusClass(
            status
          )
        }`;

      if (
        status ===
        'Unknown'
      ) {

        badge.classList.add(
          'tdx-status-error'
        );
      }

      badge.textContent =
        status;

      cell.appendChild(
        badge
      );
    }

    function enqueueStatus(
      ticket,
      url
    ) {

      if (
        !ticket ||
        !url ||
        queuedStatus.has(
          ticket
        )
      ) {
        return;
      }

      const cached =
        statusCache.get(
          ticket
        );

      if (
        cached &&
        Date.now() -
          cached.timestamp <
          CONFIG.statusCacheMs
      ) {

        renderStatus(
          ticket,
          cached.status
        );

        /*
          Retry errors sooner than successful cache
          entries.
        */

        if (
          cached.error
        ) {

          statusCache.delete(
            ticket
          );

        } else {

          return;
        }
      }

      queuedStatus.add(
        ticket
      );

      statusQueue.push({
        ticket,
        url
      });

      pumpStatusQueue();
    }

    function pumpStatusQueue() {

      while (
        activeStatus <
          CONFIG.statusConcurrency &&
        statusQueue.length
      ) {

        const job =
          statusQueue.shift();

        queuedStatus.delete(
          job.ticket
        );

        /*
          Status requests are useful even if the user
          moved pages while they were running, so don't
          cancel completed work simply because generation
          changed. The result is cached and can immediately
          populate the ticket if it comes back into view.
        */

        if (
          !visibleTickets.has(
            job.ticket
          )
        ) {
          continue;
        }

        activeStatus++;

        getTicketStatus(
          job.ticket,
          job.url
        )
          .then(
            status => {

              if (
                visibleTickets.has(
                  job.ticket
                )
              ) {

                renderStatus(
                  job.ticket,
                  status
                );
              }
            }
          )
          .finally(
            () => {

              activeStatus--;

              pumpStatusQueue();
            }
          );
      }
    }

    // =======================================================
    // ACTIVITY
    // =======================================================

    function isCommunication(
      entry
    ) {

      const value =
        entry?.isCommunication;

      return (
        value === true ||
        value === 1 ||
        value === '1' ||
        String(value)
          .toLowerCase() ===
          'true'
      );
    }

    function latestFeed(
      entries
    ) {

      if (
        !Array.isArray(
          entries
        ) ||
        !entries.length
      ) {

        return null;
      }

      const valid =
        entries
          .filter(
            entry =>
              entry &&
              Number(
                entry.createdDateUtc ||
                0
              ) > 0
          )
          .sort(
            (a, b) =>
              Number(
                b.createdDateUtc
              ) -
              Number(
                a.createdDateUtc
              )
          );

      if (!valid.length) {
        return null;
      }

      return (
        valid.find(
          isCommunication
        ) ||
        valid[0]
      );
    }

    function feedSignature(
      entry
    ) {

      if (!entry) {
        return '';
      }

      /*
        Entry ID + creation timestamp define the
        communication. We intentionally do not use
        modifiedDateUtc here so an edit to an existing
        entry doesn't look like a brand-new message.
      */

      return (
        `${entry.id || ''}:` +
        `${entry.createdDateUtc || ''}`
      );
    }

    function activityAge(
      value
    ) {

      const ms =
        Number(value);

      if (
        !Number.isFinite(ms) ||
        ms <= 0
      ) {

        return '—';
      }

      const seconds =
        Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              ms
            ) /
            1000
          )
        );

      if (
        seconds < 60
      ) {

        return `${seconds}s`;
      }

      const minutes =
        Math.floor(
          seconds /
          60
        );

      if (
        minutes < 60
      ) {

        return `${minutes}m`;
      }

      const hours =
        Math.floor(
          minutes /
          60
        );

      if (
        hours < 24
      ) {

        return `${hours}h`;
      }

      const days =
        Math.floor(
          hours /
          24
        );

      if (
        days < 7
      ) {

        return `${days}d`;
      }

      const weeks =
        Math.floor(
          days /
          7
        );

      return (
        weeks < 8
          ? `${weeks}w`
          : new Date(
              ms
            ).toLocaleDateString()
      );
    }

    function feedPreview(
      entry
    ) {

      if (
        !entry?.bodyHtml
      ) {
        return '';
      }

      const div =
        document.createElement(
          'div'
        );

      div.innerHTML =
        entry.bodyHtml;

      return clean(
        div.textContent
      ).slice(
        0,
        500
      );
    }

    function ensureActivityHeader(
      table
    ) {

      const headerRow =
        q(
          'thead tr',
          table
        );

      if (!headerRow) {
        return null;
      }

      let header =
        q(
          '[data-sd-feed="1"]',
          headerRow
        );

      if (header) {
        return header;
      }

      header =
        document.createElement(
          'th'
        );

      header.dataset.sdFeed =
        '1';

      header.className =
        'sd-feed-cell';

      header.textContent =
        'Activity';

      header.title =
        'Latest ticket communication';

      headerRow.appendChild(
        header
      );

      return header;
    }

    function ensureActivityCell(
      row
    ) {

      let cell =
        q(
          '[data-sd-feed="1"]',
          row
        );

      if (cell) {
        return cell;
      }

      cell =
        document.createElement(
          'td'
        );

      cell.dataset.sdFeed =
        '1';

      cell.className =
        'sd-feed-cell sd-feed-loading';

      cell.textContent =
        'Loading...';

      row.appendChild(
        cell
      );

      return cell;
    }

    function renderActivity(
      ticket,
      result
    ) {

      const table =
        lastTable;

      if (!table) {
        return;
      }

      const row =
        qa(
          'tbody tr',
          table
        )
          .find(
            candidate =>
              getTicketId(
                candidate
              ) ===
                String(ticket)
          );

      if (!row) {
        return;
      }

      const cell =
        ensureActivityCell(
          row
        );

      cell.classList.remove(
        'sd-feed-loading',
        'sd-feed-new'
      );

      cell.title =
        '';

      if (
        result.status ===
          'loading'
      ) {

        cell.textContent =
          'Loading...';

        cell.classList.add(
          'sd-feed-loading'
        );

        return;
      }

      if (
        result.status ===
          'error'
      ) {

        cell.textContent =
          '—';

        cell.title =
          'Feed request failed; it will retry in 5 minutes.';

        return;
      }

      const entry =
        result.entry;

      if (!entry) {

        cell.textContent =
          '—';

        cell.title =
          'No feed entries were returned.';

        return;
      }

      const signature =
        feedSignature(
          entry
        );

      let prior =
        seen[ticket];

      /*
        FIRST successful observation establishes
        the baseline.

        Future newer entries will then show NEW.
      */

      if (!prior) {

        prior =
          seen[ticket] = {
            signature,

            createdDateUtc:
              Number(
                entry.createdDateUtc ||
                0
              ),

            savedAt:
              Date.now()
          };

        saveSeen();
      }

      const isNew =
        !!prior &&
        signature !==
          prior.signature &&
        Number(
          entry.createdDateUtc ||
          0
        ) >=
          Number(
            prior.createdDateUtc ||
            0
          );

      cell.textContent =
        `${
          isNew
            ? 'NEW · '
            : ''
        }${
          activityAge(
            entry.createdDateUtc
          )
        }`;

      if (isNew) {
        cell.classList.add(
          'sd-feed-new'
        );
      }

      const date =
        new Date(
          Number(
            entry.createdDateUtc
          )
        );

      const exact =
        Number.isNaN(
          date.getTime()
        )
          ? 'Unknown time'
          : date.toLocaleString();

      cell.title =
        `${
          isCommunication(entry)
            ? 'Communication'
            : 'Feed activity'
        }: ${exact}\n` +
        `${
          feedPreview(entry) ||
          '(no text)'
        }\n` +
        'Click to mark as seen.';

      if (
        !cell._sdFeedAttached
      ) {

        cell.addEventListener(
          'click',
          () =>
            markActivitySeen(
              ticket
            )
        );

        cell._sdFeedAttached =
          true;
      }
    }

    function markActivitySeen(
      ticket
    ) {

      const result =
        activityCache[
          ticket
        ];

      if (
        !result?.entry
      ) {
        return;
      }

      const entry =
        result.entry;

      seen[ticket] = {

        signature:
          feedSignature(
            entry
          ),

        createdDateUtc:
          Number(
            entry.createdDateUtc ||
            0
          ),

        savedAt:
          Date.now()
      };

      saveSeen();

      renderActivity(
        ticket,
        result
      );
    }

    function requestFeed(
      ticket
    ) {

      return new Promise(
        (resolve, reject) => {

          let finished =
            false;

          let timer =
            0;

          const finish =
            (
              callback,
              value
            ) => {

              if (finished) {
                return;
              }

              finished =
                true;

              if (timer) {
                clearTimeout(
                  timer
                );
              }

              callback(
                value
              );
            };

          timer =
            setTimeout(
              () =>
                finish(
                  reject,
                  new Error(
                    'Feed request timeout'
                  )
                ),
              CONFIG.activityTimeoutMs
            );

          const data = {
            dateTo: '',
            dateFrom: '',
            replyCount: 3,
            returnCount: 25,
            includePrivate: true,
            projectId: '',
            parentId: '',
            appId: 278,
            componentId: 9,
            shortcutIds: '',
            itemId:
              Number(ticket),
            personUid: '',
            flags: '',
            splitType: 0
          };

          if (
            window.jQuery &&
            typeof window.jQuery.ajax ===
              'function'
          ) {

            window.jQuery.ajax({
              url:
                '/TDNext/Apps/Feed/Search?breadcrumbsDetail=1',

              method:
                'POST',

              type:
                'POST',

              data,

              dataType:
                'json',

              processData:
                true,

              contentType:
                'application/x-www-form-urlencoded; charset=UTF-8',

              cache:
                false,

              headers: {
                'X-Requested-With':
                  'XMLHttpRequest'
              },

              success:
                response =>
                  finish(
                    resolve,
                    response
                  ),

              error:
                (
                  xhr,
                  status,
                  error
                ) =>
                  finish(
                    reject,
                    new Error(
                      `Feed request failed: ${
                        status ||
                        error ||
                        xhr?.status ||
                        'unknown'
                      }`
                    )
                  )
            });

            return;
          }

          const body =
            new URLSearchParams();

          Object.entries(
            data
          ).forEach(
            ([key, value]) =>
              body.append(
                key,
                value == null
                  ? ''
                  : String(value)
              )
          );

          fetch(
            '/TDNext/Apps/Feed/Search?breadcrumbsDetail=1',
            {
              method:
                'POST',

              credentials:
                'same-origin',

              headers: {
                'Content-Type':
                  'application/x-www-form-urlencoded; charset=UTF-8'
              },

              body:
                body.toString()
            }
          )
            .then(
              response => {

                if (
                  !response.ok
                ) {

                  throw new Error(
                    `HTTP ${response.status}`
                  );
                }

                return response.json();
              }
            )
            .then(
              response =>
                finish(
                  resolve,
                  response
                )
            )
            .catch(
              error =>
                finish(
                  reject,
                  error
                )
            );
        }
      );
    }

    function enqueueActivity(
      ticket
    ) {

      if (
        !ticket ||
        queuedActivity.has(
          ticket
        )
      ) {
        return;
      }

      if (
        activityCache[ticket]
          ?.status ===
          'loading'
      ) {
        return;
      }

      const cached =
        activityCache[ticket];

      if (
        cached?.status ===
          'ready' &&
        Date.now() -
          Number(
            cached.checkedAt ||
            0
          ) <
          CONFIG.activityCacheMs
      ) {

        renderActivity(
          ticket,
          cached
        );

        return;
      }

      queuedActivity.add(
        ticket
      );

      activityQueue.push({
        ticket,
        generation:
          pageGeneration
      });

      pumpActivityQueue();
    }

    function pumpActivityQueue() {

      while (
        activeActivity <
          CONFIG.activityConcurrency &&
        activityQueue.length
      ) {

        const job =
          activityQueue.shift();

        queuedActivity.delete(
          job.ticket
        );

        if (
          !visibleTickets.has(
            job.ticket
          )
        ) {
          continue;
        }

        activeActivity++;

        activityCache[
          job.ticket
        ] = {
          status:
            'loading'
        };

        renderActivity(
          job.ticket,
          activityCache[
            job.ticket
          ]
        );

        requestFeed(
          job.ticket
        )
          .then(
            response => {

              /*
                IMPORTANT:
                Always retain a completed result
                even if the user has already changed
                pages. This prevents useful work from
                being thrown away.
              */

              activityCache[
                job.ticket
              ] = {
                status:
                  'ready',

                entry:
                  latestFeed(
                    response?.entries
                  ),

                totalCount:
                  Number(
                    response?.totalCount ||
                    0
                  ),

                checkedAt:
                  Date.now()
              };

              if (
                visibleTickets.has(
                  job.ticket
                )
              ) {

                renderActivity(
                  job.ticket,
                  activityCache[
                    job.ticket
                  ]
                );
              }
            }
          )
          .catch(
            error => {

              warn(
                `[Activity ${job.ticket}]`,
                error
              );

              activityCache[
                job.ticket
              ] = {
                status:
                  'error',

                checkedAt:
                  Date.now()
              };

              if (
                visibleTickets.has(
                  job.ticket
                )
              ) {

                renderActivity(
                  job.ticket,
                  activityCache[
                    job.ticket
                  ]
                );
              }
            }
          )
          .finally(
            () => {

              activeActivity--;

              pumpActivityQueue();
            }
          );
      }
    }

    // =======================================================
    // TABLE PROCESSOR
    // =======================================================

    function processTable(
      table,
      forceActivity =
        false
    ) {

      if (!table) {
        return;
      }

      lastTable =
        table;

      internalMutation =
        true;

      try {

        removeDueColumn(
          table
        );

        ensureStatusHeader(
          table
        );

        ensureActivityHeader(
          table
        );

        const earlyHeaderRow =
          q(
            'thead tr',
            table
          );

        if (earlyHeaderRow) {

          placeCustomColumns(
            earlyHeaderRow,
            '.tdx-status-header'
          );
        }

      } finally {

        setTimeout(
          () => {
            internalMutation =
              false;
          },
          0
        );
      }

      const rows =
        qa(
          'tbody tr',
          table
        )
          .filter(
            row =>
              !!getTicketId(row)
          );

      const ids =
        rows
          .map(
            getTicketId
          )
          .filter(Boolean);

      const currentSignature =
        ids.join('|');

      const pageChanged =
        currentSignature !==
        pageSignature;

      if (
        pageChanged
      ) {

        pageSignature =
          currentSignature;

        pageGeneration++;

        /*
          Drop queued work for the old page.
          Already-running requests remain useful and
          will populate caches when they finish.
        */

        statusQueue.splice(
          0,
          statusQueue.length
        );

        activityQueue.splice(
          0,
          activityQueue.length
        );

        queuedStatus.clear();
        queuedActivity.clear();

        visibleTickets.clear();

        ids.forEach(
          id =>
            visibleTickets.add(
              id
            )
        );
      }

      if (
        forceActivity
      ) {

        ids.forEach(
          id => {

            visibleTickets.add(
              id
            );

            if (
              activityCache[id]
            ) {

              activityCache[id]
                .checkedAt =
                  0;
            }
          }
        );
      }

      // -------------------------------------------------------
      // Current page rows
      // -------------------------------------------------------

      for (
        const row of
          rows
      ) {

        const ticket =
          getTicketId(
            row
          );

        if (!ticket) {
          continue;
        }

        const link =
          getTicketLink(
            row
          );

        const ticketUrl =
          link?.href ||
          (
            `/TDNext/Apps/278/Tickets/TicketDet.aspx?TicketID=${
              encodeURIComponent(
                ticket
              )
            }`
          );

        // -----------------------------------------------------
        // STATUS
        // -----------------------------------------------------

        const statusCell =
          ensureStatusCell(
            row
          );

        const cachedStatus =
          statusCache.get(
            ticket
          );

        /*
          Cached status is rendered immediately.
          This is what makes moving back to a page
          substantially faster.
        */

        if (
          cachedStatus &&
          Date.now() -
            cachedStatus.timestamp <
            CONFIG.statusCacheMs &&
          !cachedStatus.error
        ) {

          renderStatus(
            ticket,
            cachedStatus.status
          );

        } else {

          statusCell.innerHTML =
            '<span class="tdx-status-loading">Loading...</span>';

          enqueueStatus(
            ticket,
            ticketUrl
          );
        }

        // -----------------------------------------------------
        // ACTIVITY
        // -----------------------------------------------------

        const activityCell =
          ensureActivityCell(
            row
          );

        /*
          STATUS cell goes right after the first column and the
          ACTIVITY cell stays last - exactly where the headers
          are placed. (The old code moved STATUS next to ACTIVITY
          here while the STATUS header sat after ID, so header and
          body columns disagreed.)
        */

        placeCustomColumns(
          row,
          '.tdx-status-cell'
        );

        const cachedActivity =
          activityCache[
            ticket
          ];

        if (
          cachedActivity?.status ===
            'ready' &&
          !forceActivity &&
          Date.now() -
            Number(
              cachedActivity.checkedAt ||
              0
            ) <
            CONFIG.activityCacheMs
        ) {

          renderActivity(
            ticket,
            cachedActivity
          );

        } else {

          renderActivity(
            ticket,
            {
              status:
                'loading'
            }
          );

          enqueueActivity(
            ticket
          );
        }
      }

      // -------------------------------------------------------
      // HEADER ORDER
      // -------------------------------------------------------

      const headerRow =
        q(
          'thead tr',
          table
        );

      if (headerRow) {

        placeCustomColumns(
          headerRow,
          '.tdx-status-header'
        );
      }

      pumpStatusQueue();
      pumpActivityQueue();
    }

    // =======================================================
    // DEBOUNCED SCAN
    // =======================================================

    function scheduleScan(
      delay = 75,
      forceActivity = false
    ) {

      clearTimeout(
        scanTimer
      );

      scanTimer =
        setTimeout(
          () => {

            scanTimer =
              0;

            processTable(
              findUnclaimedTable(),
              forceActivity
            );

          },
          delay
        );
    }

    // =======================================================
    // TABLE OBSERVER
    // =======================================================

    function attachTableObserver() {

      if (tableObserver) {

        tableObserver.disconnect();

        tableObserver =
          null;
      }

      const table =
        findUnclaimedTable();

      if (!table) {
        return;
      }

      lastTable =
        table;

      tableObserver =
        new MutationObserver(
          mutations => {

            if (
              internalMutation
            ) {
              return;
            }

            let relevant =
              false;

            for (
              const mutation of
                mutations
            ) {

              if (
                mutation.type !==
                'childList'
              ) {
                continue;
              }

              const target =
                mutation.target;

              /*
                Ignore mutations produced by
                our custom cells.
              */

              if (
                target.closest?.(
                  '.tdx-status-cell,' +
                  '.tdx-status-header,' +
                  '[data-sd-feed="1"]'
                )
              ) {
                continue;
              }

              relevant =
                true;

              break;
            }

            if (relevant) {

              scheduleScan(
                40
              );
            }
          }
        );

      tableObserver.observe(
        table,
        {
          childList:
            true,

          subtree:
            true
        }
      );
    }

    // =======================================================
    // INITIALIZATION
    // =======================================================

    function initMain() {

      addMainStyles();

      const table =
        findUnclaimedTable();

      if (table) {

        processTable(
          table
        );

        attachTableObserver();
      }

      /*
        Check for a table replacement every 500ms.
        This handles TDX pagination without putting a
        MutationObserver on the entire document.
      */

      tableMonitorTimer =
        setInterval(
          () => {

            const current =
              findUnclaimedTable();

            if (
              current !==
              lastTable
            ) {

              pageGeneration++;

              lastTable =
                current;

              pageSignature =
                '';

              statusQueue.splice(
                0,
                statusQueue.length
              );

              activityQueue.splice(
                0,
                activityQueue.length
              );

              queuedStatus.clear();
              queuedActivity.clear();

              visibleTickets.clear();

              if (
                tableObserver
              ) {

                tableObserver.disconnect();

                tableObserver =
                  null;
              }

              if (current) {

                processTable(
                  current
                );

                attachTableObserver();
              }

              return;
            }

            if (!current) {
              return;
            }

            /*
              Detect pagination when TDX keeps the
              same actual table element.
            */

            const ids =
              qa(
                'tbody tr',
                current
              )
                .map(
                  getTicketId
                )
                .filter(Boolean)
                .join('|');

            if (
              ids !==
              pageSignature
            ) {

              scheduleScan(
                20
              );

            } else if (
              Date.now() -
                lastRepairAt >
                2000 &&
              columnsMisaligned(
                current
              )
            ) {

              /*
                Same rows, but TDX re-rendered part of the table
                and header/body columns drifted apart.
              */

              lastRepairAt =
                Date.now();

              scheduleScan(
                20
              );
            }

          },
          500
        );

      /*
        ACTIVITY REFRESH:
        five minutes.
      */

      setInterval(
        () => {

          const current =
            findUnclaimedTable();

          if (!current) {
            return;
          }

          qa(
            'tbody tr',
            current
          )
            .map(
              getTicketId
            )
            .filter(Boolean)
            .forEach(
              ticket => {

                visibleTickets.add(
                  ticket
                );

                if (
                  activityCache[
                    ticket
                  ]
                ) {

                  activityCache[
                    ticket
                  ].checkedAt =
                    0;
                }
              }
            );

          processTable(
            current,
            true
          );

        },
        CONFIG.activityRefreshMs
      );
    }

    initMain();

    // =======================================================
    // DEBUG / MANUAL CONTROLS
    // =======================================================

    window.SD =
      Object.assign(
        window.SD || {},
        {

          /*
            Immediately refresh Activity.
          */

          feedRefresh:
            () =>
              processTable(
                findUnclaimedTable(),
                true
              ),

          /*
            Immediately refresh Status.
          */

          statusRefresh:
            () => {

              const table =
                findUnclaimedTable();

              if (!table) {
                return;
              }

              qa(
                'tbody tr',
                table
              )
                .map(
                  row => ({
                    id:
                      getTicketId(row),

                    link:
                      getTicketLink(row)
                  })
                )
                .filter(
                  item =>
                    !!item.id
                )
                .forEach(
                  item => {

                    statusCache.delete(
                      item.id
                    );

                    enqueueStatus(
                      item.id,
                      item.link?.href ||
                        `/TDNext/Apps/278/Tickets/TicketDet.aspx?TicketID=${
                          encodeURIComponent(
                            item.id
                          )
                        }`
                    );
                  }
                );

              pumpStatusQueue();
            },

          /*
            Mark Activity as seen.
          */

          feedMarkSeen:
            id =>
              markActivitySeen(
                String(id)
              ),

          /*
            Clear Activity baseline.
          */

          feedClearSeen:
            id => {

              if (
                id == null
              ) {

                seen = {};

              } else {

                delete seen[
                  String(id)
                ];
              }

              saveSeen();

              processTable(
                findUnclaimedTable()
              );
            },

          /*
            Clear the session's cached statuses.
          */

          statusClearCache:
            () => {

              statusCache.clear();

              try {
                sessionStorage.removeItem(
                  CONFIG.statusStorageKey
                );
              } catch {}

              const table =
                findUnclaimedTable();

              if (table) {
                processTable(
                  table
                );
              }
            },

          /*
            Diagnostics.
          */

          trackerState:
            () => ({
              pageGeneration,

              pageSignature,

              visible:
                Array.from(
                  visibleTickets
                ),

              statusActive:
                activeStatus,

              activityActive:
                activeActivity,

              statusQueued:
                Array.from(
                  queuedStatus
                ),

              activityQueued:
                Array.from(
                  queuedActivity
                ),

              statusCached:
                statusCache.size,

              activityCached:
                Object.keys(
                  activityCache
                ).length,

              seen:
                Object.keys(
                  seen
                ).length
            })
        }
      );

    log(
      'TDX enhancements active: Status optimized, Due removed, Activity refresh = 5 minutes, new-ticket alert disabled.'
    );
  }

})();
