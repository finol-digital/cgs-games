// Validates that all game banner image URLs are accessible
// Usage: node validate-games.js

// Using native fetch API available in Node.js 18+.

async function main() {
  console.log('🔍 Fetching games from https://cgs.games/api/games...');
  let games;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
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

  async function validateBannerUrl(game) {
    try {
      if (!game.bannerImageUrl) {
        const error = `❌ ${game.name || 'Unknown'} (${game.username || 'Unknown'}/${
          game.slug || 'Unknown'
        }) - Missing bannerImageUrl`;
        failures.push(error);
        console.log(error);
        return false;
      }
      console.log(`🔗 Checking: ${game.name} (${game.username}/${game.slug})`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(game.bannerImageUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'CGS-Games-Banner-Validator/1.0' },
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const error = `❌ ${game.name} (${game.username}/${game.slug}) - HTTP ${response.status} ${response.statusText}: ${game.bannerImageUrl}`;
        failures.push(error);
        console.log(error);
        return false;
      } else {
        console.log(`   ✅ Accessible (HTTP ${response.status})`);
        successCount++;
        return true;
      }
    } catch (error) {
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout (>10s)';
      }
      const errorMsg = `❌ ${game.name} (${game.username}/${game.slug}) - ${errorMessage}: ${game.bannerImageUrl}`;
      failures.push(errorMsg);
      console.log(errorMsg);
      return false;
    }
  }

  async function validateAllBanners() {
    console.log('🚀 Starting banner validation...\n');
    const batchSize = 5;
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      await Promise.all(batch.map(validateBannerUrl));
      if (i + batchSize < games.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.log(`\n📋 Validation Summary:`);
    console.log(`   ✅ ${successCount} games have accessible banners`);
    console.log(`   ❌ ${failures.length} games have inaccessible banners`);
    if (failures.length > 0) {
      console.log(`\n🚨 Failed Games:`);
      failures.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure}`);
      });
      console.log(`\n💥 Workflow failed due to ${failures.length} inaccessible banner(s)`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All game banners are accessible!`);
    }
  }

  await validateAllBanners();
}

main().catch((error) => {
  console.error('❌ Validation failed with unexpected error:', error.message);
  process.exit(1);
});
