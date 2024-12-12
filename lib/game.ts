import firebase from "firebase/compat/app";

export default interface Game {
  username: string;
  slug: string;
  name: string;
  bannerImageUrl: string;
  autoUpdateUrl: string;
  copyright: string;
  uploadedAt: Date;
}
