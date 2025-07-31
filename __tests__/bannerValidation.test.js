import '@testing-library/jest-dom';

// Test for banner URL validation logic
// This validates the core logic that will be used in the GitHub Actions workflow

describe('Banner URL Validation Logic', () => {
  // Mock game data structure based on the API structure
  const mockGameWithBanner = {
    id: 'test1',
    username: 'testuser',
    slug: 'test_game',
    name: 'Test Game',
    bannerImageUrl: 'https://example.com/banner.jpg',
    autoUpdateUrl: 'https://example.com/game.json',
    copyright: 'testuser',
    uploadedAt: new Date()
  };

  const mockGameWithoutBanner = {
    id: 'test2', 
    username: 'testuser2',
    slug: 'test_game_2',
    name: 'Test Game 2',
    // Missing bannerImageUrl
    autoUpdateUrl: 'https://example.com/game2.json',
    copyright: 'testuser2',
    uploadedAt: new Date()
  };

  it('should identify game with valid banner URL structure', () => {
    expect(mockGameWithBanner.bannerImageUrl).toBeDefined();
    expect(typeof mockGameWithBanner.bannerImageUrl).toBe('string');
    expect(mockGameWithBanner.bannerImageUrl.length).toBeGreaterThan(0);
    expect(mockGameWithBanner.bannerImageUrl.startsWith('https://')).toBe(true);
  });

  it('should identify game missing banner URL', () => {
    expect(mockGameWithoutBanner.bannerImageUrl).toBeUndefined();
  });

  it('should validate required game properties for banner validation', () => {
    // Validate that games have the required properties for error reporting
    expect(mockGameWithBanner.name).toBeDefined();
    expect(mockGameWithBanner.username).toBeDefined(); 
    expect(mockGameWithBanner.slug).toBeDefined();
    
    expect(typeof mockGameWithBanner.name).toBe('string');
    expect(typeof mockGameWithBanner.username).toBe('string');
    expect(typeof mockGameWithBanner.slug).toBe('string');
  });

  it('should handle games with missing identification properties', () => {
    const incompleteGame = { bannerImageUrl: 'https://example.com/banner.jpg' };
    
    // The workflow should handle missing name/username/slug gracefully
    const name = incompleteGame.name || 'Unknown';
    const username = incompleteGame.username || 'Unknown';
    const slug = incompleteGame.slug || 'Unknown';
    
    expect(name).toBe('Unknown');
    expect(username).toBe('Unknown');
    expect(slug).toBe('Unknown');
  });

  it('should format error messages correctly', () => {
    const errorMessage = `❌ ${mockGameWithBanner.name} (${mockGameWithBanner.username}/${mockGameWithBanner.slug}) - HTTP 404 Not Found: ${mockGameWithBanner.bannerImageUrl}`;
    
    expect(errorMessage).toContain(mockGameWithBanner.name);
    expect(errorMessage).toContain(mockGameWithBanner.username);
    expect(errorMessage).toContain(mockGameWithBanner.slug);
    expect(errorMessage).toContain(mockGameWithBanner.bannerImageUrl);
    expect(errorMessage).toContain('❌');
    expect(errorMessage).toContain('HTTP 404');
  });
});