function normalize(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractHashtags(text) {
  const set = new Set();
  const re = /(^|[\s.,;!?:()"'”“‘’\-_/])#([a-z0-9_\.]+)/gi;
  let m;
  while ((m = re.exec(text || '')) !== null) {
    set.add(`#${m[2].toLowerCase()}`);
  }
  return Array.from(set);
}

module.exports = { normalize, extractHashtags };
