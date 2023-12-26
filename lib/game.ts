import firebase from "firebase/compat/app";

interface Game {
  username: string;
  slug: string;
  name: string;
  bannerImageUrl: string;
  autoUpdateUrl: string;
  copyright: string;
  uploadedAt: firebase.firestore.Timestamp;
}
