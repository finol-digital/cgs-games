import { getStorage } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase/firebase';

export const storage = getStorage(firebaseApp);
