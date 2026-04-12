import JSZip from 'jszip';
import {
  getFileExtension,
  getPublicUrl,
  isAllowedFile,
  locateCgsJson,
  rewriteCgsJsonUrls,
  validateCgsJson,
} from '@/lib/cgsZipUtils';
import { CgsJson } from '@/lib/cgsZipUtils';

describe('cgsZipUtils', () => {
  describe('getFileExtension', () => {
    it('should return the extension for a normal filename', () => {
      expect(getFileExtension('image.png')).toBe('.png');
    });

    it('should return lowercase extension', () => {
      expect(getFileExtension('Image.PNG')).toBe('.png');
    });

    it('should handle files with multiple dots', () => {
      expect(getFileExtension('my.game.cgs.json')).toBe('.json');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('Makefile')).toBe('');
    });
  });

  describe('isAllowedFile', () => {
    it('should allow .json files', () => {
      expect(isAllowedFile('cgs.json')).toBe(true);
    });

    it('should allow .png files', () => {
      expect(isAllowedFile('Banner.png')).toBe(true);
    });

    it('should allow .jpg files', () => {
      expect(isAllowedFile('card.jpg')).toBe(true);
    });

    it('should allow .txt files', () => {
      expect(isAllowedFile('deck.txt')).toBe(true);
    });

    it('should allow .dec files', () => {
      expect(isAllowedFile('mydeck.dec')).toBe(true);
    });

    it('should allow .ydk files', () => {
      expect(isAllowedFile('deck.ydk')).toBe(true);
    });

    it('should allow .hsd files', () => {
      expect(isAllowedFile('deck.hsd')).toBe(true);
    });

    it('should allow .lor files', () => {
      expect(isAllowedFile('deck.lor')).toBe(true);
    });

    it('should allow .gif files', () => {
      expect(isAllowedFile('animation.gif')).toBe(true);
    });

    it('should allow .webp files', () => {
      expect(isAllowedFile('image.webp')).toBe(true);
    });

    it('should reject .exe files', () => {
      expect(isAllowedFile('malware.exe')).toBe(false);
    });

    it('should reject .dll files', () => {
      expect(isAllowedFile('library.dll')).toBe(false);
    });

    it('should reject .sh files', () => {
      expect(isAllowedFile('script.sh')).toBe(false);
    });

    it('should reject hidden files', () => {
      expect(isAllowedFile('.gitignore')).toBe(false);
    });

    it('should reject hidden files in subdirectories', () => {
      expect(isAllowedFile('sets/.hidden.png')).toBe(false);
    });

    it('should reject directory entries', () => {
      expect(isAllowedFile('sets/')).toBe(false);
    });

    it('should reject files with no extension', () => {
      expect(isAllowedFile('Makefile')).toBe(false);
    });
  });

  describe('getPublicUrl', () => {
    it('should generate a valid Firebase Storage public URL', () => {
      const url = getPublicUrl('my-bucket.appspot.com', 'games/uid/slug/cgs.json');
      expect(url).toBe(
        'https://firebasestorage.googleapis.com/v0/b/my-bucket.appspot.com/o/games%2Fuid%2Fslug%2Fcgs.json?alt=media',
      );
    });

    it('should encode special characters in file path', () => {
      const url = getPublicUrl('bucket', 'games/uid/my game/file name.png');
      expect(url).toContain(encodeURIComponent('games/uid/my game/file name.png'));
    });
  });

  describe('locateCgsJson', () => {
    it('should find cgs.json at root level', async () => {
      const zip = new JSZip();
      zip.file('cgs.json', JSON.stringify({ name: 'Test Game' }));
      zip.file('Banner.png', 'fake-image-data');

      const result = locateCgsJson(zip);
      expect(result).not.toBeNull();
      expect(result!.gameRoot).toBe('');

      const content = await result!.cgsJsonFile.async('string');
      expect(JSON.parse(content).name).toBe('Test Game');
    });

    it('should find cgs.json inside a single top-level directory', async () => {
      const zip = new JSZip();
      zip.file('MyGame/cgs.json', JSON.stringify({ name: 'My Game' }));
      zip.file('MyGame/Banner.png', 'fake-image-data');

      const result = locateCgsJson(zip);
      expect(result).not.toBeNull();
      expect(result!.gameRoot).toBe('MyGame');

      const content = await result!.cgsJsonFile.async('string');
      expect(JSON.parse(content).name).toBe('My Game');
    });

    it('should return null when cgs.json is missing', () => {
      const zip = new JSZip();
      zip.file('README.md', 'Hello');
      zip.file('Banner.png', 'fake-image-data');

      const result = locateCgsJson(zip);
      expect(result).toBeNull();
    });

    it('should return null when multiple top-level dirs and no root cgs.json', () => {
      const zip = new JSZip();
      zip.file('dir1/cgs.json', JSON.stringify({ name: 'Game1' }));
      zip.file('dir2/other.json', '{}');

      const result = locateCgsJson(zip);
      expect(result).toBeNull();
    });
  });

  describe('validateCgsJson', () => {
    it('should return null for valid cgs.json', () => {
      expect(validateCgsJson({ name: 'Test Game' })).toBeNull();
    });

    it('should return error for missing name field', () => {
      expect(validateCgsJson({ copyright: 'Someone' })).toBe(
        "Invalid cgs.json: missing required 'name' field",
      );
    });

    it('should return error for empty name', () => {
      expect(validateCgsJson({ name: '' })).toBe("Invalid cgs.json: missing required 'name' field");
    });

    it('should return error for non-string name', () => {
      expect(validateCgsJson({ name: 123 })).toBe(
        "Invalid cgs.json: missing required 'name' field",
      );
    });

    it('should return error for null input', () => {
      expect(validateCgsJson(null)).toBe('Invalid cgs.json: not valid JSON');
    });

    it('should return error for non-object input', () => {
      expect(validateCgsJson('string')).toBe('Invalid cgs.json: not valid JSON');
    });
  });

  describe('rewriteCgsJsonUrls', () => {
    const bucketName = 'test-bucket.appspot.com';
    const storageBasePath = 'games/uid123/test_game';
    const username = 'testuser';
    const slug = 'test_game';

    function createTestZip(files: Record<string, string>, gameRoot = ''): JSZip {
      const zip = new JSZip();
      for (const [path, content] of Object.entries(files)) {
        const fullPath = gameRoot ? `${gameRoot}/${path}` : path;
        zip.file(fullPath, content);
      }
      return zip;
    }

    it('should set autoUpdateUrl to stored cgs.json URL', () => {
      const zip = createTestZip({ 'cgs.json': '{}' });
      const cgsJson: CgsJson = { name: 'Test Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.autoUpdateUrl).toContain('cgs.json');
      expect(result.autoUpdateUrl).toContain(bucketName);
      expect(result.autoUpdateUrl).toContain('alt=media');
    });

    it('should set cgsGamesLink to game page URL', () => {
      const zip = createTestZip({ 'cgs.json': '{}' });
      const cgsJson: CgsJson = { name: 'Test Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.cgsGamesLink).toBe('https://cgs.games/testuser/test_game');
    });

    it('should rewrite bannerImageUrl when Banner.png exists', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'Banner.png': 'fake-image',
      });
      const cgsJson: CgsJson = {
        name: 'Test Game',
        bannerImageUrl: 'https://old-url.com/banner.png',
      };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.bannerImageUrl).toContain('Banner.png');
      expect(result.bannerImageUrl).toContain(bucketName);
    });

    it('should not rewrite bannerImageUrl when Banner file does not exist', () => {
      const zip = createTestZip({ 'cgs.json': '{}' });
      const cgsJson: CgsJson = {
        name: 'Test Game',
        bannerImageUrl: 'https://old-url.com/banner.png',
      };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.bannerImageUrl).toBe('https://old-url.com/banner.png');
    });

    it('should rewrite allCardsUrl when AllCards.json exists', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'AllCards.json': '[]',
      });
      const cgsJson: CgsJson = { name: 'Test Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.allCardsUrl).toContain('AllCards.json');
      expect(result.allCardsUrl).toContain(bucketName);
    });

    it('should rewrite allSetsUrl when AllSets.json exists', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'AllSets.json': '[]',
      });
      const cgsJson: CgsJson = { name: 'Test Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.allSetsUrl).toContain('AllSets.json');
    });

    it('should rewrite allDecksUrl when AllDecks.json exists', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'AllDecks.json': '[]',
      });
      const cgsJson: CgsJson = { name: 'Test Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.allDecksUrl).toContain('AllDecks.json');
    });

    it('should rewrite cardImageUrl when sets directory exists', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'sets/StarterSet/card1.png': 'fake-image',
      });
      const cgsJson: CgsJson = { name: 'Test Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.cardImageUrl).toContain('{cardSet}');
      expect(result.cardImageUrl).toContain('{cardId}');
      expect(result.cardImageUrl).toContain('.png');
      expect(result.cardImageUrl).toContain(bucketName);
    });

    it('should rewrite gameBoardUrls when board files exist', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'boards/mainboard.png': 'fake-image',
      });
      const cgsJson: CgsJson = {
        name: 'Test Game',
        gameBoardUrls: [{ id: 'mainboard', url: 'https://old.com/board.png' }],
      };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.gameBoardUrls![0].url).toContain('mainboard.png');
      expect(result.gameBoardUrls![0].url).toContain(bucketName);
    });

    it('should rewrite deckUrls when deck files exist', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'decks/StarterDeck.txt': 'deck contents',
      });
      const cgsJson: CgsJson = {
        name: 'Test Game',
        deckUrls: [{ name: 'StarterDeck', url: 'https://old.com/deck.txt' }],
      };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.deckUrls![0].url).toContain('StarterDeck.txt');
    });

    it('should rewrite cardBackFaceImageUrls when back files exist', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'backs/alt_back.png': 'fake-image',
      });
      const cgsJson: CgsJson = {
        name: 'Test Game',
        cardBackFaceImageUrls: [{ id: 'alt_back', url: 'https://old.com/back.png' }],
      };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.cardBackFaceImageUrls![0].url).toContain('alt_back.png');
    });

    it('should handle gameRoot correctly for nested zip structure', () => {
      const zip = createTestZip(
        {
          'cgs.json': '{}',
          'Banner.png': 'fake-image',
          'AllCards.json': '[]',
        },
        'MyGame',
      );
      const cgsJson: CgsJson = { name: 'My Game' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        'MyGame',
      );

      expect(result.bannerImageUrl).toContain('Banner.png');
      expect(result.allCardsUrl).toContain('AllCards.json');
    });

    it('should use custom bannerImageFileType', () => {
      const zip = createTestZip({
        'cgs.json': '{}',
        'Banner.jpg': 'fake-image',
      });
      const cgsJson: CgsJson = { name: 'Test Game', bannerImageFileType: 'jpg' };

      const result = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        '',
      );

      expect(result.bannerImageUrl).toContain('Banner.jpg');
    });
  });
});
