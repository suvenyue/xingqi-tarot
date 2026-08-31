import { headers } from 'next/headers';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get('oai-authenticated-user-id');
  const email = requestHeaders.get('oai-authenticated-user-email');
  if (!userId || !email) return null;

  const encodedName = requestHeaders.get('oai-authenticated-user-full-name');
  const encoding = requestHeaders.get('oai-authenticated-user-full-name-encoding');
  let fullName: string | null = null;
  if (encodedName && encoding === 'percent-encoded-utf-8') {
    try {
      fullName = decodeURIComponent(encodedName);
    } catch {
      fullName = null;
    }
  }

  return { userId, email, fullName, displayName: fullName || email };
}

export function chatGPTSignInPath(returnTo = '/') {
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = '/') {
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/signout-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}
