import { User } from "firebase/auth";
import { createContext } from "react";

interface UserContextType {
  user: User | undefined | null;
  username: string | null;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  username: null,
});
