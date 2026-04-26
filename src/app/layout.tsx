import Script from "next/script";

// The [locale]/layout.tsx owns <html> and <body>. This root layout exists
// only to register a beforeInteractive script that strips DOM attributes
// injected by browser extensions (Bitdefender `bis_*`, LastPass / Grammarly
// `__processed_<uuid>__`) BEFORE React starts hydration. Otherwise the
// extension's injections race React's hydration check and trigger a
// hydration-mismatch warning we can't patch up after the fact.
//
// `beforeInteractive` works only when declared from the root layout.

const EXT_ATTR_STRIP = `(function () {
  try {
    var re = /^(bis_|__processed_)/;
    function clean(el) {
      if (!el || !el.attributes) return;
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        if (re.test(el.attributes[i].name)) el.removeAttribute(el.attributes[i].name);
      }
    }
    function sweep(root) {
      clean(root);
      if (root.querySelectorAll) root.querySelectorAll("*").forEach(clean);
    }
    function boot() {
      sweep(document.documentElement);
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.type === "attributes" && re.test(r.attributeName)) {
            r.target.removeAttribute(r.attributeName);
          } else if (r.type === "childList") {
            r.addedNodes.forEach(function (n) {
              if (n.nodeType === 1) sweep(n);
            });
          }
        }
      }).observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  } catch (_) {}
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="ext-attr-strip"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: EXT_ATTR_STRIP }}
      />
      {children}
    </>
  );
}
