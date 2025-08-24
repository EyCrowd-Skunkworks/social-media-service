const { validateCaptionAndTags } = require('./CaptionValidator');

for (const post of posts.slice(0, 10)) {
  if (!post.img) continue;

  console.log(`[🔍] Analyzing post:\nImage: ${post.img}\nCaption: ${post.caption}`);
  
  const match = await analyzeImageWithTask(post.img, taskDescription);
  const policyViolations = validateCaptionAndTags(post.caption || '');

  results.push({
    ...post,
    match,
    policyViolations
  });
}

