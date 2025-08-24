const { normalize } = require('./normalize');

/**
 * Validate caption + hashtags against a policy.
 * @param {string} caption
 * @param {string[]} hashtags - lowercased with '#' prefix
 * @param {object} policy
 * @returns {{passed: boolean, reasons: string[], details: object}}
 */
function validateCaptionHashtags(caption, hashtags, policy) {
  const reasons = [];
  const cap = normalize(caption || '');
  const tags = (hashtags || []).map(h => h.toLowerCase());

  // 1. Required phrases (must include ALL)
  if (policy.requiredPhrases?.length) {
    const missing = policy.requiredPhrases.filter(
      phrase => !cap.includes(phrase.toLowerCase())
    );
    if (missing.length > 0) {
      reasons.push(`Missing required phrases: ${missing.join(', ')}`);
    }
  }

  // 2. Forbidden words
  if (policy.forbiddenWords?.length) {
    const found = policy.forbiddenWords.filter(
      word => cap.includes(word.toLowerCase())
    );
    if (found.length > 0) {
      reasons.push(`Caption contains forbidden words: ${found.join(', ')}`);
    }
  }

  // 3. Disclosure tags (must include at least one)
  if (policy.disclosureTags?.length) {
    const hasDisclosure = policy.disclosureTags.some(tag =>
      cap.includes(tag.toLowerCase())
    );
    if (!hasDisclosure) {
      reasons.push(
        `Caption missing disclosure tag (one of: ${policy.disclosureTags.join(', ')})`
      );
    }
  }

  // 4. Caption length
  if (policy.captionLengthLimit) {
    if (cap.length > policy.captionLengthLimit) {
      reasons.push(
        `Caption length ${cap.length} exceeds limit of ${policy.captionLengthLimit}`
      );
    }
  }

  // 5. Hashtag whitelist
  if (policy.hashtagWhitelist?.length) {
    const outside = tags.filter(t => !policy.hashtagWhitelist.includes(t));
    if (outside.length > 0) {
      reasons.push(`Hashtags outside whitelist: ${outside.join(', ')}`);
    }
  }

  // 6. Hashtag blacklist
  if (policy.hashtagBlacklist?.length) {
    const bad = tags.filter(t => policy.hashtagBlacklist.includes(t));
    if (bad.length > 0) {
      reasons.push(`Blacklisted hashtags found: ${bad.join(', ')}`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    details: {
      captionLength: cap.length,
      hashtags: tags
    }
  };
}

module.exports = { validateCaptionHashtags };
