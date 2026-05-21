function legacyCopy(writeClipboard: (clipboard: DataTransfer) => void): boolean {
  let copied = false;
  const selection = window.getSelection();
  const previousRanges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
  const host = document.createElement("span");
  host.textContent = "copy";
  host.style.position = "fixed";
  host.style.left = "-9999px";
  document.body.append(host);

  const handleCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    writeClipboard(event.clipboardData);
    copied = true;
  };

  document.addEventListener("copy", handleCopy, { once: true });
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(host);
    selection.addRange(range);
  }

  document.execCommand("copy");
  document.removeEventListener("copy", handleCopy);
  host.remove();
  if (selection) {
    selection.removeAllRanges();
    previousRanges.forEach((range) => selection.addRange(range));
  }
  return copied;
}

export async function copyMarkdown(markdown: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    return legacyCopy((clipboard) => {
      clipboard.setData("text/plain", markdown);
      clipboard.setData("text/markdown", markdown);
    });
  }
}

export async function copyRichText(markdown: string, html: string): Promise<boolean> {
  try {
    if (navigator.clipboard.write && "ClipboardItem" in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([markdown], { type: "text/plain" })
        })
      ]);
      return true;
    }
  } catch {
    // Fall through to the browser copy event path for HTTP/LAN contexts.
  }

  return legacyCopy((clipboard) => {
    clipboard.setData("text/html", html);
    clipboard.setData("text/plain", markdown);
  });
}
