"use client";

import { useEffect } from "react";

export const COMMON_IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.avif,.gif,.heic,.heif,.tif,.tiff,.svg";

function broadenImageInputs(root: ParentNode) {
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type="file"][accept*="image"], input[type="file"][accept*=".svg"]')) {
    input.accept = COMMON_IMAGE_ACCEPT;
  }
}

export function ImageInputCompatibility() {
  useEffect(() => {
    broadenImageInputs(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) broadenImageInputs(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
