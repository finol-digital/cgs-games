export default interface Game {
  id: string;
  username: string;
  slug: string;
  name: string;
  bannerImageUrl: string;
  autoUpdateUrl: string;
  copyright: string;
  uploadedAt: Date;
}
