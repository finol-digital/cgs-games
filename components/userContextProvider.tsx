'use client';

import React from 'react';

import { UserContext } from '@/lib/context';
import { useUserData } from '@/lib/hooks';

export default function UserContextProvider({ children }: { children: React.ReactNode }) {
  const userData = useUserData();
  return <UserContext.Provider value={userData}>{children}</UserContext.Provider>;
}
