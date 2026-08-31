const fs = require('fs');
const fsp = require('fs/promises');

// Monkey-patch fs.promises.symlink
const originalSymlink = fsp.symlink;
fsp.symlink = async function(target, pathStr, type) {
  try {
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) {
      await fsp.cp(target, pathStr, { recursive: true });
    } else {
      await fsp.copyFile(target, pathStr);
    }
  } catch (e) {
    console.log("Fallback copy failed, trying original symlink", e);
    return originalSymlink(target, pathStr, type);
  }
};

// Monkey-patch fs.symlink
const origSymlinkCb = fs.symlink;
fs.symlink = function(target, pathStr, typeOrCallback, maybeCallback) {
  let cb = typeof typeOrCallback === 'function' ? typeOrCallback : maybeCallback;
  fs.stat(target, (err, stat) => {
    if (err) {
      origSymlinkCb(target, pathStr, typeOrCallback, maybeCallback);
      return;
    }
    if (stat.isDirectory()) {
      fs.cp(target, pathStr, { recursive: true }, (err) => {
        if (err) return origSymlinkCb(target, pathStr, typeOrCallback, maybeCallback);
        if (cb) cb();
      });
    } else {
      fs.copyFile(target, pathStr, (err) => {
        if (err) return origSymlinkCb(target, pathStr, typeOrCallback, maybeCallback);
        if (cb) cb();
      });
    }
  });
};

console.log("Symlink monkey-patch active. Running Firebase CLI...");
require('firebase-tools/lib/bin/firebase');
