/**
 * DoorViz Pro — embeddable popup widget.
 *
 * One-line install (paste before </body>):
 *   <script src="https://YOUR-APP/embed.js" data-slug="your-company" defer></script>
 *
 * Behaviour:
 *   - Attaches a click handler to any element with [data-doorviz] on the page.
 *   - If no such element exists, injects a floating "Visualize My Door" button.
 *   - Clicking opens a modal containing the branded visualizer in an <iframe>
 *     (camera access granted so customers can use their phone photos).
 *
 * Optional attributes on the <script> tag:
 *   data-slug   (required) the company's vanity slug or id
 *   data-label  button text          (default "Visualize My Door")
 *   data-color  button/accent color  (default "#FF7716")
 *   data-float  "false" to disable the auto-injected floating button
 */
(function () {
  "use strict";

  // Resolve the script tag and the origin it was served from.
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  if (!script) return;

  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    origin = "";
  }

  var slug = script.getAttribute("data-slug");
  if (!slug) {
    console.error("[DoorViz] embed.js is missing the data-slug attribute.");
    return;
  }

  var WIDGET_ID = "doorviz-embed-" + slug;
  if (document.getElementById(WIDGET_ID)) return; // already initialised

  var label = script.getAttribute("data-label") || "Visualize My Door";
  var color = script.getAttribute("data-color") || "#FF7716";
  var enableFloat = script.getAttribute("data-float") !== "false";
  var visualizerUrl = origin + "/v/" + encodeURIComponent(slug);

  var overlay = null;

  function openModal() {
    if (overlay) {
      overlay.style.display = "flex";
      document.documentElement.style.overflow = "hidden";
      return;
    }

    overlay = document.createElement("div");
    overlay.id = WIDGET_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = [
      "position:fixed", "inset:0", "z-index:2147483647",
      "background:rgba(2,6,23,0.72)", "backdrop-filter:blur(4px)",
      "-webkit-backdrop-filter:blur(4px)",
      "display:flex", "align-items:center", "justify-content:center",
      "padding:12px", "box-sizing:border-box",
      "opacity:0", "transition:opacity .2s ease",
    ].join(";");

    var frameWrap = document.createElement("div");
    frameWrap.style.cssText = [
      "position:relative", "width:100%", "max-width:1500px",
      "height:96vh", "background:#0a0a0a", "border-radius:16px",
      "overflow:hidden", "box-shadow:0 25px 80px rgba(0,0,0,.6)",
      "transform:translateY(12px) scale(.99)", "transition:transform .2s ease",
    ].join(";");

    var iframe = document.createElement("iframe");
    iframe.src = visualizerUrl;
    iframe.allow = "camera; clipboard-write";
    iframe.setAttribute("title", "Garage Door Visualizer");
    iframe.style.cssText =
      "width:100%;height:100%;border:0;display:block;background:#0a0a0a;";

    var close = document.createElement("button");
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";
    close.style.cssText = [
      "position:absolute", "top:10px", "right:12px", "z-index:2",
      "width:40px", "height:40px", "border:0", "border-radius:9999px",
      "background:rgba(0,0,0,.55)", "color:#fff", "font-size:26px",
      "line-height:38px", "cursor:pointer", "font-family:system-ui,sans-serif",
    ].join(";");
    close.addEventListener("click", closeModal);

    frameWrap.appendChild(iframe);
    frameWrap.appendChild(close);
    overlay.appendChild(frameWrap);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });

    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    // Trigger the open transition on the next frame.
    requestAnimationFrame(function () {
      overlay.style.opacity = "1";
      frameWrap.style.transform = "translateY(0) scale(1)";
    });
  }

  function closeModal() {
    if (!overlay) return;
    overlay.style.display = "none";
    document.documentElement.style.overflow = "";
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && overlay.style.display !== "none") {
      closeModal();
    }
  });

  // Inject a small, crawlable backlink credit onto the host page itself.
  function addCredit() {
    // Already upgraded / freshly injected — nothing to do.
    if (document.getElementById("seemygd-credit")) return;

    // Self-heal the old pre-rebrand credit. Site owners who pasted the previous
    // static snippet still have <a id="cmygd-credit" href="https://cmygd.com">
    // frozen in their HTML — we can't edit their page, but it still loads this
    // embed.js, so we rewrite that link in place to the new domain. No
    // re-pasting required. Matched narrowly (legacy id, or an anchor that BOTH
    // points at cmygd.com AND names it in its text) so we never touch an
    // unrelated link on the host site.
    var stale = document.getElementById("cmygd-credit");
    if (!stale) {
      var links = document.querySelectorAll('a[href*="cmygd.com"]');
      for (var i = 0; i < links.length; i++) {
        if (/cmygd/i.test(links[i].textContent || "")) {
          stale = links[i];
          break;
        }
      }
    }
    if (stale) {
      stale.id = "seemygd-credit";
      stale.href = "https://seemygd.com";
      if (/cmygd/i.test(stale.textContent || "")) {
        stale.textContent = "Visualizer powered by Seemygd";
      }
      return;
    }

    var a = document.createElement("a");
    a.id = "seemygd-credit";
    a.href = "https://seemygd.com";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Visualizer powered by Seemygd";
    a.style.cssText = [
      "position:fixed", "right:12px", "bottom:6px", "z-index:2147483645",
      "font-size:11px", "line-height:1", "color:#9ca3af",
      "text-decoration:none", "font-family:system-ui,-apple-system,sans-serif",
    ].join(";");
    a.addEventListener("mouseenter", function () {
      a.style.textDecoration = "underline";
    });
    a.addEventListener("mouseleave", function () {
      a.style.textDecoration = "none";
    });
    document.body.appendChild(a);
  }

  function wireTriggers() {
    addCredit();
    var triggers = document.querySelectorAll("[data-doorviz]");
    triggers.forEach(function (el) {
      if (el.getAttribute("data-doorviz-bound")) return;
      el.setAttribute("data-doorviz-bound", "1");
      el.style.cursor = "pointer";
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    });

    if (enableFloat && triggers.length === 0) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.style.cssText = [
        "position:fixed", "right:24px", "bottom:24px", "z-index:2147483646",
        "background:" + color, "color:#fff", "border:0", "cursor:pointer",
        "padding:18px 30px", "border-radius:9999px", "font-size:17px",
        "font-weight:700", "font-family:system-ui,-apple-system,sans-serif",
        "box-shadow:0 12px 36px rgba(0,0,0,.35)", "transition:transform .15s ease",
        "letter-spacing:.2px",
      ].join(";");
      btn.addEventListener("mouseenter", function () {
        btn.style.transform = "translateY(-2px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "translateY(0)";
      });
      btn.addEventListener("click", openModal);
      document.body.appendChild(btn);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireTriggers);
  } else {
    wireTriggers();
  }
})();
