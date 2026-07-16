// Validates that all game banner image URLs are accessible,
// and that each game's bannerImageUrl in the database matches
// the bannerImageUrl in its cgs.json (fetched via autoUpdateUrl).
// Usage: node validate-games.js

// Using native fetch API available in Node.js 18+.

const TIMEOUT = 30000; // 30 seconds
const RETRY_DELAY = 1000; // 1 second

async function main() {
  console.log('🔍 Fetching games from https://cgs.games/api/games...');
  let games;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
    const gamesRes = await fetch('https://cgs.games/api/games', {
      method: 'GET',
      headers: { 'User-Agent': 'CGS-Games-Banner-Validator/1.0' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    if (!gamesRes.ok) {
      console.error(`❌ Failed to fetch games from API (HTTP ${gamesRes.status})`);
      process.exit(1);
    }
    games = await gamesRes.json();
  } catch (err) {
    console.error('❌ Failed to fetch games from API:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(games)) {
    console.error('❌ API response is not an array');
    process.exit(1);
  }

  console.log(`📊 Found ${games.length} games to validate`);
  if (games.length === 0) {
    console.log('⚠️  No games found to validate');
    return;
  }

  let failures = [];
  let successCount = 0;

  function gameLabel(game) {
    return `${game.name || 'Unknown'} (${game.username || 'Unknown'}/${game.slug || 'Unknown'})`;
  }

  async function fetchWithRetry(url, options) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: { 'User-Agent': 'CGS-Games-Banner-Validator/1.0' },
        }).finally(() => clearTimeout(timeoutId));
        if (response.ok) {
          return { response };
        }
        lastError = `HTTP ${response.status} ${response.statusText}`;
      } catch (error) {
        if (error.name === 'AbortError') {
          lastError = `Request timeout (>${TIMEOUT / 1000}s)`;
        } else {
          lastError = error.message;
        }
      }
      if (attempt < 3) {
        console.log(`   ⏳ Retry ${attempt} failed for ${url}, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
    return { error: lastError };
  }

  async function validateBannerUrl(game) {
    if (!game.bannerImageUrl) {
      const error = `❌ ${gameLabel(game)} - Missing bannerImageUrl`;
      failures.push(error);
      console.log(error);
      return false;
    }
    const { error } = await fetchWithRetry(game.bannerImageUrl, { method: 'HEAD' });
    if (error) {
      const errorMsg = `❌ ${gameLabel(game)} - ${error}: ${game.bannerImageUrl}`;
      failures.push(errorMsg);
      console.log(errorMsg);
      return false;
    }
    console.log(`   ✅ Banner accessible: ${gameLabel(game)}`);
    return true;
  }

  async function validateCgsJsonMatch(game) {
    if (!game.autoUpdateUrl) {
      const error = `❌ ${gameLabel(game)} - Missing autoUpdateUrl, cannot verify against cgs.json`;
      failures.push(error);
      console.log(error);
      return false;
    }
    const { response, error } = await fetchWithRetry(game.autoUpdateUrl, { method: 'GET' });
    if (error) {
      const errorMsg = `❌ ${gameLabel(game)} - Failed to fetch cgs.json (${error}): ${game.autoUpdateUrl}`;
      failures.push(errorMsg);
      console.log(errorMsg);
      return false;
    }
    let cgsJson;
    try {
      cgsJson = await response.json();
    } catch (err) {
      const errorMsg = `❌ ${gameLabel(game)} - cgs.json is not valid JSON (${err.message}): ${game.autoUpdateUrl}`;
      failures.push(errorMsg);
      console.log(errorMsg);
      return false;
    }
    // The database bannerImageUrl falls back to the card back image when the
    // cgs.json has no banner image, so apply the same fallback here.
    const expectedBannerImageUrl = cgsJson.bannerImageUrl || cgsJson.cardBackImageUrl;
    if (!expectedBannerImageUrl) {
      const errorMsg = `❌ ${gameLabel(game)} - cgs.json has no bannerImageUrl or cardBackImageUrl: ${game.autoUpdateUrl}`;
      failures.push(errorMsg);
      console.log(errorMsg);
      return false;
    }
    if (game.bannerImageUrl !== expectedBannerImageUrl) {
      const errorMsg = `❌ ${gameLabel(game)} - bannerImageUrl mismatch: database has "${game.bannerImageUrl}" but cgs.json has "${expectedBannerImageUrl}"`;
      failures.push(errorMsg);
      console.log(errorMsg);
      return false;
    }
    console.log(`   ✅ Banner matches cgs.json: ${gameLabel(game)}`);
    return true;
  }

  async function validateGame(game) {
    console.log(`🔗 Checking: ${gameLabel(game)}`);
    const bannerOk = await validateBannerUrl(game);
    const matchOk = await validateCgsJsonMatch(game);
    if (bannerOk && matchOk) {
      successCount++;
    }
  }

  async function validateAllGames() {
    console.log('🚀 Starting banner validation...\n');
    const batchSize = 5;
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      await Promise.all(batch.map(validateGame));
      if (i + batchSize < games.length) {
        await new Promise((resolve) => setTimeout(resolve, TIMEOUT));
      }
    }
    console.log(`\n📋 Validation Summary:`);
    console.log(`   ✅ ${successCount} games passed all checks`);
    console.log(`   ❌ ${failures.length} validation failure(s)`);
    if (failures.length > 0) {
      console.log(`\n🚨 Failures:`);
      failures.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure}`);
      });
      console.log(`\n💥 Workflow failed due to ${failures.length} validation failure(s)`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All game banners are accessible and match their cgs.json!`);
    }
  }

  await validateAllGames();
}

main().catch((error) => {
  console.error('❌ Validation failed with unexpected error:', error.message);
  process.exit(1);
});
